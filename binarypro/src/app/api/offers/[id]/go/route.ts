import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { canOpenOffer } from '@/lib/domain/offers';
import { isMembershipActive } from '@/lib/server/membership';
import type { Tier } from '@/lib/domain/plans';
import { handle } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Records the click for the member, then sends them to the partner. Plan and expiry are checked here. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return handle(async () => {
    const offer = await db.partnerOffer.findUnique({ where: { id: params.id } });
    const now = new Date();
    const tier = (user.membership?.tier ?? 'BASIC') as Tier;
    const eligible = offer && offer.active && offer.validUntil > now && isMembershipActive(user.membership, now) && canOpenOffer(tier, offer.minTier as Tier);
    if (!offer || !eligible) return NextResponse.redirect(new URL('/offers?locked=1', req.url), 303);
    await db.partnerClick.create({ data: { userId: user.id, offerId: offer.id } });
    return NextResponse.redirect(offer.offerUrl, 302);
  });
}
