import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { decideWithdrawal } from '@/lib/server/wallet';

export const runtime = 'nodejs';
const Body = z.object({ decision: z.enum(['APPROVE', 'REJECT']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('withdrawals:decide');
    const body = await readJson(req, Body);
    return ok(await decideWithdrawal(params.id, body.decision, user.id));
  });
}
