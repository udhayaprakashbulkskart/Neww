import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { updateReward } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().min(2).max(240), active: z.boolean() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const r = await updateReward(params.id, body, user.id);
    return ok({ id: r.id });
  });
}
