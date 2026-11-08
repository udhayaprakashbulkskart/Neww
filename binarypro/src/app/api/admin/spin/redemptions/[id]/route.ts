import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { decideRedemption } from '@/lib/server/spin';

export const runtime = 'nodejs';
const Body = z.object({
  action: z.enum(['APPROVE', 'FULFIL', 'REJECT']),
  voucherCode: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('spin:redeem');
    const body = await readJson(req, Body);
    return ok(await decideRedemption(params.id, body.action, { voucherCode: body.voucherCode, note: body.note }, user.id));
  });
}
