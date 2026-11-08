// Spin & Win server logic. Every decision (eligibility, cooldown, membership, reward draw, payout) is made here,
// inside a transaction that locks the member's row so two requests can never both spin.
import { randomInt, randomUUID } from 'node:crypto';
import { db, type Tx } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { accounts } from './accounts';
import { balanceOf, postTransaction } from './ledger';
import { addDays } from './time';
import {
  cashActivationBlockers, eligibility, isRewardLive, nextEligibleAt, pickIndex, REASON_TEXT, TIER_LABEL, validateCooldown, validateWeight, type SpinKind,
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

export async function getSpinState(userId: string, now = new Date()) {
  const [user, settings, last, recent, badges] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } }),
    loadSettings(),
    db.spinSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.spinSpin.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 25,
      select: { id: true, createdAt: true, rewardName: true, rewardKind: true, amountMinor: true, outcome: true, redemption: { select: { status: true, voucherCode: true } } },
    }),
    db.spinSpin.findMany({
      where: { userId, rewardKind: 'BADGE' }, orderBy: { createdAt: 'desc' },
      select: { rewardName: true, createdAt: true },
    }),
  ]);
  const membership = user.membership;
  const tier = membership?.tier ?? 'BASIC';
  const paidAndCurrent = !!membership?.active && membership.expiresAt > now && tier !== 'BASIC';
  const lastSpinAt = last?.createdAt ?? null;
  const next = nextEligibleAt(lastSpinAt, settings.cooldownDays);
  // Free members, and members whose membership has lapsed, see the Silver wheel as a preview only.
  const wheelTier = paidAndCurrent ? tier : 'SILVER';
  const liveSlots = await liveWheel(wheelTier);
  const verdict = eligibility({
    enabled: settings.enabled,
    tier,
    membershipActive: !!membership?.active,
    membershipExpiresAt: membership?.expiresAt ?? null,
    now,
    nextEligibleAt: next,
    liveRewardCount: liveSlots.length,
  });
  const wheel = liveSlots.map(publicSegment);
  return {
    serverNow: now.toISOString(),
    enabled: settings.enabled,
    cooldownDays: settings.cooldownDays,
    membership: {
      tier,
      tierLabel: TIER_LABEL[tier] ?? tier,
      active: paidAndCurrent,
      expiresAt: membership?.expiresAt.toISOString() ?? null,
    },
    eligible: verdict.eligible,
    reason: verdict.reason,
    reasonText: REASON_TEXT[verdict.reason],
    lastSpinAt: lastSpinAt?.toISOString() ?? null,
    nextEligibleAt: next?.toISOString() ?? null,
    wheel,
    previewOnly: !paidAndCurrent,
    badges: badges.map((b) => ({ name: b.rewardName, grantedAt: b.createdAt.toISOString() })),
    history: recent.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      rewardName: r.rewardName,
      kind: r.rewardKind,
      amountMinor: r.amountMinor.toString(),
      outcome: r.outcome,
      redemptionStatus: r.redemption?.status ?? null,
      voucherCode: r.redemption?.status === 'FULFILLED' ? r.redemption.voucherCode : null,
    })),
  };
}

const KEY = /^[A-Za-z0-9_-]{16,64}$/;

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

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } });
    const settings = await loadSettings(tx);
    const last = await tx.spinSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const membership = user.membership;
    const tier = membership?.tier ?? 'BASIC';
    const live = tier === 'BASIC' ? [] : await liveWheel(tier, tx);
    const verdict = eligibility({
      enabled: settings.enabled,
      tier,
      membershipActive: !!membership?.active,
      membershipExpiresAt: membership?.expiresAt ?? null,
      now,
      nextEligibleAt: nextEligibleAt(last?.createdAt ?? null, settings.cooldownDays),
      liveRewardCount: live.length,
    });
    if (!verdict.eligible) {
      const status = verdict.reason === 'NOT_MEMBER' || verdict.reason === 'MEMBERSHIP_EXPIRED' || verdict.reason === 'TIER_NOT_ELIGIBLE' ? 403 : 409;
      throw new DomainError(verdict.reason, verdict.reason === 'COOLDOWN' ? 'Your next spin is not available yet' : verdict.reason, status);
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

    const spinRow = await tx.spinSpin.create({
      data: {
        userId,
        tier,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardKind: reward.kind,
        amountMinor: reward.kind === 'CASH' ? reward.amountMinor : 0n,
        outcome,
        requestKey,
        randomDraw: draw,
        totalWeight: total,
        nextEligibleAt: nextAt,
        createdAt: now,
      },
    });

    if (reward.kind === 'CASH') {
      // Money leaves the reward pool only. Membership revenue accounts are never touched.
      await postTransaction(tx, {
        reference: `SPIN:${requestKey}`,
        type: 'SPIN_REWARD',
        description: `Spin & Win cash reward: ${reward.name}`,
        legs: [
          { ...accounts.spinPool('INR'), direction: 'DEBIT', amountMinor: reward.amountMinor },
          { ...accounts.wallet(userId, 'INR'), direction: 'CREDIT', amountMinor: reward.amountMinor },
        ],
      });
    }
    if (reward.kind === 'VOUCHER') {
      await tx.spinRedemption.create({ data: { spinId: spinRow.id, userId, status: 'REQUESTED', updatedAt: now } });
    }
    await audit(tx, { action: 'spin.won', actorId: userId, targetId: spinRow.id, meta: { tier, reward: reward.id, kind: reward.kind, draw, total } });

    return {
      replayed: false,
      spinId: spinRow.id,
      rewardName: reward.name,
      rewardDescription: reward.description,
      kind: reward.kind,
      amountMinor: spinRow.amountMinor.toString(),
      outcome,
      slotIndex: index,
      wheelSize: live.length,
      wheelSlotId: slot.id,
      nextEligibleAt: nextAt.toISOString(),
      serverNow: now.toISOString(),
    };
  });
}

async function resultOf(tx: Tx, spinId: string) {
  const s = await tx.spinSpin.findUniqueOrThrow({ where: { id: spinId } });
  return {
    spinId: s.id,
    rewardName: s.rewardName,
    rewardDescription: '',
    kind: s.rewardKind,
    amountMinor: s.amountMinor.toString(),
    outcome: s.outcome,
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
