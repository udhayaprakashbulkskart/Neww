import { notFound, redirect } from 'next/navigation';
import { getPublicCampaign } from '@/lib/services/campaigns';
import { requirePageUser } from '@/lib/auth/session';
import { formatINR, publicName } from '@/lib/format';
import { ProgressBar, VerifiedBadge, CampaignImage } from '@/components/ui/primitives';
import { TopBar } from '@/components/mobile/shell';
import { DonateForm } from '@/components/mobile/forms/donate-form';

export const metadata = { title: 'Make a donation' };

export default async function DonatePage({ params }: { params: { slug: string } }) {
  await requirePageUser(`/app/donate/${params.slug}`);
  const c = await getPublicCampaign(params.slug);
  if (!c) notFound();
  if (c.status !== 'PUBLISHED') redirect(`/app/campaign/${c.slug}`);
  const remaining = c.requestedPaise - c.raisedPaise;
  const firstName = c.beneficiaryName.split(' ')[0];

  return (
    <main className="pb-10">
      <TopBar back={`/app/campaign/${c.slug}`} title="Make a donation" />
      <div className="space-y-7 px-5">
        <div className="surface flex gap-4 p-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
            <CampaignImage src={c.imageUrl} name={c.beneficiaryName} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1 py-1">
            <VerifiedBadge />
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug">{c.title}</p>
            <p className="mt-1 text-xs text-ui-muted">
              {publicName(c.beneficiaryName)} · {formatINR(remaining)} still needed
            </p>
          </div>
        </div>
        <div>
          <ProgressBar value={c.fundingPercent} />
          <p className="mt-2 text-xs text-ui-muted">
            {formatINR(c.raisedPaise)} raised of {formatINR(c.requestedPaise)}
          </p>
        </div>
        <DonateForm campaignId={c.id} slug={c.slug} title={c.title} remainingPaise={remaining} beneficiaryFirstName={firstName} />
      </div>
    </main>
  );
}
