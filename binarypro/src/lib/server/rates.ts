// FX rates. Rates are INR minor units per whole unit of currency, scaled by 1e8.
// Rates are required in production (set by the finance team via the admin API); development seeds defaults.
import { CURRENCIES, RATE_SCALE, type Currency } from '@/lib/domain/money';
import { db, type Tx } from './db';
import { DomainError } from './errors';

export const DEV_DEFAULT_RATES_INR: Record<Exclude<Currency, 'INR'>, number> = {
  USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 62.1, MYR: 17.8, SAR: 22.3,
};

export async function loadRates(tx: Tx | typeof db = db): Promise<Record<Currency, bigint>> {
  const rows = await tx.fxRate.findMany();
  const map = new Map(rows.map((r) => [r.currency as Currency, r.rateE8]));
  const out = {} as Record<Currency, bigint>;
  for (const c of CURRENCIES) {
    if (c === 'INR') {
      out[c] = RATE_SCALE;
      continue;
    }
    const rate = map.get(c);
    if (!rate) throw new DomainError('FX_RATE_MISSING', `No FX rate configured for ${c}`, 503);
    out[c] = rate;
  }
  return out;
}

/** Converts a decimal INR-per-unit value to the stored scaled integer. */
export function toRateE8(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) throw new DomainError('FX_INVALID', 'Rate must be a positive number', 400);
  return BigInt(Math.round(value * 1e8));
}
