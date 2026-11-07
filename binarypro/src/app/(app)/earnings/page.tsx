import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { earningsByType, EARNING_TYPES, type EarningType } from '@/lib/server/dashboard';
import { Money, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Earnings() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { totals, entries } = await earningsByType(user.id);
  const grand = Object.values(totals).reduce((a, b) => a + b, 0n);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Earnings</h1>
        <p className="mt-1 text-sm text-[#8f8672]">Rewards from verified sales, binary matching, verified ad views and cashback. Shown in INR at today&apos;s rates.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl bg-[linear-gradient(150deg,#ff6a00,#d4af37_75%,#4a3508)] p-5 text-black">
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">Total</div>
          <div className="mt-3 text-2xl font-black"><Money minor={grand} /></div>
        </div>
        {(Object.keys(EARNING_TYPES) as EarningType[]).map((t) => (
          <div key={t} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">{EARNING_TYPES[t]}</div>
            <div className="mt-3 text-xl font-extrabold"><Money minor={totals[t]} /></div>
          </div>
        ))}
      </section>
      <Section title="Credit history" subtitle="Latest 5,000 credits to your wallets.">
        {entries.length === 0 ? (
          <p className="text-sm text-[#8f8672]">No earnings yet. Verified sales, binary matches, ad rewards and cashback appear here.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>Date</th><th>Source</th><th>Amount</th></tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td>{e.tx.createdAt.toLocaleDateString('en-IN')}</td>
                  <td>{EARNING_TYPES[e.tx.type as EarningType]}</td>
                  <td><Money minor={e.amountMinor} currency={e.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
