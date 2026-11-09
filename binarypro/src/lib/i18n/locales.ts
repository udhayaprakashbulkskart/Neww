// Supported page languages. Adding a language means adding its dictionary in messages/ (the type
// checker then requires every key), and listing it here.
export const LOCALES = ['en', 'ar', 'de', 'fr', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  de: 'Deutsch',
  fr: 'Français',
  ja: '日本語',
};

export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function directionFor(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

const EN_NUMBER_LOCALE: Record<string, string> = {
  INR: 'en-IN', USD: 'en-US', GBP: 'en-GB', EUR: 'en-IE', AED: 'en-AE', SGD: 'en-SG', MYR: 'en-MY', SAR: 'en-SA', JPY: 'en-JP',
};

/** Number and currency formatting locale for a page language and currency (Latin digits for Arabic). */
export function numberLocale(locale: Locale, currency: string): string {
  switch (locale) {
    case 'ar': return 'ar-u-nu-latn';
    case 'de': return 'de-DE';
    case 'fr': return 'fr-FR';
    case 'ja': return 'ja-JP';
    default: return EN_NUMBER_LOCALE[currency] ?? 'en-US';
  }
}
