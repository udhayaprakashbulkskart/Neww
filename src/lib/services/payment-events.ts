import crypto from 'node:crypto';
import { db } from '../db';
import { env } from '../env';
import { ApiError, errors } from '../http';
import { getPaymentGateway } from '../providers/payments';
import { mockSignCheckout, mockSignWebhook } from '../providers/payments/mock';
import { audit } from './audit';
import { notify } from './notifications';
import { flagAmountMismatch } from './fraud';
import { markRefundProcessed, recalcCampaign, verifyCheckout } from './donations';
import { formatINR } from '../format';
import { markPostFeeFailed, markPostFeePaid } from './billing';

/**
 * Webhook processing is the ONLY place a donation becomes successful.
 * Steps: verify signature over the raw body -> de-duplicate by event id -> apply in one transaction.
 */

type RazorpayPaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
};

export async function handleWebhook(args: { rawBody: string; signature: string | null; eventId: string | null; ip: string | null }) {
  const gateway = getPaymentGateway();
  if (!args.signature || !gateway.verifyWebhookSignature(args.rawBody, args.signature)) {
    await audit({ action: 'webhook.invalid_signature', entityType: 'Webhook', entityId: gateway.name, metadata: { bytes: args.rawBody.length }, ip: args.ip });
    throw new ApiError(400, 'INVALID_SIGNATURE', 'Signature verification failed.');
  }

  let event: { event: string; payload?: Record<string, { entity: unknown }> };
  try {
    event = JSON.parse(args.rawBody);
  } catch {
    throw errors.badRequest('Malformed event.');
  }

  const id = args.eventId ?? crypto.createHash('sha256').update(args.rawBody).digest('hex');
  try {
    await db.webhookEvent.create({
      data: {
        id,
        provider: gateway.name,
        eventType: event.event,
        payloadHash: crypto.createHash('sha256').update(args.rawBody).digest('hex'),
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return { received: true, duplicate: true };
    throw err;
  }

  try {
    await applyEvent(event);
  } catch (err) {
    // Processing failed, so release the de-duplication row. The provider's retry must be applied, not dropped.
    await db.webhookEvent.delete({ where: { id } }).catch(() => undefined);
    throw err;
  }

  await db.webhookEvent.update({ where: { id }, data: { processedAt: new Date() } });
  return { received: true, duplicate: false };
}

async function applyEvent(event: { event: string; payload?: Record<string, { entity: unknown }> }) {
  switch (event.event) {
    case 'payment.captured': {
      const p = event.payload?.payment?.entity as RazorpayPaymentEntity;
      await applyCaptured({ orderId: p.order_id, paymentId: p.id, amountPaise: p.amount, method: p.method ?? null });
      break;
    }
    case 'payment.failed': {
      const p = event.payload?.payment?.entity as RazorpayPaymentEntity;
      await applyFailed({ orderId: p.order_id, paymentId: p.id, code: p.error_code ?? 'UNKNOWN', description: p.error_description ?? null });
      break;
    }
    case 'refund.processed': {
      const r = event.payload?.refund?.entity as { id: string; payment_id: string } | undefined;
      if (r) {
        const refund = await db.refund.findFirst({ where: { providerRefundId: r.id }, select: { id: true } });
        if (refund) await markRefundProcessed({ refundId: refund.id, providerRefundId: r.id });
      }
      break;
    }
    default:
      break;
  }

}

async function nextReceipt(): Promise<string> {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `HT${ym}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function applyCaptured(args: { orderId: string; paymentId: string; amountPaise: number; method: string | null }) {
  if (await markPostFeePaid({ orderId: args.orderId, paymentId: args.paymentId, amountPaise: args.amountPaise })) return;
  const payment = await db.payment.findUnique({
    where: { providerOrderId: args.orderId },
    include: { donation: { select: { id: true, donorId: true, campaignId: true, amountPaise: true, status: true, campaign: { select: { beneficiaryId: true, title: true } } } } },
  });
  if (!payment) return;
  if (payment.status === 'CAPTURED') return;

  if (payment.amountPaise !== args.amountPaise) {
    // Never credit a mismatched amount. Hold it for a human.
    await flagAmountMismatch(payment.donation.campaignId, payment.donation.id, payment.amountPaise, args.amountPaise);
    await db.payment.update({ where: { id: payment.id }, data: { errorCode: 'AMOUNT_MISMATCH' } });
    return;
  }

  const receipt = await nextReceipt();
  const credited = await db.$transaction(async (tx) => {
    const flipped = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'CAPTURED' } },
      data: { status: 'CAPTURED', providerPaymentId: args.paymentId, method: args.method },
    });
    if (flipped.count === 0) return false;
    await tx.donation.update({
      where: { id: payment.donationId },
      data: { status: 'SUCCESS', paidAt: new Date(), receiptNumber: receipt },
    });
    await recalcCampaign(tx, payment.donation.campaignId);
    return true;
  });
  if (!credited) return;

  await audit({ action: 'payment.captured', entityType: 'Donation', entityId: payment.donationId, metadata: { amountPaise: args.amountPaise, campaignId: payment.donation.campaignId } });
  await notify({
    userId: payment.donation.donorId,
    type: 'PAYMENT_CONFIRMATION',
    title: 'Donation received',
    body: `Thank you. Your ${formatINR(args.amountPaise)} donation to "${payment.donation.campaign.title}" is confirmed. Receipt ${receipt}.`,
    link: `/app/donation/${payment.donationId}`,
    sms: 'PAYMENT_CONFIRMATION',
  });
  await notify({
    userId: payment.donation.campaign.beneficiaryId,
    type: 'DONATION_RECEIVED',
    title: 'New donation',
    body: `${formatINR(args.amountPaise)} received for your campaign.`,
    link: `/app/beneficiary`,
    sms: 'DONATION_RECEIVED',
  });
}

export async function applyFailed(args: { orderId: string; paymentId: string; code: string; description: string | null }) {
  await markPostFeeFailed(args.orderId);
  const payment = await db.payment.findUnique({ where: { providerOrderId: args.orderId }, include: { donation: { select: { id: true, donorId: true, status: true } } } });
  if (!payment || payment.status === 'CAPTURED') return;
  await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', providerPaymentId: args.paymentId, errorCode: args.code, errorDescription: args.description },
    }),
    db.donation.updateMany({ where: { id: payment.donationId, status: 'PENDING' }, data: { status: 'FAILED' } }),
  ]);
  await notify({
    userId: payment.donation.donorId,
    type: 'PAYMENT_CONFIRMATION',
    title: 'Payment not completed',
    body: 'Your payment was not completed. No money was taken for this donation. You can try again.',
    link: `/app/donate/failed/${payment.donationId}`,
  });
}

/**
 * Sandbox only: walks a donation through checkout signing and a signed webhook using the same code
 * paths as production. Refused in production and when the real gateway is configured.
 */
export async function simulateMockPayment(args: { donorId: string; donationId: string; outcome: 'success' | 'failed'; ip: string | null }) {
  if (!env().sandboxAllowed || getPaymentGateway().name !== 'MOCK') throw errors.notFound('Simulator');
  const donation = await db.donation.findUnique({ where: { id: args.donationId }, select: { donorId: true, payment: { select: { providerOrderId: true, amountPaise: true } } } });
  if (!donation || donation.donorId !== args.donorId || !donation.payment?.providerOrderId) throw errors.notFound('Donation');
  const orderId = donation.payment.providerOrderId;
  const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;

  if (args.outcome === 'failed') {
    const body = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: donation.payment.amountPaise, error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment was declined by the bank (sandbox).' } } },
    });
    return handleWebhook({ rawBody: body, signature: mockSignWebhook(body), eventId: `evt_mock_${crypto.randomBytes(6).toString('hex')}`, ip: args.ip });
  }

  // Checkout signature, then capture webhook. The browser never sees the mock secret.
  await verifyCheckout({
    donorId: args.donorId,
    ip: args.ip,
    body: { donationId: args.donationId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: mockSignCheckout(orderId, paymentId) },
  });
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: donation.payment.amountPaise, method: 'upi' } } },
  });
  return handleWebhook({ rawBody: body, signature: mockSignWebhook(body), eventId: `evt_mock_${crypto.randomBytes(6).toString('hex')}`, ip: args.ip });
}

/**
 * Sandbox only: completes any mock order through the same signed webhook used in production.
 * Refused whenever sandbox mode is off or a real gateway is configured.
 */
export async function simulateOrderCapture(args: { orderId: string; amountPaise: number; ip: string | null }) {
  if (!env().sandboxAllowed || getPaymentGateway().name !== 'MOCK') throw errors.notFound('Simulator');
  const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: args.orderId, amount: args.amountPaise, method: 'upi' } } },
  });
  return handleWebhook({ rawBody: body, signature: mockSignWebhook(body), eventId: `evt_mock_${crypto.randomBytes(6).toString('hex')}`, ip: args.ip });
}
