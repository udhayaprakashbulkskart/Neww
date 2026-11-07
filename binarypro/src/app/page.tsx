import Link from 'next/link';
import { PLANS, TIERS } from '@/lib/domain/plans';
import { MembershipCard } from '@/components/membership-card';
import { PublicHeader } from '@/components/public-header';
import { NetworkArt } from '@/components/brand-art';
import { Icon } from '@/components/shell/icons';

const STEPS = [
  { n: '01', t: 'Join and choose a plan', b: 'Create your account and pick the membership tier that fits you. Benefits are shown up front.' },
  { n: '02', t: 'Shop and watch', b: 'Buy from partner merchants for cashback, and watch sponsored videos to earn advertiser-funded rewards.' },
  { n: '03', t: 'Build your team', b: 'Place each new member on your left or right. Commission comes from verified retail sales only.' },
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_at_70%_0%,rgba(255,106,0,.22),transparent_55%),radial-gradient(ellipse_at_10%_30%,rgba(212,175,55,.12),transparent_50%)]" />

        <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#f7e09a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" /> Lead · Grow · Prosper
            </span>
            <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              Shop. Watch. <span className="gold-text">Grow your team.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#a39a86]">
              CrownTree pays for real activity: cashback from partner merchants, commission on verified retail sales and rewards from advertiser-funded videos, in one multi-currency wallet.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login?mode=register" className="btn btn-brand px-7 py-3.5 text-base">Create free account</Link>
              <Link href="/compliance" className="btn btn-ghost px-7 py-3.5 text-base">How it stays compliant</Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-8">
              {[['4', 'membership tiers'], ['8', 'currencies'], ['2', 'payment and ledger safeguards']].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-black text-[#f7e09a]">{v}</dt>
                  <dd className="text-xs text-[#8f8672]">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_60%)] blur-3xl" />
            <div className="relative space-y-5">
              <div className="ml-10 rotate-[-3deg] transition hover:rotate-0"><MembershipCard tier="GOLD" name="Member Name" active expires={null} /></div>
              <div className="-mt-28 mr-6 rotate-[3deg] transition hover:rotate-0"><MembershipCard tier="PLATINUM" name="Member Name" active expires={null} /></div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">How it works</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Three steps. Real activity, real rewards.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition hover:-translate-y-1 hover:border-[#d4af37]/40">
                <div className="text-sm font-black text-[#ff6a00]">{s.n}</div>
                <h3 className="mt-4 text-xl font-bold">{s.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#8f8672]">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">Membership</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Four tiers. Clear benefits.</h2>
              <p className="mt-3 text-[#8f8672]">Cashback caps increase with each tier. Membership fees are never paid out as commission.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t, i) => {
              const featured = t === 'GOLD';
              return (
                <div key={t} className={`relative flex flex-col rounded-3xl p-6 ${featured ? 'bg-[linear-gradient(170deg,#2a1c05,#0b0b0b_60%)] ring-1 ring-[#d4af37]/60 shadow-[0_0_60px_rgba(212,175,55,.15)]' : 'border border-white/10 bg-white/[0.03]'}`}>
                  {featured && <span className="absolute -top-3 left-6 rounded-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)] px-3 py-1 text-[11px] font-bold text-black">Most popular</span>}
                  <div className="text-xs font-bold uppercase tracking-[.2em] text-[#f7e09a]">{t}</div>
                  <div className="mt-4 text-4xl font-black">{PLANS[t].couponMaxPercent}%</div>
                  <div className="text-xs text-[#8f8672]">cashback coupons up to</div>
                  <div className="my-6 h-px bg-white/10" />
                  <div className="text-2xl font-extrabold">{PLANS[t].priceInrMinor === 0n ? 'Free' : `₹${Number(PLANS[t].priceInrMinor / 100n).toLocaleString('en-IN')}`}<span className="text-sm font-medium text-[#8f8672]"> / year</span></div>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#cfc6b0]">
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />Direct commission {PLANS[t].directBps / 100}% on verified sales</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />{PLANS[t].binaryBps ? `Binary matching ${PLANS[t].binaryBps / 100}%` : 'No binary matching'}</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />Up to {PLANS[t].adViewsPerDay} ad rewards per day</li>
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-[32px] border border-[#d4af37]/30 bg-[linear-gradient(120deg,#1f1405,#050505_60%)] p-10 md:p-14">
            <NetworkArt className="absolute -right-10 top-0 h-full w-[60%] opacity-40" />
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
