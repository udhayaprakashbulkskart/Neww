import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { runBinaryPayouts } from '@/lib/server/binary';
import { dayKey } from '@/lib/server/time';

export const runtime = 'nodejs';
const Body = z.object({ periodKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('commissions:run');
    const body = await readJson(req, Body);
    return ok(await runBinaryPayouts(body.periodKey ?? dayKey(new Date()), user.id));
  });
}
