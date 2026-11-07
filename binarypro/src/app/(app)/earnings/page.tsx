import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { earningsByType, EARNING_TYPES, type EarningType } from '@/lib/server/dashboard';
import { formatMoney, BASE_CURRENCY, type Currency } from '@/lib/domain/money';
import { EarningsHistory, type EarningRow } from '@/components/earnings-history';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

const TONE: Record<EarningType, string> = {
  DIRECT_COMMISSION: 'from-[#ff6a00] to-[#ff8c33]',
  BINARY_COMMISSION: 'from-[#d4af37] to-[#f7e09a]',
  AD_REWARD: 'from-emerald-500 to-emerald-300',
  CASHBACK: 'from-sky-500 to-sky-300',
};

export default async function Earnings() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { totals, entries } = await earningsByType(user.id);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0n);
  const pct = (v: bigint) => (grand === 0n ? 0 : Number((v * 100n) / grand));

  const rows: EarningRow[] = entries.slice(0, 500).map((e, i) => ({
    id: `${i}-${e.tx.createdAt.getTime()}`,
    date: e.tx.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    source: e.tx.type,
    label: EARNING_TYPES[e.tx.type as EarningType],
    amount: formatMoney(e.amountMinor, e.currency as Currency),
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Earnings</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Every reward credited to your wallets, grouped by where it came from. Totals are in INR at today&apos;s rates.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(150deg,#ff6a00,#d4af37_75%,#4a3508)] p-7 text-black">
          <div className="text-xs font-bold uppercase tracking-[.2em] opacity-75">Total earned</div>
          <div className="mt-3 text-4xl font-black tracking-tight">{formatMoney(grand, BASE_CURRENCY)}</div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-black/20">
            {(Object.keys(EARNING_TYPES) as EarningType[]).map((t) => (
              <div key={t} className="h-full bg-black/60" style={{ width: `${pct(totals[t])}%` }} title={EARNING_TYPES[t]} />
            ))}
          </div>
          <p className="mt-3 text-xs opacity-75">Share by source</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {(Object.keys(EARNING_TYPES) as EarningType[]).map((t) => (
            <div key={t} className="min-w-0 rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#b9b09a]">{EARNING_TYPES[t]}</span>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${TONE[t]} text-black`}>
                  <Icon name={t === 'AD_REWARD' ? 'play' : t === 'CASHBACK' ? 'bag' : t === 'BINARY_COMMISSION' ? 'tree' : 'chart'} className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{formatMoney(totals[t], BASE_CURRENCY)}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className={`h-full rounded-full bg-gradient-to-r ${TONE[t]}`} style={{ width: `${Math.max(pct(totals[t]), totals[t] > 0n ? 4 : 0)}%` }} />
              </div>
              <div className="mt-2 text-xs text-[#8f8672]">{pct(totals[t])}% of total</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Credit history</h2>
          <p className="text-sm text-[#8f8672]">Latest {rows.length} credits. Filter by source.</p>
        </div>
        <EarningsHistory rows={rows} />
      </section>
    </div>
  );
}
