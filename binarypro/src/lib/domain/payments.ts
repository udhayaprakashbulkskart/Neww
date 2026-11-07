// HMAC-SHA256 signature handling for payment webhooks. Timing-safe comparison, raw body only.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPayload(secret, rawBody), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
