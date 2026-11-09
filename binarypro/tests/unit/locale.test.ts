import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, directionFor, numberLocale } from '@/lib/i18n/locales';
import { MESSAGES, format, messagesFor } from '@/lib/i18n/messages';
import { en } from '@/lib/i18n/messages/en';
import { applyConfig, DEFAULT_LOCALE_CONFIG, LocaleConfigSchema, type LocaleConfig } from '@/lib/server/locale';
import { parseProviderRates } from '@/lib/server/fx-provider';
import { RATE_SCALE } from '@/lib/domain/money';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('translation completeness', () => {
  it('every language defines exactly the English keys', () => {
    const enKeys = Object.keys(en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(MESSAGES[locale]).sort(), locale).toEqual(enKeys);
    }
  });

  it('no translation is empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(MESSAGES[locale])) {
        expect(value.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('placeholders match the English text in every language', () => {
    for (const locale of LOCALES) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(MESSAGES[locale][key]), `${locale} ${key}`).toBe(placeholders(en[key]));
      }
    }
  });

  it('Arabic is right-to-left and the rest are left-to-right', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
    expect(directionFor('ja')).toBe('ltr');
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('Arabic amounts use Latin digits', () => {
    expect(numberLocale('ar', 'SAR')).toBe('ar-u-nu-latn');
  });
});

describe('translator and overrides', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(format('Hello {name}, {amount} due {x}', { name: 'Asha', amount: '₹10' })).toBe('Hello Asha, ₹10 due {x}');
  });

  it('applies non-empty overrides only', () => {
    const merged = messagesFor('de', { de: { 'common.save': 'Sichern', 'common.cancel': '   ' } });
    expect(merged['common.save']).toBe('Sichern');
    expect(merged['common.cancel']).toBe(MESSAGES.de['common.cancel']);
  });
});

describe('admin configuration', () => {
  const base: LocaleConfig = DEFAULT_LOCALE_CONFIG;

  it('accepts the default configuration', () => {
    expect(LocaleConfigSchema.safeParse(base).success).toBe(true);
  });

  it('requires English and INR to stay enabled', () => {
    expect(LocaleConfigSchema.safeParse({ ...base, enabledLanguages: ['ar'] }).success).toBe(false);
    expect(LocaleConfigSchema.safeParse({ ...base, enabledCurrencies: ['USD'] }).success).toBe(false);
  });

  it('requires the default country to be enabled', () => {
    expect(LocaleConfigSchema.safeParse({ ...base, enabledCountries: ['US'], defaultCountry: 'IN' }).success).toBe(false);
  });

  it('a disabled country falls back to the default country', () => {
    const cfg = { ...base, enabledCountries: ['IN', 'US'] };
    const p = applyConfig({ country: 'DE', language: 'de', currency: 'EUR', source: 'DETECTED' }, cfg);
    expect(p.country).toBe('IN');
    expect(p.currency).toBe('INR');
  });

  it('a disabled language falls back to the country default, then English', () => {
    const cfg = { ...base, enabledLanguages: ['en', 'ar'] as LocaleConfig['enabledLanguages'] };
    expect(applyConfig({ country: 'JP', language: 'ja', currency: 'JPY', source: 'DETECTED' }, cfg).language).toBe('en');
    expect(applyConfig({ country: 'SA', language: 'ar', currency: 'SAR', source: 'DETECTED' }, cfg).language).toBe('ar');
  });

  it('a disabled currency falls back to the country currency when enabled', () => {
    const cfg = { ...base, enabledCurrencies: ['INR', 'USD'] as LocaleConfig['enabledCurrencies'] };
    expect(applyConfig({ country: 'US', language: 'en', currency: 'JPY', source: 'MANUAL' }, cfg).currency).toBe('USD');
  });
});

describe('rate provider parsing', () => {
  const good = {
    result: 'success',
    base_code: 'INR',
    rates: { USD: 1 / 83.5, EUR: 1 / 90.2, GBP: 1 / 105.8, AED: 1 / 22.7, SGD: 1 / 62.1, MYR: 1 / 17.8, SAR: 1 / 22.3, JPY: 1 / 0.55 },
  };

  it('converts units-per-INR into INR-per-unit, scaled by 1e8', () => {
    const rates = parseProviderRates(good);
    expect(Number(rates.USD) / Number(RATE_SCALE)).toBeCloseTo(83.5, 4);
    expect(Number(rates.JPY) / Number(RATE_SCALE)).toBeCloseTo(0.55, 4);
  });

  it('rejects a response for another base currency', () => {
    expect(() => parseProviderRates({ ...good, base_code: 'USD' })).toThrow();
  });

  it('rejects a missing transaction currency', () => {
    const rates = { ...good.rates } as Record<string, number>;
    delete rates.EUR;
    expect(() => parseProviderRates({ ...good, rates })).toThrow();
  });

  it('accepts a missing display-only currency', () => {
    const rates = { ...good.rates } as Record<string, number>;
    delete rates.JPY;
    expect(parseProviderRates({ ...good, rates }).JPY).toBeUndefined();
  });

  it('rejects an implausible rate', () => {
    expect(() => parseProviderRates({ ...good, rates: { ...good.rates, USD: 1e9 } })).toThrow();
  });
});
