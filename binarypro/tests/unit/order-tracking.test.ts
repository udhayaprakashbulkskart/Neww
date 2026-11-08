import { describe, expect, it } from 'vitest';
import { commissionEligible, trackingBucket } from '@/lib/domain/order-tracking';

const now = new Date('2026-11-08T12:00:00Z');
const future = new Date('2026-11-10T00:00:00Z');
const past = new Date('2026-11-01T00:00:00Z');

describe('order tracking', () => {
  it('places each status in the right bucket', () => {
    expect(trackingBucket({ status: 'PENDING_PAYMENT', returnWindowEndsAt: null, commissionBlocked: null }, now)).toBe('AWAITING_PAYMENT');
    expect(trackingBucket({ status: 'PAID', returnWindowEndsAt: null, commissionBlocked: null }, now)).toBe('IN_TRANSIT');
    expect(trackingBucket({ status: 'CANCELLED', returnWindowEndsAt: null, commissionBlocked: null }, now)).toBe('CANCELLED');
    expect(trackingBucket({ status: 'RETURNED', returnWindowEndsAt: past, commissionBlocked: null }, now)).toBe('RETURNED');
  });

  it('keeps a delivered order in its return window until it closes', () => {
    expect(trackingBucket({ status: 'DELIVERED', returnWindowEndsAt: future, commissionBlocked: null }, now)).toBe('RETURN_WINDOW_OPEN');
    expect(trackingBucket({ status: 'DELIVERED', returnWindowEndsAt: past, commissionBlocked: null }, now)).toBe('READY_TO_VERIFY');
  });

  it('makes only verified, unwithheld orders commission-eligible', () => {
    expect(commissionEligible({ status: 'VERIFIED', returnWindowEndsAt: past, commissionBlocked: null })).toBe(true);
    expect(commissionEligible({ status: 'VERIFIED', returnWindowEndsAt: past, commissionBlocked: 'self-purchase loop' })).toBe(false);
    expect(commissionEligible({ status: 'DELIVERED', returnWindowEndsAt: past, commissionBlocked: null })).toBe(false);
    expect(commissionEligible({ status: 'RETURNED', returnWindowEndsAt: past, commissionBlocked: null })).toBe(false);
    expect(trackingBucket({ status: 'VERIFIED', returnWindowEndsAt: past, commissionBlocked: 'x' }, now)).toBe('COMMISSION_WITHHELD');
  });
});
