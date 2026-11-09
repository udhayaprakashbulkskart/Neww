// Spin & Win server logic. Every decision (eligibility, cooldown, membership, reward draw) is made here, inside
// a transaction that locks the member's row so two requests can never both spin.
// Anyone may spin. A reward won without a paid membership is HELD and applied only when the member claims it
// while holding an active paid membership. Membership fees never fund rewards.
import { randomInt, randomUUID } from 'node:crypto';
import { db, type Tx } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { accounts } from './accounts';
import { balanceOf, postTransaction } from './ledger';
import { addDays } from './time';
import {
  cashActivationBlockers, eligibility, ENTRY_WHEEL_TIER, isPaidAndCurrent, isRewardLive, nextEligibleAt, pickIndex,
  REASON_TEXT, TIER_LABEL, validateCooldown, validateWeight, type SpinKind,
} from '@/lib/domain/spin';
import { parseMinor } from '@/lib/domain/money';

type Db = Tx | typeof db;

/** The platform switch for cash rewards. It is set only after written legal approval. Read at call time. */
export function cashSwitchOn(): boolean {
  return process.env.SPIN_CASH_ENABLED === 'true';
}

export async function loadSettings(client: Db = db) {
  const row = await client.spinSettings.findUnique({ where: { id: 'default' } });
  if (!row) throw new DomainError('NOT_CONFIGURED', 'Spin & Win has not been set up', 500);
  return row;
}

async function poolBalance(client: Db): Promise<bigint> {
  return balanceOf(client, accounts.spinPool('INR').key);
}

/** Live segments for a tier, in wheel order. A segment is shown only when a spin could actually land on it. */
export async function liveWheel(tier: string, client: Db = db) {
  const [slots, pool] = await Promise.all([
    client.spinSlot.findMany({
      where: { tier: tier as 'SILVER' | 'GOLD' | 'PLATINUM', active: true },
      include: { reward: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    poolBalance(client),
  ]);
  const env = { cashSwitchOn: cashSwitchOn(), poolBalanceMinor: pool };
  return slots.filter((s) => isRewardLive(s.reward, env));
}

function publicSegment(s: { id: string; weight: number; reward: { name: string; description: string; kind: SpinKind; amountMinor: bigint } }) {
  return { slotId: s.id, name: s.reward.name, description: s.reward.description, kind: s.reward.kind, amountMinor: s.reward.amountMinor.toString(), weight: s.weight };
}

async function memberContext(userId: string, now: Date, client: Db) {
  const user = await client.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } });
  const membership = user.membership;
  const paidCurrent = isPaidAndCurrent(membership, now);
  const tier = membership?.tier ?? 'BASIC';
  return { user, membership, paidCurrent, tier, wheelTier: paidCurrent ? tier : ENTRY_WHEEL_TIER };
}

export async function getSpinState(userId: string, now = new Date()) {
  const [ctx, settings, last, recent, held, badges] = await Promise.all([
    memberContext(userId, now, db),
    loadSettings(),
    db.spinSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.spinSpin.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 25,
      select: {
        id: true, createdAt: true, rewardName: true, rewardKind: true, amountMinor: true, outcome: true,
        claim: { select: { status: true } },
        redemption: { select: { status: true, voucherCode: true } },
      },
    }),
    db.spinClaim.findMany({
      where: { userId, status: 'HELD' }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { spinId: true, createdAt: true, spin: { select: { rewardName: true, rewardKind: true, amountMinor: true } } },
    }),
    db.spinSpin.findMany({
      where: { userId, rewardKind: 'BADGE', claim: { is: { status: 'CLAIMED' } } }, orderBy: { createdAt: 'desc' },
      select: { rewardName: true, createdAt: true },
    }),
  ]);
  const next = nextEligibleAt(last?.createdAt ?? null, settings.cooldownDays);
  const wheelSlots = await liveWheel(ctx.wheelTier);
  const verdict = eligibility({ enabled: settings.enabled, now, nextEligibleAt: next, liveRewardCount: wheelSlots.length });
  return {
    serverNow: now.toISOString(),
    enabled: settings.enabled,
    cooldownDays: settings.cooldownDays,
    membership: {
      tier: ctx.tier,
      tierLabel: TIER_LABEL[ctx.tier] ?? ctx.tier,
      active: ctx.paidCurrent,
      expiresAt: ctx.membership?.expiresAt.toISOString() ?? null,
    },
    paidCurrent: ctx.paidCurrent,
    eligible: verdict.eligible,
    reason: verdict.reason,
    reasonText: REASON_TEXT[verdict.reason],
    lastSpinAt: last?.createdAt.toISOString() ?? null,
    nextEligibleAt: next?.toISOString() ?? null,
    wheel: wheelSlots.map(publicSegment),
    heldRewards: held.map((h) => ({
      spinId: h.spinId,
      rewardName: h.spin.rewardName,
      kind: h.spin.rewardKind,
      amountMinor: h.spin.amountMinor.toString(),
      at: h.createdAt.toISOString(),
    })),
    badges: badges.map((b) => ({ name: b.rewardName, grantedAt: b.createdAt.toISOString() })),
    history: recent.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      rewardName: r.rewardName,
      kind: r.rewardKind,
      amountMinor: r.amountMinor.toString(),
      outcome: r.outcome,
      claimStatus: r.claim?.status ?? null,
      redemptionStatus: r.redemption?.status ?? null,
      voucherCode: r.redemption?.status === 'FULFILLED' ? r.redemption.voucherCode : null,
    })),
  };
}

const KEY = /^[A-Za-z0-9_-]{16,64}$/;

/** Applies a reward's effect once. Used at spin time for paid members, and at claim time for held rewards. */
async function applyClaim(tx: Tx, claimId: string, userId: string, spin: { id: string; rewardId: string; rewardKind: SpinKind; amountMinor: bigint }, now: Date) {
  if (spin.rewardKind === 'CASH') {
    // Money leaves the reward pool only. Membership revenue accounts are never touched.
    await postTransaction(tx, {
      reference: `SPIN-CLAIM:${claimId}`,
      type: 'SPIN_REWARD',
      description: `Spin & Win cash reward (spin ${spin.id})`,
      legs: [
        { ...accounts.spinPool('INR'), direction: 'DEBIT', amountMinor: spin.amountMinor },
        { ...accounts.wallet(userId, 'INR'), direction: 'CREDIT', amountMinor: spin.amountMinor },
      ],
    });
  }
  if (spin.rewardKind === 'VOUCHER') {
    await tx.spinRedemption.create({ data: { spinId: spin.id, userId, status: 'REQUESTED', updatedAt: now } });
  }
}

export async function spin(userId: string, requestKey: string, now = new Date()) {
  if (!KEY.test(requestKey)) throw new DomainError('BAD_KEY', 'Missing or invalid request key', 400);
  return db.$transaction(async (tx) => {
    // Serialise every spin for this member. The second request waits here, then sees the first spin.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    // Replay of an identical request returns the original outcome. It never spins again.
    const replay = await tx.spinSpin.findUnique({ where: { requestKey } });
    if (replay) {
      if (replay.userId !== userId) throw new DomainError('CONFLICT', 'This request key was already used', 409);
      return { replayed: true, ...(await resultOf(tx, replay.id)) };
    }

    const settings = await loadSettings(tx);
    const last = await tx.spinSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const ctx = await memberContext(userId, now, tx);
    const live = await liveWheel(ctx.wheelTier, tx);
    const verdict = eligibility({
      enabled: settings.enabled,
      now,
      nextEligibleAt: nextEligibleAt(last?.createdAt ?? null, settings.cooldownDays),
      liveRewardCount: live.length,
    });
    if (!verdict.eligible) {
      throw new DomainError(verdict.reason, verdict.reason === 'COOLDOWN' ? 'Your next spin is not available yet' : REASON_TEXT[verdict.reason], 409);
    }

    // The draw uses the operating system's secure random source, on the server only.
    const weights = live.map((s) => s.weight);
    const total = weights.reduce((a, w) => a + w, 0);
    const draw = randomInt(total);
    const index = pickIndex(weights, draw);
    const slot = live[index]!;
    const reward = slot.reward;
    const outcome = reward.kind === 'BADGE' ? 'GRANTED' : reward.kind === 'CASH' ? 'CREDITED' : 'REDEMPTION_REQUESTED';
    const nextAt = addDays(now, settings.cooldownDays);
    const amount = reward.kind === 'CASH' ? reward.amountMinor : 0n;

    const spinRow = await tx.spinSpin.create({
      data: {
        userId,
        tier: ctx.tier,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardKind: reward.kind,
        amountMinor: amount,
        outcome,
        requestKey,
        randomDraw: draw,
        totalWeight: total,
        nextEligibleAt: nextAt,
        createdAt: now,
      },
    });
    // Paid members receive the reward now. Everyone else holds it until they claim with a paid membership.
    const claimStatus = ctx.paidCurrent ? 'CLAIMED' : 'HELD';
    const claim = await tx.spinClaim.create({
      data: { spinId: spinRow.id, userId, status: claimStatus, claimedAt: ctx.paidCurrent ? now : null, updatedAt: now },
    });
    if (ctx.paidCurrent) await applyClaim(tx, claim.id, userId, { id: spinRow.id, rewardId: reward.id, rewardKind: reward.kind, amountMinor: amount }, now);
    await audit(tx, { action: 'spin.won', actorId: userId, targetId: spinRow.id, meta: { tier: ctx.tier, reward: reward.id, kind: reward.kind, draw, total, claimStatus } });

    return {
      replayed: false,
      spinId: spinRow.id,
      rewardName: reward.name,
      rewardDescription: reward.description,
      kind: reward.kind,
      amountMinor: amount.toString(),
      outcome,
      claimStatus,
      slotIndex: index,
      wheelSize: live.length,
      wheelSlotId: slot.id,
      nextEligibleAt: nextAt.toISOString(),
      serverNow: now.toISOString(),
    };
  });
}

/** Claims a held reward. Requires an active paid membership at the moment of claiming. */
export async function claimReward(userId: string, spinId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const ctx = await memberContext(userId, now, tx);
    if (!ctx.paidCurrent) {
      throw new DomainError('PAID_MEMBERSHIP_REQUIRED', 'Activate a paid membership to claim this reward', 403);
    }
    const claim = await tx.spinClaim.findUnique({ where: { spinId }, include: { spin: true } });
    if (!claim || claim.userId !== userId) throw new DomainError('NOT_FOUND', 'Reward not found', 404);
    if (claim.status === 'CLAIMED') throw new DomainError('ALREADY_CLAIMED', 'This reward is already claimed', 409);
    if (claim.spin.rewardKind === 'CASH') {
      const reward = await tx.spinReward.findUniqueOrThrow({ where: { id: claim.spin.rewardId } });
      const pool = await poolBalance(tx);
      const live = isRewardLive(reward, { cashSwitchOn: cashSwitchOn(), poolBalanceMinor: pool }) && pool >= claim.spin.amountMinor;
      if (!live) throw new DomainError('CASH_NOT_LIVE', 'This cash reward is not payable yet. It stays held until it is.', 409);
    }
    const flipped = await tx.spinClaim.updateMany({ where: { id: claim.id, status: 'HELD' }, data: { status: 'CLAIMED', claimedAt: now, updatedAt: now } });
    if (flipped.count !== 1) throw new DomainError('CONFLICT', 'This reward was just claimed', 409);
    await applyClaim(tx, claim.id, userId, { id: claim.spin.id, rewardId: claim.spin.rewardId, rewardKind: claim.spin.rewardKind, amountMinor: claim.spin.amountMinor }, now);
    await audit(tx, { action: 'spin.claimed', actorId: userId, targetId: claim.spin.id, meta: { kind: claim.spin.rewardKind } });
    return { spinId, status: 'CLAIMED', kind: claim.spin.rewardKind, amountMinor: claim.spin.amountMinor.toString() };
  });
}

async function resultOf(tx: Tx, spinId: string) {
  const s = await tx.spinSpin.findUniqueOrThrow({ where: { id: spinId }, include: { claim: { select: { status: true } } } });
  return {
    spinId: s.id,
    rewardName: s.rewardName,
    rewardDescription: '',
    kind: s.rewardKind,
    amountMinor: s.amountMinor.toString(),
    outcome: s.outcome,
    claimStatus: s.claim?.status ?? null,
    slotIndex: -1,
    wheelSize: 0,
    wheelSlotId: '',
    nextEligibleAt: s.nextEligibleAt.toISOString(),
    serverNow: new Date().toISOString(),
  };
}

// ---------- administration ----------

export async function updateSettings(input: { enabled?: boolean; cooldownDays?: number }, actorId: string) {
  if (input.cooldownDays !== undefined) {
    const err = validateCooldown(input.cooldownDays);
    if (err) throw new DomainError('VALIDATION', err, 422);
  }
  return db.$transaction(async (tx) => {
    const before = await loadSettings(tx);
    const after = await tx.spinSettings.update({
      where: { id: 'default' },
      data: { enabled: input.enabled ?? before.enabled, cooldownDays: input.cooldownDays ?? before.cooldownDays, updatedAt: new Date(), updatedBy: actorId },
    });
    await audit(tx, {
      action: 'spin.settings_updated', actorId, targetId: 'default',
      meta: { before: { enabled: before.enabled, cooldownDays: before.cooldownDays }, after: { enabled: after.enabled, cooldownDays: after.cooldownDays } },
    });
    return after;
  });
}

export interface RewardInput {
  name: string;
  description: string;
  kind: SpinKind;
  amountRupees: string;
}

export async function createReward(input: RewardInput, actorId: string) {
  if (input.kind === 'CASH') throw new DomainError('CASH_LOCKED', 'Cash rewards are created as locked. Add the approval and funding records, then activate.', 422);
  const amount = input.kind === 'BADGE' ? 0n : parseAmount(input.amountRupees);
  return db.$transaction(async (tx) => {
    const id = `${input.kind.toLowerCase()}_${randomUUID().slice(0, 8)}`;
    const reward = await tx.spinReward.create({
      data: { id, name: input.name.trim(), description: input.description.trim(), kind: input.kind, amountMinor: amount, active: true, updatedAt: new Date() },
    });
    await audit(tx, { action: 'spin.reward_created', actorId, targetId: id, meta: { name: reward.name, kind: reward.kind } });
    return reward;
  });
}

export async function updateReward(id: string, input: { name: string; description: string; active: boolean }, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.spinReward.findUnique({ where: { id } });
    if (!before) throw new DomainError('NOT_FOUND', 'Reward not found', 404);
    if (before.kind === 'CASH' && input.active && !before.cashActivatedAt) {
      throw new DomainError('CASH_LOCKED', 'Cash rewards are activated only through the activation step with approval and funding records', 422);
    }
    const after = await tx.spinReward.update({
      where: { id },
      data: { name: input.name.trim(), description: input.description.trim(), active: input.active, updatedAt: new Date() },
    });
    await audit(tx, { action: 'spin.reward_updated', actorId, targetId: id, meta: { before: { name: before.name, active: before.active }, after: { name: after.name, active: after.active } } });
    return after;
  });
}

export async function activateCashReward(id: string, input: { legalRef: string; fundingRef: string }, actorId: string) {
  return db.$transaction(async (tx) => {
    const reward = await tx.spinReward.findUnique({ where: { id } });
    if (!reward) throw new DomainError('NOT_FOUND', 'Reward not found', 404);
    const blockers = cashActivationBlockers({
      kind: reward.kind, amountMinor: reward.amountMinor, legalRef: input.legalRef, fundingRef: input.fundingRef, cashSwitchOn: cashSwitchOn(),
    });
    if (blockers.length) throw new DomainError('ACTIVATION_BLOCKED', blockers.join('. '), 422);
    const after = await tx.spinReward.update({
      where: { id },
      data: {
        active: true,
        cashLegalRef: input.legalRef.trim(),
        cashFundingRef: input.fundingRef.trim(),
        cashActivatedAt: new Date(),
        cashActivatedBy: actorId,
        updatedAt: new Date(),
      },
    });
    await audit(tx, { action: 'spin.cash_activated', actorId, targetId: id, meta: { legalRef: input.legalRef.trim(), fundingRef: input.fundingRef.trim() } });
    return after;
  });
}

export async function deactivateCashReward(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const reward = await tx.spinReward.findUnique({ where: { id } });
    if (!reward) throw new DomainError('NOT_FOUND', 'Reward not found', 404);
    await tx.spinReward.update({ where: { id }, data: { active: false, updatedAt: new Date() } });
    await audit(tx, { action: 'spin.cash_deactivated', actorId, targetId: id, meta: {} });
    return { id, active: false };
  });
}

export async function saveSlot(input: { tier: string; rewardId: string; weight: number; active: boolean }, actorId: string) {
  const weightErr = validateWeight(input.weight);
  if (weightErr) throw new DomainError('VALIDATION', weightErr, 422);
  if (!['SILVER', 'GOLD', 'PLATINUM'].includes(input.tier)) throw new DomainError('VALIDATION', 'Choose a membership tier', 422);
  return db.$transaction(async (tx) => {
    const reward = await tx.spinReward.findUnique({ where: { id: input.rewardId } });
    if (!reward) throw new DomainError('NOT_FOUND', 'Reward not found', 404);
    const slot = await tx.spinSlot.upsert({
      where: { tier_rewardId: { tier: input.tier as 'SILVER', rewardId: input.rewardId } },
      create: { tier: input.tier as 'SILVER', rewardId: input.rewardId, weight: input.weight, active: input.active, sortOrder: 10 },
      update: { weight: input.weight, active: input.active },
    });
    await audit(tx, { action: 'spin.slot_saved', actorId, targetId: slot.id, meta: { tier: input.tier, reward: input.rewardId, weight: input.weight, active: input.active } });
    return slot;
  });
}

export async function updateSlot(id: string, input: { weight: number; active: boolean }, actorId: string) {
  const weightErr = validateWeight(input.weight);
  if (weightErr) throw new DomainError('VALIDATION', weightErr, 422);
  return db.$transaction(async (tx) => {
    const before = await tx.spinSlot.findUnique({ where: { id } });
    if (!before) throw new DomainError('NOT_FOUND', 'Segment not found', 404);
    const after = await tx.spinSlot.update({ where: { id }, data: { weight: input.weight, active: input.active } });
    await audit(tx, { action: 'spin.slot_updated', actorId, targetId: id, meta: { before: { weight: before.weight, active: before.active }, after: { weight: after.weight, active: after.active } } });
    return after;
  });
}

/** Records an external deposit into the reward pool. Requires the bank or payment reference for the deposit. */
export async function fundRewardPool(amountRupees: string, fundingRef: string, actorId: string) {
  const ref = fundingRef.trim();
  if (ref.length < 6) throw new DomainError('VALIDATION', 'Enter the bank or payment reference for this deposit (at least 6 characters)', 422);
  const amount = parseAmount(amountRupees);
  return db.$transaction(async (tx) => {
    const result = await postTransaction(tx, {
      reference: `SPINFUND:${ref}`,
      type: 'SPIN_POOL_FUNDING',
      description: `Reward pool deposit, ref ${ref}`,
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: amount },
        { ...accounts.spinPool('INR'), direction: 'CREDIT', amountMinor: amount },
      ],
    });
    if (result.duplicate) throw new DomainError('DUPLICATE_FUNDING', 'This funding reference was already recorded', 409);
    await audit(tx, { action: 'spin.pool_funded', actorId, targetId: ref, meta: { amount: amount.toString() } });
    return { funded: amount.toString(), reference: ref };
  });
}

export async function decideRedemption(
  id: string,
  action: 'APPROVE' | 'FULFIL' | 'REJECT',
  input: { voucherCode?: string | null; note?: string | null },
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const r = await tx.spinRedemption.findUnique({ where: { id }, select: { id: true, status: true, userId: true } });
    if (!r) throw new DomainError('NOT_FOUND', 'Redemption not found', 404);
    const from = r.status;
    const to = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'FULFILLED';
    const allowed = (action === 'APPROVE' || action === 'REJECT') ? from === 'REQUESTED' : from === 'APPROVED';
    if (!allowed) throw new DomainError('INVALID_TRANSITION', `Cannot ${action.toLowerCase()} a redemption that is ${from.toLowerCase()}`, 409);
    if (action === 'FULFIL' && !input.voucherCode?.trim()) throw new DomainError('VALIDATION', 'Enter the voucher code before marking it fulfilled', 422);
    const result = await tx.spinRedemption.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        handledBy: actorId,
        handledAt: new Date(),
        note: input.note?.trim() || null,
        voucherCode: action === 'FULFIL' ? input.voucherCode!.trim() : undefined,
        updatedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new DomainError('CONFLICT', 'This redemption was just changed by someone else', 409);
    await audit(tx, { action: `spin.redemption_${to.toLowerCase()}`, actorId, targetId: id, meta: { userId: r.userId } });
    return { status: to };
  });
}

function parseAmount(input: string): bigint {
  try {
    const v = parseMinor(input);
    if (v <= 0n) throw new Error('nonpositive');
    return v;
  } catch {
    throw new DomainError('VALIDATION', 'Enter an amount in rupees, for example 500 or 1500.50', 422);
  }
}
