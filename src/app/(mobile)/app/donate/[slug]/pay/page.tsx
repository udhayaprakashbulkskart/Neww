import { notFound, redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getDonationForDonor } from '@/lib/services/donations';
import { TopBar } from '@/components/mobile/shell';
import { PayPanel } from '@/components/mobile/forms/pay-panel';

export const metadata = { title: 'Payment' };

export default async function PayPage({ params, searchParams }: { params: { slug: string }; searchParams: { d?: string } }) {
  const user = await requirePageUser(`/app/donate/${params.slug}`);
  if (!searchParams.d) notFound();
  const donation = await getDonationForDonor(user.id, searchParams.d);
  if (donation.status === 'SUCCESS') redirect(`/app/donate/success/${donation.id}`);
  if (donation.status === 'FAILED') redirect(`/app/donate/failed/${donation.id}`);

  return (
    <main className="pb-10">
      <TopBar back={`/app/donate/${params.slug}`} title="Payment" />
      <div className="px-5">
        <PayPanel donationId={donation.id} campaignSlug={params.slug} />
      </div>
    </main>
  );
}
