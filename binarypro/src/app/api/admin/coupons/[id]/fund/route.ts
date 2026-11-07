import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { fundCouponPool } from '@/lib/server/coupons';
import { parseMinor } from '@/lib/domain/money';

export const runtime = 'nodejs';
const Body = z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('ads:fund');
    const body = await readJson(req, Body);
    return ok(await fundCouponPool(params.id, parseMinor(body.amount), user.id));
  });
}
