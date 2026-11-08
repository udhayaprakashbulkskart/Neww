import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { decideAward } from '@/lib/server/milestones';

export const runtime = 'nodejs';

const Body = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'FULFIL']),
  prizeId: z.string().min(1).max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('milestones:decide');
    const body = await readJson(req, Body);
    return ok(await decideAward(params.id, body.action, { prizeId: body.prizeId, note: body.note }, user.id));
  });
}
