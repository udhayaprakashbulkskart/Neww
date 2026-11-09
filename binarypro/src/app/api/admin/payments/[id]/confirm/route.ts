import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { confirmOfflineMembershipPayment } from '@/lib/server/payments-offline';

export const runtime = 'nodejs';
const Body = z.object({
  method: z.enum(['BANK', 'CASH']).optional(),
  bankRef: z.string().trim().max(120),
  amountRupees: z.string().trim().min(1).max(20),
  receivedFrom: z.string().trim().max(120).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const user = await requirePermission('payments:confirm');
    const body = await readJson(req, Body);
    return ok(await confirmOfflineMembershipPayment(params.id, body, user.id), 201);
  });
}
