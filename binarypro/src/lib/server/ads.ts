// Advertising rewards: viewers are paid only from advertiser-funded campaign pools.
import { canCompleteView, canStartView } from '@/lib/domain/ads';
import { isMembershipActive } from './membership';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { accounts } from './accounts';
import { audit } from './audit';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { balanceOf, postTransaction } from './ledger';
import { dayKey } from './time';
import { randomUUID } from 'node:crypto';
import type { Currency } from '@/lib/domain/money';

/** Advertiser deposit into a campaign pool, inside an existing transaction (used by the payment webhook). */
export async function fundCampaignTx(tx: Tx, campaignId: string, amountMinor: bigint, actorId: string | null, reference: string) {
  const campaign = await tx.adCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new DomainError('NOT_FOUND', 'Campaign not found', 404);
  const currency = campaign.currency as Currency;
  await postTransaction(tx, {
    reference,
    type: 'ADVERTISER_FUNDING',
    description: `Advertiser deposit for ${campaign.title}`,
    legs: [
      { ...accounts.cash(currency), direction: 'DEBIT', amountMinor },
      { ...accounts.advertiserPool(campaignId, currency), direction: 'CREDIT', amountMinor },
    ],
  });
  await audit(tx, { action: 'ad.funded', actorId, targetId: campaignId, meta: { amount: amountMinor.toString() } });
  return { campaignId, funded: amountMinor };
}

/** Staff deposit into a campaign pool. */
export async function fundCampaign(campaignId: string, amountMinor: bigint, actorId: string) {
  if (amountMinor <= 0n) throw new DomainError('INVALID_AMOUNT', 'Amount must be positive');
  return db.$transaction((tx) => fundCampaignTx(tx, campaignId, amountMinor, actorId, `ADFUND:${campaignId}:${randomUUID()}`));
}

export async function startAdView(userId: string, campaignId: string, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } });
  if (!isMembershipActive(user.membership, now)) throw new DomainError('MEMBERSHIP_REQUIRED', 'An active membership is required', 403);
  const campaign = await db.adCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new DomainError('NOT_FOUND', 'Campaign not found', 404);
  const today = dayKey(now);
  const [poolBalance, viewsToday, existing] = await Promise.all([
    balanceOf(db, accounts.advertiserPool(campaignId, campaign.currency as Currency).key),
    db.adView.count({ where: { userId, dayKey: today, completedAt: { not: null } } }),
    db.adView.findUnique({ where: { userId_campaignId_dayKey: { userId, campaignId, dayKey: today } } }),
  ]);
  const tier = user.membership!.tier as Tier;
  const check = canStartView({
    campaignStatus: campaign.status,
    poolBalanceMinor: poolBalance,
    rewardMinor: campaign.rewardMinor,
    viewsCompletedToday: viewsToday,
    adViewsPerDay: PLANS[tier].adViewsPerDay,
    alreadyViewedTodayThisCampaign: !!existing,
  });
  if (!check.ok) throw new DomainError('AD_UNAVAILABLE', check.reason, 409);
  const view = await db.adView.create({ data: { userId, campaignId, dayKey: today, startedAt: now } });
  return { viewId: view.id, durationSec: campaign.durationSec, videoUrl: campaign.videoUrl, title: campaign.title };
}

export async function completeAdView(userId: string, viewId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const view = await tx.adView.findUnique({ where: { id: viewId }, include: { campaign: true } });
    if (!view || view.userId !== userId) throw new DomainError('NOT_FOUND', 'View not found', 404);
    const check = canCompleteView(view.startedAt, now, view.campaign.durationSec, view.completedAt);
    if (!check.ok) throw new DomainError('AD_INCOMPLETE', check.reason, 409);
    const currency = view.campaign.currency as Currency;
    const reward = view.campaign.rewardMinor;
    if (reward > 0n) {
      await postTransaction(tx, {
        reference: `ADREWARD:${viewId}`,
        type: 'AD_REWARD',
        description: `Ad reward: ${view.campaign.title}`,
        legs: [
          { ...accounts.advertiserPool(view.campaignId, currency), direction: 'DEBIT', amountMinor: reward },
          { ...accounts.wallet(userId, currency), direction: 'CREDIT', amountMinor: reward },
        ],
      });
    }
    await tx.adView.update({ where: { id: viewId }, data: { completedAt: now, rewardMinor: reward } });
    return { viewId, rewardMinor: reward, currency };
  });
}
