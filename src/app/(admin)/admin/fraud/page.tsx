import Link from 'next/link';
import { listFraud } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { FraudControl } from '@/components/admin/actions';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Fraud reports' };

export default async function FraudAdmin({ searchParams }: { searchParams: { status?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.FRAUD_MANAGE);
  const status = searchParams.status ?? 'OPEN';
  const rows = await listFraud(status);

  return (
    <AdminFrame permissions={perms} active="/admin/fraud" name={user.fullName}>
      <PageTitle
        title="Fraud reports"
        description="Flags from automated rules and from users. A flag is a reason to look, not a finding. Nobody is suspended from this screen."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {['OPEN', 'UNDER_INVESTIGATION', 'CONFIRMED', 'DISMISSED', 'ALL'].map((s) => (
          <a key={s} href={`/admin/fraud?status=${s}`} className={`chip ${status === s ? 'chip-active' : ''}`}>
            {s === 'ALL' ? 'All' : formatCell(s)}
          </a>
        ))}
      </div>
      <Table head={['Rule', 'Severity', 'Subject', 'Reason', 'Evidence (hashes and counts)', 'Raised', 'Decision']} empty="No reports in this view.">
        {rows.map((f) => (
          <tr key={f.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4">
              <p className="font-medium">{formatCell(f.ruleCode)}</p>
              <p className="text-xs text-ui-subtle">{formatCell(f.source)}</p>
            </td>
            <td className="px-5 py-4">
              <Badge tone={statusTone(f.severity)}>{formatCell(f.severity)}</Badge>
            </td>
            <td className="px-5 py-4">
              {f.campaign ? (
                <Link href={`/admin/campaigns/${f.campaign.id}`} className="hover:text-mint">
                  {f.campaign.title}
                </Link>
              ) : (
                <span className="text-ui-subtle">User-level</span>
              )}
            </td>
            <td className="max-w-xs px-5 py-4 text-ui-muted">{f.reason}</td>
            <td className="max-w-[220px] px-5 py-4 font-mono text-[11px] text-ui-subtle">{JSON.stringify(f.evidence)}</td>
            <td className="px-5 py-4 text-ui-muted">{formatDateTime(f.createdAt)}</td>
            <td className="w-80 px-5 py-4">
              <FraudControl reportId={f.id} />
            </td>
          </tr>
        ))}
      </Table>
    </AdminFrame>
  );
}
