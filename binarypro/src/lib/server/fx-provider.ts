// Live exchange rates. Provider returns "units of X per 1 INR"; we store "INR per 1 unit of X" scaled by 1e8.
// Display only: transaction amounts, ledger postings and commissions never use these rates.
import { CURRENCIES, RATE_SCALE, DISPLAY_ONLY_CURRENCIES, type DisplayCurrency } from '@/lib/domain/money';
import { db } from './db';
import { DomainError } from './errors';
import { audit } from './audit';
import { getLocaleConfig, invalidateLocaleCache } from './locale';

const SANITY_MIN_INR = 0.01; // INR per one unit: anything outside this range is treated as bad data
const SANITY_MAX_INR = 1000;

export type FxSnapshot = Partial<Record<DisplayCurrency, bigint>>;

/** Parses a provider response. Throws on any malformed or implausible value, so bad data is never stored. */
export function parseProviderRates(json: unknown): FxSnapshot {
  const body = json as { result?: string; base_code?: string; rates?: Record<string, unknown> };
  if (body?.result !== 'success' || body.base_code !== 'INR' || !body.rates || typeof body.rates !== 'object') {
    throw new DomainError('FX_PROVIDER_BAD_RESPONSE', 'Rate provider returned an unexpected response', 502);
  }
  const out: FxSnapshot = {};
  const wanted = [...CURRENCIES.filter((c) => c !== 'INR'), ...DISPLAY_ONLY_CURRENCIES] as DisplayCurrency[];
  for (const c of wanted) {
    const perInr = body.rates[c];
    if (typeof perInr !== 'number' || !Number.isFinite(perInr) || perInr <= 0) {
      if (CURRENCIES.includes(c as never)) {
        throw new DomainError('FX_PROVIDER_BAD_RESPONSE', `Rate for ${c} is missing from the provider`, 502);
      }
      continue; // display-only currencies are optional
    }
    const inrPerUnit = 1 / perInr;
    if (inrPerUnit < SANITY_MIN_INR || inrPerUnit > SANITY_MAX_INR) {
      throw new DomainError('FX_PROVIDER_BAD_RESPONSE', `Rate for ${c} is outside the plausible range`, 502);
    }
    out[c] = BigInt(Math.round(inrPerUnit * Number(RATE_SCALE)));
  }
  return out;
}

export function providerUrl(template: string, apiKey: string | undefined): string {
  return template.replace('{key}', encodeURIComponent(apiKey ?? ''));
}

export async function fetchLiveRates(fetchImpl: typeof fetch = fetch): Promise<{ rates: FxSnapshot; host: string }> {
  const config = await getLocaleConfig();
  const url = providerUrl(config.fxProviderUrl, process.env.FX_API_KEY);
  if (config.fxProviderUrl.includes('{key}') && !process.env.FX_API_KEY) {
    throw new DomainError('FX_KEY_MISSING', 'The rate provider needs an API key (FX_API_KEY) on the server', 503);
  }
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  } catch {
    throw new DomainError('FX_PROVIDER_UNREACHABLE', 'Could not reach the rate provider', 502);
  }
  if (!res.ok) throw new DomainError('FX_PROVIDER_ERROR', `Rate provider responded ${res.status}`, 502);
  const rates = parseProviderRates(await res.json().catch(() => null));
  return { rates, host: new URL(url).host };
}

/**
 * Stores fresh rates. Only the current-rate rows change. Past transactions keep their original amounts
 * and currency, so their history is never rewritten. The audit row records the rates used.
 */
export async function refreshLiveRates(actorId: string, fetchImpl: typeof fetch = fetch, now = new Date()) {
  const { rates, host } = await fetchLiveRates(fetchImpl);
  await db.$transaction(async (tx) => {
    for (const [currency, rateE8] of Object.entries(rates) as [DisplayCurrency, bigint][]) {
      await tx.fxRate.upsert({
        where: { currency },
        create: { currency, rateE8, source: 'LIVE', fetchedAt: now },
        update: { rateE8, source: 'LIVE', fetchedAt: now, updatedAt: now },
      });
    }
    await audit(tx, {
      action: 'fx.refreshed',
      actorId,
      targetId: 'fx',
      meta: { host, rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, v!.toString()])) },
    });
  });
  invalidateLocaleCache();
  return { count: Object.keys(rates).length, fetchedAt: now, host };
}

/** Current display rates (INR per unit, scaled), with where they came from. */
export async function displayRates() {
  const rows = await db.fxRate.findMany();
  const rates: FxSnapshot = {};
  let oldest: Date | null = null;
  for (const r of rows) {
    if (!(CURRENCIES as readonly string[]).includes(r.currency) && !(DISPLAY_ONLY_CURRENCIES as readonly string[]).includes(r.currency)) continue;
    rates[r.currency as DisplayCurrency] = r.rateE8;
    const at = r.fetchedAt ?? r.updatedAt;
    if (!oldest || at < oldest) oldest = at;
  }
  rates.INR = RATE_SCALE;
  const staleMs = oldest ? Date.now() - oldest.getTime() : null;
  return {
    rates,
    rows: rows.map((r) => ({ currency: r.currency, rateE8: r.rateE8.toString(), source: r.source, updatedAt: r.updatedAt, fetchedAt: r.fetchedAt })),
    oldestAt: oldest,
    stale: staleMs === null || staleMs > 36 * 60 * 60 * 1000,
  };
}
