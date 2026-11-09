// Region rules: a visitor's country gives the default language and currency. Display only.
// Payments, the ledger, wallets and withdrawals always stay in INR (BASE_CURRENCY).
import { BASE_CURRENCY, isDisplayCurrency, type DisplayCurrency } from './money';
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n/locales';

export interface Region {
  name: string;
  currency: DisplayCurrency;
  /** Default language when the visitor has not chosen one. Countries whose language is not shipped use English. */
  language: Locale;
}

export const DEFAULT_COUNTRY = 'IN';

export const REGIONS: Record<string, Region> = {
  IN: { name: 'India', currency: 'INR', language: 'en' },
  US: { name: 'United States', currency: 'USD', language: 'en' },
  GB: { name: 'United Kingdom', currency: 'GBP', language: 'en' },
  DE: { name: 'Germany', currency: 'EUR', language: 'de' },
  FR: { name: 'France', currency: 'EUR', language: 'fr' },
  IT: { name: 'Italy', currency: 'EUR', language: 'en' },
  ES: { name: 'Spain', currency: 'EUR', language: 'en' },
  NL: { name: 'Netherlands', currency: 'EUR', language: 'en' },
  IE: { name: 'Ireland', currency: 'EUR', language: 'en' },
  AE: { name: 'United Arab Emirates', currency: 'AED', language: 'ar' },
  SA: { name: 'Saudi Arabia', currency: 'SAR', language: 'ar' },
  SG: { name: 'Singapore', currency: 'SGD', language: 'en' },
  MY: { name: 'Malaysia', currency: 'MYR', language: 'en' },
  JP: { name: 'Japan', currency: 'JPY', language: 'ja' },
};

/** Returns a supported two-letter country code, or null when the value is missing or unsupported. */
export function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && REGIONS[code] ? code : null;
}

/** Currency for a country. Unknown countries see INR, so nothing breaks. */
export function currencyForCountry(country: string | null | undefined): DisplayCurrency {
  const code = normalizeCountry(country);
  return code ? REGIONS[code].currency : BASE_CURRENCY;
}

/** Default language for a country. Unknown countries get English. */
export function languageForCountry(country: string | null | undefined): Locale {
  const code = normalizeCountry(country);
  return code ? REGIONS[code].language : DEFAULT_LOCALE;
}

export function normalizeLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const code = value.trim().toLowerCase();
  return isLocale(code) ? code : null;
}

export interface RegionPrefs {
  country: string;
  language: Locale;
  currency: DisplayCurrency;
  /** Where the values came from: a saved account setting, a manual choice on this device, or automatic detection. */
  source: 'ACCOUNT' | 'MANUAL' | 'DETECTED' | 'DEFAULT';
}

/**
 * Resolves the effective preferences. Order: saved account choice, then manual choice on this device,
 * then the detected country, then the default. A manual choice is never overridden by detection.
 */
export function resolvePrefs(input: {
  account?: { country?: string | null; language?: string | null; currency?: string | null; regionChosen?: boolean } | null;
  manual?: { country?: string | null; language?: string | null; currency?: string | null } | null;
  detectedCountry?: string | null;
}): RegionPrefs {
  const detected = normalizeCountry(input.detectedCountry);
  const pick = (
    src: { country?: string | null; language?: string | null; currency?: string | null } | null | undefined,
  ) => {
    const country = normalizeCountry(src?.country);
    if (!country) return null;
    return {
      country,
      language: normalizeLanguage(src?.language) ?? languageForCountry(country),
      currency: normalizeDisplayCurrency(src?.currency) ?? currencyForCountry(country),
    };
  };
  const account = input.account?.regionChosen ? pick(input.account) : null;
  if (account) return { ...account, source: 'ACCOUNT' };
  const manual = pick(input.manual);
  if (manual) return { ...manual, source: 'MANUAL' };
  if (detected) return { country: detected, language: languageForCountry(detected), currency: currencyForCountry(detected), source: 'DETECTED' };
  return { country: DEFAULT_COUNTRY, language: DEFAULT_LOCALE, currency: BASE_CURRENCY, source: 'DEFAULT' };
}

export function normalizeDisplayCurrency(value: string | null | undefined): DisplayCurrency | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return isDisplayCurrency(code) ? code : null;
}
