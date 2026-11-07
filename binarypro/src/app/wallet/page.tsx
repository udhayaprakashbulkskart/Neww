import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { walletBalances } from '@/lib/server/wallet';
import { CURRENCIES } from '@/lib/domain/money';
import { MIN_WITHDRAWAL } from '@/lib/domain/plans';
import { ConvertForm, WithdrawForm } from '@/components/client';
import { Section, Money, Notice } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';

export const dynamic = 'force-dynamic';

export default async function Wallet() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const [balances, history, withdrawals] = await Promise.all([
    walletBalances(user.id),
    db.ledgerEntry.findMany({
      where: { account: { userId: user.id } },
      orderBy: { tx: { createdAt: 'desc' } },
      take: 40,
      include: { tx: { select: { type: true, description: true, createdAt: true } }, account: { select: { currency: true } } },
    }),
    db.withdrawal.findMany({ where: { userId: user.id }, orderBy: { requestedAt: 'desc' }, take: 20 }),
  ]);
  const balanceStrings = Object.fromEntries(Object.entries(balances).map(([k, v]) => [k, formatMoney(v, k as 'INR')]));
  const kycOk = user.kyc === 'VERIFIED';

  return (
    <div className="space-y-6">
      <Section title="Multi-currency wallets" subtitle="Convert between currencies at the published rate. A spread of 1.5% applies.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CURRENCIES.map((c) => (
            <div key={c} className="rounded-xl bg-[#0c0a06] p-4">
              <div className="label">{c}</div>
              <div className="mt-1 text-xl font-bold"><Money minor={balances[c]} currency={c} /></div>
            </div>
          ))}
        </div>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Convert currency">
          <ConvertForm currencies={[...CURRENCIES]} balances={balanceStrings} />
        </Section>
        <Section title="Withdraw" subtitle={kycOk ? 'Paid to your bank account after review.' : 'Identity verification is required before withdrawing.'}>
          {kycOk ? (
            <WithdrawForm currencies={[...CURRENCIES]} />
          ) : (
            <Notice tone="warn">Complete identity verification to enable withdrawals. Minimum INR {formatMoney(MIN_WITHDRAWAL.INR, 'INR')}.</Notice>
          )}
          {withdrawals.length > 0 && (
            <table className="table mt-4 w-full text-sm">
              <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}><td>{w.requestedAt.toLocaleDateString('en-IN')}</td><td><Money minor={w.amountMinor} currency={w.currency} /></td><td>{w.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
      <Section title="Ledger history" subtitle="Every movement, with its reason. Entries are append-only.">
        {history.length === 0 ? (
          <p className="text-sm text-[#a39a86]">No transactions yet.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>When</th><th>Description</th><th>Direction</th><th>Amount</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{h.tx.createdAt.toLocaleString('en-IN')}</td>
                  <td>{h.tx.description}<div className="text-xs text-[#6f6758]">{h.tx.type}</div></td>
                  <td className={h.direction === 'CREDIT' ? 'text-emerald-300' : 'text-orange-300'}>{h.direction === 'CREDIT' ? 'Credit' : 'Debit'}</td>
                  <td><Money minor={h.amountMinor} currency={h.account.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
