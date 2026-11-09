import { describe, expect, it } from 'vitest';
import { convertMinor, formatMoney, RATE_SCALE, ALL_DISPLAY_CURRENCIES, type DisplayCurrency } from '@/lib/domain/money';
import { currencyForCountry, normalizeCountry, REGIONS, resolvePrefs, languageForCountry } from '@/lib/domain/region';

describe('region rules', () => {
  it('maps countries to currencies and falls back to INR', () => {
    expect(currencyForCountry('US')).toBe('USD');
    expect(currencyForCountry('de')).toBe('EUR');
    expect(currencyForCountry('JP')).toBe('JPY');
    expect(currencyForCountry('IN')).toBe('INR');
    expect(currencyForCountry('ZZ')).toBe('INR');
    expect(currencyForCountry(null)).toBe('INR');
  });

  it('gives the required default languages for the launch countries', () => {
    expect(languageForCountry('IN')).toBe('en');
    expect(languageForCountry('US')).toBe('en');
    expect(languageForCountry('GB')).toBe('en');
    expect(languageForCountry('AE')).toBe('ar');
    expect(languageForCountry('SA')).toBe('ar');
    expect(languageForCountry('DE')).toBe('de');
    expect(languageForCountry('FR')).toBe('fr');
    expect(languageForCountry('JP')).toBe('ja');
  });

  it('accepts only supported two-letter codes', () => {
    expect(normalizeCountry(' us ')).toBe('US');
    expect(normalizeCountry('USA')).toBeNull();
    expect(normalizeCountry('XX')).toBeNull();
    expect(normalizeCountry('')).toBeNull();
  });

  it('every region currency is a display currency', () => {
    for (const r of Object.values(REGIONS)) {
      expect(ALL_DISPLAY_CURRENCIES).toContain(r.currency);
    }
  });

  it('converts INR paise to USD cents at the stored rate (83.5 INR per USD)', () => {
    const rates = { INR: RATE_SCALE, USD: 8_350_000_000n } as Record<DisplayCurrency, bigint>;
    expect(convertMinor(8350n, 'INR', 'USD', rates)).toBe(100n);
  });
});

describe('preference priority', () => {
  const detected = 'US';

  it('uses detection when nothing is chosen', () => {
    const p = resolvePrefs({ detectedCountry: detected });
    expect(p).toMatchObject({ country: 'US', currency: 'USD', language: 'en', source: 'DETECTED' });
  });

  it('a manual choice on this device beats detection', () => {
    const p = resolvePrefs({ detectedCountry: detected, manual: { country: 'DE', language: 'de', currency: 'EUR' } });
    expect(p).toMatchObject({ country: 'DE', currency: 'EUR', language: 'de', source: 'MANUAL' });
  });

  it('a saved account choice beats the device choice and detection', () => {
    const p = resolvePrefs({
      detectedCountry: detected,
      manual: { country: 'DE', language: 'de', currency: 'EUR' },
      account: { country: 'JP', language: 'ja', currency: 'JPY', regionChosen: true },
    });
    expect(p).toMatchObject({ country: 'JP', currency: 'JPY', language: 'ja', source: 'ACCOUNT' });
  });

  it('an account without a saved choice does not override detection', () => {
    const p = resolvePrefs({ detectedCountry: detected, account: { country: 'IN', language: 'en', currency: 'INR', regionChosen: false } });
    expect(p.source).toBe('DETECTED');
    expect(p.country).toBe('US');
  });

  it('falls back to India and English with no information', () => {
    expect(resolvePrefs({})).toMatchObject({ country: 'IN', currency: 'INR', language: 'en', source: 'DEFAULT' });
  });
});

describe('money display', () => {
  it('shows yen with no decimals and keeps the amount exact in storage', () => {
    expect(formatMoney(12_345n, 'JPY', 'ja-JP')).toMatch(/12/);
    expect(formatMoney(12_345n, 'JPY', 'ja-JP')).not.toMatch(/\.\d/);
  });

  it('formats Indian rupees with lakh grouping when asked', () => {
    expect(formatMoney(123_456_789n, 'INR', 'en-IN')).toBe('₹12,34,567.89');
  });

  it('uses Latin digits for Arabic when requested', () => {
    expect(formatMoney(123_456n, 'SAR', 'ar-u-nu-latn')).toMatch(/1,234\.56/);
  });
});
