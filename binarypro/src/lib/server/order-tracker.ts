// Order tracking: buckets, return windows, refunds and commission eligibility for orders in a date range.
import { db, type Tx } from './db';
import { MAX_ROWS, type Range } from './audit-view';
import { BUCKET_LABELS, commissionEligible, trackingBucket, type TrackingBucket } from '@/lib/domain/order-tracking';
import { CURRENCIES, type Currency } from '@/lib/domain/money';

export interface TrackedRow {
  id: string;
  createdAt: Date;
  status: string;
  bucket: TrackingBucket;
  bucketLabel: string;
  merchant: string;
  buyer: string;
  currency: Currency;
  subtotalMinor: bigint;
  pvInrMinor: bigint;
  cashbackMinor: bigint;
  refundDueMinor: bigint;
  deliveredAt: Date | null;
  returnWindowEndsAt: Date | null;
  verifiedAt: Date | null;
  returnedAt: Date | null;
  commissionBlocked: string | null;
  commissionEligible: boolean;
  commissionPostedMinor: bigint;
  commissionReversedMinor: bigint;
}

export async function orderTracker(range: Range, now: Date, client: Tx | typeof db = db) {
  const orders = await client.order.findMany({
    where: { createdAt: { gte: range.gte, lt: range.lt } },
    select: {
      id: true, createdAt: true, status: true, currency: true, subtotalMinor: true, pvInrMinor: true,
      cashbackMinor: true, refundDueMinor: true, deliveredAt: true, returnWindowEndsAt: true,
      verifiedAt: true, returnedAt: true, commissionBlocked: true,
      merchant: { select: { name: true } },
      buyer: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });
  const ids = orders.map((o) => o.id);
  const commissionSums = ids.length
    ? await client.commission.groupBy({
        by: ['sourceOrderId', 'status'],
        where: { sourceOrderId: { in: ids } },
        _sum: { amountMinor: true },
      })
    : [];

  const rows: TrackedRow[] = orders.map((o) => {
    const bucket = trackingBucket(o, now);
    const sums = commissionSums.filter((c) => c.sourceOrderId === o.id);
    const posted = sums.find((c) => c.status === 'POSTED')?._sum.amountMinor ?? 0n;
    const reversed = sums.find((c) => c.status === 'REVERSED')?._sum.amountMinor ?? 0n;
    return {
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      bucket,
      bucketLabel: BUCKET_LABELS[bucket],
      merchant: o.merchant.name,
      buyer: o.buyer.email ?? o.buyer.name,
      currency: o.currency,
      subtotalMinor: o.subtotalMinor,
      pvInrMinor: o.pvInrMinor,
      cashbackMinor: o.cashbackMinor,
      refundDueMinor: o.refundDueMinor,
      deliveredAt: o.deliveredAt,
      returnWindowEndsAt: o.returnWindowEndsAt,
      verifiedAt: o.verifiedAt,
      returnedAt: o.returnedAt,
      commissionBlocked: o.commissionBlocked,
      commissionEligible: commissionEligible(o),
      commissionPostedMinor: posted,
      commissionReversedMinor: reversed,
    };
  });

  const counts = new Map<TrackingBucket, number>();
  for (const r of rows) counts.set(r.bucket, (counts.get(r.bucket) ?? 0) + 1);
  const byCurrency = CURRENCIES.map((currency) => {
    const inCur = rows.filter((r) => r.currency === currency);
    return {
      currency,
      orders: inCur.length,
      subtotalMinor: inCur.reduce((a, r) => a + r.subtotalMinor, 0n),
      refundsMinor: inCur.filter((r) => r.status === 'RETURNED').reduce((a, r) => a + r.subtotalMinor, 0n),
    };
  }).filter((c) => c.orders > 0);

  return {
    rows,
    counts: Object.fromEntries(counts) as Partial<Record<TrackingBucket, number>>,
    byCurrency,
    truncated: orders.length >= MAX_ROWS,
  };
}
