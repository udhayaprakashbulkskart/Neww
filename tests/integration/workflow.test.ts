import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { resetDatabase, makeUser, makeCampaign } from './helpers';
import { approvalBlockers, reviewCampaign, submitCampaign } from '@/lib/services/campaigns';
import { registerWithPassword, loginWithPassword } from '@/lib/services/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { reviewDocument } from '@/lib/services/documents';
import { reviewVerification } from '@/lib/services/verification';
import { setUserSuspended } from '@/lib/services/admin';
import { getPaymentGateway } from '@/lib/providers/payments';
import { decideRefund } from '@/lib/services/donations';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  await db.adminAuditLog.deleteMany();
  await db.notification.deleteMany();
  await db.fraudReport.deleteMany();
});

/** Fully prepares a beneficiary whose campaign is ready for review. */
async function readyBeneficiary() {
  const ben = await makeUser({ userType: 'BENEFICIARY' });
  const campaign = await makeCampaign({ beneficiaryId: ben.id, status: 'DRAFT' });
  await db.campaign.update({ where: { id: campaign.id }, data: { city: 'Coimbatore', state: 'Tamil Nadu', title: 'Help me clear my shop loan', story: 'x'.repeat(120) } });
  await db.userProfile.update({ where: { userId: ben.id }, data: { addressLine: '12 Gandhipuram Street', city: 'Coimbatore', state: 'TN', pincode: '641001' } });
  await db.verification.createMany({
    data: [
      { userId: ben.id, type: 'IDENTITY', status: 'VERIFIED', verifiedAt: new Date() },
      { userId: ben.id, type: 'ADDRESS', status: 'VERIFIED', verifiedAt: new Date() },
      { userId: ben.id, type: 'BANK_ACCOUNT', status: 'VERIFIED', verifiedAt: new Date() },
    ],
  });
  await db.bankVerification.create({
    data: { userId: ben.id, accountHolderName: ben.fullName, accountNumberEncrypted: 'x', accountHash: 'h'.repeat(64), accountLast4: '1234', ifscCode: 'HDFC0001234', status: 'VERIFIED', isPrimary: true },
  });
  const idDoc = await db.campaignDocument.create({
    data: { campaignId: campaign.id, uploaderId: ben.id, kind: 'IDENTITY', mimeType: 'application/pdf', sizeBytes: 100, storageKey: `t/${campaign.id}/id.bin`, sha256: 'a'.repeat(64), originalNameEncrypted: 'x' },
  });
  const billDoc = await db.campaignDocument.create({
    data: { campaignId: campaign.id, uploaderId: ben.id, kind: 'LOAN_STATEMENT', mimeType: 'application/pdf', sizeBytes: 100, storageKey: `t/${campaign.id}/loan.bin`, sha256: 'b'.repeat(64), originalNameEncrypted: 'x' },
  });
  return { ben, campaign, docs: [idDoc, billDoc] };
}

async function staff(key: string) {
  return makeUser({ roles: [key] });
}

describe('campaign submission and review', () => {
  it('cannot be submitted until every checklist item is complete', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const campaign = await makeCampaign({ beneficiaryId: ben.id, status: 'DRAFT' });
    await expect(submitCampaign(ben.id, campaign.id)).rejects.toThrow(/Complete these before submitting/);
  });

  it('reports every blocker before approval, including unapproved documents', async () => {
    const { campaign } = await readyBeneficiary();
    const blockers = await approvalBlockers(campaign.id);
    expect(blockers.some((b) => b.includes('not approved'))).toBe(true);
    expect(blockers.some((b) => b.includes('bank'))).toBe(false);
  });

  it('refuses approval while documents are still pending', async () => {
    const { campaign } = await readyBeneficiary();
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'UNDER_REVIEW' } });
    const officer = await staff('VERIFICATION_OFFICER');
    await expect(reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'APPROVE' })).rejects.toThrow(/Cannot approve yet/);
  });

  it('approves and publishes once documents are approved, in that order only', async () => {
    const { campaign, docs } = await readyBeneficiary();
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'UNDER_REVIEW' } });
    const officer = await staff('VERIFICATION_OFFICER');
    for (const d of docs) await reviewDocument({ actorId: officer.id, documentId: d.id, decision: 'APPROVED' });

    await expect(reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'PUBLISH' })).rejects.toThrow(/cannot move/i);
    await reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'APPROVE' });
    // Publishing needs the separate publish permission. The verification officer has it.
    await reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'PUBLISH' });
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('PUBLISHED');
    expect(c.publishedAt).not.toBeNull();
  });

  it('blocks review actions for users without the permission', async () => {
    const { campaign } = await readyBeneficiary();
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'UNDER_REVIEW' } });
    const support = await staff('SUPPORT_AGENT');
    await expect(reviewCampaign({ actorId: support.id, campaignId: campaign.id, action: 'APPROVE' })).rejects.toThrow(/permission/);
  });

  it('requires a note when requesting information or rejecting', async () => {
    const { campaign } = await readyBeneficiary();
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'UNDER_REVIEW' } });
    const officer = await staff('VERIFICATION_OFFICER');
    await expect(reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'REQUEST_INFO' })).rejects.toThrow(/Add a note/);
    await reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'REQUEST_INFO', note: 'Please upload a dated loan statement.' });
    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.status).toBe('ADDITIONAL_INFO_REQUIRED');
    expect(c.reviewNote).toContain('dated loan statement');
  });

  it('writes an audit entry for every review decision', async () => {
    const { campaign } = await readyBeneficiary();
    await db.campaign.update({ where: { id: campaign.id }, data: { status: 'PENDING' } });
    const officer = await staff('VERIFICATION_OFFICER');
    await reviewCampaign({ actorId: officer.id, campaignId: campaign.id, action: 'START_REVIEW' });
    const entries = await db.adminAuditLog.findMany({ where: { entityId: campaign.id } });
    expect(entries.map((e) => e.action)).toContain('campaign.start_review');
  });

  it('lets verification officers mark a bank check as verified and notifies the beneficiary', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const v = await db.verification.create({ data: { userId: ben.id, type: 'BANK_ACCOUNT', status: 'UNDER_REVIEW' } });
    const officer = await staff('VERIFICATION_OFFICER');
    await reviewVerification({ actorId: officer.id, verificationId: v.id, decision: 'VERIFIED' });
    expect((await db.verification.findUniqueOrThrow({ where: { id: v.id } })).status).toBe('VERIFIED');
    expect(await db.notification.count({ where: { userId: ben.id } })).toBe(1);
  });
});

describe('role-based access', () => {
  it('grants permissions through roles only', async () => {
    const finance = await staff('FINANCE_OFFICER');
    expect(await hasPermission(finance.id, PERMISSIONS.REFUND_PROCESS)).toBe(true);
    expect(await hasPermission(finance.id, PERMISSIONS.CAMPAIGN_REVIEW)).toBe(false);
    const plain = await makeUser();
    expect(await hasPermission(plain.id, PERMISSIONS.OVERVIEW_VIEW)).toBe(false);
  });

  it('suspension requires USER_SUSPEND and bumps the session version so tokens stop working', async () => {
    const target = await makeUser();
    const before = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    const fraud = await staff('FRAUD_ANALYST');
    await expect(setUserSuspended({ actorId: fraud.id, userId: target.id, suspended: true, reason: 'Investigation pending review.' })).rejects.toThrow(/permission/);

    const superAdmin = await staff('SUPER_ADMIN');
    await setUserSuspended({ actorId: superAdmin.id, userId: target.id, suspended: true, reason: 'Confirmed duplicate account abuse.' });
    const after = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.status).toBe('SUSPENDED');
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  });

  it('refuses self-suspension', async () => {
    const admin = await staff('SUPER_ADMIN');
    await expect(setUserSuspended({ actorId: admin.id, userId: admin.id, suspended: true, reason: 'Trying to lock myself out.' })).rejects.toThrow(/own account/);
  });
});

describe('refunds', () => {
  it('approves through the gateway and reverses the money on the campaign once', async () => {
    const ben = await makeUser({ userType: 'BENEFICIARY' });
    const donor = await makeUser();
    const campaign = await makeCampaign({ beneficiaryId: ben.id, requestedPaise: 1_000_000 });
    const donation = await db.donation.create({
      data: {
        donorId: donor.id,
        campaignId: campaign.id,
        amountPaise: 40_000,
        status: 'SUCCESS',
        paidAt: new Date(),
        receiptNumber: 'HTTEST-REFUND1',
        idempotencyKey: 'seed-refund-test-1',
        payment: { create: { provider: 'MOCK', status: 'CAPTURED', amountPaise: 40_000, providerOrderId: 'order_refund_1', providerPaymentId: 'pay_refund_1' } },
      },
    });
    await db.campaign.update({ where: { id: campaign.id }, data: { raisedPaise: 40_000, donorCount: 1 } });
    const refund = await db.refund.create({ data: { donationId: donation.id, requesterId: donor.id, amountPaise: 40_000, reason: 'Donated by mistake.' } });

    const finance = await staff('FINANCE_OFFICER');
    expect(getPaymentGateway().name).toBe('MOCK');
    const res = await decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'Verified duplicate payment.' });
    expect(res.status).toBe('PROCESSED');

    const c = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(c.raisedPaise).toBe(0);
    expect(c.donorCount).toBe(0);
    expect((await db.donation.findUniqueOrThrow({ where: { id: donation.id } })).status).toBe('REFUNDED');

    await expect(decideRefund({ actorId: finance.id, refundId: refund.id, decision: 'APPROVE', note: 'Trying again.' })).rejects.toThrow(/already been decided/);
  });
});

describe('password sign-in', () => {
  const ip = '198.51.100.9';

  it('creates an account and stores only a salted scrypt hash', async () => {
    const mobile = `97${Date.now().toString().slice(-8)}`;
    const user = await registerWithPassword({ mobile, fullName: 'Asha Devi', password: 'Sunshine42', ip });
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain('Sunshine42');
    expect(await verifyPassword('Sunshine42', row.passwordHash)).toBe(true);
    expect(await verifyPassword('sunshine42', row.passwordHash)).toBe(false);
  });

  it('signs in with the right password and refuses the wrong one with a generic message', async () => {
    const mobile = `96${Date.now().toString().slice(-8)}`;
    await registerWithPassword({ mobile, fullName: 'Ravi Kumar', password: 'Blueberry7', ip });
    await expect(loginWithPassword({ mobile, password: 'Blueberry7', ip })).resolves.toMatchObject({ id: expect.any(String) });
    await expect(loginWithPassword({ mobile, password: 'wrong-guess', ip })).rejects.toThrow(/incorrect/);
    await expect(loginWithPassword({ mobile: '9955555555', password: 'anything1', ip })).rejects.toThrow(/incorrect/);
  });

  it('throttles repeated failures on one mobile number', async () => {
    const mobile = `95${Date.now().toString().slice(-8)}`;
    await registerWithPassword({ mobile, fullName: 'Meena Raj', password: 'Orange99x', ip: '198.51.100.11' });
    for (let i = 0; i < 10; i++) {
      await loginWithPassword({ mobile, password: 'nope-nope', ip: '198.51.100.11' }).catch(() => undefined);
    }
    await expect(loginWithPassword({ mobile, password: 'Orange99x', ip: '198.51.100.11' })).rejects.toThrow(/Too many attempts/);
  });

  it('refuses sign-in for suspended accounts even with the right password', async () => {
    const mobile = `94${Date.now().toString().slice(-8)}`;
    const user = await registerWithPassword({ mobile, fullName: 'Kavitha N', password: 'Harbour11', ip: '198.51.100.12' });
    await db.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    await expect(loginWithPassword({ mobile, password: 'Harbour11', ip: '198.51.100.12' })).rejects.toThrow(/suspended/);
  });

  it('hashes and verifies passwords with the parameters stored alongside the hash', async () => {
    const hash = await hashPassword('Correct horse 1');
    expect(hash.split('$')).toHaveLength(6);
    expect(await verifyPassword('Correct horse 1', hash)).toBe(true);
    expect(await verifyPassword('Correct horse 2', hash)).toBe(false);
    expect(await verifyPassword('anything', null)).toBe(false);
  });
});
