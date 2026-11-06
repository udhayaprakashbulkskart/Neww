import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { verifyHmacSha256 } from '@/lib/crypto';
import type { CreateOrderInput, CreateOrderResult, PaymentGateway } from './types';

/**
 * Razorpay gateway. Uses the REST API directly (no SDK) so the surface stays small and auditable.
 * All keys are read on the server only. The key secret never leaves this module.
 */
const API = 'https://api.razorpay.com/v1';

function credentials() {
  const e = env();
  if (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials are not configured.');
  }
  return { keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET };
}

async function rzp<T>(path: string, body: unknown): Promise<T> {
  const { keyId, keySecret } = credentials();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Do not echo the provider body (it can contain request details); log the status only.
    if (res.status === 401) console.error('[razorpay] authentication failed: check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    console.error(`[razorpay] ${path} failed with status ${res.status}`);
    throw new Error('Payment provider request failed.');
  }
  return (await res.json()) as T;
}

export const razorpayGateway: PaymentGateway = {
  name: 'RAZORPAY',
  get isSandbox() {
    return env().RAZORPAY_KEY_ID?.startsWith('rzp_test_') ?? true;
  },

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    // Razorpay rejects orders below 100 paise (Rs 1).
    if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
      throw new Error('Order amount must be at least 100 paise.');
    }
    const order = await rzp<{ id: string }>('/orders', {
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });
    return { orderId: order.id, keyId: credentials().keyId, mock: false };
  },

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const { keySecret } = credentials();
    return verifyHmacSha256(`${orderId}|${paymentId}`, keySecret, signature);
  },

  verifyWebhookSignature(rawBody, signature) {
    const secret = env().RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    return verifyHmacSha256(rawBody, secret, signature);
  },

  async refund({ paymentId, amountPaise, receipt }) {
    const refund = await rzp<{ id: string; status: string }>(`/payments/${paymentId}/refund`, {
      amount: amountPaise,
      speed: 'normal',
      receipt,
    });
    return { refundId: refund.id, status: refund.status === 'processed' ? 'processed' : 'pending' };
  },
};

/** Exposed for tests of the webhook signing scheme. */
export function razorpaySignForTest(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}
