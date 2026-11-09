import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { walletBalances, walletSummary } from '@/lib/server/wallet';
import { CURRENCIES, formatMoney, CURRENCY_META, type Currency } from '@/lib/domain/money';
import { MIN_WITHDRAWAL } from '@/lib/domain/plans';
import { ConvertForm, WithdrawForm } from '@/components/client';
import { Money, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Wallet() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const [balances, summary, history, withdrawals] = await Promise.all([
    walletBalances(user.id),
    walletSummary(user.id),
    db.ledgerEntry.findMany({
      where: { account: { userId: user.id } },
      orderBy: { tx: { createdAt: 'desc' } },
      take: 40,
      include: { tx: { select: { type: true, description: true, createdAt: true } }, account: { select: { currency: true } } },
    }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
  ]);
  const balanceStrings = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, formatMoney(v, k as Currency)]));
  const kycOk = user.kyc === 'VERIFIED';
  const total = balances.INR;

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-5">
        <div className="panel p-4"><div className="label">Available</div><div className="mt-2 text-lg font-bold">{formatMoney(summary.available, 'INR')}</div></div>
        <div className="panel p-4"><div className="label">Pending</div><div className="mt-2 text-lg font-bold">{formatMoney(summary.pending, 'INR')}</div><div className="text-xs text-[#8f8672]">Released daily, up to your cap</div></div>
        <div className="panel p-4"><div className="label">Withdrawable</div><div className="mt-2 text-lg font-bold">{formatMoney(summary.withdrawable, 'INR')}</div></div>
        <div className="panel p-4"><div className="label">Withdrawn</div><div className="mt-2 text-lg font-bold">{formatMoney(summary.withdrawn, 'INR')}</div></div>
        <div className="panel p-4"><div className="label">Reversed</div><div className="mt-2 text-lg font-bold">{formatMoney(summary.reversed, 'INR')}</div><div className="text-xs text-[#8f8672]">After returns</div></div>
      </section>
      <header>
        <h1 className="text-3xl font-black tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-[#8f8672]">One wallet per currency. Every balance comes from the ledger.</p>
      </header>

      <section className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {CURRENCIES.map((c) => {
          const hasFunds = balances[c] > 0n;
          return (
            <div key={c} className={`min-w-[210px] snap-start rounded-3xl p-5 ${hasFunds ? 'bg-[linear-gradient(150deg,#ff6a00,#d4af37_70%,#4a3508)] text-black' : 'border border-white/5 bg-white/[0.03]'}`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest opacity-80">
                <span>{c}</span><span>{CURRENCY_META[c].symbol.trim()}</span>
              </div>
              <div className="mt-8 whitespace-nowrap text-xl font-black sm:text-2xl"><Money minor={balances[c]} currency={c} /></div>
              <div className="mt-1 text-xs opacity-70">{CURRENCY_META[c].name}</div>
            </div>
          );
        })}
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <h2 className="mb-1 text-lg font-bold">Convert currency</h2>
          <p className="mb-4 text-sm text-[#8f8672]">Converted at the published rate with a 1.5% spread.</p>
          <ConvertForm currencies={[...CURRENCIES]} balances={balanceStrings} />
        </section>
        <section className="min-w-0 rounded-3xl border border-white/5 bg-white/[0.03] p-6">
          <h2 className="mb-1 text-lg font-bold">Withdraw</h2>
          <p className="mb-4 text-sm text-[#8f8672]">{kycOk ? 'Paid to your bank account after finance review.' : user.kyc === 'PENDING' ? 'Your identity documents are under review.' : 'Identity verification is required before withdrawing.'}</p>
          {kycOk ? (
            <WithdrawForm currencies={[...CURRENCIES]} />
          ) : (
            <Notice tone="warn">{user.kyc === 'PENDING' ? 'Your identity documents are under review. Withdrawals unlock once approved.' : user.kyc === 'REJECTED' ? 'Your identity check was not approved. Contact support to resubmit your documents.' : 'Complete identity verification to enable withdrawals.'} Minimum INR {formatMoney(MIN_WITHDRAWAL.INR, 'INR')}. Available INR: {formatMoney(total, 'INR')}.</Notice>
          )}
          {withdrawals.length > 0 && (
            <table className="table mt-5 w-full text-sm">
              <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}><td>{w.requestedAt.toLocaleDateString('en-IN')}</td><td><Money minor={w.amountMinor} currency={w.currency} /></td><td>{w.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-1 text-lg font-bold">Activity</h2>
        <p className="mb-4 text-sm text-[#8f8672]">Every movement with its reason. Entries are append-only.</p>
        {history.length === 0 ? (
          <p className="text-sm text-[#8f8672]">No transactions yet.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>When</th><th>Description</th><th>Direction</th><th>Amount</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{h.tx.createdAt.toLocaleString('en-IN')}</td>
                  <td>{h.tx.description}<div className="text-xs text-[#8f8672]">{h.tx.type}</div></td>
                  <td className={h.direction === 'CREDIT' ? 'text-emerald-300' : 'text-orange-300'}>{h.direction === 'CREDIT' ? 'Credit' : 'Debit'}</td>
                  <td><Money minor={h.amountMinor} currency={h.account.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
