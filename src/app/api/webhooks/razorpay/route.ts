import { handle, json, clientIp } from '@/lib/http';
import { handleWebhook } from '@/lib/services/payment-events';

export const dynamic = 'force-dynamic';

/**
 * Payment provider webhook. Authenticated by signature over the exact raw body, not by session.
 * Requests with a missing or invalid signature are rejected and audited.
 */
export const POST = handle(async (req: Request) => {
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 256 * 1024) return json({ received: false }, { status: 413 });
  const result = await handleWebhook({
    rawBody,
    signature: req.headers.get('x-razorpay-signature'),
    eventId: req.headers.get('x-razorpay-event-id'),
    ip: clientIp(req),
  });
  return json(result);
});
