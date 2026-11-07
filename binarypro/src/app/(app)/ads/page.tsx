import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { dayKey } from '@/lib/server/time';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { AdWatch } from '@/components/client';
import { Notice, Money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Ads() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const today = dayKey(new Date());
  const [campaigns, watched, viewsToday] = await Promise.all([
    db.adCampaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.adView.findMany({ where: { userId: user.id, dayKey: today, completedAt: { not: null } }, select: { campaignId: true } }),
    db.adView.count({ where: { userId: user.id, dayKey: today, completedAt: { not: null } } }),
  ]);
  const done = new Set(watched.map((w) => w.campaignId));
  const tier = (user.membership?.tier ?? 'BASIC') as Tier;
  const limit = PLANS[tier].adViewsPerDay;
  const pct = Math.min(100, Math.round((viewsToday / limit) * 100));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Watch &amp; earn</h1>
          <p className="mt-1 text-sm text-[#8f8672]">Advertiser-funded videos. Watch each one in full to claim its reward.</p>
        </div>
        <div className="w-full max-w-xs rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <div className="flex justify-between text-xs text-[#8f8672]"><span>Today</span><span>{viewsToday} / {limit}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1a1408]"><div className="h-full bg-[linear-gradient(90deg,#ff6a00,#d4af37)]" style={{ width: `${pct}%` }} /></div>
        </div>
      </header>

      {campaigns.length === 0 ? (
        <Notice>No campaigns are live right now. Check back soon.</Notice>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {campaigns.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03]">
              <div className="relative flex h-44 items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#ff8c33,transparent_55%),linear-gradient(135deg,#1a1408,#000)]">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black shadow-[0_0_40px_rgba(255,106,0,.5)]">
                  <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#f7e09a]">{c.durationSec}s</span>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#8f8672]">{c.advertiser}</div>
                    <div className="text-lg font-bold">{c.title}</div>
                  </div>
                  <div className="text-right"><div className="text-[11px] uppercase tracking-widest text-[#8f8672]">Reward</div><Money minor={c.rewardMinor} currency={c.currency} /></div>
                </div>
                {done.has(c.id) ? (
                  <Notice>Completed today. Come back tomorrow for the next video.</Notice>
                ) : (
                  <AdWatch campaignId={c.id} durationSec={c.durationSec} title={c.title} videoUrl={c.videoUrl} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Notice>Rewards are paid only from advertiser budgets. You must watch at least 95% of a video. Skipping pays nothing.</Notice>
    </div>
  );
}
