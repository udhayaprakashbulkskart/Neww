import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { setDailyCap } from '@/lib/server/commission-engine';

export const runtime = 'nodejs';
const Body = z.object({ capRupees: z.string().trim().max(20).nullable(), reason: z.string().trim().min(8).max(300) });

export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requirePermission('engine:manage');
    const body = await readJson(req, Body);
    const row = await setDailyCap(body.capRupees, body.reason, user.id);
    return ok({ capMinor: row.capMinor?.toString() ?? null });
  });
}
