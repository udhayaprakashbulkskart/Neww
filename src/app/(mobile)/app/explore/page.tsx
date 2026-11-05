import { CampaignBrowser, type BrowseParams } from '@/components/browse/campaign-browser';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'Explore campaigns' };

export default async function ExplorePage({ searchParams }: { searchParams: BrowseParams }) {
  return (
    <main className="pb-36">
      <TopBar
        title="Explore campaigns"
        right={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850 text-ui-muted" aria-hidden="true">
            <Icon name="grid" className="h-5 w-5" />
          </span>
        }
      />
      <div className="px-5">
        <CampaignBrowser basePath="/app/explore" params={searchParams} />
      </div>
    </main>
  );
}
