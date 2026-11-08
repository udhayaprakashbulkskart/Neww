import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { dateRange } from '@/lib/domain/finance';
import { BUCKET_LABELS, type TrackingBucket } from '@/lib/domain/order-tracking';
import { formatMoney } from '@/lib/domain/money';
import { orderTracker } from '@/lib/server/order-tracker';
import { MAX_ROWS } from '@/lib/server/audit-view';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export default async function OrderTrackingPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user.role as StaffRole, 'finance:read')) redirect('/dashboard');

  const from = searchParams.from || daysAgo(30);
  const to = searchParams.to || daysAgo(0);
  const range = dateRange(from, to);
  const report = range ? await orderTracker(range, new Date()) : null;
  const exportUrl = (format: 'csv' | 'pdf', name: 'orders' | 'refunds') =>
    `/api/admin/finance/export?report=${name}&format=${format}&from=${from}&to=${to}`;

  const buckets = Object.keys(BUCKET_LABELS) as TrackingBucket[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Order tracking</h1>
          <p className="text-sm text-[#a39a86]">Delivered orders, return windows, refunds, cancellations and commission eligibility. Orders are grouped by the day they were placed.</p>
        </div>
        <Link href="/admin/finance" className="text-sm underline">Back to finance</Link>
      </div>

      <form method="get" className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">From<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border border-[#2a2116] bg-[#0e0b06] px-3 py-2" /></label>
        <label className="text-sm">To<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border border-[#2a2116] bg-[#0e0b06] px-3 py-2" /></label>
        <button className="btn btn-primary" type="submit">Apply</button>
      </form>

      {!range && <Notice tone="warn">Enter a valid range: both dates, with the end on or after the start.</Notice>}

      {report && (
        <>
          <Section title="Status summary" subtitle="How many orders in this period sit in each bucket.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {buckets.map((b) => (
                <div key={b} className="rounded-lg border border-[#2a2116] p-3">
                  <div className="text-xs text-[#a39a86]">{BUCKET_LABELS[b]}</div>
                  <div className="mt-1 text-2xl font-extrabold">{report.counts[b] ?? 0}</div>
                </div>
              ))}
            </div>
            {report.byCurrency.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {report.byCurrency.map((c) => (
                  <li key={c.currency}>
                    {c.currency}: {c.orders} orders, sales {formatMoney(c.subtotalMinor, c.currency)}, returned {formatMoney(c.refundsMinor, c.currency)}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Orders"
            subtitle={`Newest first, up to ${MAX_ROWS} orders.${report.truncated ? ' More exist in this period: narrow the range or use export, which has the same cap.' : ''}`}
            action={
              <span className="flex flex-wrap gap-3 text-sm">
                <a className="underline" href={exportUrl('csv', 'orders')}>Orders CSV</a>
                <a className="underline" target="_blank" rel="noopener" href={exportUrl('pdf', 'orders')}>Orders PDF</a>
                <a className="underline" href={exportUrl('csv', 'refunds')}>Refunds CSV</a>
                <a className="underline" target="_blank" rel="noopener" href={exportUrl('pdf', 'refunds')}>Refunds PDF</a>
              </span>
            }
          >
            {report.rows.length === 0 ? <p className="text-sm text-[#a39a86]">No orders were placed in this period.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-[#a39a86]">
                    <tr><th className="py-2">Placed</th><th>Merchant</th><th>Buyer</th><th>Bucket</th><th>Sales</th><th>PV</th><th>Window ends</th><th>Commission</th></tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.id} className="border-t border-[#2a2116] align-top">
                        <td className="py-1 whitespace-nowrap">{r.createdAt.toISOString().slice(0, 10)}</td>
                        <td>{r.merchant}</td>
                        <td className="break-all">{r.buyer}</td>
                        <td>{r.bucketLabel}{r.commissionBlocked ? <div className="text-orange-300">{r.commissionBlocked}</div> : null}</td>
                        <td>{formatMoney(r.subtotalMinor, r.currency)}</td>
                        <td>{formatMoney(r.pvInrMinor, 'INR')}</td>
                        <td>{r.returnWindowEndsAt ? r.returnWindowEndsAt.toISOString().slice(0, 10) : '-'}</td>
                        <td>
                          {r.commissionEligible ? 'Eligible' : r.commissionPostedMinor > 0n || r.commissionReversedMinor > 0n ? 'Not eligible' : '-'}
                          {r.commissionReversedMinor > 0n && <div className="text-[#a39a86]">reversed {formatMoney(r.commissionReversedMinor, 'INR')}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
