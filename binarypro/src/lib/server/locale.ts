// Server side of the locale and currency system: admin configuration, translation overrides, and the
// effective preferences for the current request. Reads only; writes go through the API routes.
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ALL_DISPLAY_CURRENCIES, BASE_CURRENCY, type DisplayCurrency } from '@/lib/domain/money';
import { DEFAULT_LOCALE, LOCALES, directionFor, type Locale } from '@/lib/i18n/locales';
import { messagesFor, type Overrides, type Messages, type MessageKey, translatorFor, type Translator } from '@/lib/i18n/messages';
import { DEFAULT_COUNTRY, REGIONS, languageForCountry, currencyForCountry, normalizeCountry, normalizeDisplayCurrency, normalizeLanguage, resolvePrefs, type RegionPrefs } from '@/lib/domain/region';
import { db } from './db';
import { currentUser } from './auth';

export const LOCALE_CONFIG_KEY = 'locale.config';
export const DEFAULT_FX_PROVIDER_URL = 'https://open.er-api.com/v6/latest/INR';

export interface LocaleConfig {
  enabledCountries: string[];
  enabledLanguages: Locale[];
  enabledCurrencies: DisplayCurrency[];
  defaultCountry: string;
  /** Rate provider URL. May contain {key}, which is replaced by the FX_API_KEY environment variable. */
  fxProviderUrl: string;
}

export const DEFAULT_LOCALE_CONFIG: LocaleConfig = {
  enabledCountries: Object.keys(REGIONS),
  enabledLanguages: [...LOCALES],
  enabledCurrencies: [...ALL_DISPLAY_CURRENCIES],
  defaultCountry: DEFAULT_COUNTRY,
  fxProviderUrl: DEFAULT_FX_PROVIDER_URL,
};

export const LocaleConfigSchema = z.object({
  enabledCountries: z.array(z.string().refine((c) => !!REGIONS[c], 'Unknown country')).min(1),
  enabledLanguages: z.array(z.enum(LOCALES)).min(1),
  enabledCurrencies: z.array(z.enum(ALL_DISPLAY_CURRENCIES as unknown as [DisplayCurrency, ...DisplayCurrency[]])).min(1),
  defaultCountry: z.string(),
  fxProviderUrl: z.string().url().max(500),
}).superRefine((c, ctx) => {
  if (!c.enabledCountries.includes(c.defaultCountry)) ctx.addIssue({ code: 'custom', path: ['defaultCountry'], message: 'Default country must be enabled' });
  if (!c.enabledLanguages.includes(DEFAULT_LOCALE)) ctx.addIssue({ code: 'custom', path: ['enabledLanguages'], message: 'English must stay enabled as the fallback language' });
  if (!c.enabledCurrencies.includes(BASE_CURRENCY)) ctx.addIssue({ code: 'custom', path: ['enabledCurrencies'], message: 'INR must stay enabled: it is the payment currency' });
});

const TTL_MS = 30_000;
let configCache: { at: number; value: LocaleConfig } | null = null;
let overrideCache: { at: number; value: Overrides } | null = null;

/** Clears the cached config and overrides after an admin change. */
export function invalidateLocaleCache() {
  configCache = null;
  overrideCache = null;
}

export async function getLocaleConfig(): Promise<LocaleConfig> {
  if (configCache && Date.now() - configCache.at < TTL_MS) return configCache.value;
  let value = DEFAULT_LOCALE_CONFIG;
  try {
    const row = await db.platformSetting.findUnique({ where: { key: LOCALE_CONFIG_KEY } });
    if (row) {
      const parsed = LocaleConfigSchema.safeParse(row.value);
      if (parsed.success) value = parsed.data as LocaleConfig;
    }
  } catch {
    // Database unavailable: fall back to the shipped defaults rather than failing the page.
  }
  configCache = { at: Date.now(), value };
  return value;
}

export async function getOverrides(): Promise<Overrides> {
  if (overrideCache && Date.now() - overrideCache.at < TTL_MS) return overrideCache.value;
  const out: Overrides = {};
  try {
    const rows = await db.translationOverride.findMany();
    for (const r of rows) {
      if (!(LOCALES as readonly string[]).includes(r.locale)) continue;
      const bucket = (out[r.locale as Locale] ??= {});
      bucket[r.key as MessageKey] = r.value;
    }
  } catch {
    // Keep shipped text if overrides cannot be read.
  }
  overrideCache = { at: Date.now(), value: out };
  return out;
}

function parseManual(raw: string | undefined): { country?: string; language?: string; currency?: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      country: typeof v.country === 'string' ? v.country : undefined,
      language: typeof v.language === 'string' ? v.language : undefined,
      currency: typeof v.currency === 'string' ? v.currency : undefined,
    };
  } catch {
    return null;
  }
}

/** Applies admin switches: disabled countries, languages and currencies fall back to safe defaults. */
export function applyConfig(prefs: RegionPrefs, config: LocaleConfig): RegionPrefs {
  // A disabled country takes its language and currency with it: the fallback uses the default country's.
  const countryOk = config.enabledCountries.includes(prefs.country);
  const country = countryOk ? prefs.country : config.defaultCountry;
  const countryLanguage = languageForCountry(country);
  const countryCurrency = currencyForCountry(country);
  const wantLanguage = countryOk ? prefs.language : countryLanguage;
  const wantCurrency = countryOk ? prefs.currency : countryCurrency;
  const language = [wantLanguage, countryLanguage, DEFAULT_LOCALE].find((l) => config.enabledLanguages.includes(l)) ?? DEFAULT_LOCALE;
  const currency = [wantCurrency, countryCurrency, BASE_CURRENCY].find((c) => config.enabledCurrencies.includes(c)) ?? BASE_CURRENCY;
  return { ...prefs, country, language, currency };
}

export interface RequestRegion {
  prefs: RegionPrefs;
  locale: Locale;
  dir: 'ltr' | 'rtl';
  messages: Messages;
  t: Translator;
  config: LocaleConfig;
  detectedCountry: string;
  signedIn: boolean;
}

/** Effective locale, currency and dictionary for this request. */
export async function getRequestRegion(): Promise<RequestRegion> {
  const jar = cookies();
  const detected = normalizeCountry(jar.get('bp_geo')?.value) ?? DEFAULT_COUNTRY;
  const manual = parseManual(jar.get('bp_pref')?.value);
  const user = await currentUser().catch(() => null);
  const [config, overrides] = await Promise.all([getLocaleConfig(), getOverrides()]);
  const raw = resolvePrefs({
    account: user
      ? { country: user.country, language: user.language, currency: user.displayCurrency, regionChosen: user.regionChosen }
      : null,
    manual,
    detectedCountry: detected,
  });
  const prefs = applyConfig(raw, config);
  const messages = messagesFor(prefs.language, overrides);
  return {
    prefs,
    locale: prefs.language,
    dir: directionFor(prefs.language),
    messages,
    t: translatorFor(messages),
    config,
    detectedCountry: detected,
    signedIn: !!user,
  };
}

/** Server components: the translator for this request. */
export async function getServerT(): Promise<Translator> {
  return (await getRequestRegion()).t;
}

export { normalizeLanguage, normalizeDisplayCurrency, normalizeCountry };
