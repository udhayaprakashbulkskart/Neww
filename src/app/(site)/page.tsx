import Link from 'next/link';
import { homeSections } from '@/lib/services/campaigns';
import { Icon, type IconName } from '@/components/ui/icons';
import { CampaignTile } from '@/components/mobile/campaign-card';
import { SectionHeader } from '@/components/ui/primitives';
import { CountUp } from '@/components/ui/count-up';
import { categoryIcon } from '@/lib/category-meta';
import { BrandMarquee } from '@/components/site/brand-marquee';
import { LiveDonations } from '@/components/site/live-donations';
import { recentDonationFeed } from '@/lib/services/live-feed';

export const metadata = {
  title: 'Home',
  description: 'Real People. Real Problems. Verified Help. Request verified financial help or support a genuine cause in India.',
};

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'file', title: 'Submit request', body: 'Describe your situation and upload the bills or loan statements that prove it.' },
  { icon: 'shield', title: 'Verification', body: 'Our team checks your documents, address and bank account before anything goes live.' },
  { icon: 'user', title: 'Get support', body: 'Verified campaigns appear to donors. Every donation is confirmed and receipted.' },
  { icon: 'heart', title: 'Make an impact', body: 'Funds go to the verified need, and you can see how much has been raised.' },
];

const HIGHLIGHTS: { icon: IconName; title: string }[] = [
  { icon: 'checkCircle', title: 'Verified requests' },
  { icon: 'lock', title: 'Transparent & secure' },
  { icon: 'user', title: 'Real people' },
];

export default async function HomePage() {
  const [data, feed] = await Promise.all([homeSections(), recentDonationFeed(12)]);
  const s = data.stats;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-emerald/15 blur-3xl" />
          <div className="absolute bottom-0 left-[-10%] h-[360px] w-[360px] rounded-full bg-mint/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-10 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-8">
          <div className="text-center lg:text-left">
            <span className="pill border border-white/10 bg-ink-850/70 px-4 py-2 text-sm text-ui-muted">
              <span aria-hidden="true">🇮🇳</span> Financial help · India
            </span>
            <h1 className="mt-6 text-balance text-[40px] font-extrabold leading-[1.05] tracking-tight md:text-[60px]">
              Real People.
              <br />
              Real Problems.
              <br />
              <span className="text-mint">Verified Help.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ui-muted lg:mx-0">
              Get support for debt, medical bills, education and emergencies from kind, verified people. Every request is checked before it reaches a donor.
            </p>
            <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 lg:mx-0 lg:max-w-none lg:flex-row">
              <Link href="/request-help" className="btn-primary h-14 text-base">
                Request help
                <Icon name="arrowRight" className="h-5 w-5" />
              </Link>
              <Link href="/support-a-cause" className="btn-ghost h-14 text-base">
                <Icon name="heart" className="h-5 w-5" />
                Support a cause
              </Link>
            </div>
            <ul className="mt-8 grid grid-cols-3 gap-3 text-left text-xs text-ui-muted sm:text-sm">
              {HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex items-center gap-2">
                  <Icon name={h.icon} className="h-5 w-5 shrink-0 text-mint" />
                  <span>{h.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-rise delay-200">
            <div aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-mint/15 blur-3xl animate-breathe" />
            <img src="/illustrations/hands-heart.svg" alt="Two hands holding a glowing heart" className="animate-float w-full drop-shadow-[0_30px_60px_rgba(92,255,177,0.18)]" />
            <div className="surface absolute -bottom-4 left-4 right-4 p-4 shadow-glow lift animate-rise delay-400">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="pill bg-emerald/15 text-emerald-400">
                  <Icon name="checkCircle" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Verified
                </span>
                <span className="text-xs text-ui-subtle">Every request is checked before it goes live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live platform figures from the database */}
        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <dl className="surface grid grid-cols-2 gap-6 p-6 md:grid-cols-4 md:p-8">
            <Stat icon="users" label="Campaigns funded" value={<CountUp value={s.campaignsFunded} />} />
            <Stat icon="heart" label="Raised so far" value={<CountUp value={Math.round(s.totalRaisedPaise / 100)} mode="inrCompactRupees" />} />
            <Stat icon="shield" label="Verified campaigns" value={<CountUp value={s.verifiedCampaigns} />} />
            <Stat icon="users" label="Donors" value={<CountUp value={s.donors} />} />
          </dl>
          <p className="mt-3 text-center text-xs text-ui-subtle">Figures are live from our platform records.</p>
        </div>
      </section>

      {/* Charity and partner strip */}
      <div className="mt-12">
        <BrandMarquee campaigns={data.verified} />
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8" aria-labelledby="how-h">
        <div className="mb-12 text-center">
          <h2 id="how-h" className="text-[32px] font-extrabold tracking-tight md:text-[40px]">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-ui-muted">A simple, transparent and trusted way to get or give help.</p>
        </div>
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative text-center">
              <span className="surface lift mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-mint">
                <Icon name={step.icon} className="h-9 w-9" />
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute right-[-18px] top-8 hidden text-mint/60 lg:block">
                  <Icon name="arrowRight" className="h-5 w-5" />
                </span>
              )}
              <p className="mt-5 text-sm font-semibold text-ui-subtle">
                {i + 1}. {step.title}
              </p>
              <p className="mx-auto mt-2 max-w-[220px] text-sm leading-relaxed text-ui-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8" aria-labelledby="cats-h">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 id="cats-h" className="text-[28px] font-extrabold tracking-tight">
            Find a cause that matters to you
          </h2>
          <Link href="/explore" className="hidden text-sm font-semibold text-mint sm:inline">
            Explore all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {data.categories.map((c) => (
            <Link key={c.id} href={`/explore?category=${c.slug}`} className="surface lift flex flex-col gap-4 p-5 hover:border-mint/25">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.tone === 'yellow' ? 'bg-pastel-yellow' : c.tone === 'pink' ? 'bg-pastel-pink' : c.tone === 'sky' ? 'bg-pastel-sky' : 'bg-pastel-mint'} text-ink-950`}>
                <Icon name={categoryIcon(c.slug)} className="h-5 w-5" />
              </span>
              <span className="font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live donations */}
      <LiveDonations initial={feed} />

      {/* Verified campaigns (only when real campaigns are published) */}
      {data.verified.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8" aria-labelledby="live-h">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow">Verified and live</p>
              <h2 id="live-h" className="mt-2 text-[28px] font-extrabold tracking-tight">
                Campaigns that need you
              </h2>
            </div>
            <Link href="/explore" className="hidden text-sm font-semibold text-mint sm:inline">
              Explore all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.verified.slice(0, 4).map((c) => (
              <CampaignTile key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {/* Final call to action */}
      <section className="mx-auto max-w-6xl px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] border border-mint/15 bg-mint-gradient p-8 text-ink-950 md:p-14">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="max-w-xl text-[30px] font-extrabold leading-tight tracking-tight md:text-[42px]">
                Be the reason for someone&rsquo;s second chance.
              </h2>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-950/75">Start a verified request, or give to a cause you can see clearly.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
              <Link href="/request-help" className="btn h-14 bg-ink-950 text-mint hover:bg-ink-900">
                Request help
              </Link>
              <Link href="/support-a-cause" className="btn h-14 bg-white text-ink-950 hover:bg-white/90">
                Support a cause
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/10 text-mint">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div>
        <dd className="text-[24px] font-extrabold text-mint md:text-[28px]">{value}</dd>
        <dt className="text-xs text-ui-muted">{label}</dt>
      </div>
    </div>
  );
}
