import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { toRateE8 } from '@/lib/server/rates';
import { audit } from '@/lib/server/audit';
import { CURRENCIES } from '@/lib/domain/money';

export const runtime = 'nodejs';
const Body = z.object({ currency: z.enum(CURRENCIES).refine((c) => c !== 'INR', 'INR is the base currency'), inrPerUnit: z.number().positive().max(1_000_000) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('fx:manage');
    const body = await readJson(req, Body);
    const rateE8 = toRateE8(body.inrPerUnit);
    await db.$transaction(async (tx) => {
      await tx.fxRate.upsert({ where: { currency: body.currency }, create: { currency: body.currency, rateE8, source: 'MANUAL', fetchedAt: null }, update: { rateE8, source: 'MANUAL', fetchedAt: null, updatedAt: new Date() } });
      await audit(tx, { action: 'fx.rate_set', actorId: user.id, targetId: body.currency, meta: { rateE8: rateE8.toString() } });
    });
    return ok({ currency: body.currency, rateE8 });
  });
}
