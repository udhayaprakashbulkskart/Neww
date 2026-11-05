import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getDonationForDonor } from '@/lib/services/donations';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';
import { PollDonation } from '@/components/mobile/forms/poll-donation';

export const metadata = { title: 'Payment not completed' };

export default async function DonationFailedPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/donate/failed/${params.id}`);
  let donation;
  try {
    donation = await getDonationForDonor(user.id, params.id);
  } catch {
    notFound();
  }
  if (donation.status === 'SUCCESS') redirect(`/app/donate/success/${donation.id}`);
  const failed = donation.status === 'FAILED';

  return (
    <main className="pb-10">
      <TopBar title="Payment" />
      <div className="flex flex-col items-center px-6 text-center">
        <div className={`mt-6 flex h-28 w-28 items-center justify-center rounded-full ${failed ? 'bg-ui-danger/10 text-ui-danger' : 'bg-white/5 text-ui-muted'} animate-rise`}>
          <Icon name={failed ? 'x' : 'clock'} className="h-14 w-14" strokeWidth={1.6} />
        </div>
        <h1 className="mt-7 text-[30px] font-extrabold tracking-tight">{failed ? 'Payment not completed' : 'Checking your payment'}</h1>
        <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-ui-muted">
          {failed
            ? donation.failureReason ?? 'The payment was not completed. No money has been taken for this donation.'
            : 'We are confirming the status with your payment provider.'}
        </p>
        {!failed && (
          <div className="mt-6 w-full">
            <PollDonation donationId={donation.id} targetPath="failed" />
          </div>
        )}
        <div className="mt-8 flex w-full flex-col gap-3">
          <Link href={`/app/donate/${donation.campaign.slug}`} className="btn-primary w-full">
            Try again
          </Link>
          <Link href="/app/help" className="btn-ghost w-full">
            Get help
          </Link>
        </div>
      </div>
    </main>
  );
}
