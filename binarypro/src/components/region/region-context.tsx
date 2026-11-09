'use client';

// Region provider, switcher and local price. Shows INR first and an approximate local price beneath.
// The visitor's choice is stored in a cookie; otherwise the detected country is used.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CURRENCY_META, convertMinor, formatMoney, type Currency, BASE_CURRENCY } from '@/lib/domain/money';
import { REGIONS, currencyForCountry, normalizeCountry, DEFAULT_COUNTRY } from '@/lib/domain/region';

const OVERRIDE_COOKIE = 'bp_region';
const GEO_COOKIE = 'bp_geo';

type Rates = Record<Currency, bigint>;

interface RegionState {
  country: string;
  detected: string;
  override: string | null;
  currency: Currency;
  rates: Rates | null;
  setOverride: (country: string | null) => void;
}

const RegionContext = createContext<RegionState | null>(null);

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  } catch {
    // Cookies blocked: the page keeps working with the detected country.
  }
}

export function RegionProvider({ children }: { children: ReactNode }) {
  const [detected, setDetected] = useState(DEFAULT_COUNTRY);
  const [override, setOverrideState] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    setDetected(normalizeCountry(readCookie(GEO_COOKIE)) ?? DEFAULT_COUNTRY);
    setOverrideState(normalizeCountry(readCookie(OVERRIDE_COOKIE)));
    fetch('/api/fx')
      .then((r) => r.json())
      .then((d: { rates: Record<string, string> | null }) => {
        if (!d.rates) return;
        setRates(Object.fromEntries(Object.entries(d.rates).map(([k, v]) => [k, BigInt(v)])) as Rates);
      })
      .catch(() => setRates(null));
  }, []);

  const country = override ?? detected;
  const currency = currencyForCountry(country);

  useEffect(() => {
    try {
      document.documentElement.lang = REGIONS[country]?.lang ?? 'en';
    } catch {
      // Ignore: the lang attribute is cosmetic.
    }
  }, [country]);

  const value = useMemo<RegionState>(
    () => ({
      country,
      detected,
      override,
      currency,
      rates,
      setOverride: (next) => {
        if (next === null) {
          writeCookie(OVERRIDE_COOKIE, '', 0);
        } else {
          writeCookie(OVERRIDE_COOKIE, next, 60 * 60 * 24 * 365);
        }
        setOverrideState(next);
      },
    }),
    [country, detected, override, currency, rates],
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    return { country: DEFAULT_COUNTRY, detected: DEFAULT_COUNTRY, override: null, currency: BASE_CURRENCY, rates: null, setOverride: () => {} };
  }
  return ctx;
}

/** Price in INR, with an approximate local-currency figure when the visitor is outside India. */
export function LocalPrice({ minor, className }: { minor: string; className?: string }) {
  const { currency, rates } = useRegion();
  const inrMinor = BigInt(minor);
  const inr = formatMoney(inrMinor, BASE_CURRENCY);
  if (currency === BASE_CURRENCY || !rates) {
    return <span className={className}>{inr}</span>;
  }
  const local = convertMinor(inrMinor, BASE_CURRENCY, currency, rates);
  return (
    <span className={className}>
      {inr}
      <span className="mt-0.5 block text-xs font-medium text-[#8f8672]">
        ≈ {formatMoney(local, currency)} (approximate; you pay in INR)
      </span>
    </span>
  );
}

/** Footer control: automatic, or a fixed country. Shows the language used on the page. */
export function RegionSwitcher() {
  const { country, detected, override, currency, setOverride } = useRegion();
  const lang = REGIONS[country]?.lang ?? 'en';
  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#f7e09a]">Country and currency</span>
        <select
          className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-[#b9b09a]"
          value={override ?? 'auto'}
          onChange={(e) => setOverride(e.target.value === 'auto' ? null : e.target.value)}
        >
          <option value="auto">Automatic ({REGIONS[detected]?.name ?? 'India'})</option>
          {Object.entries(REGIONS).map(([code, r]) => (
            <option key={code} value={code}>
              {r.name} ({CURRENCY_META[r.currency].symbol.trim() || r.currency})
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[#6f6758]">
        Showing {currency} estimates for {REGIONS[country]?.name ?? 'India'}. Payments are always in INR. Language: English ({lang}).
      </p>
    </div>
  );
}
