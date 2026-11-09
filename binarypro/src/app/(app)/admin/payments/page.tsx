import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { can, type StaffRole } from '@/lib/domain/rbac';
import { formatMoney } from '@/lib/domain/money';
import { pendingMembershipPayments } from '@/lib/server/payments-offline';
import { OfflinePaymentForm } from '@/components/admin/offline-payment-form';
import { Section, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PendingPaymentsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user.role as StaffRole, 'payments:confirm')) redirect('/dashboard');
  const rows = await pendingMembershipPayments();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pending membership payments</h1>
          <p className="text-sm text-[#a39a86]">Confirm a membership only after the bank transfer has arrived in the company account. Enter the bank reference and the exact amount received.</p>
        </div>
        <Link href="/admin" className="text-sm underline">Back to admin</Link>
      </div>
      <Section title={`Waiting for confirmation (${rows.length})`} subtitle="Oldest first. Each bank reference confirms one payment only.">
        {rows.length === 0 ? <Notice>No membership payments are waiting.</Notice> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-[#a39a86]">
                <tr><th className="py-2">Created</th><th>Member</th><th>Plan</th><th>Amount due</th><th>Confirm</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 align-top">
                    <td className="py-2 whitespace-nowrap">{r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                    <td><div className="font-semibold">{r.user.name}</div><div className="break-all text-xs text-[#8f8672]">{r.user.email ?? '-'} · {r.user.phone ?? '-'}</div></td>
                    <td>{r.referenceId}</td>
                    <td>{formatMoney(r.amountMinor, r.currency as 'INR')}</td>
                    <td><OfflinePaymentForm paymentId={r.id} amountRupees={(Number(r.amountMinor) / 100).toFixed(2)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
