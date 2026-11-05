import crypto from 'node:crypto';
import { env } from '@/lib/env';
import { verifyHmacSha256 } from '@/lib/crypto';
import type { CreateOrderInput, CreateOrderResult, PaymentGateway } from './types';

/**
 * Sandbox gateway used in development and tests. It mimics Razorpay's shapes and signing scheme
 * so the donation code path (order -> checkout signature -> webhook) is the same as production.
 * It is blocked in production by env.ts.
 */
function secret(): string {
  return env().MOCK_PAYMENT_SECRET ?? 'dev-only-mock-payment-secret';
}

export const mockGateway: PaymentGateway = {
  name: 'MOCK',
  isSandbox: true,

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return { orderId: `order_mock_${crypto.randomBytes(9).toString('base64url')}`, keyId: 'rzp_test_mockkey', mock: true };
  },

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    return verifyHmacSha256(`${orderId}|${paymentId}`, secret(), signature);
  },

  verifyWebhookSignature(rawBody, signature) {
    return verifyHmacSha256(rawBody, secret(), signature);
  },

  async refund({ paymentId }) {
    return { refundId: `rfnd_mock_${paymentId.slice(-8)}_${crypto.randomBytes(3).toString('hex')}`, status: 'processed' };
  },
};

/** Test/simulator helper: produce the signatures a real checkout and webhook would produce. */
export function mockSignCheckout(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', secret()).update(`${orderId}|${paymentId}`).digest('hex');
}

export function mockSignWebhook(rawBody: string): string {
  return crypto.createHmac('sha256', secret()).update(rawBody).digest('hex');
}
