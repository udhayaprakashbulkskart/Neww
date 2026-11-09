// Financial engine rules: business day, daily cap settlement and policy checks. Pure functions only.
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/** Business calendar day in Asia/Kolkata, as YYYY-MM-DD. */
export function businessDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function previousBusinessDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
}

export interface SettlementInput {
  /** Eligible commission earned on this business day that is not yet released or reversed. */
  eligibleMinor: bigint;
  /** Commission carried in from earlier days that is still pending. */
  carriedInMinor: bigint;
  capMinor: bigint;
}

/**
 * Daily cap rule. Commission from today plus carried-forward pending commission can be released up to the cap.
 * Carried pending is released, never recounted as new commission. Whatever is not released stays pending.
 * payable = MIN(eligible + carried, cap); carriedOut = carriedIn + eligible - payable.
 */
export function settleDay(input: SettlementInput): { payableMinor: bigint; carriedOutMinor: bigint } {
  if (input.capMinor <= 0n) throw new Error('Daily cap must be configured before settlement');
  if (input.eligibleMinor < 0n || input.carriedInMinor < 0n) throw new Error('Amounts cannot be negative');
  const available = input.eligibleMinor + input.carriedInMinor;
  const payableMinor = available < input.capMinor ? available : input.capMinor;
  return { payableMinor, carriedOutMinor: available - payableMinor };
}

/** Kinds that may ever accrue commission. Sponsor and binary are excluded by design. */
export const ACCRUING_KINDS = ['PRODUCT', 'SERVICE'] as const;
export type AccruingKind = (typeof ACCRUING_KINDS)[number];

/**
 * Commission for a verified sale: at most the policy rate of the sale value, and never more than the funded budget.
 * Returns zero when the policy is inactive, so an unapproved policy accrues nothing.
 */
export function productCommission(input: { saleMinor: bigint; rateBps: number; active: boolean; budgetMinor: bigint; requestedMinor: bigint }): bigint {
  if (!input.active || input.rateBps <= 0) return 0n;
  if (input.saleMinor <= 0n || input.budgetMinor <= 0n || input.requestedMinor <= 0n) return 0n;
  let amount = (input.saleMinor * BigInt(input.rateBps)) / 10000n;
  if (amount > input.requestedMinor) amount = input.requestedMinor;
  if (amount > input.budgetMinor) amount = input.budgetMinor;
  return amount > 0n ? amount : 0n;
}

/** Whether a policy version may be activated. Sponsor and binary policies can never be activated. */
export function policyActivationBlockers(input: { kind: string; rateBps: number; legalApprovalRef: string | null }): string[] {
  const problems: string[] = [];
  if (input.kind === 'DIRECT_SPONSOR' || input.kind === 'BINARY') {
    problems.push(`${input.kind === 'BINARY' ? 'Binary' : 'Sponsor-linked'} commission is disabled and cannot be activated`);
  }
  if (!Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10000) problems.push('Rate must be between 0 and 10000 basis points');
  if (input.rateBps === 0) problems.push('A rate of zero would pay nothing; set a rate before activating');
  if (!input.legalApprovalRef || input.legalApprovalRef.trim().length < 6) problems.push('Enter the documented legal approval reference (at least 6 characters)');
  return problems;
}

export function validateDailyCap(capMinor: bigint): string | null {
  if (capMinor <= 0n) return 'The daily cap must be greater than zero';
  if (capMinor > 1_000_000_000_00n) return 'The daily cap is unrealistically large';
  return null;
}
