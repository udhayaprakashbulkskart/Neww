import { handle, ok, requireUser } from '@/lib/server/http';
import { db } from '@/lib/server/db';
import { walletBalances } from '@/lib/server/wallet';
import { isMembershipActive } from '@/lib/server/membership';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { BASE_CURRENCY } from '@/lib/domain/money';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [wallets, legs, referrals, recentCommissions] = await Promise.all([
      walletBalances(user.id),
      db.pvLeg.findMany({ where: { userId: user.id } }),
      db.user.count({ where: { sponsorId: user.id } }),
      db.commission.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    const legMap = { LEFT: 0n, RIGHT: 0n } as Record<'LEFT' | 'RIGHT', bigint>;
    for (const l of legs) legMap[l.side] = l.pvMinor;
    const m = user.membership;
    const tier = (m?.tier ?? 'BASIC') as Tier;
    return ok({
      id: user.id,
      name: user.name,
      phone: user.phone,
      kyc: user.kyc,
      rank: user.rank,
      placed: !!user.parentId,
      side: user.side,
      preferredCurrency: user.preferredCurrency,
      referralLink: `/login?ref=${user.id}`,
      membership: m && { tier, active: isMembershipActive(m), expiresAt: m.expiresAt, plan: PLANS[tier] },
      binary: { leftPvInrMinor: legMap.LEFT, rightPvInrMinor: legMap.RIGHT },
      referrals,
      wallets,
      baseCurrency: BASE_CURRENCY,
      recentCommissions,
    });
  });
}
