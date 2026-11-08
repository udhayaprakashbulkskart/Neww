import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { createReward } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(240),
  kind: z.enum(['BADGE', 'VOUCHER', 'CASH']),
  amountRupees: z.string().max(20).optional().default('0'),
});

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('spin:manage');
    const body = await readJson(req, Body);
    const r = await createReward({ ...body, amountRupees: body.amountRupees ?? '0' }, user.id);
    return ok({ id: r.id }, 201);
  });
}
