import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { dayKey } from '@/lib/server/time';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { AdWatch } from '@/components/client';
import { Section, Notice, Money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Ads() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const today = dayKey(new Date());
  const [campaigns, watched] = await Promise.all([
    db.adCampaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.adView.findMany({ where: { userId: user.id, dayKey: today, completedAt: { not: null } }, select: { campaignId: true } }),
  ]);
  const done = new Set(watched.map((w) => w.campaignId));
  const tier = (user.membership?.tier ?? 'BASIC') as Tier;
  const limit = PLANS[tier].adViewsPerDay;

  return (
    <div className="space-y-6">
      <Section title="Earn with advertising" subtitle={`Watch approved sponsored videos in full. Your plan allows ${limit} completed videos per day, one per campaign.`}>
        {campaigns.length === 0 ? (
          <Notice>No campaigns are live right now. Check back soon.</Notice>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((c) => (
              <div key={c.id} className="panel space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[#a39a86]">{c.advertiser}</div>
                    <div className="text-lg font-bold">{c.title}</div>
                  </div>
                  <div className="text-right"><div className="label">Reward</div><Money minor={c.rewardMinor} currency={c.currency} /></div>
                </div>
                <div className="text-xs text-[#a39a86]">{c.durationSec}s video</div>
                {done.has(c.id) ? (
                  <Notice>Completed today. Come back tomorrow.</Notice>
                ) : (
                  <AdWatch campaignId={c.id} durationSec={c.durationSec} title={c.title} videoUrl={c.videoUrl} />
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
      <Notice>Rewards are paid only from advertiser budgets. You must watch at least 95% of a video; skipping pays nothing.</Notice>
    </div>
  );
}
