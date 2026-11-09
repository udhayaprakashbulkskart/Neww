'use client';

// Admin controls for the locale system: enabled countries, languages and currencies, defaults,
// live rate refresh, and wording overrides for each language.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/lib/i18n/locales';
import { REGIONS } from '@/lib/domain/region';
import { ALL_DISPLAY_CURRENCIES, CURRENCY_META, type DisplayCurrency } from '@/lib/domain/money';
import { en } from '@/lib/i18n/messages/en';
import type { LocaleConfig } from '@/lib/server/locale';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

async function call<T>(url: string, method: 'POST' | 'PUT', body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json?.error?.message ?? `Request failed (${res.status})` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, message: 'Network error. Check your connection and try again.' };
  }
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function LocaleSettingsForm({ initial }: { initial: LocaleConfig }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<LocaleConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const toggle = <K extends 'enabledCountries' | 'enabledLanguages' | 'enabledCurrencies'>(key: K, value: string, on: boolean) => {
    setCfg((c) => {
      const list = c[key] as string[];
      const next = on ? [...new Set([...list, value])] : list.filter((x) => x !== value);
      return { ...c, [key]: next as LocaleConfig[K] };
    });
  };

  async function save() {
    setBusy(true); setMsg(null);
    const r = await call('/api/admin/locale', 'PUT', cfg);
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setMsg({ kind: 'ok', text: 'Saved. Visitors see the change on their next page load.' });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[#f7e09a]">Countries</legend>
          {Object.entries(REGIONS).map(([code, r]) => (
            <Check key={code} checked={cfg.enabledCountries.includes(code)} onChange={(v) => toggle('enabledCountries', code, v)} label={`${r.name} (${code})`} />
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[#f7e09a]">Languages</legend>
          {LOCALES.map((l) => (
            <Check key={l} checked={cfg.enabledLanguages.includes(l)} onChange={(v) => toggle('enabledLanguages', l, v)} label={`${LOCALE_NAMES[l]} (${l})`} />
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[#f7e09a]">Display currencies</legend>
          {ALL_DISPLAY_CURRENCIES.map((c: DisplayCurrency) => (
            <Check key={c} checked={cfg.enabledCurrencies.includes(c)} onChange={(v) => toggle('enabledCurrencies', c, v)} label={`${CURRENCY_META[c].name} (${c})`} />
          ))}
          <p className="text-xs text-[#8f8672]">INR is always on: it is the payment currency.</p>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="label">Default country (for unknown visitors)</span>
          <select className="input mt-2" value={cfg.defaultCountry} onChange={(e) => setCfg({ ...cfg, defaultCountry: e.target.value })}>
            {cfg.enabledCountries.map((code) => <option key={code} value={code}>{REGIONS[code]?.name ?? code}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="label">Rate provider URL</span>
          <input className="input mt-2" value={cfg.fxProviderUrl} onChange={(e) => setCfg({ ...cfg, fxProviderUrl: e.target.value })} />
          <span className="mt-1 block text-xs text-[#8f8672]">Use {'{key}'} where the API key goes. The key itself is set in the server environment as FX_API_KEY, never here.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-brand py-2.5" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button>
        {msg && <span role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function FxRefreshButton({ stale }: { stale: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function refresh() {
    setBusy(true); setMsg(null);
    const r = await call<{ count: number; host: string }>('/api/admin/fx/refresh', 'POST');
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setMsg({ kind: 'ok', text: `Updated ${r.data.count} rates from ${r.data.host}.` });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-brand py-2.5" disabled={busy} onClick={refresh}>{busy ? 'Fetching…' : 'Refresh live rates'}</button>
      {stale && <span className="text-xs text-orange-300">Rates are older than 36 hours or missing. Refresh before relying on the estimates.</span>}
      {msg && <span role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </div>
  );
}

type OverrideRow = { locale: string; key: string; value: string };

/** Edits wording per language. The shipped text is shown as reference; an empty box keeps the shipped text. */
export function TranslationEditor({ overrides, shipped }: { overrides: OverrideRow[]; shipped: Record<Locale, Record<string, string>> }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('ar');
  const keys = useMemo(() => Object.keys(en), []);
  const saved = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of overrides) if (o.locale === locale) map[o.key] = o.value;
    return map;
  }, [overrides, locale]);
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => setDraft(saved), [saved]);

  const changed = keys.filter((k) => (draft[k] ?? '') !== (saved[k] ?? ''));
  const shown = keys.filter((k) => !filter || k.includes(filter) || en[k as keyof typeof en].toLowerCase().includes(filter.toLowerCase()));

  async function save() {
    if (changed.length === 0) return;
    setBusy(true); setMsg(null);
    const r = await call<{ saved: number }>('/api/admin/translations', 'PUT', {
      items: changed.map((k) => ({ locale, key: k, value: draft[k] ?? '' })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: 'err', text: r.message });
    setMsg({ kind: 'ok', text: `Saved ${r.data.saved} change(s).` });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Language</span>
          <select className="input mt-2" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="label">Filter</span>
          <input className="input mt-2" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search key or English text" />
        </label>
        <button type="button" className="btn btn-brand py-2.5" disabled={busy || changed.length === 0} onClick={save}>
          {busy ? 'Saving…' : `Save ${changed.length || ''} change${changed.length === 1 ? '' : 's'}`}
        </button>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
        {shown.map((k) => (
          <div key={k} className="grid gap-2 rounded-xl border border-white/5 bg-black/30 p-3 md:grid-cols-[1fr_1fr_1fr]">
            <div className="font-mono text-[11px] text-[#8f8672]">{k}<div className="mt-1 font-sans text-xs text-[#cfc6b0]">{en[k as keyof typeof en]}</div></div>
            <div className="text-xs text-[#8f8672]">Shipped: <span className="text-[#cfc6b0]">{shipped[locale][k]}</span></div>
            <textarea
              className="input min-h-[44px] text-sm"
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              placeholder="Leave empty to use the shipped text"
              value={draft[k] ?? ''}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              aria-label={`${locale} text for ${k}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
