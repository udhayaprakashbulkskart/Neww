import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { walletBalances } from '@/lib/server/wallet';
import { isMembershipActive, membershipPrice } from '@/lib/server/membership';
import { PLANS, TIERS, type Tier } from '@/lib/domain/plans';
import { BASE_CURRENCY, formatMoney } from '@/lib/domain/money';
import { RANK_LABELS, type Rank } from '@/lib/domain/rank-type';
import { MembershipCard } from '@/components/membership-card';
import { MembershipPicker } from '@/components/client';
import { Money, Section, Stat, Disclaimer, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const [wallets, legs, referrals, activeDirects, commissions, prices] = await Promise.all([
    walletBalances(user.id),
    db.pvLeg.findMany({ where: { userId: user.id } }),
    db.user.count({ where: { sponsorId: user.id } }),
    db.user.count({ where: { sponsorId: user.id, membership: { active: true, expiresAt: { gt: new Date() } }, orders: { some: { status: 'VERIFIED' } } } }),
    db.commission.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    Promise.all(TIERS.map(async (t) => ({ tier: t, price: formatMoney(await membershipPrice(t, 'INR'), 'INR') }))),
  ]);
  const left = legs.find((l) => l.side === 'LEFT')?.pvMinor ?? 0n;
  const right = legs.find((l) => l.side === 'RIGHT')?.pvMinor ?? 0n;
  const m = user.membership;
  const tier = (m?.tier ?? 'BASIC') as Tier;
  const active = isMembershipActive(m);
  const nonZero = Object.entries(wallets).filter(([, v]) => v > 0n);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <MembershipCard tier={tier} name={user.name} active={active} expires={m?.expiresAt ?? null} />
          <Notice>
            Referral link:{' '}
            <span className="break-all font-mono text-[#f7e09a]">{`/login?ref=${user.id}`}</span>
          </Notice>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Rank">{RANK_LABELS[user.rank as Rank]}</Stat>
          <Stat label="Wallet (INR)"><Money minor={wallets.INR} /></Stat>
          <Stat label="Left leg (unmatched PV)"><Money minor={left} /></Stat>
          <Stat label="Right leg (unmatched PV)"><Money minor={right} /></Stat>
          <Stat label="Direct members" hint={`${activeDirects} with a verified purchase`}>{referrals}</Stat>
          <Stat label="Binary placement">{user.parentId ? `${user.side}` : 'Not placed'}</Stat>
        </div>
      </div>

      <Section title="Membership" subtitle={`Current plan: ${tier}. Plans are paid in INR or converted at checkout.`}>
        <MembershipPicker currentTier={active ? tier : ''} tiers={prices.map((p) => ({ ...p, price: p.price }))} />
        <div className="mt-4 grid gap-2 text-xs text-[#a39a86] sm:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t}>{t}: direct {PLANS[t].directBps / 100}% · binary {PLANS[t].binaryBps / 100}% · cap {formatMoney(PLANS[t].binaryDailyCapInrMinor, BASE_CURRENCY)}/day</div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Wallet balances" subtitle="Each currency has its own wallet. Balances come from the double-entry ledger.">
          {nonZero.length === 0 ? (
            <p className="text-sm text-[#a39a86]">No balance yet. Commissions, cashback and rewards appear here once released.</p>
          ) : (
            <ul className="space-y-2">
              {nonZero.map(([c, v]) => (
                <li key={c} className="flex justify-between rounded-lg bg-[#0c0a06] px-3 py-2"><span>{c}</span><Money minor={v} currency={c as 'INR'} /></li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Recent commissions" subtitle="Released only from verified retail sales or binary matching.">
          {commissions.length === 0 ? (
            <p className="text-sm text-[#a39a86]">None yet.</p>
          ) : (
            <table className="table w-full text-sm">
              <thead><tr><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}><td>{c.type}</td><td><Money minor={c.amountMinor} /></td><td>{c.createdAt.toLocaleDateString('en-IN')}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
      <Disclaimer />
    </div>
  );
}
