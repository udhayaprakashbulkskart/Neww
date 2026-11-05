import Link from 'next/link';
import { homeSections } from '@/lib/services/campaigns';
import { formatINRCompact } from '@/lib/format';
import { Icon, type IconName } from '@/components/ui/icons';
import { CampaignTile } from '@/components/mobile/campaign-card';
import { SectionHeader } from '@/components/ui/primitives';

export const metadata = {
  title: 'Home',
  description: 'Real People. Real Problems. Verified Help. Request verified financial help or support a genuine cause in India.',
};

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'user', title: 'Register and verify', body: 'Create an account with your mobile number and confirm your identity with consent.' },
  { icon: 'file', title: 'Share your need', body: 'Describe your situation and upload the bills or loan statements that prove it.' },
  { icon: 'shield', title: 'We verify', body: 'Our team checks your documents, address and bank account before anything goes live.' },
  { icon: 'heart', title: 'Get support', body: 'Verified campaigns appear to donors. Every donation is confirmed and receipted.' },
];

const TRUST: { icon: IconName; title: string; body: string }[] = [
  { icon: 'lock', title: 'Private by design', body: 'Documents and bank details are encrypted and visible only to our verification team.' },
  { icon: 'eye', title: 'Transparent progress', body: 'See how much has been raised, how many people have given and what has been reviewed.' },
  { icon: 'refund', title: 'Refund policy', body: 'Request a full refund within 7 days of a successful payment, reviewed by our finance team.' },
];

export default async function HomePage() {
  const data = await homeSections();
  const s = data.stats;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-emerald/15 blur-3xl" />
          <div className="absolute bottom-0 left-[-10%] h-[360px] w-[360px] rounded-full bg-mint/10 blur-3xl" />
          <svg className="absolute inset-x-0 bottom-0 h-48 w-full opacity-60" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,140 C240,60 480,180 720,110 C960,40 1200,150 1440,90 L1440,200 L0,200 Z" fill="rgba(92,255,177,0.08)" />
            <path d="M0,170 C300,110 540,200 800,150 C1060,100 1260,180 1440,140" fill="none" stroke="rgba(92,255,177,0.35)" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <p className="eyebrow">Financial help · India</p>
            <h1 className="mt-5 text-balance text-[44px] font-extrabold leading-[1.04] tracking-tight md:text-[60px]">
              Real People.
              <br />
              Real Problems.
              <br />
              <span className="text-mint">Verified Help.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ui-muted">
              Get support for debt, medical bills, education and emergencies from kind people. Every request is checked before it reaches a donor.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/request-help" className="btn-primary">
                Request help
                <Icon name="arrowRight" className="h-5 w-5" />
              </Link>
              <Link href="/support-a-cause" className="btn-ghost">
                <Icon name="heart" className="h-5 w-5" />
                Support a cause
              </Link>
            </div>
            <p className="mt-6 text-xs text-ui-subtle">Totals below are live figures from our platform records.</p>
          </div>

          {/* Verified-trust composition: stylised, no stock imagery */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="surface p-6 shadow-glow">
              <div className="flex items-center justify-between">
                <span className="pill bg-emerald/15 text-emerald-400">
                  <Icon name="checkCircle" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Verified
                </span>
                <span className="text-xs text-ui-subtle">Live campaign</span>
              </div>
              <div className="mt-6 flex h-40 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald/25 via-ink-700 to-ink-900">
                <Icon name="heart" className="h-16 w-16 text-mint/80" strokeWidth={1.2} />
              </div>
              <p className="mt-6 text-lg font-bold leading-snug">Verified campaigns, reviewed by people</p>
              <p className="mt-2 text-sm leading-relaxed text-ui-muted">Identity, address, bank account and bills are checked before a campaign can be published.</p>
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div className="relative border-y border-white/[0.06] bg-ink-900/70">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4 lg:px-8">
            <Stat label="Campaigns funded" value={s.campaignsFunded.toLocaleString('en-IN')} />
            <Stat label="Raised so far" value={formatINRCompact(s.totalRaisedPaise)} />
            <Stat label="Verified campaigns" value={s.verifiedCampaigns.toLocaleString('en-IN')} />
            <Stat label="Donors" value={s.donors.toLocaleString('en-IN')} />
          </dl>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:px-8" aria-labelledby="cats-h">
        <SectionHeader title="Find a cause that matters to you" />
        <h2 id="cats-h" className="sr-only">
          Categories
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {data.categories.map((c) => (
            <Link key={c.id} href={`/explore?category=${c.slug}`} className="surface flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-mint/25">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.tone === 'yellow' ? 'bg-pastel-yellow' : c.tone === 'pink' ? 'bg-pastel-pink' : c.tone === 'sky' ? 'bg-pastel-sky' : 'bg-pastel-mint'} text-ink-950`}>
                <Icon name={c.slug === 'debt-relief' ? 'wallet' : c.slug === 'medical' ? 'heart' : c.slug === 'education' ? 'file' : c.slug === 'family' ? 'users' : c.slug === 'emergency' ? 'alert' : 'chart'} className="h-5 w-5" />
              </span>
              <span className="font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8" aria-labelledby="how-h">
        <div className="mb-12 max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 id="how-h" className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight md:text-[40px]">
            A simple, transparent, secure process
          </h2>
        </div>
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="surface relative p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint/15 text-mint">
                <Icon name={step.icon} className="h-6 w-6" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ui-subtle">Step {i + 1}</p>
              <h3 className="mt-1 text-[17px] font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ui-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-6 grid gap-5 md:grid-cols-3">
          {TRUST.map((t) => (
            <li key={t.title} className="surface-flat flex gap-4 p-6">
              <Icon name={t.icon} className="h-6 w-6 shrink-0 text-mint" />
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ui-muted">{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Live campaigns */}
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
        <div className="relative overflow-hidden rounded-[36px] border border-mint/15 bg-mint-gradient p-10 text-ink-950 md:p-14">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
          <h2 className="relative max-w-2xl text-[32px] font-extrabold leading-tight tracking-tight md:text-[42px]">Help is closer than you think.</h2>
          <p className="relative mt-4 max-w-xl text-[16px] leading-relaxed text-ink-950/75">Start a verified request, or give to a cause you can see clearly.</p>
          <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/request-help" className="btn h-14 bg-ink-950 text-mint hover:bg-ink-900">
              Request help
            </Link>
            <Link href="/support-a-cause" className="btn h-14 border border-ink-950/20 bg-white/30 text-ink-950 hover:bg-white/40">
              Support a cause
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ui-subtle">{label}</dt>
      <dd className="mt-1.5 text-[26px] font-extrabold text-mint md:text-[30px]">{value}</dd>
    </div>
  );
}
