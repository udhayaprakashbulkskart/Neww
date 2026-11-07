import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { dayKey } from '@/lib/server/time';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { formatMoney, type Currency } from '@/lib/domain/money';
import { AdWatch } from '@/components/client';
import { Notice } from '@/components/ui';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

const HOW = [
  { icon: 'play', t: 'Watch in full', b: 'Keep the video playing. Rewards need at least 95% of the running time.' },
  { icon: 'wallet', t: 'Paid by advertisers', b: 'Each reward comes from the advertiser’s funded budget. When the budget is spent, the campaign pauses.' },
  { icon: 'shield', t: 'One per campaign a day', b: 'You can earn each campaign once per day, up to your plan’s daily limit.' },
];

export default async function Ads() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const today = dayKey(new Date());
  const [campaigns, watched] = await Promise.all([
    db.adCampaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.adView.findMany({ where: { userId: user.id, dayKey: today, completedAt: { not: null } }, select: { campaignId: true, rewardMinor: true } }),
  ]);
  const done = new Set(watched.map((w) => w.campaignId));
  const earnedToday = watched.reduce((a, w) => a + w.rewardMinor, 0n);
  const tier = (user.membership?.tier ?? 'BASIC') as Tier;
  const limit = PLANS[tier].adViewsPerDay;
  const used = watched.length;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const sorted = [...campaigns].sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Watch &amp; earn</h1>
          <p className="mt-1 max-w-xl text-sm text-[#8f8672]">Sponsored videos from advertisers. Watch one in full to claim its reward.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-[360px]">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">Watched today</div>
            <div className="mt-2 text-xl font-extrabold">{used} <span className="text-sm font-medium text-[#8f8672]">of {limit}</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#8f8672]">Earned today</div>
            <div className="mt-2 text-xl font-extrabold">{formatMoney(earnedToday, 'INR')}</div>
            <div className="mt-1 text-xs text-[#8f8672]">{PLANS[tier].adViewsPerDay} videos a day on {tier}</div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {HOW.map((h, i) => (
          <div key={h.t} className="flex gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black"><Icon name={h.icon} className="h-5 w-5" /></span>
            <div>
              <div className="text-xs font-bold text-[#f7e09a]">0{i + 1}</div>
              <div className="font-semibold">{h.t}</div>
              <p className="mt-1 text-xs leading-relaxed text-[#8f8672]">{h.b}</p>
            </div>
          </div>
        ))}
      </section>

      {sorted.length === 0 ? (
        <Notice>No campaigns are live right now. Check back soon.</Notice>
      ) : (
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((c) => {
            const completed = done.has(c.id);
            return (
              <article key={c.id} className={`flex flex-col overflow-hidden rounded-3xl border transition ${completed ? 'border-white/5 bg-white/[0.02] opacity-70' : 'border-white/10 bg-[#0a0a0a] hover:border-[#d4af37]/40'}`}>
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#ff8c33,transparent_55%),linear-gradient(135deg,#1a1408,#000)]">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-black shadow-[0_0_40px_rgba(255,106,0,.45)]">
                    {completed
                      ? <Icon name="shield" className="h-6 w-6" />
                      : <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
                  </div>
                  <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-[#f7e09a]">{c.durationSec} sec</span>
                  <span className="absolute right-4 top-4 rounded-full bg-[#d4af37]/90 px-3 py-1 text-[11px] font-bold text-black">{formatMoney(c.rewardMinor, c.currency as Currency)}</span>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#8f8672]">{c.advertiser}</div>
                    <div className="mt-1 text-lg font-bold leading-snug">{c.title}</div>
                  </div>
                  <div className="mt-auto">
                    {completed ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        <span aria-hidden="true">✓</span> Reward claimed today. Come back tomorrow.
                      </div>
                    ) : (
                      <AdWatch campaignId={c.id} durationSec={c.durationSec} title={c.title} videoUrl={c.videoUrl} />
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <p className="text-xs text-[#6f6758]">Rewards are paid only from advertiser budgets. Skipping a video pays nothing. Your daily limit depends on your membership tier.</p>
    </div>
  );
}
