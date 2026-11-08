import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { decideKyc } from '@/lib/server/kyc';

export const runtime = 'nodejs';
const Body = z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().max(500).nullable().optional() });

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  return handle(async () => {
    const user = await requirePermission('kyc:review');
    const body = await readJson(req, Body);
    return ok(await decideKyc(params.userId, body.decision, body.note ?? null, user.id));
  });
}
