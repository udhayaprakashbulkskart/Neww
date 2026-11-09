// Public display rates (INR per unit, scaled by 1e8). Used only to show approximate prices.
import { NextResponse } from 'next/server';
import { displayRates } from '@/lib/server/fx-provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rates, stale, oldestAt } = await displayRates();
    const out = Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, v!.toString()]));
    return NextResponse.json(
      { rates: out, stale, updatedAt: oldestAt?.toISOString() ?? null },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json({ rates: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
