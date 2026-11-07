// Recomputes ranks from verified retail volume and active sponsorships. Run periodically (admin job).
import { evaluateRank } from '@/lib/domain/ranks';
import type { Rank } from '@/lib/domain/rank-type';
import { isMembershipActive } from './membership';
import { db } from './db';

export async function recomputeRanks(now = new Date()): Promise<number> {
  const users = await db.user.findMany({
    select: { id: true, sponsorId: true, rank: true, membership: { select: { active: true, expiresAt: true } } },
  });
  const verified = await db.order.groupBy({
    by: ['buyerId'],
    where: { status: 'VERIFIED' },
    _sum: { pvInrMinor: true },
  });
  const pvByBuyer = new Map(verified.map((v) => [v.buyerId, v._sum.pvInrMinor ?? 0n]));
  const childrenOf = new Map<string, string[]>();
  for (const u of users) {
    if (!u.sponsorId) continue;
    const list = childrenOf.get(u.sponsorId) ?? [];
    list.push(u.id);
    childrenOf.set(u.sponsorId, list);
  }
  const active = new Set(users.filter((u) => isMembershipActive(u.membership, now)).map((u) => u.id));
  const hasVerifiedOrder = new Set(verified.map((v) => v.buyerId));

  let changed = 0;
  for (const u of users) {
    const directs = (childrenOf.get(u.id) ?? []).filter((c) => active.has(c) && hasVerifiedOrder.has(c)).length;
    // Team PV = verified PV of everyone in the sponsorship downline (excluding the member's own sales).
    let team = 0n;
    const stack = [...(childrenOf.get(u.id) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      team += pvByBuyer.get(id) ?? 0n;
      stack.push(...(childrenOf.get(id) ?? []));
    }
    const next: Rank = evaluateRank(directs, team, u.rank as Rank);
    if (next !== u.rank) {
      await db.user.update({ where: { id: u.id }, data: { rank: next } });
      changed++;
    }
  }
  return changed;
}
