import { listComplaints } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { ComplaintControl } from '@/components/admin/actions';
import { formatDate } from '@/lib/format';
import { maskedName } from '@/lib/mask';

export const metadata = { title: 'Complaints' };

export default async function ComplaintsAdmin({ searchParams }: { searchParams: { status?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.COMPLAINT_MANAGE);
  const status = searchParams.status ?? 'OPEN';
  const rows = await listComplaints(status);

  return (
    <AdminFrame permissions={perms} active="/admin/complaints" name={user.fullName}>
      <PageTitle title="Complaints" description="Messages from users. Reply here and the user is notified in the app." />
      <div className="mb-5 flex flex-wrap gap-2">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ALL'].map((s) => (
          <a key={s} href={`/admin/complaints?status=${s}`} className={`chip ${status === s ? 'chip-active' : ''}`}>
            {s === 'ALL' ? 'All' : formatCell(s)}
          </a>
        ))}
      </div>
      <Table head={['From', 'Subject and message', 'Campaign', 'Status', 'Received', 'Reply']} empty="No complaints in this view.">
        {rows.map((c) => (
          <tr key={c.id} className="align-top hover:bg-white/[0.02]">
            <td className="px-5 py-4 text-ui-muted">{maskedName(c.user.fullName)}</td>
            <td className="max-w-md px-5 py-4">
              <p className="font-medium">{c.subject}</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ui-muted">{c.body}</p>
            </td>
            <td className="px-5 py-4 text-ui-muted">{c.campaign?.title ?? '—'}</td>
            <td className="px-5 py-4">
              <Badge tone={statusTone(c.status)}>{formatCell(c.status)}</Badge>
            </td>
            <td className="px-5 py-4 text-ui-muted">{formatDate(c.createdAt)}</td>
            <td className="w-72 px-5 py-4">
              <ComplaintControl complaintId={c.id} />
            </td>
          </tr>
        ))}
      </Table>
    </AdminFrame>
  );
}
