// Region rules: which currency and locale a visitor sees. Display only. Payments, the ledger,
// wallets and withdrawals always stay in INR (BASE_CURRENCY).
import { BASE_CURRENCY, isCurrency, type Currency } from './money';

export interface Region {
  name: string;
  currency: Currency;
  /** Locale tag used for the page language. Page text is English for now. */
  lang: string;
}

export const DEFAULT_COUNTRY = 'IN';

export const REGIONS: Record<string, Region> = {
  IN: { name: 'India', currency: 'INR', lang: 'en-IN' },
  US: { name: 'United States', currency: 'USD', lang: 'en-US' },
  GB: { name: 'United Kingdom', currency: 'GBP', lang: 'en-GB' },
  DE: { name: 'Germany', currency: 'EUR', lang: 'de-DE' },
  FR: { name: 'France', currency: 'EUR', lang: 'fr-FR' },
  IT: { name: 'Italy', currency: 'EUR', lang: 'it-IT' },
  ES: { name: 'Spain', currency: 'EUR', lang: 'es-ES' },
  NL: { name: 'Netherlands', currency: 'EUR', lang: 'nl-NL' },
  IE: { name: 'Ireland', currency: 'EUR', lang: 'en-IE' },
  AE: { name: 'United Arab Emirates', currency: 'AED', lang: 'en-AE' },
  SA: { name: 'Saudi Arabia', currency: 'SAR', lang: 'en-SA' },
  SG: { name: 'Singapore', currency: 'SGD', lang: 'en-SG' },
  MY: { name: 'Malaysia', currency: 'MYR', lang: 'en-MY' },
};

/** Returns a supported two-letter country code, or null when the value is missing or unsupported. */
export function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && REGIONS[code] ? code : null;
}

/** Currency for a country. Unknown countries see INR, so nothing breaks. */
export function currencyForCountry(country: string | null | undefined): Currency {
  const code = normalizeCountry(country);
  return code ? REGIONS[code].currency : BASE_CURRENCY;
}

export function isBaseCurrency(currency: string): boolean {
  return isCurrency(currency) && currency === BASE_CURRENCY;
}
