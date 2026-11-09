import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { runDailySettlement } from '@/lib/server/commission-engine';

export const runtime = 'nodejs';
const Body = z.object({ dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().min(8).max(300) });

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('engine:manage');
    const body = await readJson(req, Body);
    return ok(await runDailySettlement(body.dayKey, user.id, body.reason));
  });
}
