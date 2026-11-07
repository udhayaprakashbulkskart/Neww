import Link from 'next/link';
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
import { CopyButton } from '@/components/copy-button';
import { Money, Disclaimer } from '@/components/ui';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

function Tile({ label, children, hint, accent = false }: { label: string; children: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-[#d4af37]/40 bg-[linear-gradient(160deg,#1d1606,#080808)]' : 'border-white/5 bg-white/[0.03]'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8f8672]">{label}</div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{children}</div>
      {hint && <div className="mt-1 text-xs text-[#8f8672]">{hint}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const [wallets, legs, referrals, activeDirects, commissions, prices] = await Promise.all([
    walletBalances(user.id),
    db.pvLeg.findMany({ where: { userId: user.id } }),
    db.user.count({ where: { sponsorId: user.id } }),
    db.user.count({ where: { sponsorId: user.id, membership: { active: true, expiresAt: { gt: new Date() } }, orders: { some: { status: 'VERIFIED' } } } }),
    db.commission.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 8 }),
    Promise.all(TIERS.map(async (t) => ({ tier: t, price: formatMoney(await membershipPrice(t, 'INR'), 'INR') }))),
  ]);
  const left = legs.find((l) => l.side === 'LEFT')?.pvMinor ?? 0n;
  const right = legs.find((l) => l.side === 'RIGHT')?.pvMinor ?? 0n;
  const m = user.membership;
  const tier = (m?.tier ?? 'BASIC') as Tier;
  const active = isMembershipActive(m);
  const legTotal = left + right;
  const leftPct = legTotal === 0n ? 50 : Number((left * 100n) / legTotal);
  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#8f8672]">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight">Hi, <span className="gold-text">{firstName}</span></h1>
        </div>
        <div className="flex gap-2">
          <Link href="/ads" className="btn btn-brand">Watch &amp; earn</Link>
          <Link href="/shop" className="btn btn-ghost">Shop</Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <MembershipCard tier={tier} name={user.name} active={active} expires={m?.expiresAt ?? null} />
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8f8672]">Your invite link</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-black px-3 py-2 text-xs text-[#f7e09a]">{`/login?ref=${user.id}`}</code>
              <CopyButton text={`/login?ref=${user.id}`} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Tile label="Wallet · INR" accent><Money minor={wallets.INR} /></Tile>
          <Tile label="Rank">{RANK_LABELS[user.rank as Rank]}</Tile>
          <Tile label="Direct members" hint={`${activeDirects} with a verified purchase`}>{referrals}</Tile>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[.18em] text-[#8f8672]">
              <span>Binary balance</span>
              <span>{user.parentId ? `Placed ${user.side}` : 'Not placed'}</span>
            </div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#1a1408]">
              <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#ff8c33)]" style={{ width: `${leftPct}%` }} />
              <div className="h-full bg-[linear-gradient(90deg,#d4af37,#f7e09a)]" style={{ width: `${100 - leftPct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 text-sm">
              <div><div className="text-[#8f8672]">Left leg</div><Money minor={left} /></div>
              <div className="text-right"><div className="text-[#8f8672]">Right leg</div><Money minor={right} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { href: '/ads', icon: 'play', title: 'Watch advertiser videos', body: 'Watch a sponsored video in full to earn its advertiser-funded reward.' },
          { href: '/shop', icon: 'bag', title: 'Shop with cashback', body: 'Merchant-funded cashback is released once your order is verified.' },
          { href: '/tree', icon: 'tree', title: 'Grow your binary team', body: 'Place members on your left or right and track matched volume.' },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-[#d4af37]/40">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black"><Icon name={c.icon} className="h-5 w-5" /></span>
            <div className="mt-4 font-bold">{c.title}</div>
            <p className="mt-1 text-sm text-[#8f8672]">{c.body}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold">Membership</h2>
          <p className="text-sm text-[#8f8672]">Current plan: {tier}. Plans can be paid in INR or converted at checkout.</p>
        </div>
        <MembershipPicker currentTier={active ? tier : ''} tiers={prices} />
        <div className="mt-5 grid gap-3 text-xs text-[#8f8672] sm:grid-cols-4">
          {TIERS.map((t) => (
            <div key={t} className="rounded-xl bg-black/40 p-3">
              <div className="font-semibold text-[#f7e09a]">{t}</div>
              Direct {PLANS[t].directBps / 100}% · Binary {PLANS[t].binaryBps / 100}% · Cap {formatMoney(PLANS[t].binaryDailyCapInrMinor, BASE_CURRENCY)}/day
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-lg font-bold">Recent commissions</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-[#8f8672]">None yet. Commissions appear here after verified sales or binary matching.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}><td>{c.type === 'DIRECT' ? 'Direct sale' : 'Binary match'}</td><td><Money minor={c.amountMinor} /></td><td>{c.createdAt.toLocaleDateString('en-IN')}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <Disclaimer />
    </div>
  );
}
