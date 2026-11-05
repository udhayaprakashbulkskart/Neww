import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { resetDatabase, makeUser, makeCampaign } from './helpers';
import { createDonation, verifyCheckout, recalcCampaign } from '@/lib/services/donations';
import { applyCaptured, handleWebhook } from '@/lib/services/payment-events';
import { mockSignCheckout, mockSignWebhook } from '@/lib/providers/payments/mock';

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  await db.webhookEvent.deleteMany();
  await db.payment.deleteMany();
  await db.donation.deleteMany();
  await db.fraudReport.deleteMany();
});

async function startDonation(args: { donorId: string; campaignId: string; amountPaise: number; key?: string }) {
  return createDonation({
    donorId: args.donorId,
    ip: '203.0.113.7',
    body: {
      campaignId: args.campaignId,
      amountPaise: args.amountPaise,
      isAnonymous: false,
      idempotencyKey: args.key ?? `don_${crypto.randomBytes(6).toString('hex')}`,
    },
  });
}

describe('donation creation', () => {
  it('creates a pending donation and gateway order, without marking money received', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });

    const res = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 50_000 });
    expect(res.status).toBe('PENDING');
    expect(res.orderId).toMatch(/^order_mock_/);

    const donation = await db.donation.findUniqueOrThrow({ where: { id: res.donationId }, include: { payment: true } });
    expect(donation.status).toBe('PENDING');
    expect(donation.payment?.status).toBe('CREATED');
    const fresh = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(fresh.raisedPaise).toBe(0);
  });

  it('is idempotent on the idempotency key: a retry returns the same donation', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    const key = 'don_retrykey123';
    const a = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 20_000, key });
    const b = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 20_000, key });
    expect(b.donationId).toBe(a.donationId);
    expect(await db.donation.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('refuses amounts below the minimum and above the donation cap', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    await expect(startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 100 })).rejects.toThrow(/between/);
    await expect(startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 60_000_000 })).rejects.toThrow(/between/);
  });

  it('refuses donations to campaigns that are not live', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, status: 'UNDER_REVIEW' });
    await expect(startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 10_000 })).rejects.toThrow(/not be found|not found/);
  });

  it('will not accept more than the remaining funding need', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 100_000, raisedPaise: 90_000 });
    await expect(startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 20_000 })).rejects.toThrow(/needs/);
  });

  it('refuses checkout verification for a donation that belongs to someone else', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const other = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 10_000 });
    await expect(
      verifyCheckout({
        donorId: other.id,
        ip: null,
        body: { donationId: d.donationId, razorpay_order_id: d.orderId, razorpay_payment_id: 'pay_x1', razorpay_signature: 'a'.repeat(64) },
      }),
    ).rejects.toThrow(/not be found|not found/);
  });
});

describe('checkout signature', () => {
  it('rejects a forged checkout signature and records nothing as paid', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 10_000 });
    await expect(
      verifyCheckout({
        donorId: donor.id,
        ip: null,
        body: { donationId: d.donationId, razorpay_order_id: d.orderId, razorpay_payment_id: 'pay_forged1', razorpay_signature: 'b'.repeat(64) },
      }),
    ).rejects.toThrow(/could not verify/);
    const payment = await db.payment.findUniqueOrThrow({ where: { donationId: d.donationId } });
    expect(payment.status).toBe('CREATED');
  });

  it('accepts a genuine checkout signature but still does not mark the donation successful', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 10_000 });
    const paymentId = 'pay_genuine01';
    const res = await verifyCheckout({
      donorId: donor.id,
      ip: null,
      body: { donationId: d.donationId, razorpay_order_id: d.orderId, razorpay_payment_id: paymentId, razorpay_signature: mockSignCheckout(d.orderId!, paymentId) },
    });
    expect(res.status).toBe('PENDING');
    expect(res.paymentStatus).toBe('AUTHORIZED');
  });
});

describe('webhook settlement', () => {
  it('credits the campaign exactly once, even when the same capture is delivered twice', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 25_000 });

    await applyCaptured({ orderId: d.orderId!, paymentId: 'pay_once0001', amountPaise: 25_000, method: 'upi' });
    await applyCaptured({ orderId: d.orderId!, paymentId: 'pay_once0001', amountPaise: 25_000, method: 'upi' });

    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(25_000);
    expect(c.donorCount).toBe(1);
    expect(c.fundingPercent).toBe(3);
    const donation = await db.donation.findUniqueOrThrow({ where: { id: d.donationId } });
    expect(donation.status).toBe('SUCCESS');
    expect(donation.receiptNumber).toMatch(/^HT\d{4}-[0-9A-F]{8}$/);
  });

  it('never credits a capture whose amount does not match the order and flags it for review', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 25_000 });

    await applyCaptured({ orderId: d.orderId!, paymentId: 'pay_short001', amountPaise: 1_000, method: 'upi' });

    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(0);
    const donation = await db.donation.findUniqueOrThrow({ where: { id: d.donationId } });
    expect(donation.status).toBe('PENDING');
    const flags = await db.fraudReport.findMany({ where: { ruleCode: 'PAYMENT_AMOUNT_MISMATCH' } });
    expect(flags).toHaveLength(1);
    expect(flags[0].status).toBe('OPEN');
  });

  it('rejects webhooks with a bad signature and records the attempt', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_bad', order_id: 'order_x', amount: 100 } } } });
    await expect(handleWebhook({ rawBody: body, signature: 'deadbeef', eventId: 'evt_bad1', ip: '1.2.3.4' })).rejects.toThrow(/Signature verification failed/);
    await expect(handleWebhook({ rawBody: body, signature: null, eventId: 'evt_bad2', ip: '1.2.3.4' })).rejects.toThrow();
    expect(await db.webhookEvent.count()).toBe(0);
  });

  it('ignores a tampered body even when the attacker reuses a valid signature', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 25_000 });
    const original = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_t1', order_id: d.orderId, amount: 25_000, error_code: 'X' } } } });
    const sig = mockSignWebhook(original);
    const tampered = original.replace('payment.failed', 'payment.captured');
    await expect(handleWebhook({ rawBody: tampered, signature: sig, eventId: 'evt_t1', ip: null })).rejects.toThrow();
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(0);
  });

  it('processes a signed capture event end to end and then treats a replay as a duplicate', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 30_000 });
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_e2e0001', order_id: d.orderId, amount: 30_000, method: 'card' } } } });
    const sig = mockSignWebhook(body);

    const first = await handleWebhook({ rawBody: body, signature: sig, eventId: 'evt_e2e_1', ip: null });
    expect(first.duplicate).toBe(false);
    const replay = await handleWebhook({ rawBody: body, signature: sig, eventId: 'evt_e2e_1', ip: null });
    expect(replay.duplicate).toBe(true);

    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(30_000);
  });

  it('keeps campaign totals consistent with confirmed donations (recalculation)', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const d1 = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 10_000 });
    const d2 = await startDonation({ donorId: donor.id, campaignId: campaign.id, amountPaise: 15_000 });
    await applyCaptured({ orderId: d1.orderId!, paymentId: 'pay_rc0001', amountPaise: 10_000, method: 'upi' });
    await applyCaptured({ orderId: d2.orderId!, paymentId: 'pay_rc0002', amountPaise: 15_000, method: 'upi' });
    await db.campaign.update({ where: { id: campaign.id }, data: { raisedPaise: 999 } });
    await db.$transaction((tx) => recalcCampaign(tx, campaign.id));
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(25_000);
    expect(c.donorCount).toBe(1);
  });
});
