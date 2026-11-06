import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { ApiError, errors } from '../http';
import { getPaymentGateway } from '../providers/payments';
import { checkoutConfig } from './donations';
import { audit } from './audit';
import { notify } from './notifications';

/** Each campaign post costs one paid credit. Paying opens the beneficiary dashboard. */
export const POST_FEE_PAISE = 10_000; // Rs 100

export async function postFeeStatus(userId: string) {
  const [paidPosts, availableCredits] = await Promise.all([
    db.postFee.count({ where: { userId, status: 'PAID' } }),
    db.postFee.count({ where: { userId, status: 'PAID', campaignId: null } }),
  ]);
  return {
    feePaise: POST_FEE_PAISE,
    paidPosts,
    availableCredits,
    hasDashboardAccess: paidPosts > 0,
  };
}

/** Starts a post-fee payment: one order for Rs 100, settled only by a verified webhook. */
export async function startPostFee(userId: string, ip: string | null) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== 'ACTIVE') throw errors.forbidden('Your account must be active to pay the post fee.');

  const gateway = getPaymentGateway();
  const fee = await db.postFee.create({
    data: { userId, amountPaise: POST_FEE_PAISE, provider: gateway.name },
    select: { id: true },
  });
  try {
    const order = await gateway.createOrder({
      amountPaise: POST_FEE_PAISE,
      receipt: fee.id.slice(0, 40),
      notes: { postFeeId: fee.id, type: 'post_fee' },
    });
    await db.postFee.update({ where: { id: fee.id }, data: { providerOrderId: order.orderId } });
    await audit({ actorId: userId, action: 'post_fee.started', entityType: 'PostFee', entityId: fee.id, ip });
    const cfg = checkoutConfig();
    return {
      postFeeId: fee.id,
      orderId: order.orderId,
      keyId: cfg.keyId,
      amountPaise: POST_FEE_PAISE,
      sandbox: gateway.isSandbox,
      mock: gateway.name === 'MOCK',
    };
  } catch {
    await db.postFee.update({ where: { id: fee.id }, data: { status: 'FAILED' } });
    throw errors.invalidState('We could not start the payment. Please try again in a moment.');
  }
}

/** Called from the verified webhook path. Idempotent: a paid fee is never credited twice. */
export async function markPostFeePaid(args: { orderId: string; paymentId: string; amountPaise: number }) {
  const fee = await db.postFee.findUnique({ where: { providerOrderId: args.orderId }, select: { id: true, userId: true, status: true, amountPaise: true } });
  if (!fee) return false;
  if (fee.status === 'PAID') return true;
  if (fee.amountPaise !== args.amountPaise) {
    await audit({ action: 'post_fee.amount_mismatch', entityType: 'PostFee', entityId: fee.id, metadata: { expected: fee.amountPaise, received: args.amountPaise } });
    return true;
  }
  const flipped = await db.postFee.updateMany({
    where: { id: fee.id, status: { not: 'PAID' } },
    data: { status: 'PAID', providerPaymentId: args.paymentId, paidAt: new Date() },
  });
  if (flipped.count === 1) {
    await audit({ actorId: fee.userId, action: 'post_fee.paid', entityType: 'PostFee', entityId: fee.id });
    await notify({
      userId: fee.userId,
      type: 'PAYMENT_CONFIRMATION',
      title: 'Post fee paid',
      body: 'Your Rs 100 post fee is paid. You can now open your dashboard and create a campaign.',
      link: '/app/beneficiary',
    });
  }
  return true;
}

export async function markPostFeeFailed(orderId: string) {
  await db.postFee.updateMany({ where: { providerOrderId: orderId, status: 'CREATED' }, data: { status: 'FAILED' } });
}

/** Reserves one paid credit for a new campaign draft. Runs inside the caller's transaction. */
export async function reserveCreditForCampaign(tx: Prisma.TransactionClient, userId: string, campaignId: string) {
  const credit = await tx.postFee.findFirst({
    where: { userId, status: 'PAID', campaignId: null },
    orderBy: { paidAt: 'asc' },
    select: { id: true },
  });
  if (!credit) {
    throw new ApiError(402, 'PAYMENT_REQUIRED', 'Pay the Rs 100 post fee to start a campaign.');
  }
  await tx.postFee.update({ where: { id: credit.id }, data: { campaignId } });
}
