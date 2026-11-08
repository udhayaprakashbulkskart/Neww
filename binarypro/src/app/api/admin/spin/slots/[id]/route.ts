import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { updateSlot } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({ weight: z.number().int().min(1).max(1000), active: z.boolean() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const s = await updateSlot(params.id, body, user.id);
    return ok({ id: s.id });
  });
}
