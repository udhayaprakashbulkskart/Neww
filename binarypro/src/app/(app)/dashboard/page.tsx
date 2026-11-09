import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { getDashboard, EARNING_TYPES, type EarningType } from '@/lib/server/dashboard';
import { walletBalances } from '@/lib/server/wallet';
import { buildTree } from '@/lib/server/tree';
import { membershipPrice } from '@/lib/server/membership';
import { PLANS, TIERS, type Tier } from '@/lib/domain/plans';
import { loadEffectivePlans } from '@/lib/server/plans';
import { formatMoney, BASE_CURRENCY, CURRENCY_META, type Currency } from '@/lib/domain/money';
import { getRequestRegion } from '@/lib/server/locale';
import { numberLocale, type Locale } from '@/lib/i18n/locales';
import { RANK_LABELS } from '@/lib/domain/rank-type';
import type { Translator, MessageKey } from '@/lib/i18n/messages';
import { MembershipCard } from '@/components/membership-card';
import { MembershipPicker } from '@/components/client';
import { CopyButton } from '@/components/copy-button';
import { Money, Disclaimer } from '@/components/ui';
import { Icon } from '@/components/shell/icons';
import { memberMilestone, loadPrizes } from '@/lib/server/milestones';
import { TreeView } from '@/components/tree-view';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon: string }) {
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

const QUICK: { href: string; icon: string; label: MessageKey }[] = [
  { href: '/ads', icon: 'play', label: 'dash.qWatch' },
  { href: '/shop', icon: 'bag', label: 'dash.qShop' },
  { href: '/tree', icon: 'tree', label: 'dash.binaryTree' },
  { href: '/earnings', icon: 'chart', label: 'dash.qEarnings' },
  { href: '/wallet', icon: 'wallet', label: 'dash.qWallet' },
  { href: '/login', icon: 'copy', label: 'dash.qInvite' },
];

/** Rank keys by their shipped English label, so the translated name can be shown. */
function rankKey(label: string): MessageKey {
  const key = (Object.keys(RANK_LABELS) as (keyof typeof RANK_LABELS)[]).find((k) => RANK_LABELS[k] === label) ?? 'MEMBER';
  return `rank.${key}` as MessageKey;
}

function milestoneStatus(t: Translator, status: string, prize: string | null | undefined): string | null {
  const name = prize ?? '';
  if (status === 'QUALIFIED') return t('dash.milestoneQualified');
  if (status === 'APPROVED') return t('dash.milestoneApproved', { prize: prize ?? name });
  if (status === 'FULFILLED') return t('dash.milestoneFulfilled', { prize: name });
  if (status === 'REJECTED') return t('dash.milestoneRejected');
  return null;
}

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const region = await getRequestRegion();
  const t = region.t;
  const locale: Locale = region.locale;
  const numLocale = numberLocale(locale, BASE_CURRENCY);

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
          <MembershipCard tier={tier} name={user.name} active={d.activeMembership} expires={d.expiresAt} t={t} locale={locale} />
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between"><span className="text-[#8f8672]">{t('dash.memberId')}</span><span className="font-mono font-bold text-[#f7e09a]">{d.memberCode}</span></div>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-black px-3 py-2 font-mono text-xs text-[#f7e09a]">{`/login?ref=${user.id}`}</code>
              <CopyButton text={`/login?ref=${user.id}`} />
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 items-start gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <Kpi label={t('dash.kpiDirects')} value={d.directs} icon="home" />
          <Kpi label={t('dash.kpiLeftTeam')} value={d.leftTeamCount.toLocaleString(numLocale)} icon="tree" />
          <Kpi label={t('dash.kpiRightTeam')} value={d.rightTeamCount.toLocaleString(numLocale)} icon="tree" />
          <Kpi label={t('dash.kpiTeamBusiness')} value={<Money minor={d.teamPvInrMinor} />} icon="wallet" />
          <Kpi label={t('dash.kpiRank')} value={<span className="text-[#f7e09a]">{t(rankKey(d.rankLabel))}</span>} icon="shield" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('dash.binaryTree')} className="xl:col-span-2" action={<Link href="/tree" className="text-xs font-semibold text-[#f7e09a]">{t('dash.fullTree')}</Link>}>
          {preview ? <TreeView root={preview} viewerId={user.id} /> : <p className="text-sm text-[#8f8672]">{t('dash.chooseTree')}</p>}
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#1a1408]" aria-label={t('dash.legBalance')}>
            <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#ff8c33)]" style={{ width: `${leftPct}%` }} />
            <div className="h-full bg-[linear-gradient(90deg,#d4af37,#f7e09a)]" style={{ width: `${100 - leftPct}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 text-xs text-[#8f8672]">
            <span>{t('dash.leftUnmatched')} <Money minor={d.legs.left} /></span>
            <span className="text-right">{t('dash.rightUnmatched')} <Money minor={d.legs.right} /></span>
          </div>
        </Card>

        <Card title={t('dash.earningsSummary')} action={<Link href="/earnings" className="text-xs font-semibold text-[#f7e09a]">{t('dash.report')}</Link>}>
          <ul className="space-y-3 text-sm">
            {(Object.keys(EARNING_TYPES) as EarningType[]).map((k) => (
              <li key={k} className="flex items-center justify-between rounded-xl bg-black/40 px-3 py-2.5">
                <span className="text-[#cfc6b0]">{t(`earn.${k}` as MessageKey)}</span>
                <Money minor={d.earnings.totals[k]} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[linear-gradient(90deg,#ff6a00,#d4af37)] px-4 py-3 font-extrabold text-black">
            <span>{t('dash.totalEarnings')}</span><Money minor={earnTotal} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t('dash.rankProgress')}>
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#d4af37)] text-black"><Icon name="shield" className="h-6 w-6" /></div>
            <div>
              <div className="text-xs text-[#8f8672]">{t('dash.current')}</div>
              <div className="font-bold text-[#f7e09a]">{t(rankKey(d.rankLabel))}</div>
              {d.next && <div className="text-xs text-[#8f8672]">{t('dash.nextRank', { name: t(rankKey(d.next.label)) })}</div>}
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#1a1408]"><div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${d.rankProgress}%` }} /></div>
          <div className="mt-1 text-right text-xs text-[#8f8672]">{d.rankProgress}%</div>
          {d.next ? (
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex justify-between"><span className="text-[#cfc6b0]">{t('dash.activeDirects')}</span><span>{d.activeDirects} / {d.next.activeDirects}</span></li>
              <li className="flex justify-between"><span className="text-[#cfc6b0]">{t('dash.kpiTeamBusiness')}</span><span><Money minor={d.teamPvInrMinor} /> / <Money minor={d.next.teamPvInrMinor} /></span></li>
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#f7e09a]">{t('dash.highestRank')}</p>
          )}
        </Card>

        <Card title={t('dash.myWallets')} action={<Link href="/wallet" className="text-xs font-semibold text-[#f7e09a]">{t('dash.manage')}</Link>}>
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
            <Link href="/wallet" className="btn btn-brand py-2 text-xs">{t('dash.withdraw')}</Link>
            <Link href="/wallet" className="btn btn-ghost py-2 text-xs">{t('dash.convert')}</Link>
          </div>
        </Card>

      </div>

      <Card title={t('dash.membershipPlans')} action={<span className="text-xs text-[#8f8672]">{t('dash.currentStatus', { status: d.activeMembership ? t(`tier.${tier}` as MessageKey) : t('dash.none') })}</span>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier2) => {
            const current = d.activeMembership && tier2 === tier;
            return (
              <div key={tier2} className={`relative rounded-2xl p-5 text-center ${current ? 'bg-[linear-gradient(160deg,#ff6a00,#d4af37)] text-black' : 'border border-white/10 bg-black/40'}`}>
                {current && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#f7e09a]">{t('dash.currentPlan')}</span>}
                <div className="text-xs font-bold tracking-widest">{t(`tier.${tier2}` as MessageKey)}</div>
                <div className="mt-2 text-3xl font-black">{plans[tier2].couponMaxPercent}%</div>
                <div className="text-[11px] opacity-80">{t('plan.cashbackUpTo')}</div>
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
                <p className="mt-1 max-w-xl text-sm text-[#8f8672]">{t('dash.milestoneNote')}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-[#f7e09a]">{formatMoney(milestone.metricMinor, BASE_CURRENCY)}</div>
                <div className="text-xs text-[#8f8672]">{t('dash.ofAmount', { amount: formatMoney(milestone.thresholdMinor, BASE_CURRENCY, numLocale) })}</div>
              </div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#1a1408]">
              <div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${milestone.percent}%` }} />
            </div>
            {milestone.award && (
              <p className="mt-3 text-sm text-[#f7e09a]">
                {milestoneStatus(t, milestone.award.status, milestone.award.prizeModel)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#8f8672]">{t('dash.noMilestone')}</p>
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
                  <p className="mt-auto pt-2 text-[11px] text-[#6f6758]">{prize.supplierNote} {t('dash.prizeAwarded')}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-4 text-[11px] text-[#6f6758]">{t('dash.prizeTerms')}</p>
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">{t('dash.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {QUICK.map((q) => (
            <Link key={q.label} href={q.href} className="group flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-[#d4af37]/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black"><Icon name={q.icon} className="h-5 w-5" /></span>
              <span className="text-sm font-semibold">{t(q.label)}</span>
            </Link>
          ))}
        </div>
      </section>
      <Disclaimer />
      <p className="text-[11px] text-[#6f6758]">{t('dash.amountsNote', { currency: BASE_CURRENCY })}</p>
    </div>
  );
}
