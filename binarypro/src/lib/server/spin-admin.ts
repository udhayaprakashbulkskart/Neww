// Read models for the Spin & Win administration page and its exports.
import { db } from './db';
import { minorToDecimal } from '@/lib/domain/finance';
import { accounts } from './accounts';
import { balanceOf } from './ledger';
import { cashSwitchOn, loadSettings } from './spin';
import { MAX_ROWS } from './audit-view';

export const SPIN_REPORTS = ['spins', 'distribution', 'redemptions'] as const;
export type SpinReport = (typeof SPIN_REPORTS)[number];

export async function spinAdminOverview(opts: { userId?: string | null; take?: number } = {}) {
  const [settings, rewards, slots, pool, spins, distribution, queue] = await Promise.all([
    loadSettings(),
    db.spinReward.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
    db.spinSlot.findMany({ include: { reward: { select: { name: true } } }, orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }] }),
    balanceOf(db, accounts.spinPool('INR').key),
    db.spinSpin.findMany({
      where: opts.userId ? { userId: opts.userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 100,
      include: { user: { select: { name: true, email: true } }, redemption: { select: { status: true } } },
    }),
    db.spinSpin.groupBy({ by: ['rewardId'], _count: { _all: true }, _sum: { amountMinor: true } }),
    db.spinRedemption.findMany({
      where: { status: { in: ['REQUESTED', 'APPROVED'] } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { spin: { select: { rewardName: true, createdAt: true } }, user: { select: { name: true, email: true } } },
    }),
  ]);
  const counts = new Map(distribution.map((d) => [d.rewardId, d._count._all]));
  const paid = new Map(distribution.map((d) => [d.rewardId, d._sum.amountMinor ?? 0n]));
  return {
    settings: { enabled: settings.enabled, cooldownDays: settings.cooldownDays, updatedAt: settings.updatedAt },
    cashSwitchOn: cashSwitchOn(),
    poolMinor: pool,
    rewards: rewards.map((r) => ({
      id: r.id, name: r.name, description: r.description, kind: r.kind,
      amountMinor: r.amountMinor, active: r.active,
      cashLegalRef: r.cashLegalRef, cashFundingRef: r.cashFundingRef, cashActivatedAt: r.cashActivatedAt,
      wins: counts.get(r.id) ?? 0, paidMinor: paid.get(r.id) ?? 0n,
    })),
    slots: slots.map((s) => ({ id: s.id, tier: s.tier, rewardId: s.rewardId, rewardName: s.reward.name, weight: s.weight, active: s.active })),
    spins: spins.map((s) => ({
      id: s.id, at: s.createdAt, user: s.user.email ?? s.user.name, tier: s.tier, reward: s.rewardName,
      kind: s.rewardKind, amountMinor: s.amountMinor, outcome: s.outcome, redemption: s.redemption?.status ?? null,
    })),
    queue: queue.map((q) => ({ id: q.id, status: q.status, reward: q.spin.rewardName, at: q.spin.createdAt, user: q.user.email ?? q.user.name })),
    maxRows: MAX_ROWS,
  };
}

export async function spinExportTable(report: SpinReport, range: { gte: Date; lt: Date }, userId: string | null) {
  if (report === 'spins') {
    const rows = await db.spinSpin.findMany({
      where: { createdAt: { gte: range.gte, lt: range.lt }, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS * 10,
      include: { user: { select: { name: true, email: true } }, redemption: { select: { status: true, voucherCode: true } } },
    });
    return {
      headers: ['Time (UTC)', 'Member', 'Membership', 'Reward', 'Kind', 'Cash amount (INR)', 'Outcome', 'Redemption status', 'Spin ID'],
      rows: rows.map((s) => [
        s.createdAt.toISOString(), s.user.email ?? s.user.name, s.tier, s.rewardName, s.rewardKind,
        s.rewardKind === 'CASH' ? minorToDecimal(s.amountMinor) : '', s.outcome, s.redemption?.status ?? '', s.id,
      ]),
    };
  }
  if (report === 'distribution') {
    const rewards = await db.spinReward.findMany({ orderBy: { name: 'asc' } });
    const grouped = await db.spinSpin.groupBy({
      by: ['rewardId'], where: { createdAt: { gte: range.gte, lt: range.lt }, ...(userId ? { userId } : {}) },
      _count: { _all: true }, _sum: { amountMinor: true },
    });
    return {
      headers: ['Reward', 'Kind', 'Wins', 'Cash paid (INR)'],
      rows: rewards.map((r) => {
        const g = grouped.find((x) => x.rewardId === r.id);
        return [r.name, r.kind, g?._count._all ?? 0, r.kind === 'CASH' ? minorToDecimal(g?._sum.amountMinor ?? 0n) : ''];
      }),
    };
  }
  const rows = await db.spinRedemption.findMany({
    where: { createdAt: { gte: range.gte, lt: range.lt }, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS * 10,
    include: { spin: { select: { rewardName: true } }, user: { select: { name: true, email: true } } },
  });
  return {
    headers: ['Requested (UTC)', 'Member', 'Reward', 'Status', 'Voucher code', 'Handled at (UTC)', 'Redemption ID'],
    rows: rows.map((r) => [
      r.createdAt.toISOString(), r.user.email ?? r.user.name, r.spin.rewardName, r.status,
      r.voucherCode ?? '', r.handledAt?.toISOString() ?? '', r.id,
    ]),
  };
}
