import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { createCoupon } from '@/lib/server/coupons';
import { CURRENCIES, parseMinor } from '@/lib/domain/money';

export const runtime = 'nodejs';

const Amount = z.string().regex(/^\d+(\.\d{1,2})?$/);
const Create = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9-]+$/),
  funding: z.enum(['MERCHANT', 'PROMO']),
  merchantId: z.string().min(1).optional().nullable(),
  percent: z.number().int(),
  maxCashback: Amount,
  minOrder: Amount,
  budget: Amount,
  currency: z.enum(CURRENCIES),
  perUserLimit: z.number().int().min(1).max(20),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function GET() {
  return handle(async () => {
    await requirePermission('coupons:manage');
    return ok({ coupons: await db.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('coupons:manage');
    const b = await readJson(req, Create);
    const coupon = await createCoupon({
      code: b.code,
      funding: b.funding,
      merchantId: b.merchantId ?? null,
      percent: b.percent,
      maxCashbackMinor: parseMinor(b.maxCashback),
      minOrderMinor: parseMinor(b.minOrder),
      currency: b.currency,
      budgetMinor: parseMinor(b.budget),
      perUserLimit: b.perUserLimit,
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
    }, user.id);
    return ok(coupon, 201);
  });
}
