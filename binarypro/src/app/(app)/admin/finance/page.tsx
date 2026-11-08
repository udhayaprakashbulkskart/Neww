import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney } from '@/lib/domain/money';
import { dateRange } from '@/lib/domain/finance';
import { financeOverview, salesReport, commissionReport, withdrawalReport } from '@/lib/server/finance';
import { Section, Money, Notice, Stat } from '@/components/ui';

export const dynamic = 'force-dynamic';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export default async function FinancePage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user.role as StaffRole, 'finance:read')) redirect('/dashboard');

  const from = searchParams.from ?? monthStartUtc();
  const to = searchParams.to ?? todayUtc();
  const range = dateRange(from, to);

  const overview = await financeOverview();
  const [sales, commissions, withdrawals] = range
    ? await Promise.all([salesReport(range), commissionReport(range), withdrawalReport(range)])
    : [[], [], []];

  const exportLink = (report: string, format: 'csv' | 'pdf') =>
    `/api/admin/finance/export?report=${report}&from=${from}&to=${to}&format=${format}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Finance</h1>
          <p className="text-sm text-[#a39a86]">Reconciliation, reserve, verified sales and commission reports. Read-only.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>

      <Section title="Ledger integrity" subtitle="Across all accounts, total debits must equal total credits in every currency.">
        {overview.trial.balanced ? (
          <Notice>Trial balance is balanced across {overview.trial.rows.length} ledger accounts. No unbalanced transactions.</Notice>
        ) : (
          <Notice tone="warn">
            <ul className="list-disc pl-5">
              {overview.trial.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </Notice>
        )}
      </Section>

      <Section title="Commission reserve and liabilities" subtitle="The reserve is the funded pool for commissions. Liabilities are what the platform owes.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Commission reserve (INR)"><Money minor={overview.reserve.balanceMinor} currency="INR" /></Stat>
          {overview.liabilities.map((l) => (
            <Stat key={l.currency} label={`Liabilities (${l.currency})`} hint="Wallets, merchant payables, pools, escrow and pending withdrawals">
              <span className="text-sm">
                Wallets {formatMoney(l.wallets, l.currency)} · Merchants {formatMoney(l.merchantPayable, l.currency)} · Pools {formatMoney(l.pools, l.currency)} · Escrow {formatMoney(l.escrow, l.currency)} · Pending withdrawals {formatMoney(l.withdrawalPending, l.currency)}
              </span>
            </Stat>
          ))}
        </div>
      </Section>

      <Section title="Withdrawal reconciliation" subtitle="Requests awaiting a decision must match the money held in the pending account.">
        {overview.withdrawalChecks.length === 0 ? (
          <Notice>No pending withdrawal requests and no money held in pending accounts.</Notice>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[#a39a86]">
                <tr><th className="py-2">Currency</th><th>Requests</th><th>Requested</th><th>Held in ledger</th><th>Difference</th><th>Status</th></tr>
              </thead>
              <tbody>
                {overview.withdrawalChecks.map((c) => (
                  <tr key={c.currency} className="border-t border-[#2a2116]">
                    <td className="py-2">{c.currency}</td>
                    <td>{c.count}</td>
                    <td>{formatMoney(c.requestedMinor, c.currency)}</td>
                    <td>{formatMoney(c.ledgerPendingMinor, c.currency)}</td>
                    <td>{formatMoney(c.differenceMinor, c.currency)}</td>
                    <td>{c.ok ? 'Matched' : 'Mismatch: investigate before paying out'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Reports" subtitle="Choose a date range (inclusive). Export as CSV for Excel, or print-ready page to save as PDF.">
        <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">From<br />
            <input type="date" name="from" defaultValue={from} className="rounded-lg border border-[#2a2116] bg-[#0e0b06] px-3 py-2" />
          </label>
          <label className="text-sm">To<br />
            <input type="date" name="to" defaultValue={to} className="rounded-lg border border-[#2a2116] bg-[#0e0b06] px-3 py-2" />
          </label>
          <button className="btn btn-primary" type="submit">Apply</button>
        </form>
        {!range && <Notice tone="warn">Enter a valid range: both dates, with the end on or after the start.</Notice>}

        {range && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-semibold">Verified retail sales</h3>
              {sales.length === 0 ? <p className="text-sm text-[#a39a86]">No verified sales in this period.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[#a39a86]">
                    <tr><th className="py-2">Currency</th><th>Verified orders</th><th>Verified sales</th><th>PV (INR)</th><th>Cashback</th><th>Returns</th></tr>
                  </thead>
                  <tbody>
                    {sales.map((r) => (
                      <tr key={r.currency} className="border-t border-[#2a2116]">
                        <td className="py-2">{r.currency}</td>
                        <td>{r.verifiedOrders}</td>
                        <td>{formatMoney(r.verifiedSubtotalMinor, r.currency)}</td>
                        <td>{formatMoney(r.verifiedPvInrMinor, 'INR')}</td>
                        <td>{formatMoney(r.verifiedCashbackMinor, r.currency)}</td>
                        <td>{r.returnedOrders} ({formatMoney(r.returnedSubtotalMinor, r.currency)})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Commission postings</h3>
              {commissions.length === 0 ? <p className="text-sm text-[#a39a86]">No commission postings in this period.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[#a39a86]">
                    <tr><th className="py-2">Type</th><th>Status</th><th>Count</th><th>Amount (INR)</th></tr>
                  </thead>
                  <tbody>
                    {commissions.map((r) => (
                      <tr key={`${r.type}-${r.status}`} className="border-t border-[#2a2116]">
                        <td className="py-2">{r.type}</td>
                        <td>{r.status}</td>
                        <td>{r.count}</td>
                        <td><Money minor={r.amountMinor} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Withdrawal requests</h3>
              {withdrawals.length === 0 ? <p className="text-sm text-[#a39a86]">No withdrawal requests in this period.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-[#a39a86]">
                    <tr><th className="py-2">Currency</th><th>Status</th><th>Count</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((r) => (
                      <tr key={`${r.currency}-${r.status}`} className="border-t border-[#2a2116]">
                        <td className="py-2">{r.currency}</td>
                        <td>{r.status}</td>
                        <td>{r.count}</td>
                        <td>{formatMoney(r.amountMinor, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {(['sales', 'commissions', 'withdrawals'] as const).map((report) => (
                <span key={report} className="flex gap-2">
                  <a className="underline" href={exportLink(report, 'csv')}>{report} CSV</a>
                  <a className="underline" href={exportLink(report, 'pdf')} target="_blank" rel="noopener">{report} PDF</a>
                </span>
              ))}
              <span className="flex gap-2">
                <a className="underline" href={`/api/admin/finance/export?report=trial&from=${from}&to=${to}&format=csv`}>trial balance CSV</a>
                <a className="underline" href={`/api/admin/finance/export?report=trial&from=${from}&to=${to}&format=pdf`} target="_blank" rel="noopener">trial balance PDF</a>
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Trial balance by account" subtitle="Current balances, all time. Balance is shown on each account's normal side.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[#a39a86]">
              <tr><th className="py-2">Account</th><th>Currency</th><th>Debits</th><th>Credits</th><th>Balance</th></tr>
            </thead>
            <tbody>
              {overview.trial.rows.map((r) => (
                <tr key={r.key} className="border-t border-[#2a2116]">
                  <td className="py-1 font-mono">{r.key}</td>
                  <td>{r.currency}</td>
                  <td>{formatMoney(r.debitMinor, r.currency)}</td>
                  <td>{formatMoney(r.creditMinor, r.currency)}</td>
                  <td>{formatMoney(r.balanceMinor, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
