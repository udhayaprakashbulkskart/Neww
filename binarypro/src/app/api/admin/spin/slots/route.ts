import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { saveSlot } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({
  tier: z.enum(['SILVER', 'GOLD', 'PLATINUM']),
  rewardId: z.string().min(1).max(80),
  weight: z.number().int().min(1).max(1000),
  active: z.boolean(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const s = await saveSlot(body, user.id);
    return ok({ id: s.id }, 201);
  });
}
