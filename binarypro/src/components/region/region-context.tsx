'use client';

// Client side of the locale and currency system: translator, current preferences, approximate money
// display, and the preferences form. The server supplies the dictionary and the effective preferences.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { convertMinor, formatMoney, CURRENCY_META, BASE_CURRENCY, type DisplayCurrency } from '@/lib/domain/money';
import { REGIONS, currencyForCountry, languageForCountry, type RegionPrefs } from '@/lib/domain/region';
import { LOCALE_NAMES, numberLocale, type Locale } from '@/lib/i18n/locales';
import { format, type Messages, type MessageKey, type Translator } from '@/lib/i18n/messages';

export interface RegionClientConfig {
  enabledCountries: string[];
  enabledLanguages: Locale[];
  enabledCurrencies: DisplayCurrency[];
}

export interface RegionValue {
  prefs: RegionPrefs;
  locale: Locale;
  dir: 'ltr' | 'rtl';
  messages: Messages;
  detectedCountry: string;
  config: RegionClientConfig;
  signedIn: boolean;
}

type Rates = Partial<Record<DisplayCurrency, bigint>>;

interface RegionState extends RegionValue {
  t: Translator;
  rates: Rates | null;
  save: (next: { country?: string; language?: string; currency?: string }) => Promise<{ ok: true } | { ok: false; message: string }>;
  resetAuto: () => Promise<void>;
}

const RegionContext = createContext<RegionState | null>(null);

export function RegionProvider({ value, children }: { value: RegionValue; children: ReactNode }) {
  const router = useRouter();
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fx', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d: { rates: Record<string, string> | null }) => {
        if (cancelled || !d.rates) return;
        setRates(Object.fromEntries(Object.entries(d.rates).map(([k, v]) => [k, BigInt(v)])) as Rates);
      })
      .catch(() => { if (!cancelled) setRates(null); });
    return () => { cancelled = true; };
  }, []);

  const state = useMemo<RegionState>(() => {
    const t: Translator = (key: MessageKey, vars?: Record<string, string | number>) => format(value.messages[key], vars);
    return {
      ...value,
      t,
      rates,
      save: async (next) => {
        try {
          const res = await fetch('/api/prefs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
            credentials: 'same-origin',
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false as const, message: json?.error?.message ?? value.messages['common.networkError'] };
          router.refresh();
          return { ok: true as const };
        } catch {
          return { ok: false as const, message: value.messages['common.networkError'] };
        }
      },
      resetAuto: async () => {
        await fetch('/api/prefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true }),
          credentials: 'same-origin',
        }).catch(() => undefined);
        router.refresh();
      },
    };
  }, [value, rates, router]);

  return <RegionContext.Provider value={state}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error('useRegion must be used inside RegionProvider');
  return ctx;
}

export function useT(): Translator {
  return useRegion().t;
}

/**
 * Money in its original currency, with an approximate figure in the visitor's display currency.
 * The original amount is always shown first, so the amount that is charged or stored stays clear.
 */
export function MoneyView({ minor, currency, className }: { minor: string; currency: DisplayCurrency; className?: string }) {
  const { prefs, locale, rates, t } = useRegion();
  const amount = BigInt(minor);
  const numLocale = numberLocale(locale, currency);
  const original = formatMoney(amount, currency, numLocale);
  const display = prefs.currency;
  if (!rates || display === currency || !rates[display] || !rates[currency]) {
    return <span className={className ?? 'kpi'}>{original}</span>;
  }
  const local = convertMinor(amount, currency, display, rates);
  return (
    <span className={className ?? 'kpi'}>
      {original}
      <span className="mt-0.5 block text-xs font-medium text-[#8f8672]">
        {t('region.approx', { amount: formatMoney(local, display, numberLocale(locale, display)) })} · {t('region.approxNote')}
      </span>
    </span>
  );
}

/** Country, language and currency controls. Used on the account page and in the footer. */
export function PreferencesForm({ compact = false }: { compact?: boolean }) {
  const { prefs, config, t, save, resetAuto } = useRegion();
  const [country, setCountry] = useState(prefs.country);
  const [language, setLanguage] = useState<Locale>(prefs.language);
  const [currency, setCurrency] = useState<DisplayCurrency>(prefs.currency);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCountry(prefs.country);
    setLanguage(prefs.language);
    setCurrency(prefs.currency);
  }, [prefs.country, prefs.language, prefs.currency]);

  const field = 'mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-[#e8e0cc]';
  const label = 'block text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]';

  async function submit() {
    setBusy(true);
    setMsg(null);
    const r = await save({ country, language, currency });
    setBusy(false);
    setMsg(r.ok ? { kind: 'ok', text: t('account.prefsSaved') } : { kind: 'err', text: r.message });
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <label className="block">
        <span className={label}>{t('account.countryLabel')}</span>
        <select className={field} value={country} onChange={(e) => {
          const next = e.target.value;
          setCountry(next);
          // Choosing a country also moves the language and currency to that country's defaults.
          const local = currencyForCountry(next);
          setCurrency(config.enabledCurrencies.includes(local) ? local : BASE_CURRENCY);
          const lang = languageForCountry(next);
          if (config.enabledLanguages.includes(lang)) setLanguage(lang);
        }}>
          {config.enabledCountries.map((code) => (
            <option key={code} value={code}>{REGIONS[code]?.name ?? code}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t('account.languageLabel')}</span>
        <select className={field} value={language} onChange={(e) => setLanguage(e.target.value as Locale)}>
          {config.enabledLanguages.map((code) => (
            <option key={code} value={code}>{LOCALE_NAMES[code]}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t('account.currencyLabel')}</span>
        <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}>
          {config.enabledCurrencies.map((code) => (
            <option key={code} value={code}>{CURRENCY_META[code].name} ({code})</option>
          ))}
        </select>
      </label>
      {!compact && <p className="text-xs text-[#8f8672]">{t('account.currencyNote')}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-brand px-4 py-2.5 text-sm" disabled={busy} onClick={submit}>{t('common.save')}</button>
        <button type="button" className="btn btn-ghost px-4 py-2.5 text-sm" disabled={busy} onClick={async () => { setBusy(true); await resetAuto(); setBusy(false); }}>
          {t('account.resetAuto')}
        </button>
        {msg && <span role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
      {compact && <p className="text-xs text-[#6f6758]">{t('footer.estimatesNote', { currency: prefs.currency })}</p>}
    </div>
  );
}

