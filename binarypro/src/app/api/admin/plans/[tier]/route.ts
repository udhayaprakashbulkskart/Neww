import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { updatePlan } from '@/lib/server/plans';
import { parseMinor } from '@/lib/domain/money';
import { parseTier } from '@/lib/server/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  name: z.string().max(60),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  durationDays: z.number().int(),
  couponMaxPercent: z.number().int(),
  adViewsPerDay: z.number().int(),
  benefits: z.string().max(2000),
  active: z.boolean(),
});

/** Admin: edit a membership package. Commission rates and daily caps are not part of this request. */
export async function PATCH(req: Request, { params }: { params: { tier: string } }) {
  return handle(async () => {
    const user = await requirePermission('membership:manage');
    const tier = parseTier(params.tier);
    const body = await readJson(req, Body);
    const saved = await updatePlan(tier, {
      name: body.name,
      priceInrMinor: parseMinor(body.price),
      durationDays: body.durationDays,
      couponMaxPercent: body.couponMaxPercent,
      adViewsPerDay: body.adViewsPerDay,
      benefits: body.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
      active: body.active,
    }, user.id);
    return ok({ tier, updatedAt: saved.updatedAt });
  });
}
