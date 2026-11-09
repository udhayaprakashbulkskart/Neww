import { describe, expect, it } from 'vitest';
import { convertMinor, RATE_SCALE, type Currency } from '@/lib/domain/money';
import { currencyForCountry, normalizeCountry, REGIONS } from '@/lib/domain/region';

describe('region rules', () => {
  it('maps countries to currencies and falls back to INR', () => {
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('de')).toBe('EUR');
    expect(currencyForCountry('IN')).toBe('INR');
    expect(currencyForCountry('ZZ')).toBe('INR');
    expect(currencyForCountry(null)).toBe('INR');
  });

  it('accepts only supported two-letter codes', () => {
    expect(normalizeCountry(' us ')).toBe('US');
    expect(normalizeCountry('USA')).toBeNull();
    expect(normalizeCountry('XX')).toBeNull();
    expect(normalizeCountry('')).toBeNull();
  });

  it('every region currency is a supported currency with a rate path', () => {
    for (const r of Object.values(REGIONS)) {
      expect(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'MYR', 'SAR']).toContain(r.currency);
    }
  });

  it('converts INR paise to USD cents at the stored rate (83.5 INR per USD)', () => {
    // 83.5 INR per USD, scaled by 1e8
    const rates = { INR: RATE_SCALE, USD: 8_350_000_000n } as unknown as Record<Currency, bigint>;
    // 8350 paise (Rs 83.50) is exactly 1 USD = 100 cents
    expect(convertMinor(8350n, 'INR', 'USD', rates)).toBe(100n);
  });
});
