// Money helpers. All amounts are BigInt minor units. Storage is always 2-decimal minor units.
// Transaction currencies (CURRENCIES) can be paid, withdrawn, converted and used in ledgers.
// Display-only currencies (DISPLAY_ONLY_CURRENCIES) appear only as approximate prices; they never
// move money. JPY has no minor unit in practice, so it is stored x100 like the others and shown with 0 decimals.

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'MYR', 'SAR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DISPLAY_ONLY_CURRENCIES = ['JPY'] as const;
export type DisplayCurrency = Currency | (typeof DISPLAY_ONLY_CURRENCIES)[number];
export const ALL_DISPLAY_CURRENCIES: readonly DisplayCurrency[] = [...CURRENCIES, ...DISPLAY_ONLY_CURRENCIES];

export const BASE_CURRENCY: Currency = 'INR';
export const RATE_SCALE = 100_000_000n; // 1e8 - FX rates are stored scaled by this

export const CURRENCY_META: Record<DisplayCurrency, { name: string; symbol: string; locale: string; digits: number }> = {
  INR: { name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', digits: 2 },
  USD: { name: 'US Dollar', symbol: '$', locale: 'en-US', digits: 2 },
  EUR: { name: 'Euro', symbol: '€', locale: 'de-DE', digits: 2 },
  GBP: { name: 'Pound Sterling', symbol: '£', locale: 'en-GB', digits: 2 },
  AED: { name: 'UAE Dirham', symbol: 'AED ', locale: 'en-AE', digits: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG', digits: 2 },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM ', locale: 'en-MY', digits: 2 },
  SAR: { name: 'Saudi Riyal', symbol: 'SAR ', locale: 'en-SA', digits: 2 },
  JPY: { name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', digits: 0 },
};

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return (ALL_DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

/** Basis points: 10000 bps = 100%. Always floors so the platform never over-pays. */
export function applyBps(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('Invalid basis points');
  return (amount * BigInt(bps)) / 10_000n;
}

/**
 * Converts `amount` (minor units of `from`) to minor units of `to` using INR-based rates.
 * Integer math with floor rounding. Used for backend calculations, so keep it exact.
 */
export function convertMinor(
  amount: bigint,
  from: DisplayCurrency,
  to: DisplayCurrency,
  rates: Partial<Record<DisplayCurrency, bigint>>,
): bigint {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) throw new Error(`Missing FX rate for ${!fromRate ? from : to}`);
  const inr = (amount * fromRate) / RATE_SCALE; // INR minor
  return (inr * RATE_SCALE) / toRate;
}

export function assertPositive(amount: bigint, label = 'amount'): void {
  if (typeof amount !== 'bigint') throw new Error(`${label} must be a bigint`);
  if (amount <= 0n) throw new Error(`${label} must be positive`);
}

/**
 * Formats a minor-unit amount for display. `locale` controls separators and symbol placement
 * (for example 1.234,56 € in German). Falls back to the currency's own locale when none is given.
 */
export function formatMoney(minor: bigint, currency: DisplayCurrency, locale?: string): string {
  const meta = CURRENCY_META[currency];
  const whole = Number(minor) / 100;
  try {
    return new Intl.NumberFormat(locale ?? meta.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: meta.digits,
      maximumFractionDigits: meta.digits,
    }).format(whole);
  } catch {
    return `${meta.symbol}${whole.toFixed(meta.digits)}`;
  }
}

/** Parses a decimal string such as "1234.5" into minor units. Rejects more than 2 decimals. */
export function parseMinor(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error('Invalid amount');
  const [whole, frac = ''] = trimmed.split('.');
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
}
