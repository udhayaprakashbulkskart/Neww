// Data for the member dashboard and earnings report. Everything is computed from the database.
import { db } from './db';
import { binaryDownline } from './binary';
import { isMembershipActive } from './membership';
import { loadRates } from './rates';
import { convertMinor, BASE_CURRENCY, type Currency } from '@/lib/domain/money';
import { RANK_LADDER } from '@/lib/domain/ranks';
import { RANK_LABELS, type Rank } from '@/lib/domain/rank-type';

export const EARNING_TYPES = {
  DIRECT_COMMISSION: 'Direct sales commission',
  BINARY_COMMISSION: 'Binary matching commission',
  AD_REWARD: 'Advertising reward',
  CASHBACK: 'Shopping cashback',
} as const;
export type EarningType = keyof typeof EARNING_TYPES;

/** Member code shown on the dashboard. Derived from the account id; the unique Member ID field is pending. */
export function memberCode(id: string): string {
  return `CT${id.slice(-6).toUpperCase()}`;
}

export async function earningsByType(userId: string) {
  const [entries, rates] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { direction: 'CREDIT', account: { userId }, tx: { type: { in: Object.keys(EARNING_TYPES) } } },
      select: { amountMinor: true, currency: true, tx: { select: { type: true, createdAt: true } } },
      orderBy: { tx: { createdAt: 'desc' } },
      take: 5000,
    }),
    loadRates(),
  ]);
  const totals: Record<EarningType, bigint> = { DIRECT_COMMISSION: 0n, BINARY_COMMISSION: 0n, AD_REWARD: 0n, CASHBACK: 0n };
  for (const e of entries) {
    const inr = convertMinor(e.amountMinor, e.currency as Currency, BASE_CURRENCY, rates);
    totals[e.tx.type as EarningType] += inr;
  }
  return { totals, entries, rates };
}

export async function getDashboard(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { membership: true, children: { select: { id: true, side: true } } },
  });
  const downline = await binaryDownline(db, userId);
  const teamIds = [...downline].filter((id) => id !== userId);

  const leftChild = user.children.find((c) => c.side === 'LEFT');
  const rightChild = user.children.find((c) => c.side === 'RIGHT');
  const [leftTeam, rightTeam] = await Promise.all([
    leftChild ? binaryDownline(db, leftChild.id) : Promise.resolve(new Set<string>()),
    rightChild ? binaryDownline(db, rightChild.id) : Promise.resolve(new Set<string>()),
  ]);

  const [teamBusiness, personal, directs, activeDirects, legs, earnings] = await Promise.all([
    teamIds.length
      ? db.order.aggregate({ where: { buyerId: { in: teamIds }, status: 'VERIFIED' }, _sum: { pvInrMinor: true } })
      : Promise.resolve({ _sum: { pvInrMinor: 0n } }),
    db.order.aggregate({ where: { buyerId: userId, status: 'VERIFIED' }, _sum: { pvInrMinor: true } }),
    db.user.count({ where: { sponsorId: userId } }),
    db.user.count({
      where: { sponsorId: userId, membership: { active: true, expiresAt: { gt: new Date() } }, orders: { some: { status: 'VERIFIED' } } },
    }),
    db.pvLeg.findMany({ where: { userId } }),
    earningsByType(userId),
  ]);

  const teamPv = teamBusiness._sum.pvInrMinor ?? 0n;
  const personalPv = personal._sum.pvInrMinor ?? 0n;
  const rank = user.rank as Rank;
  const nextReq = RANK_LADDER.find((r) => rankIndex(r.rank) > rankIndex(rank));
  const progress = nextReq
    ? Math.min(100, Math.min(
        Math.floor((activeDirects * 100) / nextReq.activeDirects),
        Number((teamPv * 100n) / nextReq.teamPvInrMinor),
      ))
    : 100;

  return {
    user,
    memberCode: memberCode(user.id),
    referralCode: memberCode(user.id),
    activeMembership: isMembershipActive(user.membership),
    tier: user.membership?.tier ?? 'BASIC',
    expiresAt: user.membership?.expiresAt ?? null,
    directs,
    activeDirects,
    leftTeamCount: leftTeam.size,
    rightTeamCount: rightTeam.size,
    teamPvInrMinor: teamPv,
    personalPvInrMinor: personalPv,
    legs: {
      left: legs.find((l) => l.side === 'LEFT')?.pvMinor ?? 0n,
      right: legs.find((l) => l.side === 'RIGHT')?.pvMinor ?? 0n,
    },
    rank,
    rankLabel: RANK_LABELS[rank],
    next: nextReq ? { label: RANK_LABELS[nextReq.rank], activeDirects: nextReq.activeDirects, teamPvInrMinor: nextReq.teamPvInrMinor } : null,
    rankProgress: progress,
    earnings,
  };
}

const ORDER = ['MEMBER', 'SENIOR_MEMBER', 'TEAM_LEADER', 'MANAGER', 'DIRECTOR', 'AMBASSADOR'];
function rankIndex(r: string) {
  return ORDER.indexOf(r);
}
