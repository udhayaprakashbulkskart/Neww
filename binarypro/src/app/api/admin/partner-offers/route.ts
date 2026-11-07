import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { importPartnerOffers, MAX_IMPORT_ROWS } from '@/lib/server/offers';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;
const Body = z.object({ offers: z.array(z.unknown()).min(1).max(MAX_IMPORT_ROWS) });

/** Staff import of approved partner offers (JSON). Coupon management permission required. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('coupons:manage');
    const body = await readJson(req, Body);
    const result = await importPartnerOffers(body.offers, user.id);
    return ok(result, 201);
  });
}
