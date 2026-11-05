import { CampaignBrowser, type BrowseParams } from '@/components/browse/campaign-browser';

export const metadata = { title: 'Explore campaigns', description: 'Browse verified campaigns by category, city, funding status and urgency.' };

export default async function WebExplorePage({ searchParams }: { searchParams: BrowseParams }) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 lg:px-8">
      <p className="eyebrow">Explore</p>
      <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-tight">Verified campaigns</h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ui-muted">Only campaigns that have passed verification are listed here.</p>
      <div className="mt-10 max-w-3xl">
        <CampaignBrowser basePath="/explore" params={searchParams} />
      </div>
    </main>
  );
}
