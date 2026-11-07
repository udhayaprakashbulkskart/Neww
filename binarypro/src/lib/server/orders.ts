// Retail orders and the commission lifecycle.
//
// PENDING_PAYMENT -> PAID (payment captured; funds held in ESCROW)
//   -> DELIVERED (merchant confirms delivery; return window opens)
//   -> VERIFIED (after the return window: commissions, cashback and PV are released)
//   -> RETURNED (reverses everything that was released)
//
// Commissions, cashback and binary PV come ONLY from VERIFIED retail orders. Membership fees never count.
import { applyBps, convertMinor, BASE_CURRENCY, type Currency } from '@/lib/domain/money';
import { computeCashback } from '@/lib/domain/cashback';
import { isSelfPurchase } from '@/lib/domain/fraud';
import { COMMISSION_FUNDING_BPS, PLANS, type Tier } from '@/lib/domain/plans';
import { isMembershipActive } from './membership';
import { accounts } from './accounts';
import { addPvUpline, removePvUpline } from './binary';
import { audit } from './audit';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { balanceOf, postTransaction, type AccountSpec, type PostingLeg } from './ledger';
import { loadRates } from './rates';
import { RETURN_WINDOW_DAYS, addDays } from './time';

export interface OrderLineInput {
  productId: string;
  quantity: number;
}

export async function createOrder(
  buyerId: string,
  lines: OrderLineInput[],
  couponCode: string | null,
  now = new Date(),
) {
  if (lines.length === 0 || lines.length > 50) throw new DomainError('INVALID_ORDER', 'Add between 1 and 50 items');
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 99) {
      throw new DomainError('INVALID_QUANTITY', 'Quantity must be between 1 and 99');
    }
  }
  const buyer = await db.user.findUnique({ where: { id: buyerId }, include: { membership: true } });
  if (!buyer || buyer.status !== 'ACTIVE') throw new DomainError('FORBIDDEN', 'Account is not active', 403);
  if (!isMembershipActive(buyer.membership, now)) throw new DomainError('MEMBERSHIP_REQUIRED', 'An active membership is required to shop', 403);

  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } });
  if (products.length !== productIds.length) throw new DomainError('PRODUCT_UNAVAILABLE', 'One or more products are unavailable', 409);
  const merchantIds = new Set(products.map((p) => p.merchantId));
  if (merchantIds.size !== 1) throw new DomainError('MIXED_MERCHANTS', 'Place one order per merchant');
  const currencies = new Set(products.map((p) => p.currency));
  if (currencies.size !== 1) throw new DomainError('MIXED_CURRENCIES', 'Products in one order must share a currency');
  const merchantId = [...merchantIds][0]!;
  const currency = [...currencies][0] as Currency;
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = lines.reduce((sum, l) => sum + byId.get(l.productId)!.priceMinor * BigInt(l.quantity), 0n);

  const rates = await loadRates();
  const pvInr = convertMinor(subtotal, currency, BASE_CURRENCY, rates);

  let couponId: string | null = null;
  let cashbackMinor = 0n;
  if (couponCode) {
    const coupon = await db.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
    if (!coupon) throw new DomainError('COUPON_INVALID', 'Coupon not found', 409);
    if (coupon.funding === 'MERCHANT' && coupon.merchantId !== merchantId) {
      throw new DomainError('COUPON_INVALID', 'This coupon is not valid for this merchant', 409);
    }
    const poolKey = coupon.funding === 'MERCHANT'
      ? accounts.merchantPool(merchantId, coupon.currency).key
      : accounts.promoPool(coupon.id, coupon.currency).key;
    const poolBalance = await balanceOf(db, poolKey);
    const userRedemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId: buyerId, reversed: false },
    });
    const result = computeCashback({
      subtotalMinor: subtotal,
      orderCurrency: currency,
      couponCurrency: coupon.currency,
      percent: coupon.percent,
      maxCashbackMinor: coupon.maxCashbackMinor,
      minOrderMinor: coupon.minOrderMinor,
      startsAt: coupon.startsAt,
      endsAt: coupon.endsAt,
      active: coupon.active,
      now,
      userRedemptions,
      perUserLimit: coupon.perUserLimit,
      poolBalanceMinor: poolBalance,
    });
    if (!result.ok) throw new DomainError('COUPON_INVALID', result.reason, 409);
    couponId = coupon.id;
    cashbackMinor = result.cashbackMinor;
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        buyerId,
        merchantId,
        currency,
        subtotalMinor: subtotal,
        pvInrMinor: pvInr,
        cashbackMinor,
        couponId,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPriceMinor: byId.get(l.productId)!.priceMinor,
          })),
        },
      },
    });
    await tx.payment.create({
      data: {
        kind: 'ORDER',
        referenceId: order.id,
        userId: buyerId,
        amountMinor: subtotal,
        currency,
        providerRef: `ord_${order.id}`,
      },
    });
    await audit(tx, { action: 'order.created', actorId: buyerId, targetId: order.id, meta: { subtotal: subtotal.toString(), currency } });
    return order;
  });
}

/** Called from the verified payment webhook. */
export async function markOrderPaid(tx: Tx, orderId: string, paymentId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new DomainError('NOT_FOUND', 'Order not found', 404);
  if (order.status !== 'PENDING_PAYMENT') return order;
  await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt: new Date() } });
  await postTransaction(tx, {
    reference: `ORDER_PAID:${orderId}`,
    type: 'ORDER_PAYMENT',
    description: 'Retail order payment held in escrow',
    legs: [
      { ...accounts.cash(order.currency), direction: 'DEBIT', amountMinor: order.subtotalMinor },
      { ...accounts.escrow(order.currency), direction: 'CREDIT', amountMinor: order.subtotalMinor },
    ],
  });
  await audit(tx, { action: 'order.paid', targetId: orderId, meta: { paymentId } });
  return order;
}

/** Merchant or admin confirms delivery. Opens the return window. */
export async function markDelivered(orderId: string, actorId: string, now = new Date()) {
  const res = await db.order.updateMany({
    where: { id: orderId, status: 'PAID' },
    data: { status: 'DELIVERED', deliveredAt: now, returnWindowEndsAt: addDays(now, RETURN_WINDOW_DAYS) },
  });
  if (res.count !== 1) throw new DomainError('INVALID_STATE', 'Order must be PAID to mark delivered', 409);
  await db.$transaction((tx) => audit(tx, { action: 'order.delivered', actorId, targetId: orderId }));
}

/** Releases commissions for an order once its return window has passed. Idempotent. */
export async function verifyOrder(orderId: string, actorId: string | null, now = new Date()) {
  return db.$transaction(
    async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: 'DELIVERED' },
        data: { status: 'VERIFIED', verifiedAt: now },
      });
      if (claimed.count !== 1) {
        const existing = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
        if (existing?.status === 'VERIFIED') return { orderId, alreadyVerified: true };
        throw new DomainError('INVALID_STATE', 'Order must be DELIVERED to verify', 409);
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { buyer: { select: { id: true, sponsorId: true, parentId: true } }, merchant: true },
      });
      if (order.returnWindowEndsAt && now < order.returnWindowEndsAt) {
        throw new DomainError('RETURN_WINDOW_OPEN', 'Return window has not closed yet', 409);
      }

      // Fraud rule: a buyer may not earn from a purchase whose commission recipient sits in their own upline.
      let sponsorUpline: string[] = [];
      if (order.buyer.sponsorId) {
        let cursor: string | null = order.buyer.sponsorId;
        while (cursor) {
          sponsorUpline.push(cursor);
          const s: { sponsorId: string | null } | null = await tx.user.findUnique({ where: { id: cursor }, select: { sponsorId: true } });
          cursor = s?.sponsorId ?? null;
          if (sponsorUpline.length > 500) break;
        }
      }
      const selfPurchase = isSelfPurchase(order.buyerId, sponsorUpline);
      const blocked = selfPurchase ? 'SELF_PURCHASE' : null;
      if (blocked) {
        await tx.order.update({ where: { id: orderId }, data: { commissionBlocked: blocked } });
        await tx.fraudFlag.create({ data: { userId: order.buyerId, kind: 'SELF_PURCHASE', detail: `Order ${orderId} withheld` } });
      }

      const currency = order.currency as Currency;
      const pv = order.pvInrMinor;
      let fundedCur = 0n;

      if (!blocked) {
        // 1. Fund the commission reserve from escrow (a fixed share of retail PV).
        const fundCur = applyBps(order.subtotalMinor, COMMISSION_FUNDING_BPS);
        const fundInr = applyBps(pv, COMMISSION_FUNDING_BPS);
        if (fundCur > 0n && fundInr > 0n) {
          await postTransaction(tx, {
            reference: `FUND:${orderId}`,
            type: 'COMMISSION_FUNDING',
            description: 'Commission reserve funding from verified sale',
            legs: [
              { ...accounts.escrow(currency), direction: 'DEBIT', amountMinor: fundCur },
              { ...accounts.fxClearing(currency), direction: 'CREDIT', amountMinor: fundCur },
              { ...accounts.fxClearing(BASE_CURRENCY), direction: 'DEBIT', amountMinor: fundInr },
              { ...accounts.commissionReserve(), direction: 'CREDIT', amountMinor: fundInr },
            ],
          });
          fundedCur = fundCur;
        }

        // 2. Direct commission to the sponsor (verified retail sale only).
        if (order.buyer.sponsorId) {
          const sponsor = await tx.user.findUnique({
            where: { id: order.buyer.sponsorId },
            select: { id: true, status: true, membership: { select: { tier: true, active: true, expiresAt: true } } },
          });
          if (sponsor && sponsor.status === 'ACTIVE' && isMembershipActive(sponsor.membership, now)) {
            const plan = PLANS[sponsor.membership!.tier as Tier];
            const reserve = await balanceOf(tx, accounts.commissionReserve().key);
            let amount = applyBps(pv, plan.directBps);
            if (amount > reserve) amount = reserve;
            if (amount > 0n) {
              await postTransaction(tx, {
                reference: `DIRECT:${orderId}`,
                type: 'DIRECT_COMMISSION',
                description: 'Direct commission on verified retail sale',
                legs: [
                  { ...accounts.commissionReserve(), direction: 'DEBIT', amountMinor: amount },
                  { ...accounts.wallet(sponsor.id, BASE_CURRENCY), direction: 'CREDIT', amountMinor: amount },
                ],
              });
              await tx.commission.create({
                data: { userId: sponsor.id, type: 'DIRECT', sourceOrderId: orderId, amountMinor: amount },
              });
            }
          }
        }

        // 3. Binary PV for every ancestor on the buyer's leg.
        await addPvUpline(tx, order.buyerId, pv);
      }

      // 4. Cashback, funded only by the coupon's merchant or promo pool.
      let cashback = 0n;
      if (order.couponId && order.cashbackMinor > 0n && !blocked) {
        const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: order.couponId } });
        const poolSpec = coupon.funding === 'MERCHANT'
          ? accounts.merchantPool(order.merchantId, currency)
          : accounts.promoPool(coupon.id, currency);
        const poolBal = await balanceOf(tx, poolSpec.key);
        cashback = order.cashbackMinor < poolBal ? order.cashbackMinor : poolBal;
        if (cashback > 0n) {
          await postTransaction(tx, {
            reference: `CASHBACK:${orderId}`,
            type: 'CASHBACK',
            description: 'Merchant or promotional cashback',
            legs: [
              { ...poolSpec, direction: 'DEBIT', amountMinor: cashback },
              { ...accounts.wallet(order.buyerId, currency), direction: 'CREDIT', amountMinor: cashback },
            ],
          });
          await tx.couponRedemption.create({
            data: { couponId: coupon.id, userId: order.buyerId, orderId, cashbackMinor: cashback },
          });
        }
      }
      if (cashback !== order.cashbackMinor) {
        await tx.order.update({ where: { id: orderId }, data: { cashbackMinor: cashback } });
      }

      // 5. Remaining escrow belongs to the merchant (payable; settled by finance).
      const merchantShare = order.subtotalMinor - fundedCur;
      if (merchantShare > 0n) {
        await postTransaction(tx, {
          reference: `MERCHANT_SHARE:${orderId}`,
          type: 'MERCHANT_PAYABLE',
          description: 'Merchant share of verified sale',
          legs: [
            { ...accounts.escrow(currency), direction: 'DEBIT', amountMinor: merchantShare },
            { ...accounts.merchantPayable(order.merchantId, currency), direction: 'CREDIT', amountMinor: merchantShare },
          ],
        });
      }

      await audit(tx, { action: 'order.verified', actorId, targetId: orderId, meta: { blocked, pv: pv.toString(), cashback: cashback.toString() } });
      return { orderId, alreadyVerified: false, blocked };
    },
    { timeout: 60_000 },
  );
}

/**
 * Records a return. Reverses commissions, cashback and PV released for the order. Any part that the
 * recipient has already withdrawn becomes a clawback receivable instead of a negative balance.
 */
export async function returnOrder(orderId: string, actorId: string, now = new Date()) {
  return db.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { commissions: true, redemptions: true } });
      if (!order) throw new DomainError('NOT_FOUND', 'Order not found', 404);
      if (order.status === 'RETURNED') throw new DomainError('INVALID_STATE', 'Order already returned', 409);
      if (order.status === 'PENDING_PAYMENT' || order.status === 'CANCELLED') {
        throw new DomainError('INVALID_STATE', 'Order has not been paid', 409);
      }
      const currency = order.currency as Currency;

      if (order.status === 'VERIFIED') {
        for (const c of order.commissions.filter((c) => c.status === 'POSTED' && c.type === 'DIRECT')) {
          await clawbackFromWallet(tx, c.userId, BASE_CURRENCY, c.amountMinor, `REVERSE_DIRECT:${c.id}`, accounts.commissionReserve());
          await tx.commission.update({ where: { id: c.id }, data: { status: 'REVERSED' } });
        }
        for (const r of order.redemptions.filter((r) => !r.reversed)) {
          const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: r.couponId } });
          const pool = coupon.funding === 'MERCHANT'
            ? accounts.merchantPool(order.merchantId, currency)
            : accounts.promoPool(coupon.id, currency);
          await clawbackFromWallet(tx, order.buyerId, currency, r.cashbackMinor, `REVERSE_CASHBACK:${r.id}`, pool);
          await tx.couponRedemption.update({ where: { id: r.id }, data: { reversed: true } });
        }
        if (order.commissionBlocked === null) await removePvUpline(tx, order.buyerId, order.pvInrMinor);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'RETURNED', returnedAt: now, refundDueMinor: order.subtotalMinor },
      });
      await audit(tx, { action: 'order.returned', actorId, targetId: orderId, meta: { wasVerified: order.status === 'VERIFIED' } });
      return { orderId, refundDueMinor: order.subtotalMinor };
    },
    { timeout: 60_000 },
  );
}

/**
 * Moves money from a user's wallet back to where it came from (`destination`). If the wallet no longer
 * holds enough (the user already withdrew), the shortfall is booked as a clawback receivable.
 */
async function clawbackFromWallet(
  tx: Tx,
  userId: string,
  currency: Currency,
  amount: bigint,
  reference: string,
  destination: AccountSpec,
): Promise<void> {
  const walletBal = await balanceOf(tx, accounts.wallet(userId, currency).key);
  const take = walletBal < amount ? walletBal : amount;
  const shortfall = amount - take;
  const legs: PostingLeg[] = [];
  if (take > 0n) {
    legs.push({ ...accounts.wallet(userId, currency), direction: 'DEBIT', amountMinor: take });
    legs.push({ ...destination, direction: 'CREDIT', amountMinor: take });
  }
  if (shortfall > 0n) {
    legs.push({ ...accounts.clawbackReceivable(currency), direction: 'DEBIT', amountMinor: shortfall });
    legs.push({ ...destination, direction: 'CREDIT', amountMinor: shortfall });
  }
  if (legs.length === 0) return;
  await postTransaction(tx, { reference, type: 'CLAWBACK', description: 'Reversal for returned order', legs });
}
