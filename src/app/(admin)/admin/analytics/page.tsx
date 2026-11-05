import { adminOverview } from '@/lib/services/admin';
import { adminContext, donationsByCategory, monthlyDonations } from '@/lib/services/admin-pages';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { AdminFrame, PageTitle, StatCard, Table } from '@/components/admin/shell';
import { formatINR, formatINRCompact } from '@/lib/format';
import Link from 'next/link';

export const metadata = { title: 'Analytics' };

const EXPORTS = [
  { type: 'donations', label: 'Donations' },
  { type: 'campaigns', label: 'Campaigns' },
  { type: 'payments', label: 'Payments' },
  { type: 'refunds', label: 'Refunds' },
  { type: 'audit', label: 'Audit log' },
];

export default async function AnalyticsPage() {
  const { user, perms } = await adminContext(PERMISSIONS.OVERVIEW_VIEW);
  const [overview, byCategory, months, statusCounts, canExport] = await Promise.all([
    adminOverview(),
    donationsByCategory(),
    monthlyDonations(12),
    db.campaign.groupBy({ by: ['status'], _count: true }),
    hasPermission(user.id, PERMISSIONS.REPORT_EXPORT),
  ]);
  const totalCat = Math.max(1, ...byCategory.map((c) => c.paise));
  const monthMax = Math.max(1, ...months.map((m) => m.paise));

  return (
    <AdminFrame permissions={perms} active="/admin/analytics" name={user.fullName}>
      <PageTitle title="Analytics" description="Live figures from the platform database. Exports are logged in the audit trail." />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Raised (confirmed)" value={formatINRCompact(overview.totalDonationsPaise)} tone="mint" hint={`${overview.totalDonationCount} donations`} />
        <StatCard label="Refunded" value={formatINRCompact(overview.refundsPaise)} hint={`${overview.refundCount} refunds`} />
        <StatCard label="Successful payments" value={overview.successfulPayments} />
        <StatCard label="Failed payments" value={overview.failedPayments} tone={overview.failedPayments ? 'danger' : 'default'} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="surface-flat p-6" aria-labelledby="cat-h">
          <h2 id="cat-h" className="mb-5 font-semibold">
            Donations by category
          </h2>
          <ul className="space-y-4">
            {byCategory.map((c) => (
              <li key={c.name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-ui-muted">{c.name}</span>
                  <span className="font-semibold">
                    {formatINR(c.paise)} <span className="font-normal text-ui-subtle">· {c.count}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className="h-2 rounded-full bg-gradient-to-r from-emerald to-mint" style={{ width: `${(c.paise / totalCat) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-flat p-6" aria-labelledby="m-h">
          <h2 id="m-h" className="mb-5 font-semibold">
            Monthly donations (12 months)
          </h2>
          <div className="flex h-48 items-end gap-2" role="img" aria-label="Monthly donation totals">
            {months.map((m, i) => (
              <div key={`${m.label}-${i}`} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                <div className="w-full rounded-t-lg bg-mint/70" style={{ height: `${Math.max(3, (m.paise / monthMax) * 100)}%` }} />
                <span className="text-center text-[10px] text-ui-subtle">{m.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="st-h">
        <h2 id="st-h" className="mb-4 font-semibold">
          Campaigns by status
        </h2>
        <Table head={['Status', 'Campaigns']} empty="No campaigns yet.">
          {statusCounts.map((s) => (
            <tr key={s.status}>
              <td className="px-5 py-3.5">{s.status.toLowerCase().replace(/_/g, ' ')}</td>
              <td className="px-5 py-3.5 font-semibold">{s._count}</td>
            </tr>
          ))}
        </Table>
      </section>

      {canExport && (
        <section className="surface-flat mt-8 p-6" aria-labelledby="exp-h">
          <h2 id="exp-h" className="mb-2 font-semibold">
            Export reports
          </h2>
          <p className="mb-5 text-sm text-ui-muted">CSV files contain no card data and no full bank numbers. Each export is recorded in the audit log.</p>
          <div className="flex flex-wrap gap-3">
            {EXPORTS.map((e) => (
              <Link key={e.type} href={`/api/admin/export?type=${e.type}`} className="btn-ghost btn-sm" prefetch={false}>
                {e.label} (CSV)
              </Link>
            ))}
          </div>
        </section>
      )}
    </AdminFrame>
  );
}
