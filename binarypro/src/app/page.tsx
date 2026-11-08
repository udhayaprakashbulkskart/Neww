import Link from 'next/link';
import { PLANS, TIERS } from '@/lib/domain/plans';
import { loadEffectivePlans } from '@/lib/server/plans';
import { formatMoney } from '@/lib/domain/money';

export const dynamic = 'force-dynamic';
import { MembershipCard } from '@/components/membership-card';
import { PublicHeader } from '@/components/public-header';
import { NetworkArt } from '@/components/brand-art';
import { Icon } from '@/components/shell/icons';
import { Reveal } from '@/components/reveal';
import { CountUp } from '@/components/landing/count-up';
import { Ticker } from '@/components/landing/ticker';
import { TreeArt } from '@/components/landing/tree-art';

const STEPS = [
  { n: '01', t: 'Join and choose a plan', b: 'Create your account and pick the membership tier that fits you. Benefits are shown up front.' },
  { n: '02', t: 'Shop and watch', b: 'Buy from partner merchants for cashback, and watch sponsored videos to earn advertiser-funded rewards.' },
  { n: '03', t: 'Build your team', b: 'Place each new member on your left or right. Commission comes from verified retail sales only.' },
];

export default async function Home() {
  const plans = await loadEffectivePlans();
  return (
    <>
      <PublicHeader />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden" aria-hidden="true">
          <div className="aurora-a absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_65%)] blur-3xl" />
          <div className="aurora-b absolute right-[-120px] top-[-40px] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,.28),transparent_65%)] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_30%,#000_85%)]" />
        </div>

        <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <span className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#f7e09a]" style={{ animationDelay: "0ms" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" /> Lead · Grow · Prosper
            </span>
            <h1 className="anim-fade-up mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl" style={{ animationDelay: "120ms" }}>
              Shop. Watch. <span className="gold-shimmer">Grow your team.</span>
            </h1>
            <p className="anim-fade-up mt-6 max-w-xl text-lg leading-relaxed text-[#a39a86]" style={{ animationDelay: "240ms" }}>
              CrownTree pays for real activity: cashback from partner merchants, commission on verified retail sales and rewards from advertiser-funded videos, in one multi-currency wallet.
            </p>
            <div className="anim-fade-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: "360ms" }}>
              <Link href="/login?mode=register" className="btn btn-brand px-7 py-3.5 text-base">Create free account</Link>
              <Link href="/compliance" className="btn btn-ghost px-7 py-3.5 text-base">How it stays compliant</Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-8">
              {[[4, '', 'membership tiers'], [8, '', 'currencies'], [7, '-day', 'return window before commission']].map(([v, suf, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-black text-[#f7e09a]"><CountUp to={Number(v)} suffix={String(suf)} /></dt>
                  <dd className="text-xs text-[#8f8672]">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_60%)] blur-3xl" />
            <div className="relative space-y-5">
              <div className="anim-fade-up ml-10 rotate-[-3deg] transition hover:rotate-0" style={{ animationDelay: "200ms" }}><div className="anim-float"><MembershipCard tier="GOLD" name="Member Name" active expires={null} /></div></div>
              <div className="anim-fade-up -mt-28 mr-6 rotate-[3deg] transition hover:rotate-0" style={{ animationDelay: "400ms" }}><div className="anim-float" style={{ animationDelay: "-3s" }}><MembershipCard tier="PLATINUM" name="Member Name" active expires={null} /></div></div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <Reveal><p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">How it works</p></Reveal>
            <Reveal delay={80}><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Three steps. Real activity, real rewards.</h2></Reveal>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}><div className="sheen group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:-translate-y-1.5 hover:border-[#d4af37]/50 hover:shadow-[0_20px_50px_rgba(212,175,55,.12)]">
                <div className="text-sm font-black text-[#ff6a00]">{s.n}</div>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#8f8672]">{s.b}</p>
              </div></Reveal>
            ))}
          </div>
        </section>

        <section id="plans" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Membership</p>
              <Reveal delay={80}><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Four tiers. Clear benefits.</h2></Reveal>
              <p className="mt-3 text-[#8f8672]">Cashback caps increase with each tier. Membership fees are never paid out as commission.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t, i) => {
              const featured = t === 'GOLD';
              return (
                <Reveal key={t} delay={i * 100}><div className={`sheen relative flex h-full flex-col rounded-3xl p-6 transition duration-300 hover:-translate-y-1.5 ${featured ? 'bg-[linear-gradient(170deg,#2a1c05,#0b0b0b_60%)] ring-1 ring-[#d4af37]/60 shadow-[0_0_60px_rgba(212,175,55,.15)]' : 'border border-white/10 bg-white/[0.03] hover:border-[#d4af37]/40'}`}>
                  {featured && <span className="absolute right-5 top-5 rounded-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)] px-3 py-1 text-[11px] font-bold text-black">Most popular</span>}
                  <div className="text-xs font-bold uppercase tracking-[.2em] text-[#f7e09a]">{t}</div>
                  <div className="mt-4 text-4xl font-black">{plans[t].couponMaxPercent}%</div>
                  <div className="text-xs text-[#8f8672]">cashback coupons up to</div>
                  <div className="my-6 h-px bg-white/10" />
                  <div className="text-2xl font-extrabold">{plans[t].priceInrMinor === 0n ? 'Free' : formatMoney(plans[t].priceInrMinor, 'INR')}<span className="text-sm font-medium text-[#8f8672]"> / year</span></div>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#cfc6b0]">
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />Direct commission {PLANS[t].directBps / 100}% on verified sales</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />{PLANS[t].binaryBps ? `Binary matching ${PLANS[t].binaryBps / 100}%` : 'No binary matching'}</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />Up to {plans[t].adViewsPerDay} ad rewards per day</li>
                  </ul>
                </div></Reveal>
              );
            })}
          </div>
        </section>

        <section id="earn" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Earn with ads</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Watch. Complete. Get paid.</h2>
              <p className="mt-4 max-w-md text-[#8f8672]">Advertisers fund every reward. A payment is added only after you watch at least 95% of the video, once per campaign each day, within your plan’s limit.</p>
              <ul className="mt-6 space-y-3 text-sm text-[#cfc6b0]">
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />Daily limits from 5 to 20 videos, by plan</li>
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />Rewards paid from advertiser budgets only</li>
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />Every credit shows in your wallet history</li>
              </ul>
            </div>
            <Reveal delay={120}>
              <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,.7)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ads/earn-video-cover.jpg" alt="Advertiser video preview" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.45)_50%,rgba(0,0,0,.9))]" aria-hidden="true" />
                <div className="absolute inset-x-6 bottom-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[70%] rounded-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" /></div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#cfc6b0]"><span>0:21</span><span>Reward unlocks at 95%</span></div>
                </div>
                <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black shadow-[0_0_50px_rgba(255,106,0,.5)]">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="tree" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Binary team</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Place members left or right. Grow together.</h2>
            <p className="mt-4 text-[#8f8672]">Each new member takes an open position in your team. Matched volume earns binary rewards, within each plan’s daily limit and only when funded.</p>
          </div>
          <TreeArt />
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-[32px] border border-[#d4af37]/30 bg-[linear-gradient(120deg,#1f1405,#050505_60%)] p-10 md:p-14">
            <NetworkArt className="anim-drift absolute -right-10 top-0 h-full w-[60%] opacity-40" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ready to build your <span className="gold-text">global team?</span></h2>
              <p className="mt-4 text-[#bdb4a0]">Create a free account in under a minute. Upgrade when you are ready.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?mode=register" className="btn btn-brand px-7 py-3.5">Create free account</Link>
                <Link href="/login" className="btn btn-ghost px-7 py-3.5">Sign in</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-7 text-xs leading-relaxed text-[#8f8672]">
            <strong className="text-[#cfc6b0]">Important.</strong> CrownTree does not guarantee income. Earnings depend on verified retail sales, your own activity and platform performance. Commissions are never paid for joining, recruiting or membership fees. Advertising rewards are paid only from advertiser budgets. Read the <Link href="/compliance" className="text-[#f7e09a]">compliance statement</Link>.
          </div>
        </section>
      </div>
    </>
  );
}
