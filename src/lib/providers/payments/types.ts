/** Payment gateway contract. Implementations: Razorpay (live/test) and the local sandbox mock. */
export interface CreateOrderInput {
  amountPaise: number;
  receipt: string; // <= 40 chars, our donation id
  notes: Record<string, string>;
}

export interface CreateOrderResult {
  orderId: string;
  keyId: string; // public key id only, safe for the browser
  mock: boolean;
}

export interface PaymentGateway {
  readonly name: 'RAZORPAY' | 'MOCK';
  readonly isSandbox: boolean;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  /** Verifies the signature Razorpay Checkout returns to the browser. Not sufficient to mark a payment successful. */
  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  /** Verifies the X-Razorpay-Signature header over the exact raw request body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  refund(input: { paymentId: string; amountPaise: number; receipt: string }): Promise<{ refundId: string; status: 'processed' | 'pending' }>;
}
