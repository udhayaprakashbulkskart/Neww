import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { resetDatabase, makeUser, makeCampaign } from './helpers';
import { createDonation, decideRefund } from '@/lib/services/donations';
import { handleWebhook } from '@/lib/services/payment-events';
import { mockSignWebhook } from '@/lib/providers/payments/mock';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { clientIp } from '@/lib/http';

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.webhookEvent.deleteMany();
  await db.refund.deleteMany();
  await db.payment.deleteMany();
  await db.donation.deleteMany();
  await db.platformSetting.deleteMany();
});

async function start(donorId: string, campaignId: string, amountPaise: number) {
  return createDonation({
    donorId,
    ip: null,
    body: { campaignId, amountPaise, isAnonymous: false, idempotencyKey: `don_${Math.random().toString(36).slice(2, 12)}` },
  });
}

describe('webhook retries', () => {
  it('applies a retried event after a transient failure instead of dropping it', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d = await start(donor.id, campaign.id, 25_000);
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_retry1', order_id: d.orderId, amount: 25_000, method: 'upi' } } } });
    const sig = mockSignWebhook(body);

    // The first attempt fails inside the settlement transaction, as a transient database error would.
    vi.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('transient'));
    await expect(handleWebhook({ rawBody: body, signature: sig, eventId: 'evt_retry_1', ip: null })).rejects.toThrow('transient');
    expect(await db.webhookEvent.count({ where: { id: 'evt_retry_1' } })).toBe(0);

    // The provider's retry with the same event id is now applied, not treated as a duplicate.
    const retry = await handleWebhook({ rawBody: body, signature: sig, eventId: 'evt_retry_1', ip: null });
    expect(retry.duplicate).toBe(false);
    expect((await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).raisedPaise).toBe(25_000);
  });
});

describe('refunds', () => {
  it('sends a refund once when two approvals race', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const finance = await makeUser({ roles: ['FINANCE_OFFICER'] });
    expect(await hasPermission(finance.id, PERMISSIONS.REFUND_PROCESS)).toBe(true);
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000, raisedPaise: 40_000 });
    const donation = await db.donation.create({
      data: {
        donorId: donor.id, campaignId: campaign.id, amountPaise: 40_000, status: 'SUCCESS', paidAt: new Date(), receiptNumber: 'HTRACE-0001', idempotencyKey: 'race-key-1',
        payment: { create: { provider: 'MOCK', status: 'CAPTURED', amountPaise: 40_000, providerOrderId: 'order_race', providerPaymentId: 'pay_race' } },
      },
    });
    const refund = await db.refund.create({ data: { donationId: donation.id, requesterId: donor.id, amountPaise: 40_000, reason: 'Duplicate payment.' } });

    const results = await Promise.allSettled([
      decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'First approval.' }),
      decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'Second approval.' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toMatch(/already|decided|processing/);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('PROCESSED');
  });

  it('keeps a refund approvable when the gateway call fails, so it can be retried', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const finance = await makeUser({ roles: ['FINANCE_OFFICER'] });
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000, raisedPaise: 40_000 });
    const donation = await db.donation.create({
      data: {
        donorId: donor.id, campaignId: campaign.id, amountPaise: 40_000, status: 'SUCCESS', paidAt: new Date(), receiptNumber: 'HTRACE-0002', idempotencyKey: 'retry-key-1',
        payment: { create: { provider: 'MOCK', status: 'CAPTURED', amountPaise: 40_000, providerOrderId: 'order_retry', providerPaymentId: 'pay_retry' } },
      },
    });
    const refund = await db.refund.create({ data: { donationId: donation.id, requesterId: donor.id, amountPaise: 40_000, reason: 'Duplicate payment.' } });

    const gateway = await import('@/lib/providers/payments');
    vi.spyOn(gateway, 'getPaymentGateway').mockReturnValueOnce({
      name: 'MOCK', isSandbox: true,
      createOrder: async () => { throw new Error('unused'); },
      verifyCheckoutSignature: () => false, verifyWebhookSignature: () => false,
      refund: async () => { throw new Error('provider down'); },
    } as never);
    await expect(decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'Approved.' })).rejects.toThrow(/awaiting approval/);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('REQUESTED');

    const retried = await decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'Retry after outage.' });
    expect(retried.status).toBe('PROCESSED');
  });
});

describe('campaign capacity', () => {
  it('does not accept a donation that would exceed the goal alongside an in-flight checkout', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donorA = await makeUser();
    const donorB = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 100_000 });
    await start(donorA.id, campaign.id, 60_000);
    await expect(start(donorB.id, campaign.id, 60_000)).rejects.toThrow(/being processed/);
  });
});

describe('admin settings are enforced', () => {
  it('pauses donations when maintenance mode is on', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    await db.platformSetting.create({ data: { key: 'maintenance_mode', value: true } });
    await expect(start(donor.id, campaign.id, 10_000)).rejects.toMatchObject({ status: 503 });
  });

  it('uses the admin-set minimum instead of the environment default', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    await db.platformSetting.create({ data: { key: 'donation_min_paise', value: 20_000 } });
    await expect(start(donor.id, campaign.id, 10_000)).rejects.toThrow(/between/);
  });
});

describe('client IP', () => {
  it('uses the proxy-appended address, not a client-supplied leading entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' } });
    expect(clientIp(req)).toBe('203.0.113.9');
  });
});

import { reportCampaign, assertNameUnchangedIfVerified } from '@/lib/services/profile';

describe('campaign reports', () => {
  it('keeps each reporter\'s report, and only de-duplicates the same reporter', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const a = await makeUser();
    const b = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    const first = await reportCampaign(a.id, campaign.id, 'This campaign looks copied from another page.', null);
    const second = await reportCampaign(b.id, campaign.id, 'The photo does not match the story described.', null);
    const again = await reportCampaign(a.id, campaign.id, 'This campaign looks copied from another page.', null);
    expect(second.reportId).not.toBe(first.reportId);
    expect(again.reportId).toBe(first.reportId);
    expect(await db.fraudReport.count({ where: { campaignId: campaign.id, ruleCode: 'USER_REPORT' } })).toBe(2);
  });
});

describe('verified identity', () => {
  it('refuses a name change once identity is verified', async () => {
    const user = await makeUser({ fullName: 'Lakshmi Devi' });
    await db.verification.create({ data: { userId: user.id, type: 'IDENTITY', status: 'VERIFIED', verifiedAt: new Date() } });
    await expect(assertNameUnchangedIfVerified(user.id, 'Lakshmi Ramasamy')).rejects.toThrow(/verified identity/);
    await expect(assertNameUnchangedIfVerified(user.id, 'Lakshmi Devi')).resolves.toBeUndefined();
  });

  it('allows a name change before identity is verified', async () => {
    const user = await makeUser({ fullName: 'Lakshmi Devi' });
    await expect(assertNameUnchangedIfVerified(user.id, 'Lakshmi Ramasamy')).resolves.toBeUndefined();
  });
});
