import Link from 'next/link';
import { campaignQueue } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { formatINR, formatDate } from '@/lib/format';

export const metadata = { title: 'Campaigns' };

const TABS = ['ALL', 'PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'CLOSED'];

export default async function CampaignsAdmin({ searchParams }: { searchParams: { status?: string; q?: string; page?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.CAMPAIGN_VIEW);
  const status = TABS.includes(searchParams.status ?? '') ? searchParams.status! : 'ALL';
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const data = await campaignQueue(status, searchParams.q, page);

  return (
    <AdminFrame permissions={perms} active="/admin/campaigns" name={user.fullName}>
      <PageTitle title="Campaigns" description="Review submissions, request information, approve and publish. Every action is audited." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/campaigns?status=${t}`}
            role="tab"
            aria-selected={status === t}
            className={`chip ${status === t ? 'chip-active' : ''}`}
          >
            {t === 'ALL' ? 'All' : formatCell(t)}
          </Link>
        ))}
      </div>
      <Table head={['Campaign', 'Beneficiary', 'Requested', 'Funded', 'Flags', 'Updated', 'Status']} empty="No campaigns in this view.">
        {data.items.map((c) => (
          <tr key={c.id} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3.5">
              <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-mint">
                {c.title}
              </Link>
              <p className="text-xs text-ui-subtle">
                {c.category.name} · {c.city || '—'} · {c._count.documents} docs
              </p>
            </td>
            <td className="px-5 py-3.5 text-ui-muted">{c.beneficiary.fullName}</td>
            <td className="px-5 py-3.5">{formatINR(c.requestedPaise)}</td>
            <td className="px-5 py-3.5">{c.fundingPercent}%</td>
            <td className="px-5 py-3.5">{c._count.fraudReports ? <Badge tone="amber">{c._count.fraudReports}</Badge> : <span className="text-ui-subtle">—</span>}</td>
            <td className="px-5 py-3.5 text-ui-muted">{formatDate(c.updatedAt)}</td>
            <td className="px-5 py-3.5">
              <Badge tone={statusTone(c.status)}>{formatCell(c.status)}</Badge>
            </td>
          </tr>
        ))}
      </Table>
      <p className="mt-4 text-xs text-ui-subtle">{data.total} campaigns</p>
    </AdminFrame>
  );
}
