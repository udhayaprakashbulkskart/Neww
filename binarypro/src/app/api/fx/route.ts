// Public FX rates for showing approximate local-currency prices. Read-only, no account needed.
import { NextResponse } from 'next/server';
import { CURRENCIES } from '@/lib/domain/money';
import { loadRates } from '@/lib/server/rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rates = await loadRates();
    // Rates are strings because they are BigInt values scaled by 1e8 (INR minor per unit).
    const out = Object.fromEntries(CURRENCIES.map((c) => [c, rates[c].toString()]));
    return NextResponse.json({ rates: out }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    // Without rates the page simply shows INR only.
    return NextResponse.json({ rates: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
