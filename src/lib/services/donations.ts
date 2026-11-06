import crypto from 'node:crypto';
import type { Prisma, RefundStatus } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { ApiError, errors } from '../http';
import { percent, publicName } from '../format';
import { rateLimit } from '../rate-limit';
import { getPaymentGateway } from '../providers/payments';
import { hasPermission, PERMISSIONS } from '../rbac';
import { audit } from './audit';
import { notify } from './notifications';
import { checkDonationVolume } from './fraud';
import { donationCreateSchema, donationVerifySchema } from '../validation/schemas';
import type { z } from 'zod';

export const REFUND_WINDOW_DAYS = 7;

/** A checkout that has not been paid within this window no longer holds campaign capacity. */
const CHECKOUT_WINDOW_MS = 30 * 60_000;

/** Admin-configurable limits, falling back to environment defaults. */
async function donationLimits() {
  const rows = await db.platformSetting.findMany({ where: { key: { in: ['donation_min_paise', 'donation_max_paise', 'maintenance_mode'] } } });
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const e = env();
  return {
    min: typeof v.donation_min_paise === 'number' ? v.donation_min_paise : e.DONATION_MIN_PAISE,
    max: typeof v.donation_max_paise === 'number' ? v.donation_max_paise : e.DONATION_MAX_PAISE,
    maintenance: v.maintenance_mode === true,
  };
}

/** Keys the browser needs to open checkout. Never includes a secret. */
export function checkoutConfig() {
  const gw = getPaymentGateway();
  return {
    provider: gw.name,
    keyId: gw.name === 'RAZORPAY' ? env().RAZORPAY_KEY_ID ?? '' : 'rzp_test_mockkey',
    sandbox: gw.isSandbox,
    mock: gw.name === 'MOCK',
    simulator: env().simulatorAllowed,
  };
}

function receiptNumber(): string {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `HT${ym}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Recalculate campaign totals from scratch. Used inside the same transaction as any money movement. */
export async function recalcCampaign(tx: Prisma.TransactionClient, campaignId: string) {
  const [campaign, agg, donors] = await Promise.all([
    tx.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { requestedPaise: true } }),
    tx.donation.aggregate({ where: { campaignId, status: 'SUCCESS' }, _sum: { amountPaise: true } }),
    tx.donation.findMany({ where: { campaignId, status: 'SUCCESS' }, distinct: ['donorId'], select: { donorId: true } }),
  ]);
  const raised = agg._sum.amountPaise ?? 0;
  await tx.campaign.update({
    where: { id: campaignId },
    data: { raisedPaise: raised, donorCount: donors.length, fundingPercent: percent(raised, campaign.requestedPaise) },
  });
}

/**
 * Step 1: create a pending donation and a gateway order. Idempotent on idempotencyKey so a double
 * tap or a retried request never creates two orders.
 */
export async function createDonation(args: { donorId: string; body: unknown; ip: string | null }) {
  const input = donationCreateSchema.parse(args.body);
  const limits = await donationLimits();
  if (limits.maintenance) throw new ApiError(503, 'MAINTENANCE', 'Donations are paused for maintenance. Please try again shortly.');
  if (input.amountPaise < limits.min || input.amountPaise > limits.max) {
    throw errors.badRequest(`Choose an amount between ₹${Math.ceil(limits.min / 100)} and ₹${Math.floor(limits.max / 100).toLocaleString('en-IN')}.`);
  }
  rateLimit(`donate:${args.donorId}`, 20, 60 * 60_000);

  const existing = await db.donation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payment: true, campaign: { select: { title: true, slug: true } } },
  });
  if (existing) {
    if (existing.donorId !== args.donorId) throw errors.conflict('This request was already used.');
    return donationResponse(existing);
  }

  const donor = await db.user.findUnique({ where: { id: args.donorId }, select: { status: true } });
  if (!donor || donor.status !== 'ACTIVE') throw errors.forbidden('Your account must be active to donate.');

  const campaign = await db.campaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true, title: true, slug: true, status: true, endsAt: true, requestedPaise: true, raisedPaise: true },
  });
  if (!campaign || campaign.status !== 'PUBLISHED') throw errors.notFound('Campaign');
  if (campaign.endsAt && campaign.endsAt.getTime() < Date.now()) throw errors.invalidState('This campaign has ended.');
  const remaining = campaign.requestedPaise - campaign.raisedPaise;
  if (remaining <= 0) throw errors.invalidState('This campaign has reached its goal. Thank you for wanting to help.');
  if (input.amountPaise > remaining) {
    throw errors.badRequest(`The campaign needs ₹${Math.floor(remaining / 100).toLocaleString('en-IN')} more. Choose a smaller amount.`);
  }

  await checkDonationVolume(args.ip, campaign.id);

  const gateway = getPaymentGateway();
  let donation;
  try {
    donation = await db.$transaction(async (tx) => {
      // Lock the campaign row so concurrent starts are serialised, then count checkouts still in progress.
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaign.id} FOR UPDATE`;
      const fresh = await tx.campaign.findUniqueOrThrow({ where: { id: campaign.id }, select: { requestedPaise: true, raisedPaise: true } });
      const inFlight = await tx.donation.aggregate({
        where: { campaignId: campaign.id, status: 'PENDING', createdAt: { gte: new Date(Date.now() - CHECKOUT_WINDOW_MS) } },
        _sum: { amountPaise: true },
      });
      const available = fresh.requestedPaise - fresh.raisedPaise - (inFlight._sum.amountPaise ?? 0);
      if (input.amountPaise > available) {
        throw errors.invalidState('Other donations to this campaign are being processed. Please try a smaller amount or try again in a few minutes.');
      }
      return tx.donation.create({
        data: {
          donorId: args.donorId,
          campaignId: campaign.id,
          amountPaise: input.amountPaise,
          isAnonymous: input.isAnonymous,
          idempotencyKey: input.idempotencyKey,
          clientIp: args.ip,
          payment: { create: { provider: gateway.name, amountPaise: input.amountPaise, status: 'CREATED' } },
        },
        include: { payment: true, campaign: { select: { title: true, slug: true } } },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const again = await db.donation.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: true, campaign: { select: { title: true, slug: true } } },
      });
      if (again && again.donorId === args.donorId) return donationResponse(again);
    }
    throw err;
  }

  try {
    const order = await gateway.createOrder({
      amountPaise: input.amountPaise,
      receipt: donation.id.slice(0, 40),
      notes: { donationId: donation.id, campaignId: campaign.id },
    });
    await db.payment.update({
      where: { donationId: donation.id },
      data: { providerOrderId: order.orderId, provider: gateway.name },
    });
  } catch {
    await db.$transaction([
      db.payment.update({ where: { donationId: donation.id }, data: { status: 'FAILED', errorCode: 'ORDER_CREATE_FAILED' } }),
      db.donation.update({ where: { id: donation.id }, data: { status: 'FAILED' } }),
    ]);
    throw errors.invalidState('We could not start the payment. Please try again in a moment.');
  }

  await audit({ actorId: args.donorId, action: 'donation.initiated', entityType: 'Donation', entityId: donation.id, metadata: { amountPaise: input.amountPaise, campaignId: campaign.id }, ip: args.ip });
  const fresh = await db.donation.findUniqueOrThrow({
    where: { id: donation.id },
    include: { payment: true, campaign: { select: { title: true, slug: true } } },
  });
  return donationResponse(fresh);
}

function donationResponse(d: {
  id: string;
  amountPaise: number;
  status: string;
  isAnonymous: boolean;
  payment: { providerOrderId: string | null; provider: string; status: string } | null;
  campaign: { title: string; slug: string };
}) {
  const cfg = checkoutConfig();
  return {
    donationId: d.id,
    status: d.status,
    amountPaise: d.amountPaise,
    currency: 'INR',
    orderId: d.payment?.providerOrderId ?? null,
    keyId: cfg.keyId,
    sandbox: cfg.sandbox,
    mock: cfg.mock,
    simulator: cfg.simulator,
    campaignTitle: d.campaign.title,
    campaignSlug: d.campaign.slug,
    paymentStatus: d.payment?.status ?? null,
  };
}

/**
 * Step 2: the browser returns the checkout signature. We verify it server-side and record the payment
 * as AUTHORIZED. The donation is NOT marked successful here. Only a verified webhook captures money.
 */
export async function verifyCheckout(args: { donorId: string; body: unknown; ip: string | null }) {
  const input = donationVerifySchema.parse(args.body);
  const donation = await db.donation.findUnique({ where: { id: input.donationId }, include: { payment: true } });
  if (!donation || donation.donorId !== args.donorId) throw errors.notFound('Donation');
  if (!donation.payment || donation.payment.providerOrderId !== input.razorpay_order_id) {
    throw errors.badRequest('Payment details do not match this donation.');
  }

  const gateway = getPaymentGateway();
  const valid = gateway.verifyCheckoutSignature({
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  });
  if (!valid) {
    await audit({ actorId: args.donorId, action: 'payment.signature_invalid', entityType: 'Donation', entityId: donation.id, ip: args.ip });
    throw errors.badRequest('We could not verify this payment. If money was debited, it will be confirmed or refunded automatically.');
  }

  if (donation.payment.status !== 'CAPTURED') {
    await db.payment.updateMany({
      where: { donationId: donation.id, status: { in: ['CREATED', 'AUTHORIZED'] } },
      data: { status: 'AUTHORIZED', providerPaymentId: input.razorpay_payment_id },
    });
  }
  const latest = await db.donation.findUniqueOrThrow({ where: { id: donation.id }, include: { payment: true, campaign: { select: { title: true, slug: true } } } });
  return donationResponse(latest);
}

export async function getDonationForDonor(donorId: string, donationId: string) {
  const d = await db.donation.findUnique({
    where: { id: donationId },
    include: {
      payment: { select: { status: true, method: true, errorDescription: true, providerPaymentId: true } },
      campaign: { select: { title: true, slug: true } },
      refunds: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, amountPaise: true } },
    },
  });
  if (!d || d.donorId !== donorId) throw errors.notFound('Donation');
  return {
    id: d.id,
    status: d.status,
    amountPaise: d.amountPaise,
    isAnonymous: d.isAnonymous,
    receiptNumber: d.receiptNumber,
    paidAt: d.paidAt,
    createdAt: d.createdAt,
    campaign: d.campaign,
    paymentStatus: d.payment?.status ?? null,
    paymentMethod: d.payment?.method ?? null,
    failureReason: d.payment?.status === 'FAILED' ? d.payment.errorDescription ?? 'The payment was not completed.' : null,
    refund: d.refunds[0] ?? null,
    transactionRef: d.payment?.providerPaymentId ?? null,
    refundEligible: d.status === 'SUCCESS' && !!d.paidAt && Date.now() - d.paidAt.getTime() < REFUND_WINDOW_DAYS * 86_400_000 && d.refunds.length === 0,
  };
}

export async function listDonationsForDonor(donorId: string) {
  return db.donation.findMany({
    where: { donorId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      amountPaise: true,
      status: true,
      receiptNumber: true,
      paidAt: true,
      createdAt: true,
      isAnonymous: true,
      campaign: { select: { title: true, slug: true } },
      refunds: { select: { status: true }, take: 1, orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function requestRefund(args: { donorId: string; donationId: string; reason: string; ip?: string | null }) {
  const d = await getDonationForDonor(args.donorId, args.donationId);
  if (d.status !== 'SUCCESS') throw errors.invalidState('Only successful donations can be refunded.');
  if (!d.refundEligible) {
    throw errors.invalidState(`Refunds can be requested within ${REFUND_WINDOW_DAYS} days of payment, once per donation.`);
  }
  const refund = await db.refund.create({
    data: { donationId: d.id, requesterId: args.donorId, amountPaise: d.amountPaise, reason: args.reason },
    select: { id: true, status: true },
  });
  await audit({ actorId: args.donorId, action: 'refund.requested', entityType: 'Refund', entityId: refund.id, metadata: { donationId: d.id }, ip: args.ip });
  await notify({ userId: args.donorId, type: 'REFUND_UPDATE', title: 'Refund requested', body: 'We received your refund request. We will review it and update you here.', link: `/app/donation/${d.id}` });
  return refund;
}

/** Staff approve or reject a refund request. Approval triggers a gateway refund. */
export async function decideRefund(args: { actorId: string; refundId: string; decision: 'APPROVE' | 'REJECT'; note: string; ip?: string | null }) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.REFUND_PROCESS))) throw errors.forbidden();
  const refund = await db.refund.findUnique({
    where: { id: args.refundId },
    include: { donation: { include: { payment: true } } },
  });
  if (!refund) throw errors.notFound('Refund');
  if (refund.status !== 'REQUESTED') throw errors.invalidState('This refund has already been decided.');

  if (args.decision === 'REJECT') {
    await db.refund.update({
      where: { id: refund.id },
      data: { status: 'REJECTED', decidedById: args.actorId, decidedAt: new Date(), decisionNote: args.note },
    });
    await notify({ userId: refund.requesterId, type: 'REFUND_UPDATE', title: 'Refund not approved', body: args.note, link: `/app/donation/${refund.donationId}` });
    await audit({ actorId: args.actorId, action: 'refund.rejected', entityType: 'Refund', entityId: refund.id, ip: args.ip });
    return { status: 'REJECTED' as RefundStatus };
  }

  const paymentId = refund.donation.payment?.providerPaymentId;
  if (!paymentId) throw errors.invalidState('The payment reference is missing, so this refund cannot be sent.');
  // Atomic claim: only one concurrent approval can move REQUESTED -> APPROVED and send the money.
  const claimed = await db.refund.updateMany({
    where: { id: refund.id, status: 'REQUESTED' },
    data: { status: 'APPROVED', decidedById: args.actorId, decidedAt: new Date(), decisionNote: args.note },
  });
  if (claimed.count === 0) throw errors.invalidState('This refund is already being processed or has been decided.');
  await audit({ actorId: args.actorId, action: 'refund.approved', entityType: 'Refund', entityId: refund.id, metadata: { amountPaise: refund.amountPaise }, ip: args.ip });

  try {
    const result = await getPaymentGateway().refund({ paymentId, amountPaise: refund.amountPaise, receipt: refund.id.slice(0, 40) });
    if (result.status === 'processed') {
      await markRefundProcessed({ refundId: refund.id, providerRefundId: result.refundId });
    } else {
      await db.refund.update({ where: { id: refund.id }, data: { providerRefundId: result.refundId } });
    }
    return { status: result.status === 'processed' ? ('PROCESSED' as RefundStatus) : ('APPROVED' as RefundStatus) };
  } catch {
    // Return to REQUESTED so a finance officer can approve again once the provider is reachable.
    await db.refund.updateMany({ where: { id: refund.id, status: 'APPROVED' }, data: { status: 'REQUESTED' } });
    await audit({ actorId: args.actorId, action: 'refund.failed', entityType: 'Refund', entityId: refund.id, ip: args.ip });
    throw errors.invalidState('The refund could not be sent to the payment provider. It is still awaiting approval, so you can try again.');
  }
}

/** Idempotent: a processed refund is never applied twice. */
export async function markRefundProcessed(args: { refundId: string; providerRefundId?: string }) {
  await db.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { id: args.refundId }, select: { id: true, status: true, donationId: true, amountPaise: true, requesterId: true, donation: { select: { campaignId: true, amountPaise: true } } } });
    if (!refund || refund.status === 'PROCESSED') return;
    await tx.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED', providerRefundId: args.providerRefundId ?? undefined } });
    await tx.donation.update({ where: { id: refund.donationId }, data: { status: 'REFUNDED' } });
    await recalcCampaign(tx, refund.donation.campaignId);
  });
  const refund = await db.refund.findUnique({ where: { id: args.refundId }, select: { requesterId: true, donationId: true } });
  if (refund) {
    await notify({ userId: refund.requesterId, type: 'REFUND_UPDATE', title: 'Refund processed', body: 'Your refund has been processed. It may take a few working days to reach your account.', link: `/app/donation/${refund.donationId}` });
  }
}

export async function donationRecipientLabel(donationId: string) {
  const d = await db.donation.findUnique({ where: { id: donationId }, select: { isAnonymous: true, donor: { select: { fullName: true } } } });
  if (!d) return null;
  return d.isAnonymous ? 'Anonymous donor' : publicName(d.donor.fullName);
}

/** Used by the receipt route. Returns only what the receipt needs. */
export async function receiptData(viewerId: string, donationId: string, isStaff: boolean) {
  const d = await db.donation.findUnique({
    where: { id: donationId },
    select: {
      id: true,
      donorId: true,
      amountPaise: true,
      status: true,
      receiptNumber: true,
      paidAt: true,
      isAnonymous: true,
      donor: { select: { fullName: true } },
      campaign: { select: { title: true, beneficiaryId: true } },
      payment: { select: { providerPaymentId: true, method: true } },
    },
  });
  if (!d || d.status !== 'SUCCESS' || !d.receiptNumber) throw errors.notFound('Receipt');
  if (!isStaff && d.donorId !== viewerId) throw errors.notFound('Receipt');
  return d;
}

export type DonationCreateInput = z.infer<typeof donationCreateSchema>;
