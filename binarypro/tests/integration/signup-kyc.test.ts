import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { registerMember, type RegisterInput } from '@/lib/server/auth';
import { decideKyc, openKycDocument } from '@/lib/server/kyc';
import { requestWithdrawal } from '@/lib/server/wallet';
import { postTransaction } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { DomainError } from '@/lib/server/errors';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('aadhaar-masked-scan-bytes')]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('pan-card-bytes')]);

function input(over: Partial<RegisterInput> = {}): RegisterInput {
  return {
    name: 'Asha Kumar',
    email: 'asha@example.com',
    password: 'Sturdy-pass-123',
    phone: '+919876543210',
    referralCode: null,
    sponsorId: null,
    bank: { accountHolder: 'Asha Kumar', bankName: 'State Bank', ifsc: 'SBIN0001234', accountNumber: '123456789012' },
    documents: [
      { kind: 'AADHAAR', buffer: JPG, mime: 'image/jpeg' },
      { kind: 'PAN', buffer: PDF, mime: 'application/pdf' },
    ],
    ...over,
  };
}

describe('sign-up with bank details and identity documents', () => {
  beforeEach(resetDb);

  it('creates a pending member with an encrypted bank account and documents', async () => {
    const user = await registerMember(input());
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.kyc).toBe('PENDING');
    expect(row.kycSubmittedAt).not.toBeNull();
    expect(row.referralCode).toMatch(/^BP[A-Z2-9]{10}$/);
    expect(row.phone).toBe('+919876543210');

    const bank = await db.bankAccount.findUniqueOrThrow({ where: { userId: user.id } });
    expect(bank.accountLast4).toBe('9012');
    expect(bank.accountCipher.includes(Buffer.from('123456789012'))).toBe(false);

    const docs = await db.kycDocument.findMany({ where: { userId: user.id } });
    expect(docs.map((d) => d.kind).sort()).toEqual(['AADHAAR', 'PAN']);
    const aadhaar = docs.find((d) => d.kind === 'AADHAAR')!;
    expect(Buffer.from(aadhaar.ciphertext).includes(JPG)).toBe(false);
    expect(aadhaar.sizeBytes).toBe(JPG.length);

    const membership = await db.membership.findUniqueOrThrow({ where: { userId: user.id } });
    expect(membership.tier).toBe('BASIC');
    await assertLedgerBalanced();
  });

  it('links the new member to the sponsor who owns the referral number', async () => {
    const sponsor = await makeUser({ name: 'Sponsor' });
    const sponsorCode = (await db.user.update({ where: { id: sponsor.id }, data: { referralCode: 'BPSPONSOR01' } })).referralCode;
    const user = await registerMember(input({ referralCode: sponsorCode }));
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).sponsorId).toBe(sponsor.id);
  });

  it('refuses an unknown referral number, a duplicate mobile number, a duplicate email and missing documents', async () => {
    await expect(registerMember(input({ referralCode: 'BPNOSUCHONE' }))).rejects.toMatchObject({ code: 'INVALID_REFERRAL' });
    await registerMember(input());
    await expect(registerMember(input({ email: 'other@example.com' }))).rejects.toMatchObject({ code: 'PHONE_TAKEN' });
    await expect(registerMember(input({ phone: '+919123456780' }))).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    await expect(registerMember(input({
      email: 'nopan@example.com', phone: '+919111111111',
      documents: [{ kind: 'AADHAAR', buffer: JPG, mime: 'image/jpeg' }],
    }))).rejects.toMatchObject({ code: 'DOCUMENTS_REQUIRED' });
    // Nothing is left behind from the refused attempts.
    expect(await db.user.count()).toBe(1);
    expect(await db.bankAccount.count()).toBe(1);
  });

  it('keeps withdrawals locked until an administrator approves identity', async () => {
    const user = await registerMember(input());
    await db.$transaction((tx) => postTransaction(tx, {
      reference: `TEST-FUND:${user.id}`, type: 'TEST_FUND', description: 'Test funding',
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 100_000n },
        { ...accounts.wallet(user.id, 'INR'), direction: 'CREDIT', amountMinor: 100_000n },
      ],
    }));
    await expect(requestWithdrawal(user.id, 'INR', 60_000n)).rejects.toBeInstanceOf(DomainError);

    const admin = await makeUser({ name: 'Reviewer', role: 'ADMIN' });
    await decideKyc(user.id, 'APPROVE', 'Documents match', admin.id);
    const approved = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(approved.kyc).toBe('VERIFIED');
    expect(approved.kycReviewedBy).toBe(admin.id);
    await expect(requestWithdrawal(user.id, 'INR', 60_000n)).resolves.toBeDefined();
    await assertLedgerBalanced();
  });

  it('decides a sign-up once, and records each document view in the audit log', async () => {
    const user = await registerMember(input());
    const reviewer = await makeUser({ name: 'Reviewer', role: 'ADMIN' });

    const doc = await db.kycDocument.findFirstOrThrow({ where: { userId: user.id, kind: 'PAN' } });
    const opened = await openKycDocument(doc.id, reviewer.id);
    expect(opened.bytes.equals(PDF)).toBe(true);
    expect(opened.mime).toBe('application/pdf');
    const views = await db.auditLog.count({ where: { action: 'kyc.document_viewed', actorId: reviewer.id } });
    expect(views).toBe(1);

    await decideKyc(user.id, 'REJECT', 'PAN photo unreadable', reviewer.id);
    await expect(decideKyc(user.id, 'APPROVE', null, reviewer.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).kyc).toBe('REJECTED');
  });
});
