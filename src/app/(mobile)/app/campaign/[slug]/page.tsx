import { notFound } from 'next/navigation';
import { getPublicCampaign } from '@/lib/services/campaigns';
import { getCurrentUser } from '@/lib/auth/session';
import { CampaignDetail } from '@/components/browse/campaign-detail';
import { TopBar } from '@/components/mobile/shell';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getPublicCampaign(params.slug);
  return { title: c ? c.title : 'Campaign' };
}

export default async function CampaignPage({ params }: { params: { slug: string } }) {
  const [viewer, campaign] = await Promise.all([getCurrentUser(), getPublicCampaign(params.slug)]);
  if (!campaign) notFound();
  return (
    <main>
      <div className="absolute inset-x-0 top-0 z-30">
        <TopBar back="/app/explore" right={null} />
      </div>
      <CampaignDetail c={campaign} viewerSignedIn={!!viewer} />
    </main>
  );
}
