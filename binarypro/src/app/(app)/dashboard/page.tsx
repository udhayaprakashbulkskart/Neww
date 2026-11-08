import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { getDashboard, EARNING_TYPES } from '@/lib/server/dashboard';
import { walletBalances } from '@/lib/server/wallet';
import { buildTree } from '@/lib/server/tree';
import { membershipPrice } from '@/lib/server/membership';
import { PLANS, TIERS, type Tier } from '@/lib/domain/plans';
import { loadEffectivePlans } from '@/lib/server/plans';
import { formatMoney, BASE_CURRENCY, CURRENCY_META, type Currency } from '@/lib/domain/money';
import { MembershipCard } from '@/components/membership-card';
import { MembershipPicker } from '@/components/client';
import { CopyButton } from '@/components/copy-button';
import { Money, Disclaimer } from '@/components/ui';
import { Icon } from '@/components/shell/icons';
import { memberMilestone, loadPrizes } from '@/lib/server/milestones';
import { TreeView } from '@/components/tree-view';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, icon }: { label: string; value: React.ReactNode; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[linear-gradient(160deg,#141008,#070707)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">{label}</span>
        <span className="text-[#f7e09a]"><Icon name={icon} className="h-4 w-4" /></span>
      </div>
      <div className="mt-3 text-xl font-extrabold tracking-tight sm:text-2xl">{value}</div>
    </div>
  );
}

function Card({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-white/5 bg-white/[0.03] p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const QUICK = [
  { href: '/ads', icon: 'play', label: 'Watch ads & earn' },
  { href: '/shop', icon: 'bag', label: 'Shop & earn cashback' },
  { href: '/tree', icon: 'tree', label: 'Binary tree' },
  { href: '/earnings', icon: 'chart', label: 'Earnings report' },
  { href: '/wallet', icon: 'wallet', label: 'Wallet & withdraw' },
  { href: '/login', icon: 'copy', label: 'Invite & earn' },
];

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const plans = await loadEffectivePlans();
  const [d, wallets, prices, preview] = await Promise.all([
    getDashboard(user.id),
    walletBalances(user.id),
    Promise.all(TIERS.map(async (t) => ({ tier: t, price: formatMoney(await membershipPrice(t, 'INR'), 'INR') }))),
    buildTree(user.id, user.id, 2),
  ]);
  const [milestone, prizes] = await Promise.all([memberMilestone(user.id), loadPrizes()]);
  const legTotal = d.legs.left + d.legs.right;
  const leftPct = legTotal === 0n ? 50 : Number((d.legs.left * 100n) / legTotal);
  const held = (Object.keys(wallets) as Currency[]).filter((c) => wallets[c] > 0n);
  const showCurrencies = held.length ? held : (['INR', 'USD', 'EUR'] as Currency[]);
  const earnTotal = Object.values(d.earnings.totals).reduce((a, b) => a + b, 0n);
  const tier = d.tier as Tier;

  return (
    <div className="space-y-6">
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[360px_1fr]">
        <div className="min-w-0 space-y-4">
          <MembershipCard tier={tier} name={user.name} active={d.activeMembership} expires={d.expiresAt} />
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between"><span className="text-[#8f8672]">Member ID</span><span className="font-mono font-bold text-[#f7e09a]">{d.memberCode}</span></div>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-black px-3 py-2 font-mono text-xs text-[#f7e09a]">{`/login?ref=${user.id}`}</code>
              <CopyButton text={`/login?ref=${user.id}`} />
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 items-start gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <Kpi label="My directs" value={d.directs} icon="home" />
          <Kpi label="Left team" value={d.leftTeamCount.toLocaleString('en-IN')} icon="tree" />
          <Kpi label="Right team" value={d.rightTeamCount.toLocaleString('en-IN')} icon="tree" />
          <Kpi label="Team business" value={<Money minor={d.teamPvInrMinor} />} icon="wallet" />
          <Kpi label="My rank" value={<span className="text-[#f7e09a]">{d.rankLabel}</span>} icon="shield" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Binary tree" className="xl:col-span-2" action={<Link href="/tree" className="text-xs font-semibold text-[#f7e09a]">Full tree →</Link>}>
          {preview ? <TreeView root={preview} viewerId={user.id} /> : <p className="text-sm text-[#8f8672]">Choose your binary position to see your team here.</p>}
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#1a1408]" aria-label="Binary leg balance">
            <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#ff8c33)]" style={{ width: `${leftPct}%` }} />
            <div className="h-full bg-[linear-gradient(90deg,#d4af37,#f7e09a)]" style={{ width: `${100 - leftPct}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 text-xs text-[#8f8672]">
            <span>Left unmatched <Money minor={d.legs.left} /></span>
            <span className="text-right">Right unmatched <Money minor={d.legs.right} /></span>
          </div>
        </Card>

        <Card title="Earnings summary" action={<Link href="/earnings" className="text-xs font-semibold text-[#f7e09a]">Report →</Link>}>
          <ul className="space-y-3 text-sm">
            {(Object.keys(EARNING_TYPES) as (keyof typeof EARNING_TYPES)[]).map((t) => (
              <li key={t} className="flex items-center justify-between rounded-xl bg-black/40 px-3 py-2.5">
                <span className="text-[#cfc6b0]">{EARNING_TYPES[t]}</span>
                <Money minor={d.earnings.totals[t]} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[linear-gradient(90deg,#ff6a00,#d4af37)] px-4 py-3 font-extrabold text-black">
            <span>Total earnings</span><Money minor={earnTotal} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Rank progress">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#d4af37)] text-black"><Icon name="shield" className="h-6 w-6" /></div>
            <div>
              <div className="text-xs text-[#8f8672]">Current</div>
              <div className="font-bold text-[#f7e09a]">{d.rankLabel}</div>
              {d.next && <div className="text-xs text-[#8f8672]">Next: {d.next.label}</div>}
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#1a1408]"><div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${d.rankProgress}%` }} /></div>
          <div className="mt-1 text-right text-xs text-[#8f8672]">{d.rankProgress}%</div>
          {d.next ? (
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-[#cfc6b0]">Active direct members</span><span>{d.activeDirects} / {d.next.activeDirects}</span></li>
              <li className="flex justify-between"><span className="text-[#cfc6b0]">Team business</span><span><Money minor={d.teamPvInrMinor} /> / <Money minor={d.next.teamPvInrMinor} /></span></li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#f7e09a]">You have reached the highest rank.</p>
          )}
        </Card>

        <Card title="My wallets" action={<Link href="/wallet" className="text-xs font-semibold text-[#f7e09a]">Manage →</Link>}>
          <div className="space-y-3">
            {showCurrencies.map((c, i) => (
              <div key={c} className={`flex items-center justify-between rounded-2xl p-4 ${i === 0 ? 'bg-[linear-gradient(120deg,#1f1706,#0b0b0b)] ring-1 ring-[#d4af37]/40' : 'bg-black/40'}`}>
                <div>
                  <div className="text-xs font-bold tracking-widest text-[#f7e09a]">{c}</div>
                  <div className="text-xs text-[#8f8672]">{CURRENCY_META[c].name}</div>
                </div>
                <div className="text-lg font-extrabold"><Money minor={wallets[c]} currency={c} /></div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/wallet" className="btn btn-brand py-2 text-xs">Withdraw</Link>
            <Link href="/wallet" className="btn btn-ghost py-2 text-xs">Convert</Link>
          </div>
        </Card>

      </div>

      <Card title="Membership plans" action={<span className="text-xs text-[#8f8672]">Current: {d.activeMembership ? tier : 'none'}</span>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const current = d.activeMembership && t === tier;
            return (
              <div key={t} className={`relative rounded-2xl p-5 text-center ${current ? 'bg-[linear-gradient(160deg,#ff6a00,#d4af37)] text-black' : 'border border-white/10 bg-black/40'}`}>
                {current && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#f7e09a]">Current plan</span>}
                <div className="text-xs font-bold tracking-widest">{t}</div>
                <div className="mt-2 text-3xl font-black">{plans[t].couponMaxPercent}%</div>
                <div className="text-[11px] opacity-80">cashback coupons up to</div>
              </div>
            );
          })}
        </div>
        <div className="mt-5"><MembershipPicker currentTier={d.activeMembership ? tier : ''} tiers={prices} /></div>
      </Card>

      <section className="rounded-3xl border border-[#d4af37]/25 bg-[linear-gradient(160deg,#1d1606,#070707)] p-6">
        {milestone ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{milestone.ruleName}</h2>
                <p className="mt-1 max-w-xl text-sm text-[#8f8672]">Counts only your own verified retail sales, delivered and past the return window. Team size and recruitment do not count.</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#f7e09a]">{formatMoney(milestone.metricMinor, BASE_CURRENCY)}</div>
                <div className="text-xs text-[#8f8672]">of {formatMoney(milestone.thresholdMinor, BASE_CURRENCY)}</div>
              </div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#1a1408]">
              <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${milestone.percent}%` }} />
            </div>
            {milestone.award && (
              <p className="mt-3 text-sm text-[#f7e09a]">
                {milestone.award.status === 'QUALIFIED' && 'You have reached this milestone. Our team will confirm your prize.'}
                {milestone.award.status === 'APPROVED' && `Approved: ${milestone.award.prizeModel ?? 'your prize'} will be arranged with our team.`}
                {milestone.award.status === 'FULFILLED' && `Prize handed over: ${milestone.award.prizeModel ?? ''}`}
                {milestone.award.status === 'REJECTED' && 'This milestone was not approved. Contact support if you think this is wrong.'}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#8f8672]">There is no active retail milestone right now.</p>
        )}
        {prizes.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {prizes.map((prize) => (
              <article key={prize.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="flex h-40 items-center justify-center bg-white p-3">
                  <img src={prize.imageUrl} alt={`${prize.model} (${prize.name.toLowerCase()} prize)`} className="max-h-full max-w-full object-contain" loading="lazy" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#f7e09a]">{prize.name}</div>
                  <div className="text-base font-bold">{prize.model}</div>
                  <p className="text-xs leading-relaxed text-[#b9b09a]">{prize.description}</p>
                  <ul className="mt-1 space-y-1 text-xs text-[#8f8672]">
                    {prize.details.map((line) => <li key={line}>• {line}</li>)}
                  </ul>
                  <p className="mt-auto pt-2 text-[11px] text-[#6f6758]">{prize.supplierNote} Awarded only after verification and approval.</p>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-4 text-[11px] text-[#6f6758]">Prize details, eligibility and timing are set in the programme terms. Prizes are not guaranteed.</p>
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((q) => (
            <Link key={q.label} href={q.href} className="group flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-[#d4af37]/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black"><Icon name={q.icon} className="h-5 w-5" /></span>
              <span className="text-sm font-semibold">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>
      <Disclaimer />
      <p className="text-[11px] text-[#6f6758]">Amounts shown in {BASE_CURRENCY} unless stated. Earnings count only verified sales and funded rewards.</p>
    </div>
  );
}
