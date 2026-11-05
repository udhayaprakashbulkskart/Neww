import Link from 'next/link';
import { listPaymentsAdmin } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS } from '@/lib/rbac';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { formatDateTime, formatINR } from '@/lib/format';

export const metadata = { title: 'Payments' };

const FILTERS = ['ALL', 'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'];

export default async function PaymentsAdmin({ searchParams }: { searchParams: { status?: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.PAYMENT_VIEW);
  const status = FILTERS.includes(searchParams.status ?? '') ? searchParams.status! : 'ALL';
  const rows = await listPaymentsAdmin(status);

  return (
    <AdminFrame permissions={perms} active="/admin/payments" name={user.fullName}>
      <PageTitle title="Payments" description="Gateway payment records. Status moves only on verified provider webhooks, never on browser responses." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/payments?status=${f}`} role="tab" aria-selected={status === f} className={`chip ${status === f ? 'chip-active' : ''}`}>
            {f === 'ALL' ? 'All' : formatCell(f)}
          </Link>
        ))}
      </div>
      <Table head={['Provider', 'Order', 'Payment ID', 'Amount', 'Method', 'Status', 'Updated']} empty="No payments in this view.">
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.02]">
            <td className="px-5 py-3.5 text-ui-muted">{p.provider.toLowerCase()}</td>
            <td className="px-5 py-3.5 font-mono text-xs">{p.providerOrderId ?? '—'}</td>
            <td className="px-5 py-3.5 font-mono text-xs">{p.providerPaymentId ?? '—'}</td>
            <td className="px-5 py-3.5 font-semibold">{formatINR(p.amountPaise)}</td>
            <td className="px-5 py-3.5 text-ui-muted">{p.method ?? '—'}</td>
            <td className="px-5 py-3.5">
              <Badge tone={statusTone(p.status)}>{formatCell(p.status)}</Badge>
              {p.errorCode && <p className="mt-1 text-xs text-ui-subtle">{p.errorCode}</p>}
            </td>
            <td className="px-5 py-3.5 text-ui-muted">{formatDateTime(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
    </AdminFrame>
  );
}
