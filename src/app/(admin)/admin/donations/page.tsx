import { listDonationsAdmin } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { formatDateTime, formatINR } from '@/lib/format';
import { maskedName } from '@/lib/mask';

export const metadata = { title: 'Donations' };

export default async function DonationsAdmin({ searchParams }: { searchParams: { page?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.DONATION_VIEW);
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const rows = await listDonationsAdmin(page);

  return (
    <AdminFrame permissions={perms} active="/admin/donations" name={user.fullName}>
      <PageTitle title="Donations" description="Every donation and its confirmation state. Donor names are masked here unless the donor chose to be shown." />
      <Table head={['Receipt', 'Campaign', 'Donor', 'Amount', 'Payment', 'Status', 'Date']} empty="No donations yet.">
        {rows.map((d) => (
          <tr key={d.id} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3.5 font-mono text-xs">{d.receiptNumber ?? '—'}</td>
            <td className="px-5 py-3.5">{d.campaign.title}</td>
            <td className="px-5 py-3.5 text-ui-muted">{d.isAnonymous ? 'Anonymous' : maskedName(d.donor.fullName)}</td>
            <td className="px-5 py-3.5 font-semibold">{formatINR(d.amountPaise)}</td>
            <td className="px-5 py-3.5 text-ui-muted">{formatCell(d.payment?.status ?? null)}</td>
            <td className="px-5 py-3.5">
              <Badge tone={statusTone(d.status)}>{formatCell(d.status)}</Badge>
            </td>
            <td className="px-5 py-3.5 text-ui-muted">{formatDateTime(d.paidAt ?? d.createdAt)}</td>
          </tr>
        ))}
      </Table>
      <nav className="mt-5 flex justify-between text-sm text-ui-muted" aria-label="Pagination">
        {page > 1 ? <a href={`/admin/donations?page=${page - 1}`} className="font-semibold text-mint">← Previous</a> : <span />}
        {rows.length === 25 ? <a href={`/admin/donations?page=${page + 1}`} className="font-semibold text-mint">Next →</a> : <span />}
      </nav>
    </AdminFrame>
  );
}
