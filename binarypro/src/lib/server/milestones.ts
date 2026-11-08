// Retail milestone programme: qualification, approval workflow, prizes and rule management.
// Prizes are goods, not cash: nothing here posts to the ledger or changes commissions.
import { randomUUID } from 'node:crypto';
import { db, type Tx } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { milestoneProgress, nextMilestoneStatus, validateRule, type MilestoneAction, type MilestoneStatus, type RuleInput } from '@/lib/domain/milestones';

type Db = Tx | typeof db;

/** The milestone rule currently in force (the most recently started active rule). */
export async function activeRule(client: Db = db) {
  return client.milestoneRule.findFirst({ where: { active: true }, orderBy: { startsAt: 'desc' } });
}

/** A member's own verified retail sales (INR) inside a rule's window. Fraud-withheld orders are excluded. */
export async function personalSales(userId: string, rule: { startsAt: Date; endsAt: Date | null }, client: Db = db): Promise<bigint> {
  const agg = await client.order.aggregate({
    where: {
      buyerId: userId,
      status: 'VERIFIED',
      commissionBlocked: null,
      verifiedAt: { gte: rule.startsAt, ...(rule.endsAt ? { lt: rule.endsAt } : {}) },
    },
    _sum: { pvInrMinor: true },
  });
  return agg._sum.pvInrMinor ?? 0n;
}

export async function memberMilestone(userId: string) {
  const rule = await activeRule();
  if (!rule) return null;
  const metricMinor = await personalSales(userId, rule);
  const award = await db.milestoneAward.findUnique({
    where: { userId_ruleId: { userId, ruleId: rule.id } },
    include: { prize: true },
  });
  return {
    ruleName: rule.name,
    thresholdMinor: rule.thresholdMinor,
    metricMinor,
    ...milestoneProgress(metricMinor, rule.thresholdMinor),
    award: award ? { status: award.status as MilestoneStatus, prizeName: award.prize?.name ?? null, prizeModel: award.prize?.model ?? null } : null,
  };
}

export async function loadPrizes(client: Db = db) {
  return client.prize.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

export async function listPrizes(client: Db = db) {
  return client.prize.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

/**
 * Finds members whose personal verified sales reached the active rule and records a QUALIFIED award
 * for each one. Idempotent: a member has at most one award per rule, so re-running changes nothing.
 */
export async function evaluateMilestones(actorId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const rule = await activeRule(tx);
    if (!rule) throw new DomainError('NO_RULE', 'There is no active milestone rule', 409);
    const window = { gte: rule.startsAt, ...(rule.endsAt ? { lt: rule.endsAt } : {}) };
    const totals = await tx.order.groupBy({
      by: ['buyerId'],
      where: { status: 'VERIFIED', commissionBlocked: null, verifiedAt: { ...window, lte: now } },
      _sum: { pvInrMinor: true },
    });
    const reached = totals
      .map((t) => ({ userId: t.buyerId, metricMinor: t._sum.pvInrMinor ?? 0n }))
      .filter((t) => t.metricMinor >= rule.thresholdMinor);
    const created = reached.length
      ? await tx.milestoneAward.createMany({
          data: reached.map((t) => ({ userId: t.userId, ruleId: rule.id, metricMinor: t.metricMinor, status: 'QUALIFIED' as const })),
          skipDuplicates: true,
        })
      : { count: 0 };
    await audit(tx, { action: 'milestone.evaluated', actorId, targetId: rule.id, meta: { reached: reached.length, newAwards: created.count } });
    return { reached: reached.length, newAwards: created.count };
  });
}

export async function decideAward(
  awardId: string,
  action: MilestoneAction,
  input: { prizeId?: string | null; note?: string | null },
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const award = await tx.milestoneAward.findUnique({ where: { id: awardId }, select: { id: true, status: true, userId: true, prizeId: true } });
    if (!award) throw new DomainError('NOT_FOUND', 'Award not found', 404);
    const next = nextMilestoneStatus(award.status as MilestoneStatus, action);
    if (!next) throw new DomainError('INVALID_TRANSITION', `Cannot ${action.toLowerCase()} an award that is ${award.status.toLowerCase()}`, 409);

    let prizeId: string | null | undefined = undefined;
    if (action === 'APPROVE') {
      if (!input.prizeId) throw new DomainError('PRIZE_REQUIRED', 'Choose the prize before approving', 422);
      const prize = await tx.prize.findUnique({ where: { id: input.prizeId }, select: { id: true, active: true } });
      if (!prize || !prize.active) throw new DomainError('PRIZE_UNAVAILABLE', 'That prize is not available', 409);
      prizeId = prize.id;
    }

    // Conditional update: if two staff decide at once, only the first one wins.
    const now = new Date();
    const result = await tx.milestoneAward.updateMany({
      where: { id: awardId, status: award.status },
      data: {
        status: next,
        ...(action !== 'FULFIL' ? { decidedAt: now, decidedBy: actorId, decisionNote: input.note?.trim() || null } : {}),
        ...(prizeId !== undefined ? { prizeId } : {}),
        ...(action === 'FULFIL' ? { fulfilledAt: now } : {}),
      },
    });
    if (result.count !== 1) throw new DomainError('CONFLICT', 'This award was just changed by someone else. Reload and try again.', 409);

    await audit(tx, {
      action: `milestone.${action.toLowerCase()}`,
      actorId,
      targetId: awardId,
      meta: { userId: award.userId, from: award.status, to: next, prizeId: prizeId ?? award.prizeId ?? null },
    });
    return { status: next };
  });
}

export async function updateRule(ruleId: string, input: RuleInput & { active: boolean }, actorId: string) {
  const checked = validateRule(input);
  if (checked.errors.length || checked.thresholdMinor === undefined) {
    throw new DomainError('VALIDATION', checked.errors.join('; '), 422);
  }
  return db.$transaction(async (tx) => {
    const before = await tx.milestoneRule.findUnique({ where: { id: ruleId } });
    if (!before) throw new DomainError('NOT_FOUND', 'Rule not found', 404);
    const after = await tx.milestoneRule.update({
      where: { id: ruleId },
      data: {
        name: input.name.trim(),
        thresholdMinor: checked.thresholdMinor!,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        active: input.active,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
    });
    await audit(tx, {
      action: 'milestone.rule_updated',
      actorId,
      targetId: ruleId,
      meta: {
        before: { name: before.name, threshold: before.thresholdMinor.toString(), active: before.active },
        after: { name: after.name, threshold: after.thresholdMinor.toString(), active: after.active },
        note: 'Changes apply to future evaluations. Existing awards are kept.',
      },
    });
    return after;
  });
}

export interface PrizeInput {
  name: string;
  model: string;
  imageUrl: string;
  description: string;
  details: string[];
  supplierNote: string;
  sortOrder: number;
  active: boolean;
}

export async function savePrize(id: string | null, input: PrizeInput, actorId: string) {
  return db.$transaction(async (tx) => {
    const data = { ...input, updatedAt: new Date() };
    const prize = id
      ? await tx.prize.update({ where: { id }, data }).catch(() => {
          throw new DomainError('NOT_FOUND', 'Prize not found', 404);
        })
      : await tx.prize.create({ data: { id: `prize_${randomUUID().slice(0, 12)}`, ...data } });
    await audit(tx, { action: id ? 'prize.updated' : 'prize.created', actorId, targetId: prize.id, meta: { name: prize.name, model: prize.model, active: prize.active } });
    return prize;
  });
}
