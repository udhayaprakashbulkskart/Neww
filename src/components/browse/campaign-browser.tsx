import Link from 'next/link';
import { searchCampaigns } from '@/lib/services/campaigns';
import { db } from '@/lib/db';
import { CampaignRow } from '@/components/mobile/campaign-card';
import { EmptyState } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

export type BrowseParams = { q?: string; category?: string; city?: string; funding?: string; sort?: string; page?: string };

const SORTS: { key: string; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'urgent', label: 'Most urgent' },
  { key: 'supported', label: 'Most supported' },
  { key: 'nearly', label: 'Nearly complete' },
];

const FUNDING: { key: string; label: string }[] = [
  { key: 'all', label: 'Any progress' },
  { key: 'open', label: 'Under 75%' },
  { key: 'nearly', label: '75% to 99%' },
  { key: 'funded', label: 'Fully funded' },
];

/** Build a link that keeps the current filters and changes only the given keys. */
export function buildHref(base: string, current: BrowseParams, changes: Partial<BrowseParams>): string {
  const merged: Record<string, string | undefined> = { ...current, ...changes };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== 'all' && v !== '') qs.set(k, v);
  }
  if (changes.page === undefined && !('page' in changes)) qs.delete('page');
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * Server-rendered discovery list. Works without JavaScript: filters are plain links and the search
 * is a GET form. Used by the app's Explore and Category screens and by the website's Explore page.
 */
export async function CampaignBrowser({
  basePath,
  params,
  fixedCategory,
  heading,
}: {
  basePath: string;
  params: BrowseParams;
  fixedCategory?: string;
  heading?: string;
}) {
  const categoryFilter = fixedCategory ?? params.category;
  const [result, categories] = await Promise.all([
    searchCampaigns({ ...params, category: categoryFilter, page: params.page ?? '1', pageSize: '12' }),
    db.campaignCategory.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { slug: true, name: true } }),
  ]);
  const current: BrowseParams = { q: params.q, category: categoryFilter, city: params.city, funding: params.funding, sort: params.sort };
  const sort = params.sort ?? 'latest';
  const funding = params.funding ?? 'all';

  return (
    <div className="space-y-6">
      <form action={basePath} method="get" role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Search campaigns, people or needs
        </label>
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ui-subtle" />
        <input id="q" name="q" defaultValue={params.q ?? ''} placeholder="Search campaigns, people or needs" className="input pl-12 pr-24" />
        {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        {params.funding && <input type="hidden" name="funding" value={params.funding} />}
        <button type="submit" className="btn-primary btn-sm absolute right-2 top-1/2 -translate-y-1/2">
          Search
        </button>
      </form>

      {!fixedCategory && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Categories">
          <Link href={buildHref(basePath, current, { category: undefined, page: undefined })} className={`chip ${!categoryFilter ? 'chip-active' : ''}`}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.slug} href={buildHref(basePath, current, { category: c.slug, page: undefined })} className={`chip ${categoryFilter === c.slug ? 'chip-active' : ''}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <details className="surface-flat group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
          <span>Filters and sorting</span>
          <Icon name="chevronDown" className="h-5 w-5 text-ui-muted transition group-open:rotate-180" />
        </summary>
        <form action={basePath} method="get" className="mt-5 space-y-5">
          {params.q && <input type="hidden" name="q" value={params.q} />}
          {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          <div>
            <p className="label">Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <label key={s.key} className={`chip cursor-pointer ${sort === s.key ? 'chip-active' : ''}`}>
                  <input type="radio" name="sort" value={s.key} defaultChecked={sort === s.key} className="sr-only" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="funding" className="label">
              Funding status
            </label>
            <select id="funding" name="funding" defaultValue={funding} className="select">
              {FUNDING.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="city" className="label">
              City
            </label>
            <input id="city" name="city" defaultValue={params.city ?? ''} placeholder="e.g. Coimbatore" className="input" />
          </div>
          <button type="submit" className="btn-dark w-full">
            Apply filters
          </button>
        </form>
      </details>

      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{heading ?? 'Campaigns'}</h2>
        <span className="text-xs text-ui-muted" aria-live="polite">
          {result.total} {result.total === 1 ? 'campaign' : 'campaigns'}
        </span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon="search"
          title="No campaigns match these filters"
          body="Try a different category, clear the city, or search for a broader term."
          action={{ href: basePath, label: 'Clear filters' }}
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((c) => (
            <li key={c.id}>
              <CampaignRow c={c} />
            </li>
          ))}
        </ul>
      )}

      {(result.page > 1 || result.hasMore) && (
        <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
          {result.page > 1 ? (
            <Link href={buildHref(basePath, { ...current, sort }, { page: String(result.page - 1) })} className="btn-ghost btn-sm">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ui-muted">Page {result.page}</span>
          {result.hasMore ? (
            <Link href={buildHref(basePath, { ...current, sort }, { page: String(result.page + 1) })} className="btn-ghost btn-sm">
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
