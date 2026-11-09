import Link from 'next/link';
import { PLANS, TIERS } from '@/lib/domain/plans';
import { loadEffectivePlans } from '@/lib/server/plans';
import { getRequestRegion } from '@/lib/server/locale';
import { Money } from '@/components/ui';
import { MembershipCard } from '@/components/membership-card';
import { PublicHeader } from '@/components/public-header';
import { NetworkArt } from '@/components/brand-art';
import { Icon } from '@/components/shell/icons';
import { Reveal } from '@/components/reveal';
import { CountUp } from '@/components/landing/count-up';
import { TreeArt } from '@/components/landing/tree-art';
import type { MessageKey } from '@/lib/i18n/messages';

export const dynamic = 'force-dynamic';

const STEPS: { n: string; t: MessageKey; b: MessageKey }[] = [
  { n: '01', t: 'landing.step1Title', b: 'landing.step1Body' },
  { n: '02', t: 'landing.step2Title', b: 'landing.step2Body' },
  { n: '03', t: 'landing.step3Title', b: 'landing.step3Body' },
];

export default async function Home() {
  const [plans, region] = await Promise.all([loadEffectivePlans(), getRequestRegion()]);
  const t = region.t;
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
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00]" /> {t('landing.badge')}
            </span>
            <h1 className="anim-fade-up mt-6 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl" style={{ animationDelay: "120ms" }}>
              {t('landing.heroTitle1')} <span className="gold-shimmer">{t('landing.heroTitle2')}</span>
            </h1>
            <p className="anim-fade-up mt-6 max-w-xl text-lg leading-relaxed text-[#a39a86]" style={{ animationDelay: "240ms" }}>
              {t('landing.heroBody')}
            </p>
            <div className="anim-fade-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: "360ms" }}>
              <Link href="/login?mode=register" className="btn btn-brand px-7 py-3.5 text-base">{t('common.createFreeAccount')}</Link>
              <Link href="/compliance" className="btn btn-ghost px-7 py-3.5 text-base">{t('landing.signIn')}</Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-8">
              {([[4, 'landing.statTiers'], [8, 'landing.statCurrencies'], [7, 'landing.statWindow']] as const).map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-black text-[#f7e09a]"><CountUp to={Number(v)} suffix={l === 'landing.statWindow' ? t('landing.dayUnit') : ''} /></dt>
                  <dd className="text-xs text-[#8f8672]">{t(l)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_60%)] blur-3xl" />
            <div className="relative space-y-5">
              <div className="anim-fade-up ml-10 rotate-[-3deg] transition hover:rotate-0" style={{ animationDelay: "200ms" }}><div className="anim-float"><MembershipCard tier="GOLD" name={t('landing.memberName')} active expires={null} t={t} locale={region.locale} /></div></div>
              <div className="anim-fade-up -mt-28 mr-6 rotate-[3deg] transition hover:rotate-0" style={{ animationDelay: "400ms" }}><div className="anim-float" style={{ animationDelay: "-3s" }}><MembershipCard tier="PLATINUM" name={t('landing.memberName')} active expires={null} t={t} locale={region.locale} /></div></div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <Reveal><p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">{t('landing.howLabel')}</p></Reveal>
            <Reveal delay={80}><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('landing.howTitle')}</h2></Reveal>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}><div className="sheen group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:-translate-y-1.5 hover:border-[#d4af37]/50 hover:shadow-[0_20px_50px_rgba(212,175,55,.12)]">
                <div className="text-sm font-black text-[#ff6a00]">{s.n}</div>
                <h3 className="mt-4 text-xl font-bold">{t(s.t)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#8f8672]">{t(s.b)}</p>
              </div></Reveal>
            ))}
          </div>
        </section>

        <section id="plans" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">{t('landing.plansLabel')}</p>
              <Reveal delay={80}><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('landing.plansTitle')}</h2></Reveal>
              <p className="mt-3 text-[#8f8672]">{t('landing.plansBody')}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier, i) => {
              const featured = tier === 'GOLD';
              return (
                <Reveal key={tier} delay={i * 100}><div className={`sheen relative flex h-full flex-col rounded-3xl p-6 transition duration-300 hover:-translate-y-1.5 ${featured ? 'bg-[linear-gradient(170deg,#2a1c05,#0b0b0b_60%)] ring-1 ring-[#d4af37]/60 shadow-[0_0_60px_rgba(212,175,55,.15)]' : 'border border-white/10 bg-white/[0.03] hover:border-[#d4af37]/40'}`}>
                  {featured && <span className="absolute right-5 top-5 rounded-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)] px-3 py-1 text-[11px] font-bold text-black">{t('plan.popular')}</span>}
                  <div className="text-xs font-bold uppercase tracking-[.2em] text-[#f7e09a]">{t(`tier.${tier}` as 'tier.BASIC')}</div>
                  <div className="mt-4 text-4xl font-black">{plans[tier].couponMaxPercent}%</div>
                  <div className="text-xs text-[#8f8672]">{t('plan.cashbackUpTo')}</div>
                  <div className="my-6 h-px bg-white/10" />
                  <div className="text-2xl font-extrabold">{plans[tier].priceInrMinor === 0n ? t('plan.free') : <Money minor={plans[tier].priceInrMinor} currency="INR" />}<span className="text-sm font-medium text-[#8f8672]"> {t('plan.perYear')}</span></div>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#cfc6b0]">
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />{t('plan.directCommission', { pct: PLANS[tier].directBps / 100 })}</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />{PLANS[tier].binaryBps ? t('plan.binaryMatching', { pct: PLANS[tier].binaryBps / 100 }) : t('plan.noBinary')}</li>
                    <li className="flex gap-2"><Icon name="arrow" className="mt-0.5 h-4 w-4 shrink-0 text-[#d4af37]" />{t('plan.adRewards', { n: plans[tier].adViewsPerDay })}</li>
                  </ul>
                </div></Reveal>
              );
            })}
          </div>
        </section>

        <section id="earn" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">{t('landing.earnLabel')}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('landing.earnTitle')}</h2>
              <p className="mt-4 max-w-md text-[#8f8672]">{t('landing.earnBody')}</p>
              <ul className="mt-6 space-y-3 text-sm text-[#cfc6b0]">
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />{t('landing.earnLi1')}</li>
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />{t('landing.earnLi2')}</li>
                <li className="flex gap-3"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-[#ff6a00]" />{t('landing.earnLi3')}</li>
              </ul>
            </div>
            <Reveal delay={120}>
              <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,.7)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ads/earn-video-cover.jpg" alt={t('landing.videoAlt')} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.45)_50%,rgba(0,0,0,.9))]" aria-hidden="true" />
                <div className="absolute inset-x-6 bottom-6">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[70%] rounded-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" /></div>
                  <div className="mt-2 flex justify-between text-[11px] text-[#cfc6b0]"><span>0:21</span><span>{t('landing.rewardUnlocks')}</span></div>
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
            <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#f7e09a]">{t('landing.treeLabel')}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('landing.treeTitle')}</h2>
            <p className="mt-4 text-[#8f8672]">{t('landing.treeBody')}</p>
          </div>
          <TreeArt />
        </section>

        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-[32px] border border-[#d4af37]/30 bg-[linear-gradient(120deg,#1f1405,#050505_60%)] p-10 md:p-14">
            <NetworkArt className="anim-drift absolute -right-10 top-0 h-full w-[60%] opacity-40" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('landing.ctaTitle1')} <span className="gold-text">{t('landing.ctaTitle2')}</span></h2>
              <p className="mt-4 text-[#bdb4a0]">{t('landing.ctaBody')}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?mode=register" className="btn btn-brand px-7 py-3.5">{t('common.createFreeAccount')}</Link>
                <Link href="/login" className="btn btn-ghost px-7 py-3.5">{t('landing.signIn')}</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-7 text-xs leading-relaxed text-[#8f8672]">
            <strong className="text-[#cfc6b0]">{t('landing.importantLead')}</strong> {t('landing.disclaimer')} <Link href="/compliance" className="text-[#f7e09a]">{t('landing.disclaimerLink')}</Link>{t('landing.disclaimerEnd')}
          </div>
        </section>
      </div>
    </>
  );
}
