import { z } from 'zod';
import { handle, ok, readJson, requireUser } from '@/lib/server/http';
import { startMembershipCheckout } from '@/lib/server/payments';
import { CURRENCIES } from '@/lib/domain/money';

export const runtime = 'nodejs';
const Body = z.object({ tier: z.enum(['BASIC', 'SILVER', 'GOLD', 'PLATINUM']), currency: z.enum(CURRENCIES).optional() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(req, Body);
    return ok(await startMembershipCheckout(user.id, body.tier, body.currency));
  });
}
