// Advertiser accounts: create campaigns (reviewed by staff), top up budgets through the payment gateway,
// and see verified views and spend for their own campaigns only.
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { DomainError } from './errors';
import { balanceOf } from './ledger';
import { accounts } from './accounts';
import { loadRates } from './rates';
import { convertMinor, parseMinor, BASE_CURRENCY, CURRENCIES, type Currency } from '@/lib/domain/money';

export const MAX_CAMPAIGNS_PER_ADVERTISER = 20;
const MAX_REWARD_MINOR = 100_000n; // 1,000.00 per view
const MAX_TOPUP_MINOR = 10_000_000n; // 100,000.00 per top-up

export interface CampaignInput {
  title: string;
  advertiser: string;
  videoUrl: string;
  durationSec: number;
  rewardText: string;
  currency: string;
}

export function validateVideoUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DomainError('INVALID_VIDEO_URL', 'Enter a valid video link', 422);
  }
  if (url.protocol !== 'https:') throw new DomainError('INVALID_VIDEO_URL', 'Video links must use https', 422);
  if (!/\.(mp4|webm)(\?.*)?$/i.test(url.pathname + url.search)) {
    throw new DomainError('INVALID_VIDEO_URL', 'Link must point to an MP4 or WebM video file', 422);
  }
  return url.toString();
}

export async function createOwnCampaign(ownerId: string, input: CampaignInput) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true, status: true } });
  if (owner.role !== 'ADVERTISER' || owner.status !== 'ACTIVE') throw new DomainError('FORBIDDEN', 'Advertiser account required', 403);
  const count = await db.adCampaign.count({ where: { ownerId, status: { in: ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'] } } });
  if (count >= MAX_CAMPAIGNS_PER_ADVERTISER) throw new DomainError('CAMPAIGN_LIMIT', `You can run up to ${MAX_CAMPAIGNS_PER_ADVERTISER} campaigns at once`, 409);
  if (!CURRENCIES.includes(input.currency as Currency)) throw new DomainError('INVALID_CURRENCY', 'Unsupported currency', 422);
  if (!Number.isInteger(input.durationSec) || input.durationSec < 5 || input.durationSec > 600) {
    throw new DomainError('INVALID_DURATION', 'Video length must be between 5 and 600 seconds', 422);
  }
  const reward = parseMinor(input.rewardText);
  if (reward <= 0n || reward > MAX_REWARD_MINOR) throw new DomainError('INVALID_REWARD', 'Reward per view must be between 0.01 and 1,000.00', 422);
  const title = input.title.trim();
  const advertiser = input.advertiser.trim();
  if (title.length < 3 || title.length > 160) throw new DomainError('INVALID_TITLE', 'Title must be 3 to 160 characters', 422);
  if (advertiser.length < 2 || advertiser.length > 120) throw new DomainError('INVALID_ADVERTISER', 'Advertiser name must be 2 to 120 characters', 422);
  const campaign = await db.adCampaign.create({
    data: {
      ownerId,
      advertiser,
      title,
      videoUrl: validateVideoUrl(input.videoUrl),
      durationSec: input.durationSec,
      rewardMinor: reward,
      currency: input.currency as Currency,
      status: 'PENDING_REVIEW',
    },
  });
  return campaign;
}

/** Campaign rows for one advertiser, with budget and verified-view statistics. */
export async function listOwnCampaigns(ownerId: string) {
  const [campaigns, rates] = await Promise.all([
    db.adCampaign.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    loadRates(),
  ]);
  const rows = await Promise.all(
    campaigns.map(async (c) => {
      const [budget, views] = await Promise.all([
        balanceOf(db, accounts.advertiserPool(c.id, c.currency as Currency).key),
        db.adView.findMany({ where: { campaignId: c.id }, select: { userId: true, completedAt: true, rewardMinor: true } }),
      ]);
      const completed = views.filter((v) => v.completedAt);
      const spent = completed.reduce((a, v) => a + v.rewardMinor, 0n);
      return {
        id: c.id,
        title: c.title,
        advertiser: c.advertiser,
        status: c.status,
        currency: c.currency as Currency,
        durationSec: c.durationSec,
        rewardMinor: c.rewardMinor,
        budgetMinor: budget,
        spentMinor: spent,
        started: views.length,
        verifiedViews: completed.length,
        uniqueViewers: new Set(completed.map((v) => v.userId)).size,
        completionRate: views.length === 0 ? 0 : Math.round((completed.length * 100) / views.length),
        budgetInrMinor: convertMinor(budget, c.currency as Currency, BASE_CURRENCY, rates),
        spentInrMinor: convertMinor(spent, c.currency as Currency, BASE_CURRENCY, rates),
        createdAt: c.createdAt,
      };
    }),
  );
  return rows;
}

/** Starts a top-up. The budget only increases after the gateway confirms the payment (webhook). */
export async function startTopUp(ownerId: string, campaignId: string, amountText: string) {
  const campaign = await db.adCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.ownerId !== ownerId) throw new DomainError('NOT_FOUND', 'Campaign not found', 404);
  if (campaign.status === 'ENDED') throw new DomainError('CAMPAIGN_ENDED', 'This campaign has ended', 409);
  const amount = parseMinor(amountText);
  if (amount <= 0n || amount > MAX_TOPUP_MINOR) throw new DomainError('INVALID_AMOUNT', 'Top-up must be between 0.01 and 100,000.00', 422);
  const payment = await db.payment.create({
    data: {
      kind: 'ADS_TOPUP',
      referenceId: campaignId,
      userId: ownerId,
      amountMinor: amount,
      currency: campaign.currency,
      providerRef: `ads_${randomUUID()}`,
    },
  });
  return { paymentId: payment.id, providerRef: payment.providerRef, amountMinor: amount, currency: campaign.currency as Currency };
}

/** Advertiser account summary across all their campaigns, in INR. */
export function summarise(rows: Awaited<ReturnType<typeof listOwnCampaigns>>) {
  const active = rows.filter((r) => r.status === 'ACTIVE').length;
  const pending = rows.filter((r) => r.status === 'PENDING_REVIEW').length;
  const budget = rows.reduce((a, r) => a + r.budgetInrMinor, 0n);
  const spent = rows.reduce((a, r) => a + r.spentInrMinor, 0n);
  const views = rows.reduce((a, r) => a + r.verifiedViews, 0);
  const started = rows.reduce((a, r) => a + r.started, 0);
  return { active, pending, budget, spent, views, completionRate: started === 0 ? 0 : Math.round((views * 100) / started) };
}

