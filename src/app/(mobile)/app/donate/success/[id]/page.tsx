import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getDonationForDonor } from '@/lib/services/donations';
import { formatDate, formatINR } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';
import { PollDonation } from '@/components/mobile/forms/poll-donation';

export const metadata = { title: 'Donation received' };

export default async function DonationSuccessPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/donate/success/${params.id}`);
  let donation;
  try {
    donation = await getDonationForDonor(user.id, params.id);
  } catch {
    notFound();
  }
  if (donation.status === 'FAILED') redirect(`/app/donate/failed/${donation.id}`);
  const confirmed = donation.status === 'SUCCESS';

  return (
    <main className="pb-10">
      <TopBar title={confirmed ? 'Thank you' : 'Confirming'} />
      <div className="flex flex-col items-center px-6 text-center">
        <div className={`mt-6 flex h-28 w-28 items-center justify-center rounded-full ${confirmed ? 'bg-mint/15 text-mint' : 'bg-white/5 text-ui-muted'} animate-rise`}>
          <Icon name={confirmed ? 'checkCircle' : 'clock'} className="h-14 w-14" strokeWidth={1.6} />
        </div>
        <h1 className="mt-7 text-[30px] font-extrabold tracking-tight">{confirmed ? 'Donation received' : 'Almost there'}</h1>
        <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-ui-muted">
          {confirmed
            ? `Your ${formatINR(donation.amountPaise)} donation to "${donation.campaign.title}" is confirmed.`
            : 'We are waiting for the payment provider to confirm your donation. This usually takes a few seconds.'}
        </p>

        {!confirmed && (
          <div className="mt-6 w-full">
            <PollDonation donationId={donation.id} targetPath="success" />
          </div>
        )}

        {confirmed && (
          <dl className="surface mt-8 w-full divide-y divide-white/[0.06] p-5 text-left text-sm">
            <Row label="Receipt" value={donation.receiptNumber ?? '—'} />
            <Row label="Paid on" value={formatDate(donation.paidAt)} />
            <Row label="Amount" value={formatINR(donation.amountPaise, { decimals: true })} />
            <Row label="Payment reference" value={donation.transactionRef ?? '—'} />
          </dl>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {confirmed && (
            <a href={`/api/donations/${donation.id}/receipt`} target="_blank" rel="noopener" className="btn-primary w-full">
              <Icon name="receipt" className="h-5 w-5" />
              Download receipt
            </a>
          )}
          <Link href={`/app/donation/${donation.id}`} className="btn-ghost w-full">
            View donation details
          </Link>
          <Link href={`/app/campaign/${donation.campaign.slug}`} className="btn-dark w-full">
            Back to campaign
          </Link>
        </div>
        <p className="mt-6 text-xs leading-relaxed text-ui-subtle">
          This receipt confirms your payment. HelpTrust does not provide tax deductions for donations.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ui-muted">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
