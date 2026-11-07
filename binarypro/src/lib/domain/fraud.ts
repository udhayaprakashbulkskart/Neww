// Fraud rules. Rules withhold commissions and raise review flags; they never move money on their own.

/** True when the buyer is the sponsor or appears in the sponsor's upline (self-referral loops). */
export function isSelfPurchase(buyerId: string, sponsorUplineIds: readonly string[]): boolean {
  return sponsorUplineIds.includes(buyerId);
}

export function isDuplicateCouponUse(redemptionsForUser: number, perUserLimit: number): boolean {
  return redemptionsForUser >= perUserLimit;
}
