import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicCampaign } from '@/lib/services/campaigns';
import { getCurrentUser } from '@/lib/auth/session';
import { CampaignDetail } from '@/components/browse/campaign-detail';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const c = await getPublicCampaign(params.slug);
  return { title: c ? c.title : 'Campaign' };
}

export default async function WebCampaignPage({ params }: { params: { slug: string } }) {
  const [viewer, c] = await Promise.all([getCurrentUser(), getPublicCampaign(params.slug)]);
  if (!c) notFound();
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <Link href="/explore" className="text-sm font-semibold text-mint">
        ← All campaigns
      </Link>
      <div className="mt-6">
        <CampaignDetail c={c} mobile={false} viewerSignedIn={!!viewer} />
      </div>
    </main>
  );
}
