import { db } from '../db';

export type FeedItem = {
  id: string;
  city: string;
  amountPaise: number;
  campaignTitle: string;
  campaignSlug: string;
  at: string;
};

/**
 * Latest successful donations, shown publicly. Only the donor's city is returned, never a name,
 * phone, email or street address. Anonymous donations are shown the same way.
 */
export async function recentDonationFeed(limit = 12): Promise<FeedItem[]> {
  const rows = await db.donation.findMany({
    where: { status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      amountPaise: true,
      createdAt: true,
      campaign: { select: { title: true, slug: true } },
      donor: { select: { profile: { select: { city: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    city: r.donor.profile?.city?.trim() || 'India',
    amountPaise: r.amountPaise,
    campaignTitle: r.campaign.title,
    campaignSlug: r.campaign.slug,
    at: r.createdAt.toISOString(),
  }));
}
