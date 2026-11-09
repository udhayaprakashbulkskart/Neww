// Binary tree: placement, PV propagation, and the daily binary payout run.
import { computeBinaryPayout } from '@/lib/domain/binary';
import { validatePlacement } from '@/lib/domain/binary';
import { BASE_CURRENCY } from '@/lib/domain/money';
import { PLANS, type Tier } from '@/lib/domain/plans';
import type { Side } from '@/lib/domain/types';
import { accounts } from './accounts';
import { audit } from './audit';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { postTransaction, balanceOf } from './ledger';
import { isMembershipActive } from './membership';

/** Member ids in `rootId`'s binary downline, including the root. */
export async function binaryDownline(tx: Tx | typeof db, rootId: string): Promise<Set<string>> {
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const children = await tx.user.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = [];
    for (const c of children) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        frontier.push(c.id);
      }
    }
  }
  return seen;
}

export async function placeMember(tx: Tx, userId: string, parentId: string, side: Side, actorId?: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, sponsorId: true, parentId: true } });
  if (!user) throw new DomainError('NOT_FOUND', 'Member not found', 404);
  if (user.parentId) throw new DomainError('ALREADY_PLACED', 'Member is already placed in the binary tree', 409);
  if (!user.sponsorId) throw new DomainError('NO_SPONSOR', 'Member has no sponsor to place under', 409);

  const downline = await binaryDownline(tx, user.sponsorId);
  const occupied = await tx.user.findFirst({ where: { parentId: parentId, side }, select: { id: true } });
  const result = validatePlacement({
    newUserId: userId,
    sponsorId: user.sponsorId,
    parentId,
    side,
    sponsorDownline: downline,
    occupiedSlots: new Set(occupied ? [`${parentId}:${side}`] : []),
  });
  if (!result.ok) throw new DomainError('PLACEMENT_INVALID', result.reason, 409);

  await tx.user.update({ where: { id: userId }, data: { parentId, side } });
  await audit(tx, { action: 'binary.placed', actorId: actorId ?? userId, targetId: userId, meta: { parentId, side } });
}

/** Adds retail PV to every ancestor on the leg that leads to the buyer. */
export async function addPvUpline(tx: Tx, userId: string, pvInrMinor: bigint): Promise<void> {
  if (pvInrMinor <= 0n) return;
  let childId = userId;
  for (;;) {
    const child = await tx.user.findUnique({ where: { id: childId }, select: { parentId: true, side: true } });
    if (!child?.parentId || !child.side) break;
    await tx.pvLeg.upsert({
      where: { userId_side: { userId: child.parentId, side: child.side } },
      create: { userId: child.parentId, side: child.side, pvMinor: pvInrMinor },
      update: { pvMinor: { increment: pvInrMinor } },
    });
    childId = child.parentId;
  }
}

/** Removes previously added PV (floored at zero; volume already paid out cannot be clawed back here). */
export async function removePvUpline(tx: Tx, userId: string, pvInrMinor: bigint): Promise<void> {
  if (pvInrMinor <= 0n) return;
  let childId = userId;
  for (;;) {
    const child = await tx.user.findUnique({ where: { id: childId }, select: { parentId: true, side: true } });
    if (!child?.parentId || !child.side) break;
    await tx.$executeRaw`UPDATE "PvLeg" SET "pvMinor" = GREATEST("pvMinor" - ${pvInrMinor}, 0)
      WHERE "userId" = ${child.parentId} AND side = ${child.side}::"Side"`;
    childId = child.parentId;
  }
}

export interface BinaryRunSummary {
  periodKey: string;
  duplicate: boolean;
  payouts: number;
  paidMinor: bigint;
}

/** Pays binary commission once per period. Idempotent by periodKey. */
export async function runBinaryPayouts(periodKey: string, actorId?: string): Promise<BinaryRunSummary> {
  // Binary team commission is disabled until documented legal approval. No payout can be run.
  throw new DomainError('BINARY_DISABLED', 'Binary commission is disabled until documented legal approval', 409);
  return db.$transaction(
    async (tx) => {
      const already = await tx.binaryRun.findUnique({ where: { periodKey } });
      if (already) return { periodKey, duplicate: true, payouts: already.payouts, paidMinor: already.paidMinor };

      const legs = await tx.pvLeg.findMany({ where: { pvMinor: { gt: 0n } }, orderBy: { userId: 'asc' } });
      const byUser = new Map<string, { LEFT: bigint; RIGHT: bigint }>();
      for (const l of legs) {
        const entry = byUser.get(l.userId) ?? { LEFT: 0n, RIGHT: 0n };
        entry[l.side] = l.pvMinor;
        byUser.set(l.userId, entry);
      }
      const users = await tx.user.findMany({
        where: { id: { in: [...byUser.keys()] }, status: 'ACTIVE' },
        select: { id: true, membership: { select: { tier: true, active: true, expiresAt: true } } },
      });

      let reserve = await balanceOf(tx, accounts.commissionReserve().key);
      let paidTotal = 0n;
      let payouts = 0;
      const now = new Date();
      for (const user of users) {
        const m = user.membership;
        if (!m || !isMembershipActive(m, now)) continue;
        const plan = PLANS[m.tier as Tier];
        const pv = byUser.get(user.id);
        if (!pv || plan.binaryBps <= 0) continue;

        const result = computeBinaryPayout({
          leftPvInrMinor: pv.LEFT,
          rightPvInrMinor: pv.RIGHT,
          rateBps: plan.binaryBps,
          dailyCapInrMinor: plan.binaryDailyCapInrMinor,
          reserveAvailableInrMinor: reserve,
        });
        if (result.consumedPvInrMinor <= 0n) continue;

        if (result.payoutInrMinor > 0n) {
          await postTransaction(tx, {
            reference: `BINARY:${periodKey}:${user.id}`,
            type: 'BINARY_COMMISSION',
            description: `Binary commission ${periodKey}`,
            legs: [
              { ...accounts.commissionReserve(), direction: 'DEBIT', amountMinor: result.payoutInrMinor },
              { ...accounts.wallet(user.id, BASE_CURRENCY), direction: 'CREDIT', amountMinor: result.payoutInrMinor },
            ],
          });
          await tx.commission.create({
            data: { userId: user.id, type: 'BINARY', periodKey, amountMinor: result.payoutInrMinor },
          });
          reserve -= result.payoutInrMinor;
          paidTotal += result.payoutInrMinor;
          payouts += 1;
        }
        // Consume only the matched PV that was paid for, from both legs.
        await tx.$executeRaw`UPDATE "PvLeg" SET "pvMinor" = GREATEST("pvMinor" - ${result.consumedPvInrMinor}, 0)
          WHERE "userId" = ${user.id}`;
      }

      await tx.binaryRun.create({ data: { periodKey, paidMinor: paidTotal, payouts } });
      await audit(tx, { action: 'binary.run', actorId: actorId ?? null, targetId: periodKey, meta: { payouts, paidTotal: paidTotal.toString() } });
      return { periodKey, duplicate: false, payouts, paidMinor: paidTotal };
    },
    { timeout: 60_000 },
  );
}

export function sideFromInput(value: unknown): Side {
  if (value === 'LEFT' || value === 'RIGHT') return value;
  throw new DomainError('INVALID_SIDE', 'Side must be LEFT or RIGHT');
}
