// Binary tree rules and binary commission arithmetic. Pure functions; no database access.

import { applyBps } from './money';
import type { Side } from './types';

export interface PlacementCandidate {
  /** Who is being placed. */
  newUserId: string;
  /** The sponsor who referred the new member. */
  sponsorId: string;
  /** The chosen parent node in the binary tree. */
  parentId: string;
  side: Side;
  /** Set of member ids in the sponsor's binary downline, including the sponsor itself. */
  sponsorDownline: ReadonlySet<string>;
  /** Parent ids already occupying each slot: key `${parentId}:${side}`. */
  occupiedSlots: ReadonlySet<string>;
}

export type PlacementResult = { ok: true } | { ok: false; reason: string };

/**
 * User-selected placement. The chosen parent must be the sponsor or inside the sponsor's binary
 * downline, and the chosen slot must be empty. Nobody can be placed under themselves.
 */
export function validatePlacement(c: PlacementCandidate): PlacementResult {
  if (c.newUserId === c.parentId) return { ok: false, reason: 'A member cannot be placed under themselves' };
  if (!c.sponsorDownline.has(c.parentId)) {
    return { ok: false, reason: 'Parent must be your binary downline (or you)' };
  }
  if (c.occupiedSlots.has(`${c.parentId}:${c.side}`)) {
    return { ok: false, reason: 'That binary position is already taken' };
  }
  return { ok: true };
}

export interface BinaryPayoutInput {
  leftPvInrMinor: bigint;
  rightPvInrMinor: bigint;
  rateBps: number;
  dailyCapInrMinor: bigint;
  /** Money still available in the commission reserve (INR minor). */
  reserveAvailableInrMinor: bigint;
}

export interface BinaryPayout {
  payoutInrMinor: bigint;
  /** PV consumed from BOTH legs (the matched amount). Any surplus carries forward. */
  consumedPvInrMinor: bigint;
  matchedPvInrMinor: bigint;
}

/**
 * Matches left and right volume. Payout is `matched * rate`, limited by the daily cap and by the
 * funds available in the reserve. Only the PV that was actually paid is consumed, so unpaid volume
 * carries forward to the next run.
 */
export function computeBinaryPayout(input: BinaryPayoutInput): BinaryPayout {
  const matched = input.leftPvInrMinor < input.rightPvInrMinor ? input.leftPvInrMinor : input.rightPvInrMinor;
  if (matched <= 0n || input.rateBps <= 0) {
    return { payoutInrMinor: 0n, consumedPvInrMinor: 0n, matchedPvInrMinor: matched > 0n ? matched : 0n };
  }
  const fullPayout = applyBps(matched, input.rateBps);
  const allowedPayout =
    input.dailyCapInrMinor < input.reserveAvailableInrMinor ? input.dailyCapInrMinor : input.reserveAvailableInrMinor;

  if (fullPayout <= allowedPayout) {
    return { payoutInrMinor: fullPayout, consumedPvInrMinor: matched, matchedPvInrMinor: matched };
  }
  if (allowedPayout <= 0n) {
    return { payoutInrMinor: 0n, consumedPvInrMinor: 0n, matchedPvInrMinor: matched };
  }
  // Largest PV whose payout fits within allowedPayout (floored, so we never pay more than allowed).
  const consumed = (allowedPayout * 10_000n) / BigInt(input.rateBps);
  const payout = applyBps(consumed, input.rateBps);
  return { payoutInrMinor: payout, consumedPvInrMinor: consumed, matchedPvInrMinor: matched };
}
