import type { VerificationStatus, VerificationType } from '@prisma/client';
import { db } from '../db';
import { encryptText, keyedHash } from '../crypto';
import { errors } from '../http';
import { getKycProvider, type KycResult } from '../providers/kyc';
import { hasPermission, PERMISSIONS } from '../rbac';
import { bankAccountSchema } from '../validation/schemas';
import { audit } from './audit';
import { notify } from './notifications';
import { checkBankAccountChange, checkSharedBankAccount } from './fraud';
import { randomBytes } from 'node:crypto';

/**
 * Verification workflow for a beneficiary:
 * mobile sign-in (password) -> identity (consent-based) -> address -> bank account -> documents.
 * Provider results are stored as status and reference only. Raw Aadhaar and full account numbers
 * are never stored in plaintext.
 */

export const VERIFICATION_LABELS: Record<VerificationType, string> = {
  IDENTITY: 'Identity',
  ADDRESS: 'Address',
  BANK_ACCOUNT: 'Bank account',
  FINANCIAL_DOCUMENTS: 'Financial documents',
  LOAN_DOCUMENTS: 'Loan documents',
};

export async function verificationSummary(userId: string) {
  const [user, rows, banks] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { mobileVerifiedAt: true } }),
    db.verification.findMany({ where: { userId }, select: { type: true, status: true, verifiedAt: true, failureReason: true, updatedAt: true } }),
    db.bankVerification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, accountHolderName: true, accountLast4: true, ifscCode: true, bankName: true, status: true, isPrimary: true, createdAt: true },
    }),
  ]);
  const byType = new Map(rows.map((r) => [r.type, r]));
  const items = (Object.keys(VERIFICATION_LABELS) as VerificationType[]).map((type) => {
    const r = byType.get(type);
    return {
      type,
      label: VERIFICATION_LABELS[type],
      status: (r?.status ?? 'PENDING') as VerificationStatus,
      verifiedAt: r?.verifiedAt ?? null,
      failureReason: r?.failureReason ?? null,
    };
  });
  return { items, banks };
}

function applyResult(result: KycResult) {
  return {
    status: (result.status === 'VERIFIED' ? 'VERIFIED' : result.status) as VerificationStatus,
    providerRef: result.providerRef,
    failureReason: result.status === 'VERIFIED' ? null : result.reason,
    verifiedAt: result.status === 'VERIFIED' ? new Date() : null,
  };
}

export async function startIdentityVerification(userId: string, consent: boolean, ip?: string | null) {
  if (!consent) throw errors.badRequest('Please give consent to verify your identity.');
  const user = await db.user.findUnique({ where: { id: userId }, select: { fullName: true, status: true } });
  if (!user || user.status !== 'ACTIVE') throw errors.forbidden();

  const result = await getKycProvider().verifyIdentity({
    userRef: userId,
    fullName: user.fullName,
    consentId: `consent_${randomBytes(6).toString('hex')}`,
  });
  const data = applyResult(result);
  await db.verification.upsert({
    where: { userId_type: { userId, type: 'IDENTITY' } },
    update: { ...data, providerName: getKycProvider().name, consentAt: new Date() },
    create: { userId, type: 'IDENTITY', ...data, providerName: getKycProvider().name, consentAt: new Date() },
  });
  await audit({ actorId: userId, action: 'verification.identity', entityType: 'Verification', entityId: userId, metadata: { status: data.status }, ip });
  await notify({ userId, type: 'VERIFICATION_UPDATE', title: 'Identity verification', body: data.status === 'VERIFIED' ? 'Your identity is verified.' : data.failureReason ?? 'We need more information to verify your identity.', link: '/app/beneficiary' });
  return { status: data.status };
}

export async function startAddressVerification(userId: string, ip?: string | null) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, profile: { select: { addressLine: true, pincode: true } } },
  });
  if (!user?.profile?.addressLine || !user.profile.pincode) {
    throw errors.invalidState('Add your address in personal information first.');
  }
  const result = await getKycProvider().verifyAddress({
    userRef: userId,
    fullName: user.fullName,
    addressLine: user.profile.addressLine,
    pincode: user.profile.pincode,
  });
  const data = applyResult(result);
  await db.verification.upsert({
    where: { userId_type: { userId, type: 'ADDRESS' } },
    update: { ...data, providerName: getKycProvider().name },
    create: { userId, type: 'ADDRESS', ...data, providerName: getKycProvider().name },
  });
  await audit({ actorId: userId, action: 'verification.address', entityType: 'Verification', entityId: userId, metadata: { status: data.status }, ip });
  return { status: data.status };
}

export async function submitBankAccount(userId: string, body: unknown, ip?: string | null) {
  const input = bankAccountSchema.parse(body);
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== 'ACTIVE') throw errors.forbidden();

  const accountHash = keyedHash(input.accountNumber, 'bank-account');
  const previous = await db.bankVerification.findFirst({ where: { userId, isPrimary: true }, select: { accountHash: true } });
  const changed = !!previous && previous.accountHash !== accountHash;

  const result = await getKycProvider().verifyBankAccount({
    userRef: userId,
    accountHolderName: input.accountHolderName,
    accountNumber: input.accountNumber,
    ifscCode: input.ifscCode,
  });
  const data = applyResult(result);

  // A changed payout account goes to manual review when a campaign is pending or live.
  const needsReview = changed && (await checkBankAccountChange(userId));
  const bankStatus: VerificationStatus = needsReview && data.status === 'VERIFIED' ? 'UNDER_REVIEW' : data.status;

  const bank = await db.$transaction(async (tx) => {
    await tx.bankVerification.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } });
    const created = await tx.bankVerification.create({
      data: {
        userId,
        accountHolderName: input.accountHolderName,
        accountNumberEncrypted: encryptText(input.accountNumber),
        accountHash,
        accountLast4: input.accountNumber.slice(-4),
        ifscCode: input.ifscCode,
        bankName: input.bankName ?? null,
        status: bankStatus,
        providerRef: data.providerRef,
        isPrimary: true,
        verifiedAt: data.verifiedAt,
        failureReason: data.failureReason,
      },
      select: { id: true, accountLast4: true, status: true },
    });
    await tx.verification.upsert({
      where: { userId_type: { userId, type: 'BANK_ACCOUNT' } },
      update: { status: bankStatus, providerRef: data.providerRef, providerName: getKycProvider().name, verifiedAt: data.verifiedAt, failureReason: data.failureReason },
      create: { userId, type: 'BANK_ACCOUNT', status: bankStatus, providerRef: data.providerRef, providerName: getKycProvider().name, verifiedAt: data.verifiedAt, failureReason: data.failureReason },
    });
    return created;
  });

  await checkSharedBankAccount(userId, accountHash);
  await audit({ actorId: userId, action: 'verification.bank', entityType: 'BankVerification', entityId: bank.id, metadata: { status: bankStatus, changed }, ip });
  await notify({
    userId,
    type: 'VERIFICATION_UPDATE',
    title: 'Bank account',
    body: bankStatus === 'VERIFIED' ? 'Your bank account is verified.' : bankStatus === 'UNDER_REVIEW' ? 'Your new bank account is being reviewed before payouts continue.' : data.failureReason ?? 'Bank verification needs attention.',
    link: '/app/beneficiary',
  });
  return { id: bank.id, status: bankStatus, accountLast4: bank.accountLast4 };
}

/** Staff decision on any verification row. Every decision is recorded as a review. */
export async function reviewVerification(args: {
  actorId: string;
  verificationId: string;
  decision: VerificationStatus;
  note?: string;
  ip?: string | null;
}) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.VERIFICATION_REVIEW))) throw errors.forbidden();
  const v = await db.verification.findUnique({ where: { id: args.verificationId }, select: { id: true, userId: true, type: true } });
  if (!v) throw errors.notFound('Verification');
  if (args.decision !== 'VERIFIED' && !args.note) throw errors.badRequest('Add a note explaining the decision.');

  await db.$transaction([
    db.verificationReview.create({ data: { verificationId: v.id, reviewerId: args.actorId, decision: args.decision, note: args.note ?? null } }),
    db.verification.update({
      where: { id: v.id },
      data: {
        status: args.decision,
        verifiedAt: args.decision === 'VERIFIED' ? new Date() : null,
        failureReason: args.decision === 'VERIFIED' ? null : args.note ?? null,
      },
    }),
  ]);
  if (v.type === 'BANK_ACCOUNT') {
    await db.bankVerification.updateMany({
      where: { userId: v.userId, isPrimary: true },
      data: { status: args.decision, verifiedAt: args.decision === 'VERIFIED' ? new Date() : null },
    });
  }
  await notify({
    userId: v.userId,
    type: 'VERIFICATION_UPDATE',
    title: 'Verification update',
    body: `${VERIFICATION_LABELS[v.type]}: ${args.decision === 'VERIFIED' ? 'verified.' : args.note ?? 'more information needed.'}`,
    link: '/app/beneficiary',
  });
  await audit({ actorId: args.actorId, action: `verification.review.${args.decision.toLowerCase()}`, entityType: 'Verification', entityId: v.id, metadata: { type: v.type }, ip: args.ip });
  return { status: args.decision };
}

/** Masked bank details for display. The full number is never returned. */
export function maskedBank(b: { accountHolderName: string; accountLast4: string; ifscCode: string; bankName: string | null }) {
  return { holder: b.accountHolderName, account: `XXXXXX${b.accountLast4}`, ifsc: b.ifscCode, bank: b.bankName };
}
