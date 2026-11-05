import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { homeSections } from '@/lib/services/campaigns';
import { unreadCount } from '@/lib/services/notifications';
import { Avatar, EmptyState, SectionHeader } from '@/components/ui/primitives';
import { Icon, Logo, type IconName } from '@/components/ui/icons';
import { CampaignCardLarge, CampaignRow, CampaignTile } from '@/components/mobile/campaign-card';

export const metadata = { title: 'Home' };

const CATEGORY_ICON: Record<string, IconName> = {
  'debt-relief': 'wallet',
  medical: 'heart',
  education: 'file',
  family: 'users',
  emergency: 'alert',
  business: 'chart',
};

const CATEGORY_TONE: Record<string, string> = {
  'debt-relief': 'bg-pastel-yellow',
  medical: 'bg-pastel-sky',
  education: 'bg-pastel-pink',
  family: 'bg-pastel-mint',
  emergency: 'bg-pastel-yellow',
  business: 'bg-pastel-pink',
};

export default async function HomePage() {
  const user = await requirePageUser('/app/home');
  const [sections, unread] = await Promise.all([homeSections(), unreadCount(user.id)]);
  const firstName = user.fullName.split(' ')[0];

  return (
    <main className="pb-36">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-950/80 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-[17px] font-bold tracking-tight">HelpTrust</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850">
            <Icon name="bell" className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-mint shadow-glow" />}
          </Link>
          <Link href="/app/donor" aria-label="Your profile">
            <Avatar name={user.fullName} size="sm" />
          </Link>
        </div>
      </header>

      <div className="space-y-8 px-5 pt-3">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">
            Hello,
            <br />
            {firstName} <span aria-hidden="true">👋</span>
          </h1>
        </div>

        <form action="/app/explore" method="get" role="search">
          <label htmlFor="home-q" className="sr-only">
            Search campaigns, people or needs
          </label>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ui-subtle" />
            <input id="home-q" name="q" placeholder="Search campaigns, people or needs" className="input pl-12" />
          </div>
        </form>

        <nav aria-label="Categories" className="grid grid-cols-4 gap-3">
          {sections.categories.slice(0, 4).map((c) => (
            <Link key={c.slug} href={`/app/category/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
              <span className={`${CATEGORY_TONE[c.slug] ?? 'bg-pastel-mint'} flex h-16 w-full items-center justify-center rounded-[22px] text-ink-950 shadow-card transition group-active:scale-95`}>
                <Icon name={CATEGORY_ICON[c.slug] ?? 'grid'} className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <span className="text-[12px] font-medium leading-tight text-ui-muted">{c.name}</span>
            </Link>
          ))}
        </nav>

        <section aria-labelledby="urgent-h">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="urgent-h" className="text-[19px] font-semibold tracking-tight">
              Urgent campaigns <span aria-hidden="true">🔥</span>
            </h2>
            <Link href="/app/explore?sort=urgent" className="text-sm font-medium text-mint">
              See all
            </Link>
          </div>
          {sections.urgent.length === 0 ? (
            <EmptyState icon="heart" title="No live campaigns yet" body="Verified campaigns appear here as soon as they are approved and published." />
          ) : (
            <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2">
              {sections.urgent.map((c) => (
                <CampaignCardLarge key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>

        {sections.featured.length > 0 && (
          <section aria-labelledby="featured-h">
            <SectionHeader title="Featured campaigns" action="Explore" href="/app/explore" />
            <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2">
              {sections.featured.map((c) => (
                <div key={c.id} className="w-[220px] shrink-0 snap-start">
                  <CampaignTile c={c} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="recent-h">
          <SectionHeader title="Recently added" action="See all" href="/app/explore?sort=latest" />
          <ul className="space-y-3">
            {sections.recent.slice(0, 3).map((c) => (
              <li key={c.id}>
                <CampaignRow c={c} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="verified-h">
          <SectionHeader title="Verified campaigns" action="View all" href="/app/explore" />
          <div className="grid grid-cols-2 gap-3">
            {sections.verified.slice(0, 4).map((c) => (
              <CampaignTile key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section aria-label="Platform totals" className="surface grid grid-cols-2 gap-4 p-5">
          <Stat label="Campaigns funded" value={sections.stats.campaignsFunded.toLocaleString('en-IN')} />
          <Stat label="Verified campaigns" value={sections.stats.verifiedCampaigns.toLocaleString('en-IN')} />
          <Stat label="Donors" value={sections.stats.donors.toLocaleString('en-IN')} />
          <Stat label="Raised so far" value={`₹${Math.floor(sections.stats.totalRaisedPaise / 100).toLocaleString('en-IN')}`} />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-extrabold text-mint">{value}</p>
      <p className="text-xs text-ui-muted">{label}</p>
    </div>
  );
}
