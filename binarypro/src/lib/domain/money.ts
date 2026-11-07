// Money helpers. All amounts are BigInt minor units. Every supported currency has 2 decimal places.

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'MYR', 'SAR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BASE_CURRENCY: Currency = 'INR';
export const RATE_SCALE = 100_000_000n; // 1e8 - FX rates are stored scaled by this

export const CURRENCY_META: Record<Currency, { name: string; symbol: string; locale: string }> = {
  INR: { name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  USD: { name: 'US Dollar', symbol: '$', locale: 'en-US' },
  EUR: { name: 'Euro', symbol: '€', locale: 'de-DE' },
  GBP: { name: 'Pound Sterling', symbol: '£', locale: 'en-GB' },
  AED: { name: 'UAE Dirham', symbol: 'AED ', locale: 'en-AE' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM ', locale: 'en-MY' },
  SAR: { name: 'Saudi Riyal', symbol: 'SAR ', locale: 'en-SA' },
};

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** Basis points: 10000 bps = 100%. Always floors so the platform never over-pays. */
export function applyBps(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('Invalid basis points');
  return (amount * BigInt(bps)) / 10_000n;
}

/** Converts `amount` (minor units of `from`) to minor units of `to` using INR-based rates. */
export function convertMinor(
  amount: bigint,
  from: Currency,
  to: Currency,
  rates: Record<Currency, bigint>,
): bigint {
  if (from === to) return amount;
  const inr = (amount * rates[from]) / RATE_SCALE; // INR minor
  return (inr * RATE_SCALE) / rates[to];
}

export function assertPositive(amount: bigint, label = 'amount'): void {
  if (typeof amount !== 'bigint') throw new Error(`${label} must be a bigint`);
  if (amount <= 0n) throw new Error(`${label} must be positive`);
}

export function formatMoney(minor: bigint, currency: Currency): string {
  const meta = CURRENCY_META[currency];
  const whole = Number(minor) / 100;
  try {
    return new Intl.NumberFormat(meta.locale, { style: 'currency', currency }).format(whole);
  } catch {
    return `${meta.symbol}${whole.toFixed(2)}`;
  }
}

/** Parses a decimal string such as "1234.5" into minor units. Rejects more than 2 decimals. */
export function parseMinor(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error('Invalid amount');
  const [whole, frac = ''] = trimmed.split('.');
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
}
