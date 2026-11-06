import { handle, json, clientIp, errors } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { simulateOrderCapture } from '@/lib/services/payment-events';
import { POST_FEE_PAISE } from '@/lib/services/billing';

export const dynamic = 'force-dynamic';

/** Sandbox only: completes a post-fee order through the signed webhook path. */
export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const fee = await db.postFee.findUnique({ where: { id: params.id }, select: { userId: true, providerOrderId: true, status: true } });
  if (!fee || fee.userId !== user.id || !fee.providerOrderId) throw errors.notFound('Payment');
  const result = await simulateOrderCapture({ orderId: fee.providerOrderId, amountPaise: POST_FEE_PAISE, ip: clientIp(req) });
  return json(result);
});
