// Order tracking rules: which bucket an order sits in, and whether its commissions are eligible.
// Only verified retail sales can carry commissions. Membership purchases never appear here.

export type OrderStatusName = 'PENDING_PAYMENT' | 'PAID' | 'DELIVERED' | 'VERIFIED' | 'RETURNED' | 'CANCELLED';

export type TrackingBucket =
  | 'AWAITING_PAYMENT'
  | 'IN_TRANSIT'
  | 'RETURN_WINDOW_OPEN'
  | 'READY_TO_VERIFY'
  | 'COMMISSION_ELIGIBLE'
  | 'COMMISSION_WITHHELD'
  | 'RETURNED'
  | 'CANCELLED';

export interface TrackedOrder {
  status: OrderStatusName;
  returnWindowEndsAt: Date | null;
  commissionBlocked: string | null;
}

export function trackingBucket(order: TrackedOrder, now: Date): TrackingBucket {
  switch (order.status) {
    case 'PENDING_PAYMENT':
      return 'AWAITING_PAYMENT';
    case 'PAID':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      if (order.returnWindowEndsAt && now < order.returnWindowEndsAt) return 'RETURN_WINDOW_OPEN';
      return 'READY_TO_VERIFY';
    case 'VERIFIED':
      return order.commissionBlocked ? 'COMMISSION_WITHHELD' : 'COMMISSION_ELIGIBLE';
    case 'RETURNED':
      return 'RETURNED';
    case 'CANCELLED':
      return 'CANCELLED';
  }
}

/** Commissions and PV count only for verified orders that were not withheld by fraud rules. */
export function commissionEligible(order: TrackedOrder): boolean {
  return order.status === 'VERIFIED' && order.commissionBlocked === null;
}

export const BUCKET_LABELS: Record<TrackingBucket, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  IN_TRANSIT: 'Paid, not yet delivered',
  RETURN_WINDOW_OPEN: 'Delivered, return window open',
  READY_TO_VERIFY: 'Return window closed, ready to verify',
  COMMISSION_ELIGIBLE: 'Verified, commissions eligible',
  COMMISSION_WITHHELD: 'Verified, commissions withheld (review)',
  RETURNED: 'Returned, reversed',
  CANCELLED: 'Cancelled',
};
