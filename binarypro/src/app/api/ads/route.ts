import { db } from '@/lib/server/db';
import { handle, ok, requireUser } from '@/lib/server/http';
import { dayKey } from '@/lib/server/time';

export const runtime = 'nodejs';

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const today = dayKey(new Date());
    const campaigns = await db.adCampaign.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 50 });
    const done = await db.adView.findMany({
      where: { userId: user.id, dayKey: today, completedAt: { not: null } },
      select: { campaignId: true },
    });
    const doneSet = new Set(done.map((d) => d.campaignId));
    return ok({
      campaigns: campaigns.map((c) => ({
        id: c.id, title: c.title, advertiser: c.advertiser, durationSec: c.durationSec,
        rewardMinor: c.rewardMinor, currency: c.currency, watchedToday: doneSet.has(c.id),
      })),
    });
  });
}
