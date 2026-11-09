// Spin & Win rules. Pure functions only: no database, no clock reads (the server passes `now`).
// Cash rewards are never live unless every legal and funding condition holds.

export const DAY_MS = 86_400_000;
export const SPIN_TIERS = ['SILVER', 'GOLD', 'PLATINUM'] as const;
/** The wheel shown to members without a paid membership (the entry wheel). */
export const ENTRY_WHEEL_TIER = 'SILVER' as const;
export type SpinTier = (typeof SPIN_TIERS)[number];
export const TIER_LABEL: Record<string, string> = {
  BASIC: 'Free',
  SILVER: '₹999 membership',
  GOLD: '₹2,999 membership',
  PLATINUM: '₹9,999 membership',
};

export type SpinKind = 'BADGE' | 'CASH' | 'VOUCHER';

export function nextEligibleAt(lastSpinAt: Date | null, cooldownDays: number): Date | null {
  return lastSpinAt ? new Date(lastSpinAt.getTime() + cooldownDays * DAY_MS) : null;
}

export type EligibilityReason = 'OK' | 'DISABLED' | 'COOLDOWN' | 'NO_REWARDS';

export const REASON_TEXT: Record<EligibilityReason, string> = {
  OK: 'You can spin now.',
  DISABLED: 'Spin & Win is paused right now.',
  COOLDOWN: 'Your next spin is not available yet.',
  NO_REWARDS: 'No rewards are available on the wheel right now.',
};

/** Whether a membership is paid and current. Only this unlocks claiming rewards. */
export function isPaidAndCurrent(membership: { tier: string; active: boolean; expiresAt: Date } | null, now: Date): boolean {
  return !!membership && membership.active && membership.tier !== 'BASIC' && membership.expiresAt > now;
}

/**
 * Decides whether a member may spin. Everyone may spin, paid or free; the cooldown applies to everyone.
 * Membership affects only whether a won reward can be claimed, not whether the wheel can be spun.
 */
export function eligibility(input: {
  enabled: boolean;
  now: Date;
  nextEligibleAt: Date | null;
  liveRewardCount: number;
}): { eligible: boolean; reason: EligibilityReason } {
  if (!input.enabled) return { eligible: false, reason: 'DISABLED' };
  if (input.nextEligibleAt && input.now < input.nextEligibleAt) return { eligible: false, reason: 'COOLDOWN' };
  if (input.liveRewardCount === 0) return { eligible: false, reason: 'NO_REWARDS' };
  return { eligible: true, reason: 'OK' };
}

/** Weighted choice. `draw` must be an integer in [0, total). Returns the chosen index. */
export function pickIndex(weights: number[], draw: number): number {
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) throw new Error('No weights to choose from');
  if (!Number.isInteger(draw) || draw < 0 || draw >= total) throw new Error('Draw out of range');
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (draw < acc) return i;
  }
  throw new Error('Unreachable');
}

/** Centre of segment `i` of `n`, in degrees clockwise from the top of the wheel. */
export function segmentCentreDeg(i: number, n: number): number {
  return ((i + 0.5) * 360) / n;
}

/** Absolute rotation that brings segment `targetIndex` under the top pointer, after `extraTurns` full turns. */
export function spinRotation(currentDeg: number, targetIndex: number, n: number, extraTurns: number): number {
  const centre = segmentCentreDeg(targetIndex, n);
  const delta = (((360 - centre - currentDeg) % 360) + 360) % 360;
  return currentDeg + extraTurns * 360 + delta;
}

export interface CashGate {
  kind: SpinKind;
  active: boolean;
  amountMinor: bigint;
  cashLegalRef: string | null;
  cashFundingRef: string | null;
  cashActivatedAt: Date | null;
}

/**
 * A reward can be drawn only when it is live. A cash reward is live only when:
 * the platform switch is on, the administrator activated it after legal approval and funding were recorded,
 * and the reward pool holds enough money to pay it.
 */
export function isRewardLive(r: CashGate, env: { cashSwitchOn: boolean; poolBalanceMinor: bigint }): boolean {
  if (!r.active) return false;
  if (r.kind !== 'CASH') return true;
  if (!env.cashSwitchOn) return false;
  if (!r.cashLegalRef || !r.cashFundingRef || !r.cashActivatedAt) return false;
  return env.poolBalanceMinor >= r.amountMinor;
}

/** Reasons an administrator cannot activate a cash reward yet. Empty list means it may be activated. */
export function cashActivationBlockers(input: { kind: SpinKind; amountMinor: bigint; legalRef: string; fundingRef: string; cashSwitchOn: boolean }): string[] {
  const problems: string[] = [];
  if (input.kind !== 'CASH') problems.push('Only cash rewards need activation');
  if (!input.cashSwitchOn) problems.push('Cash rewards are switched off on this platform (SPIN_CASH_ENABLED is not true)');
  if (input.legalRef.trim().length < 6) problems.push('Enter the written legal approval reference (at least 6 characters)');
  if (input.fundingRef.trim().length < 6) problems.push('Enter the verified funding source reference (at least 6 characters)');
  if (input.amountMinor <= 0n) problems.push('The reward amount must be greater than zero');
  return problems;
}

export function validateWeight(weight: number): string | null {
  return Number.isInteger(weight) && weight >= 1 && weight <= 1000 ? null : 'Weight must be a whole number from 1 to 1000';
}

export function validateCooldown(days: number): string | null {
  return Number.isInteger(days) && days >= 1 && days <= 60 ? null : 'Cooldown must be a whole number of days from 1 to 60';
}
