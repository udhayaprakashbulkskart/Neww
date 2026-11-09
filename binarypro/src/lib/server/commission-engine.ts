// Commission engine: accrual on verified sales, daily cap settlement, refund reversal and policy versions.
// Sponsor-linked and binary commission are not computed here at all.
import { db, type Tx } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { accounts } from './accounts';
import { balanceOf, postTransaction, type AccountSpec, type PostingLeg } from './ledger';
import {
  businessDayKey, policyActivationBlockers, productCommission, settleDay, validateDailyCap,
} from '@/lib/domain/finance-engine';
import { parseMinor } from '@/lib/domain/money';

type Db = Tx | typeof db;

export const pendingAccount = (userId: string): AccountSpec => ({
  key: `PENDING_COMMISSION:${userId}:INR`, normal: 'CREDIT', allowNegative: false, currency: 'INR', userId,
});

// ---------- policy versions ----------

/** The current policy for a kind: the highest version. It is in force only if it is active. */
export async function currentPolicy(kind: string, client: Db = db) {
  const p = await client.commissionPolicy.findFirst({ where: { kind: kind as 'PRODUCT' }, orderBy: { version: 'desc' } });
  return p;
}

export async function publishPolicy(
  input: { kind: 'PRODUCT' | 'SERVICE' | 'DIRECT_SPONSOR' | 'BINARY'; rateBps: number; active: boolean; legalApprovalRef?: string | null; reason: string },
  actorId: string,
) {
  if (input.reason.trim().length < 8) throw new DomainError('VALIDATION', 'Enter the reason for this policy version (at least 8 characters)', 422);
  if (input.active) {
    const problems = policyActivationBlockers({ kind: input.kind, rateBps: input.rateBps, legalApprovalRef: input.legalApprovalRef ?? null });
    if (problems.length) throw new DomainError('ACTIVATION_BLOCKED', problems.join('. '), 422);
  } else if (input.kind === 'DIRECT_SPONSOR' || input.kind === 'BINARY') {
    if (input.rateBps !== 0) throw new DomainError('VALIDATION', 'Disabled policies keep a zero rate', 422);
  }
  if (!Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10000) throw new DomainError('VALIDATION', 'Rate must be between 0 and 10000 basis points', 422);
  return db.$transaction(async (tx) => {
    const latest = await tx.commissionPolicy.findFirst({ where: { kind: input.kind }, orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;
    const created = await tx.commissionPolicy.create({
      data: {
        kind: input.kind, version, rateBps: input.rateBps, active: input.active,
        legalApprovalRef: input.legalApprovalRef?.trim() || null, reason: input.reason.trim(), createdBy: actorId,
      },
    });
    await audit(tx, { action: 'policy.published', actorId, targetId: created.id, meta: { kind: input.kind, version, rateBps: input.rateBps, active: input.active, reason: input.reason.trim() } });
    return created;
  });
}

export async function setDailyCap(capRupees: string | null, reason: string, actorId: string) {
  if (reason.trim().length < 8) throw new DomainError('VALIDATION', 'Enter the reason for this change (at least 8 characters)', 422);
  let capMinor: bigint | null = null;
  if (capRupees !== null && capRupees.trim() !== '') {
    try {
      capMinor = parseMinor(capRupees);
    } catch {
      throw new DomainError('VALIDATION', 'Enter the daily cap in rupees, for example 5000 or 5000.00', 422);
    }
    const problem = validateDailyCap(capMinor);
    if (problem) throw new DomainError('VALIDATION', problem, 422);
  }
  return db.$transaction(async (tx) => {
    const before = await tx.dailyCapSetting.findUnique({ where: { id: 'default' } });
    const after = await tx.dailyCapSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', capMinor, reason: reason.trim(), updatedAt: new Date(), updatedBy: actorId },
      update: { capMinor, reason: reason.trim(), updatedAt: new Date(), updatedBy: actorId },
    });
    await audit(tx, {
      action: 'cap.changed', actorId, targetId: 'default',
      meta: { reason: reason.trim(), before: before?.capMinor?.toString() ?? null, after: after.capMinor?.toString() ?? null },
    });
    return after;
  });
}

export async function dailyCap(client: Db = db): Promise<bigint | null> {
  const row = await client.dailyCapSetting.findUnique({ where: { id: 'default' } });
  return row?.capMinor ?? null;
}

// ---------- accrual on verified sales ----------

/** Unsettled amount of a commission entry: accrued minus everything already released or reversed. */
export async function unsettledOf(tx: Db, entryId: string, accruedMinor: bigint): Promise<bigint> {
  const agg = await tx.commissionEvent.aggregate({ where: { entryId }, _sum: { amountMinor: true } });
  return accruedMinor - (agg._sum.amountMinor ?? 0n);
}

/**
 * Accrues eligible commission and volume for a verified sale. Called inside the verification transaction.
 * Volume is always recorded for a genuine verified sale. Commission is recorded only under an active policy,
 * within the merchant or promo budget, and never twice for the same order.
 */
export async function accrueVerifiedSale(
  tx: Tx,
  order: { id: string; buyerId: string; merchantId: string; currency: string; subtotalMinor: bigint; pvInrMinor: bigint; cashbackMinor: bigint; couponId: string | null },
  verifiedAt: Date,
): Promise<{ commissionMinor: bigint; volumeMinor: bigint }> {
  const dayKey = businessDayKey(verifiedAt);
  let volumeMinor = 0n;
  if (order.pvInrMinor > 0n) {
    await tx.volumeEntry.create({ data: { userId: order.buyerId, orderId: order.id, kind: 'ACCRUE', pvMinor: order.pvInrMinor, dayKey } });
    volumeMinor = order.pvInrMinor;
  }

  let commissionMinor = 0n;
  const policy = await currentPolicy('PRODUCT', tx);
  if (policy && policy.active && order.couponId && order.cashbackMinor > 0n && order.currency === 'INR') {
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: order.couponId } });
    const pool = coupon.funding === 'MERCHANT' ? accounts.merchantPool(order.merchantId, 'INR') : accounts.promoPool(coupon.id, 'INR');
    const budget = await balanceOf(tx, pool.key);
    commissionMinor = productCommission({
      saleMinor: order.subtotalMinor, rateBps: policy.rateBps, active: true, budgetMinor: budget, requestedMinor: order.cashbackMinor,
    });
    if (commissionMinor > 0n) {
      await postTransaction(tx, {
        reference: `PCOMM:${order.id}:${order.buyerId}`,
        type: 'PRODUCT_COMMISSION_ACCRUED',
        description: 'Product sales commission, pending daily release',
        legs: [
          { ...pool, direction: 'DEBIT', amountMinor: commissionMinor },
          { ...pendingAccount(order.buyerId), direction: 'CREDIT', amountMinor: commissionMinor },
        ],
      });
      await tx.commissionEntry.create({
        data: { userId: order.buyerId, orderId: order.id, kind: 'PRODUCT', policyVersion: policy.version, amountMinor: commissionMinor, dayKey },
      });
      await tx.couponRedemption.create({ data: { couponId: coupon.id, userId: order.buyerId, orderId: order.id, cashbackMinor: commissionMinor } });
    }
  }
  return { commissionMinor, volumeMinor };
}

// ---------- refund reversal ----------

/**
 * Reverses everything a verified order earned: unsettled commission goes back to its source pool, released
 * commission is clawed back from the wallet (any shortfall becomes a receivable), and volume is reversed.
 * Safe to call once per order; the caller marks the order returned in the same transaction.
 */
export async function reverseVerifiedSale(tx: Tx, order: { id: string; buyerId: string; merchantId: string; currency: string; couponId: string | null }, now: Date) {
  const dayKey = businessDayKey(now);
  const entries = await tx.commissionEntry.findMany({ where: { orderId: order.id }, include: { events: true } });
  let reversedMinor = 0n;
  let clawbackMinor = 0n;
  for (const entry of entries) {
    const released = entry.events.filter((e) => e.type === 'RELEASE').reduce((a, e) => a + e.amountMinor, 0n);
    const reversedBefore = entry.events.filter((e) => e.type === 'REVERSE').reduce((a, e) => a + e.amountMinor, 0n);
    const unsettled = entry.amountMinor - released - reversedBefore;
    const coupon = order.couponId ? await tx.coupon.findUnique({ where: { id: order.couponId } }) : null;
    // Same source as accrual: merchant-funded coupons draw on the merchant pool, all others on the promo pool.
    const pool = coupon && coupon.funding !== 'MERCHANT' ? accounts.promoPool(coupon.id, 'INR') : accounts.merchantPool(order.merchantId, 'INR');
    if (unsettled > 0n) {
      await postTransaction(tx, {
        reference: `REVPEND:${entry.id}`,
        type: 'COMMISSION_REVERSAL',
        description: 'Pending commission reversed after return',
        legs: [
          { ...pendingAccount(entry.userId), direction: 'DEBIT', amountMinor: unsettled },
          { ...pool, direction: 'CREDIT', amountMinor: unsettled },
        ],
      });
      await tx.commissionEvent.create({ data: { entryId: entry.id, type: 'REVERSE', amountMinor: unsettled, dayKey, reference: `REVPEND:${entry.id}` } });
      reversedMinor += unsettled;
    }
    if (released > 0n) {
      const legs: PostingLeg[] = [];
      const walletBal = await balanceOf(tx, accounts.wallet(entry.userId, 'INR').key);
      const take = walletBal < released ? walletBal : released;
      if (take > 0n) {
        legs.push({ ...accounts.wallet(entry.userId, 'INR'), direction: 'DEBIT', amountMinor: take });
        legs.push({ ...pool, direction: 'CREDIT', amountMinor: take });
      }
      const shortfall = released - take;
      if (shortfall > 0n) {
        legs.push({ ...accounts.clawbackReceivable('INR'), direction: 'DEBIT', amountMinor: shortfall });
        legs.push({ ...pool, direction: 'CREDIT', amountMinor: shortfall });
        clawbackMinor += shortfall;
      }
      if (legs.length) {
        await postTransaction(tx, { reference: `REVREL:${entry.id}`, type: 'COMMISSION_CLAWBACK', description: 'Released commission clawed back after return', legs });
      }
      await tx.commissionEvent.create({ data: { entryId: entry.id, type: 'REVERSE', amountMinor: released, dayKey, reference: `REVREL:${entry.id}` } });
      reversedMinor += released;
    }
  }

  const volume = await tx.volumeEntry.findFirst({ where: { orderId: order.id, userId: order.buyerId, kind: 'ACCRUE' } });
  if (volume && !(await tx.volumeEntry.findFirst({ where: { orderId: order.id, userId: order.buyerId, kind: 'REVERSE' } }))) {
    await tx.volumeEntry.create({ data: { userId: order.buyerId, orderId: order.id, kind: 'REVERSE', pvMinor: volume.pvMinor, dayKey } });
  }
  return { reversedMinor, clawbackMinor };
}

// ---------- daily settlement ----------

export async function runDailySettlement(dayKey: string, actorId: string, reason: string, now = new Date()) {
  if (reason.trim().length < 8) throw new DomainError('VALIDATION', 'Enter the reason for this settlement (at least 8 characters)', 422);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new DomainError('VALIDATION', 'Use a business day in YYYY-MM-DD form', 422);
  if (dayKey >= businessDayKey(now)) throw new DomainError('VALIDATION', 'A business day can be settled only after it has ended (Asia/Kolkata)', 409);
  const cap = await dailyCap();
  if (cap === null) throw new DomainError('CAP_NOT_CONFIGURED', 'Set the daily cap in the admin console before settling', 409);

  // Candidates: anyone with a commission entry today, or with unsettled commission carried from earlier days.
  const candidates = await db.$queryRaw<{ userId: string }[]>`
    SELECT DISTINCT e."userId" AS "userId" FROM "CommissionEntry" e
    WHERE e."dayKey" <= ${dayKey}
      AND (e."amountMinor" - COALESCE((SELECT sum(ev."amountMinor") FROM "CommissionEvent" ev WHERE ev."entryId" = e.id), 0) > 0
           OR e."dayKey" = ${dayKey})
    ORDER BY 1`;

  const results: { userId: string; status: 'SETTLED' | 'ALREADY_SETTLED'; payableMinor: string; carriedOutMinor: string }[] = [];
  for (const { userId } of candidates) {
    const r = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const existing = await tx.dailyCommissionSummary.findUnique({ where: { userId_dayKey: { userId, dayKey } } });
      if (existing) return { userId, status: 'ALREADY_SETTLED' as const, payableMinor: existing.payableMinor.toString(), carriedOutMinor: existing.carriedOutMinor.toString() };

      const entries = await tx.commissionEntry.findMany({
        where: { userId, dayKey: { lte: dayKey } }, include: { events: true }, orderBy: [{ dayKey: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const open = entries
        .map((e) => ({ id: e.id, dayKey: e.dayKey, remaining: e.amountMinor - e.events.reduce((a, ev) => a + ev.amountMinor, 0n) }))
        .filter((e) => e.remaining > 0n);
      const eligibleMinor = open.filter((e) => e.dayKey === dayKey).reduce((a, e) => a + e.remaining, 0n);
      const carriedInMinor = open.filter((e) => e.dayKey < dayKey).reduce((a, e) => a + e.remaining, 0n);
      const { payableMinor, carriedOutMinor } = settleDay({ eligibleMinor, carriedInMinor, capMinor: cap });

      // Release oldest first.
      let left = payableMinor;
      for (const e of open) {
        if (left <= 0n) break;
        const take = e.remaining < left ? e.remaining : left;
        await tx.commissionEvent.create({ data: { entryId: e.id, type: 'RELEASE', amountMinor: take, dayKey, reference: `REL:${e.id}:${dayKey}` } });
        left -= take;
      }
      if (payableMinor > 0n) {
        await postTransaction(tx, {
          reference: `SETTLE:${userId}:${dayKey}`,
          type: 'COMMISSION_RELEASE',
          description: `Daily commission release for ${dayKey} (cap applied)`,
          legs: [
            { ...pendingAccount(userId), direction: 'DEBIT', amountMinor: payableMinor },
            { ...accounts.wallet(userId, 'INR'), direction: 'CREDIT', amountMinor: payableMinor },
          ],
        });
      }
      await tx.dailyCommissionSummary.create({
        data: { userId, dayKey, eligibleMinor, carriedInMinor, payableMinor, carriedOutMinor, capMinor: cap },
      });
      await audit(tx, { action: 'commission.settled', actorId, targetId: userId, meta: { dayKey, reason: reason.trim(), eligible: eligibleMinor.toString(), carriedIn: carriedInMinor.toString(), payable: payableMinor.toString(), carriedOut: carriedOutMinor.toString(), cap: cap.toString() } });
      return { userId, status: 'SETTLED' as const, payableMinor: payableMinor.toString(), carriedOutMinor: carriedOutMinor.toString() };
    });
    results.push(r);
  }
  return { dayKey, capMinor: cap.toString(), members: results.length, results };
}

/** Pending commission owed to a member: the pending ledger balance. */
export async function pendingBalance(userId: string, client: Db = db): Promise<bigint> {
  return balanceOf(client, pendingAccount(userId).key);
}

