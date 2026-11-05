import Link from 'next/link';
import { adminOverview, campaignQueue } from '@/lib/services/admin';
import { monthlyDonations, adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, StatCard, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { AdminLogout } from '@/components/admin/actions';
import { formatINR, formatINRCompact } from '@/lib/format';

export const metadata = { title: 'Admin overview' };

export default async function AdminOverview() {
  const { user, perms } = await adminContext(PERMISSIONS.OVERVIEW_VIEW);
  const [stats, months, queue] = await Promise.all([adminOverview(), monthlyDonations(6), campaignQueue('PENDING', undefined, 1)]);
  const max = Math.max(1, ...months.map((m) => m.paise));

  return (
    <AdminFrame permissions={perms} active="/admin" name={user.fullName}>
      <PageTitle
        title="Overview"
        description="Platform health at a glance. Figures are live from the database."
        actions={<AdminLogout />}
      />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers.toLocaleString('en-IN')} />
        <StatCard label="Total campaigns" value={stats.totalCampaigns.toLocaleString('en-IN')} />
        <StatCard label="Verified campaigns" value={stats.verifiedCampaigns.toLocaleString('en-IN')} tone="mint" />
        <StatCard label="Pending applications" value={stats.pendingApplications} tone={stats.pendingApplications > 0 ? 'warn' : 'default'} />
        <StatCard label="Total donations" value={formatINRCompact(stats.totalDonationsPaise)} hint={`${stats.totalDonationCount} confirmed`} tone="mint" />
        <StatCard label="Successful payments" value={stats.successfulPayments.toLocaleString('en-IN')} />
        <StatCard label="Failed payments" value={stats.failedPayments.toLocaleString('en-IN')} tone={stats.failedPayments > 0 ? 'danger' : 'default'} />
        <StatCard label="Refunds" value={formatINRCompact(stats.refundsPaise)} hint={`${stats.refundCount} processed`} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="surface-flat p-6" aria-labelledby="trend-h">
          <div className="mb-6 flex items-center justify-between">
            <h2 id="trend-h" className="font-semibold">
              Donation trend
            </h2>
            <span className="text-xs text-ui-subtle">Last 6 months</span>
          </div>
          <div className="flex h-56 items-end gap-4" role="img" aria-label={`Monthly donations: ${months.map((m) => `${m.label} ${formatINR(m.paise)}`).join(', ')}`}>
            {months.map((m) => (
              <div key={m.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                <span className="text-center text-[11px] text-ui-subtle">{formatINRCompact(m.paise)}</span>
                <div className="w-full rounded-t-xl bg-gradient-to-t from-emerald/40 to-mint" style={{ height: `${Math.max(4, (m.paise / max) * 100)}%` }} />
                <span className="text-center text-xs text-ui-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-flat p-6" aria-labelledby="ops-h">
          <h2 id="ops-h" className="mb-5 font-semibold">
            Needs attention
          </h2>
          <ul className="space-y-4 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-ui-muted">Open fraud reports</span>
              <span className={`font-bold ${stats.openFraudReports ? 'text-ui-warning' : ''}`}>{stats.openFraudReports}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ui-muted">Open complaints</span>
              <span className="font-bold">{stats.openComplaints}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ui-muted">Pending applications</span>
              <span className="font-bold">{stats.pendingApplications}</span>
            </li>
          </ul>
          <Link href="/admin/campaigns" className="mt-6 inline-block text-sm font-semibold text-mint">
            Open campaign queue →
          </Link>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="queue-h">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="queue-h" className="font-semibold">
            Newest submissions
          </h2>
          <Link href="/admin/campaigns?status=PENDING" className="text-sm font-semibold text-mint">
            View all
          </Link>
        </div>
        <Table head={['Campaign', 'Beneficiary', 'Requested', 'Submitted', 'Status']} empty="No campaigns waiting for review.">
          {queue.items.slice(0, 6).map((c) => (
            <tr key={c.id} className="hover:bg-white/[0.02]">
              <td className="px-5 py-3.5">
                <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-mint">
                  {c.title}
                </Link>
              </td>
              <td className="px-5 py-3.5 text-ui-muted">{c.beneficiary.fullName}</td>
              <td className="px-5 py-3.5">{formatINR(c.requestedPaise)}</td>
              <td className="px-5 py-3.5 text-ui-muted">{c.submittedAt ? c.submittedAt.toLocaleDateString('en-IN') : '—'}</td>
              <td className="px-5 py-3.5">
                <Badge tone={statusTone(c.status)}>{formatCell(c.status)}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </AdminFrame>
  );
}
