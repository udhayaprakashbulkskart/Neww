import { NextResponse } from 'next/server';
import { recentDonationFeed } from '@/lib/services/live-feed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await recentDonationFeed(12);
  return NextResponse.json({ ok: true, data: { items } }, { headers: { 'Cache-Control': 'no-store' } });
}
