// Retail milestone rules. Pure functions only.
// Counts a member's own verified retail sales. Team volume and recruitment never count.
import { parseMinor } from './money';

export type MilestoneStatus = 'QUALIFIED' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
export type MilestoneAction = 'APPROVE' | 'REJECT' | 'FULFIL';

const NEXT: Record<MilestoneStatus, Partial<Record<MilestoneAction, MilestoneStatus>>> = {
  QUALIFIED: { APPROVE: 'APPROVED', REJECT: 'REJECTED' },
  APPROVED: { FULFIL: 'FULFILLED' },
  REJECTED: {},
  FULFILLED: {},
};

/** The next status for an action, or null when the action is not allowed from this status. */
export function nextMilestoneStatus(from: MilestoneStatus, action: MilestoneAction): MilestoneStatus | null {
  return NEXT[from][action] ?? null;
}

export function milestoneProgress(metricMinor: bigint, thresholdMinor: bigint): { percent: number; reached: boolean } {
  if (thresholdMinor <= 0n) return { percent: 0, reached: false };
  const reached = metricMinor >= thresholdMinor;
  const percent = reached ? 100 : Number((metricMinor * 100n) / thresholdMinor);
  return { percent, reached };
}

export interface RuleInput {
  name: string;
  thresholdRupees: string; // decimal rupees, e.g. "50000" or "50000.00"
  startsAt: Date;
  endsAt: Date | null;
}

/** Validates an admin rule edit. Returns human-readable problems; an empty list means valid. */
export function validateRule(input: RuleInput): { errors: string[]; thresholdMinor?: bigint } {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('Name is required');
  if (input.name.length > 120) errors.push('Name is too long');
  let thresholdMinor: bigint | undefined;
  try {
    thresholdMinor = parseMinor(input.thresholdRupees);
    if (thresholdMinor <= 0n) errors.push('Threshold must be greater than zero');
    if (thresholdMinor > 1_000_000_000_00n) errors.push('Threshold is unrealistically large');
  } catch {
    errors.push('Threshold must be an amount such as 50000 or 50000.00');
  }
  if (Number.isNaN(input.startsAt.getTime())) errors.push('Start date is invalid');
  if (input.endsAt && input.endsAt <= input.startsAt) errors.push('End date must be after the start date');
  return errors.length ? { errors } : { errors, thresholdMinor };
}
