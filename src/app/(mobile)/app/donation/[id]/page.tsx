import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getDonationForDonor, REFUND_WINDOW_DAYS } from '@/lib/services/donations';
import { formatDateTime, formatINR } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { StatusPill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { RefundForm } from '@/components/mobile/forms/refund-form';

export const metadata = { title: 'Donation details' };

const TONE = { SUCCESS: 'mint', PENDING: 'amber', FAILED: 'red', REFUNDED: 'grey' } as const;

export default async function DonationDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/donation/${params.id}`);
  let d;
  try {
    d = await getDonationForDonor(user.id, params.id);
  } catch {
    notFound();
  }
  return (
    <main className="pb-10">
      <TopBar back="/app/history" title="Donation details" />
      <div className="space-y-5 px-5">
        <div className="surface p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-ui-subtle">Amount</p>
          <p className="mt-1 text-[34px] font-extrabold text-mint">{formatINR(d.amountPaise, { decimals: true })}</p>
          <div className="mt-3 flex justify-center">
            <StatusPill tone={TONE[d.status as keyof typeof TONE] ?? 'grey'}>{d.status.toLowerCase()}</StatusPill>
          </div>
        </div>

        <dl className="surface-flat divide-y divide-white/[0.06] p-5 text-sm">
          <Row label="Campaign" value={d.campaign.title} />
          <Row label="Donated on" value={formatDateTime(d.createdAt)} />
          <Row label="Paid on" value={d.paidAt ? formatDateTime(d.paidAt) : '—'} />
          <Row label="Receipt" value={d.receiptNumber ?? '—'} />
          <Row label="Payment reference" value={d.transactionRef ?? '—'} />
          <Row label="Visibility" value={d.isAnonymous ? 'Anonymous' : 'Shown by first name'} />
        </dl>

        {d.status === 'SUCCESS' && (
          <a href={`/api/donations/${d.id}/receipt`} target="_blank" rel="noopener" className="btn-ghost w-full">
            <Icon name="receipt" className="h-5 w-5" />
            Download receipt
          </a>
        )}

        <section aria-labelledby="refund-h" className="surface-flat p-5">
          <h2 id="refund-h" className="mb-2 flex items-center gap-2 text-[16px] font-semibold">
            <Icon name="refund" className="h-5 w-5 text-mint" />
            Refunds
          </h2>
          {d.refund ? (
            <p className="text-sm text-ui-muted">
              Refund request: <span className="font-semibold text-ui-text">{d.refund.status.toLowerCase().replace('_', ' ')}</span> for {formatINR(d.refund.amountPaise, { decimals: true })}.
            </p>
          ) : d.refundEligible ? (
            <>
              <p className="mb-4 text-sm leading-relaxed text-ui-muted">
                You can request a full refund within {REFUND_WINDOW_DAYS} days of payment. Refunds are reviewed by our finance team.
              </p>
              <RefundForm donationId={d.id} />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-ui-muted">
              Refunds can be requested within {REFUND_WINDOW_DAYS} days of a successful payment. For anything else, contact support.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ui-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}
