import { listRefundsAdmin } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { RefundDecision } from '@/components/admin/actions';
import { formatDate, formatINR } from '@/lib/format';

export const metadata = { title: 'Refunds' };

export default async function RefundsAdmin({ searchParams }: { searchParams: { status?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.REFUND_PROCESS);
  const status = searchParams.status ?? 'REQUESTED';
  const rows = await listRefundsAdmin(status);

  return (
    <AdminFrame permissions={perms} active="/admin/refunds" name={user.fullName}>
      <PageTitle title="Refunds" description="Requests are decided by finance. Approval sends the refund through the payment provider. Each decision is audited." />
      <div className="mb-5 flex flex-wrap gap-2">
        {['REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED', 'FAILED', 'ALL'].map((s) => (
          <a key={s} href={`/admin/refunds?status=${s}`} className={`chip ${status === s ? 'chip-active' : ''}`}>
            {s === 'ALL' ? 'All' : formatCell(s)}
          </a>
        ))}
      </div>
      <Table head={['Campaign', 'Requested by', 'Amount', 'Reason', 'Status', 'Decision']} empty="No refunds in this view.">
        {rows.map((r) => (
          <tr key={r.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4">{r.donation.campaign.title}</td>
            <td className="px-5 py-4 text-ui-muted">
              {r.requester.fullName}
              <p className="text-xs text-ui-subtle">{formatDate(r.createdAt)}</p>
            </td>
            <td className="px-5 py-4 font-semibold">{formatINR(r.amountPaise)}</td>
            <td className="max-w-xs px-5 py-4 text-ui-muted">{r.reason}</td>
            <td className="px-5 py-4">
              <Badge tone={statusTone(r.status)}>{formatCell(r.status)}</Badge>
              {r.decisionNote && <p className="mt-1 text-xs text-ui-subtle">{r.decisionNote}</p>}
            </td>
            <td className="w-80 px-5 py-4">{r.status === 'REQUESTED' ? <RefundDecision refundId={r.id} /> : <span className="text-xs text-ui-subtle">Decided</span>}</td>
          </tr>
        ))}
      </Table>
    </AdminFrame>
  );
}
