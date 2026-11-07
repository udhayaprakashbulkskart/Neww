import { getConfig } from '@/lib/server/config';
import { verifySignature } from '@/lib/domain/payments';
import { handleCapturedEvent, type CapturedEvent } from '@/lib/server/payments';
import { fail, handle, ok } from '@/lib/server/http';
import { DomainError } from '@/lib/server/errors';

export const runtime = 'nodejs';

// Webhooks are signed over the RAW body. Read text once, verify, then parse.
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.text();
    if (raw.length > 64_1024) return fail('TOO_LARGE', 'Payload too large', 413);
    if (!verifySignature(getConfig().webhookSecret, raw, req.headers.get('x-webhook-signature'))) {
      throw new DomainError('BAD_SIGNATURE', 'Invalid signature', 401);
    }
    const event = JSON.parse(raw) as CapturedEvent;
    if (event.type !== 'payment.captured' || typeof event.id !== 'string' || typeof event.providerRef !== 'string') {
      throw new DomainError('BAD_EVENT', 'Unsupported event', 400);
    }
    return ok(await handleCapturedEvent(event));
  });
}
