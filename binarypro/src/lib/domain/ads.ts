// Advertising rewards. Rewards are paid only from advertiser-funded campaign pools.


/** A view must last at least this share of the video (bps). Prevents skipping to the end. */
export const MIN_WATCH_BPS = 9500;

export function minimumWatchMs(durationSec: number): number {
  return Math.ceil((durationSec * 1000 * MIN_WATCH_BPS) / 10_000);
}

export interface StartViewInput {
  campaignStatus: string;
  poolBalanceMinor: bigint;
  rewardMinor: bigint;
  viewsCompletedToday: number;
  adViewsPerDay: number;
  alreadyViewedTodayThisCampaign: boolean;
}

export function canStartView(input: StartViewInput): { ok: true } | { ok: false; reason: string } {
  if (input.campaignStatus !== 'ACTIVE') return { ok: false, reason: 'Campaign is not active' };
  if (input.poolBalanceMinor < input.rewardMinor) return { ok: false, reason: 'Advertiser budget is exhausted' };
  if (input.viewsCompletedToday >= input.adViewsPerDay) return { ok: false, reason: 'Daily ad limit reached for your plan' };
  if (input.alreadyViewedTodayThisCampaign) return { ok: false, reason: 'You have already watched this campaign today' };
  return { ok: true };
}

export function canCompleteView(startedAt: Date, now: Date, durationSec: number, completedAt: Date | null) {
  if (completedAt) return { ok: false as const, reason: 'View already completed' };
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed < minimumWatchMs(durationSec)) return { ok: false as const, reason: 'Video has not been watched long enough' };
  return { ok: true as const };
}

