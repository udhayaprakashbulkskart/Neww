import type { FraudSource, Severity } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { audit } from './audit';
import { normaliseTitle } from './text';

/**
 * Fraud monitoring.
 *
 * Rules only raise FraudReport rows for human review. They never suspend accounts, freeze money or
 * declare anyone a fraudster. A risk signal is a reason to look, not a finding. Each rule is
 * de-duplicated so repeated triggers do not flood the review queue.
 */

export const FRAUD_RULES = {
  DUPLICATE_DOCUMENT: 'DUPLICATE_DOCUMENT',
  DUPLICATE_CAMPAIGN: 'DUPLICATE_CAMPAIGN',
  REPEATED_CAMPAIGN_ABUSE: 'REPEATED_CAMPAIGN_ABUSE',
  SHARED_BANK_ACCOUNT: 'SHARED_BANK_ACCOUNT',
  BANK_ACCOUNT_CHANGE: 'BANK_ACCOUNT_CHANGE',
  UNUSUAL_DONATION_VOLUME: 'UNUSUAL_DONATION_VOLUME',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
} as const;

export async function raiseFlag(args: {
  ruleCode: string;
  reason: string;
  severity: Severity;
  campaignId?: string | null;
  userId?: string | null;
  evidence?: Record<string, unknown>;
  source?: FraudSource;
  reporterId?: string | null;
}): Promise<string | null> {
  // De-duplicate: one open flag per rule and subject.
  const existing = await db.fraudReport.findFirst({
    where: {
      ruleCode: args.ruleCode,
      status: { in: ['OPEN', 'UNDER_INVESTIGATION'] },
      campaignId: args.campaignId ?? undefined,
      userId: args.userId ?? undefined,
      // A user report is de-duplicated per reporter, so each person's report is kept.
      reporterId: args.reporterId ?? undefined,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.fraudReport.create({
    data: {
      source: args.source ?? 'SYSTEM_RULE',
      ruleCode: args.ruleCode,
      reason: args.reason,
      severity: args.severity,
      campaignId: args.campaignId ?? null,
      userId: args.userId ?? null,
      reporterId: args.reporterId ?? null,
      evidence: (args.evidence ?? {}) as object,
    },
    select: { id: true },
  });
  await audit({
    actorId: null,
    action: 'fraud.flagged',
    entityType: 'FraudReport',
    entityId: created.id,
    metadata: { ruleCode: args.ruleCode, severity: args.severity },
  });
  return created.id;
}

/** Same document bytes used by a different campaign. Common in recycled or forged bills. */
export async function checkDuplicateDocument(campaignId: string, sha256: string): Promise<void> {
  const others = await db.campaignDocument.findMany({
    where: { sha256, campaignId: { not: campaignId } },
    select: { campaignId: true },
    take: 5,
  });
  if (others.length === 0) return;
  await raiseFlag({
    ruleCode: FRAUD_RULES.DUPLICATE_DOCUMENT,
    reason: 'An uploaded document matches a document already used in another campaign.',
    severity: 'HIGH',
    campaignId,
    evidence: { sha256Prefix: sha256.slice(0, 12), otherCampaignIds: others.map((o) => o.campaignId) },
  });
}

/** Near-identical campaigns from different beneficiaries in the same city. */
export async function checkDuplicateCampaign(campaign: { id: string; title: string; city: string; beneficiaryId: string }) {
  const key = normaliseTitle(campaign.title);
  const candidates = await db.campaign.findMany({
    where: {
      id: { not: campaign.id },
      city: { equals: campaign.city, mode: 'insensitive' },
      beneficiaryId: { not: campaign.beneficiaryId },
      status: { notIn: ['DRAFT', 'REJECTED'] },
    },
    select: { id: true, title: true },
    take: 200,
  });
  const dupes = candidates.filter((c) => normaliseTitle(c.title) === key);
  if (dupes.length === 0) return;
  await raiseFlag({
    ruleCode: FRAUD_RULES.DUPLICATE_CAMPAIGN,
    reason: 'A campaign with the same title exists for a different beneficiary in the same city.',
    severity: 'MEDIUM',
    campaignId: campaign.id,
    userId: campaign.beneficiaryId,
    evidence: { matchingCampaignIds: dupes.map((d) => d.id) },
  });
}

/** Many campaigns in a short time, or repeated rejections, by the same beneficiary. */
export async function checkRepeatedCampaigns(userId: string) {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [recent, rejected] = await Promise.all([
    db.campaign.count({ where: { beneficiaryId: userId, createdAt: { gte: since } } }),
    db.campaign.count({ where: { beneficiaryId: userId, status: 'REJECTED' } }),
  ]);
  if (recent >= 4 || rejected >= 2) {
    await raiseFlag({
      ruleCode: FRAUD_RULES.REPEATED_CAMPAIGN_ABUSE,
      reason: `Beneficiary has ${recent} campaigns in 90 days and ${rejected} rejected campaigns.`,
      severity: rejected >= 2 ? 'HIGH' : 'LOW',
      userId,
      evidence: { recent, rejected },
    });
  }
}

/** The same bank account used by more than one beneficiary. */
export async function checkSharedBankAccount(userId: string, accountHash: string) {
  const others = await db.bankVerification.findMany({
    where: { accountHash, userId: { not: userId } },
    select: { userId: true },
    take: 5,
  });
  if (others.length === 0) return;
  await raiseFlag({
    ruleCode: FRAUD_RULES.SHARED_BANK_ACCOUNT,
    reason: 'A bank account is linked to more than one beneficiary profile.',
    severity: 'HIGH',
    userId,
    evidence: { linkedUserCount: others.length + 1 },
  });
}

/** Payout account changed after a campaign went live or was submitted. Requires manual review. */
export async function checkBankAccountChange(userId: string): Promise<boolean> {
  const live = await db.campaign.count({
    where: { beneficiaryId: userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] } },
  });
  if (live === 0) return false;
  await raiseFlag({
    ruleCode: FRAUD_RULES.BANK_ACCOUNT_CHANGE,
    reason: 'Bank account changed while a campaign is pending or live.',
    severity: 'MEDIUM',
    userId,
    evidence: { activeCampaigns: live },
  });
  return true;
}

/** Many donations from one IP in an hour. Possible card testing or bot activity. */
export async function checkDonationVolume(clientIp: string | null, campaignId: string) {
  if (!clientIp) return;
  const since = new Date(Date.now() - 3_600_000);
  const count = await db.donation.count({ where: { clientIp, createdAt: { gte: since } } });
  if (count >= env().FRAUD_DONATIONS_PER_HOUR_PER_IP) {
    await raiseFlag({
      ruleCode: FRAUD_RULES.UNUSUAL_DONATION_VOLUME,
      reason: `${count} donation attempts from one network in the last hour.`,
      severity: 'MEDIUM',
      campaignId,
      evidence: { attemptsLastHour: count },
    });
  }
}

/** Gateway amount differs from what we ordered. Always investigated, never auto-resolved. */
export async function flagAmountMismatch(campaignId: string, donationId: string, expected: number, received: number) {
  await raiseFlag({
    ruleCode: FRAUD_RULES.PAYMENT_AMOUNT_MISMATCH,
    reason: 'Captured payment amount does not match the donation order.',
    severity: 'HIGH',
    campaignId,
    evidence: { donationId, expectedPaise: expected, receivedPaise: received },
  });
}
