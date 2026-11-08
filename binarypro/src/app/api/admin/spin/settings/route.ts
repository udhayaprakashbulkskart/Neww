import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { updateSettings } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({ enabled: z.boolean().optional(), cooldownDays: z.number().int().min(1).max(60).optional() });

export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const s = await updateSettings(body, user.id);
    return ok({ enabled: s.enabled, cooldownDays: s.cooldownDays });
  });
}
