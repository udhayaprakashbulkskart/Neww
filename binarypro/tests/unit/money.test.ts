import { describe, expect, it } from 'vitest';
import { applyBps, convertMinor, formatMoney, parseMinor, RATE_SCALE, type Currency } from '@/lib/domain/money';

const rates = {
  INR: RATE_SCALE,
  USD: 8350000000n, // 83.50 INR per USD
  EUR: 9020000000n,
  GBP: 10580000000n,
  AED: 2270000000n,
  SGD: 6210000000n,
  MYR: 1780000000n,
  SAR: 2230000000n,
} as Record<Currency, bigint>;

describe('money', () => {
  it('applies basis points with floor rounding', () => {
    expect(applyBps(10_000n, 1000)).toBe(1000n);
    expect(applyBps(9_999n, 1000)).toBe(999n); // floors, never over-pays
    expect(applyBps(100n, 0)).toBe(0n);
  });

  it('rejects invalid basis points', () => {
    expect(() => applyBps(100n, 10_001)).toThrow();
    expect(() => applyBps(100n, -1)).toThrow();
    expect(() => applyBps(100n, 1.5)).toThrow();
  });

  it('converts between currencies through INR', () => {
    // 100.00 USD -> INR: 100 * 83.5 = 8350.00 INR = 835000 paise
    expect(convertMinor(10_000n, 'USD', 'INR', rates)).toBe(835_000n);
    // identity conversion
    expect(convertMinor(12_345n, 'EUR', 'EUR', rates)).toBe(12_345n);
    // round trip loses at most a paisa
    const inr = convertMinor(10_000n, 'USD', 'INR', rates);
    const back = convertMinor(inr, 'INR', 'USD', rates);
    expect(back).toBeGreaterThanOrEqual(9_999n);
    expect(back).toBeLessThanOrEqual(10_000n);
  });

  it('parses decimal strings into minor units', () => {
    expect(parseMinor('12.5')).toBe(1250n);
    expect(parseMinor('0.01')).toBe(1n);
    expect(parseMinor('100')).toBe(10000n);
    expect(() => parseMinor('1.234')).toThrow();
    expect(() => parseMinor('-1')).toThrow();
    expect(() => parseMinor('abc')).toThrow();
  });

  it('formats money for display', () => {
    expect(formatMoney(12345n, 'INR')).toContain('123.45');
    expect(formatMoney(100n, 'USD')).toContain('1.00');
  });
});
