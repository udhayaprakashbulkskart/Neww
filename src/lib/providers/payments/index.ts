import { env } from '@/lib/env';
import { mockGateway } from './mock';
import { razorpayGateway } from './razorpay';
import type { PaymentGateway } from './types';

export type { PaymentGateway, CreateOrderInput, CreateOrderResult } from './types';

/** Returns the configured gateway. Razorpay credentials are validated when first used. */
export const GATEWAY_LABEL = 'Razorpay (sandbox until live approval)';

export function getPaymentGateway(): PaymentGateway {
  const e = env();
  if (e.PAYMENT_PROVIDER === 'razorpay') {
    if (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET) {
      throw new Error('PAYMENT_PROVIDER=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }
    return razorpayGateway;
  }
  return mockGateway;
}
