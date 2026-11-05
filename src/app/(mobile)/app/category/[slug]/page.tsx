import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { CampaignBrowser, type BrowseParams } from '@/components/browse/campaign-browser';
import { TopBar } from '@/components/mobile/shell';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const cat = await db.campaignCategory.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: cat?.name ?? 'Category' };
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: BrowseParams }) {
  const cat = await db.campaignCategory.findUnique({ where: { slug: params.slug }, select: { name: true, slug: true, active: true } });
  if (!cat || !cat.active) notFound();
  return (
    <main className="pb-36">
      <TopBar back="/app/explore" title={cat.name} subtitle="Verified campaigns in this category" />
      <div className="px-5">
        <CampaignBrowser basePath={`/app/category/${cat.slug}`} params={searchParams} fixedCategory={cat.slug} heading={`${cat.name} campaigns`} />
      </div>
    </main>
  );
}
