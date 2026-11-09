import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { resetDb, makeUser, makeMerchantWithProduct } from './helpers';
import { refreshLiveRates, displayRates } from '@/lib/server/fx-provider';
import { getLocaleConfig, getOverrides, invalidateLocaleCache, LocaleConfigSchema, DEFAULT_LOCALE_CONFIG, LOCALE_CONFIG_KEY } from '@/lib/server/locale';
import { startMembershipCheckout } from '@/lib/server/payments';
import { DomainError } from '@/lib/server/errors';
import { RATE_SCALE } from '@/lib/domain/money';

const providerBody = {
  result: 'success',
  base_code: 'INR',
  rates: { USD: 1 / 83.5, EUR: 1 / 90.2, GBP: 1 / 105.8, AED: 1 / 22.7, SGD: 1 / 62.1, MYR: 1 / 17.8, SAR: 1 / 22.3, JPY: 1 / 0.55 },
};

function mockFetch(body: unknown, ok = true): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 503, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}

async function seedRates() {
  const rows: [string, bigint][] = [['USD', 8_350_000_000n], ['EUR', 9_020_000_000n], ['GBP', 10_580_000_000n], ['AED', 2_270_000_000n], ['SGD', 6_210_000_000n], ['MYR', 1_780_000_000n], ['SAR', 2_230_000_000n]];
  for (const [currency, rateE8] of rows) await db.fxRate.upsert({ where: { currency }, create: { currency, rateE8 }, update: { rateE8 } });
}

describe('live exchange rates', () => {
  beforeEach(async () => { await resetDb(); await seedRates(); invalidateLocaleCache(); });

  it('stores fresh rates with their source and time, and records an audit entry', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const when = new Date('2026-11-10T06:00:00Z');
    const result = await refreshLiveRates(admin.id, mockFetch(providerBody), when);
    expect(result.count).toBe(8);
    const usd = await db.fxRate.findUniqueOrThrow({ where: { currency: 'USD' } });
    expect(usd.source).toBe('LIVE');
    expect(usd.fetchedAt?.toISOString()).toBe(when.toISOString());
    expect(Number(usd.rateE8) / Number(RATE_SCALE)).toBeCloseTo(83.5, 3);
    const jpy = await db.fxRate.findUniqueOrThrow({ where: { currency: 'JPY' } });
    expect(Number(jpy.rateE8) / Number(RATE_SCALE)).toBeCloseTo(0.55, 3);
    expect(await db.auditLog.count({ where: { action: 'fx.refreshed' } })).toBe(1);
  });

  it('a failed fetch changes nothing', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const before = await db.fxRate.findUniqueOrThrow({ where: { currency: 'USD' } });
    await expect(refreshLiveRates(admin.id, mockFetch({}, false))).rejects.toBeInstanceOf(DomainError);
    const after = await db.fxRate.findUniqueOrThrow({ where: { currency: 'USD' } });
    expect(after.rateE8).toBe(before.rateE8);
    expect(after.source).toBe('MANUAL');
  });

  it('a bad response changes nothing either', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    await expect(refreshLiveRates(admin.id, mockFetch({ result: 'success', base_code: 'INR', rates: {} }))).rejects.toBeInstanceOf(DomainError);
    expect((await db.fxRate.findUniqueOrThrow({ where: { currency: 'USD' } })).source).toBe('MANUAL');
  });

  it('a rate change never rewrites past transactions', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const buyer = await makeUser({ name: 'Buyer' });
    const { merchant } = await makeMerchantWithProduct(12_345n, 'USD');
    const order = await db.order.create({ data: { buyerId: buyer.id, merchantId: merchant.id, currency: 'USD', subtotalMinor: 12_345n, status: 'VERIFIED' } });
    await refreshLiveRates(admin.id, mockFetch(providerBody));
    const reread = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reread.subtotalMinor).toBe(12_345n);
    expect(reread.currency).toBe('USD');
  });

  it('display rates flag data older than 36 hours and clear once refreshed', async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.fxRate.updateMany({ data: { updatedAt: old } });
    expect((await displayRates()).stale).toBe(true);
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    await refreshLiveRates(admin.id, mockFetch(providerBody));
    expect((await displayRates()).stale).toBe(false);
  });
});

describe('membership is always paid in INR', () => {
  beforeEach(resetDb);

  it('refuses a dollar checkout', async () => {
    const u = await makeUser({ name: 'Member', tier: 'BASIC' });
    await expect(startMembershipCheckout(u.id, 'SILVER', 'USD')).rejects.toMatchObject({ code: 'CURRENCY_NOT_SUPPORTED' });
  });

  it('a preferred currency of USD does not change the charge', async () => {
    const u = await makeUser({ name: 'Member', tier: 'BASIC' });
    await db.user.update({ where: { id: u.id }, data: { preferredCurrency: 'USD', displayCurrency: 'USD', regionChosen: true } });
    const r = await startMembershipCheckout(u.id, 'SILVER', undefined);
    if (r.activated) throw new Error('expected a payment');
    expect(r.currency).toBe('INR');
    const payment = await db.payment.findUniqueOrThrow({ where: { providerRef: r.providerRef } });
    expect(payment.currency).toBe('INR');
  });
});

describe('admin locale settings', () => {
  beforeEach(resetDb);

  it('defaults apply until an administrator saves a configuration', async () => {
    expect((await getLocaleConfig()).enabledCountries).toEqual(DEFAULT_LOCALE_CONFIG.enabledCountries);
  });

  it('a saved configuration takes effect after the cache is cleared', async () => {
    const cfg = { ...DEFAULT_LOCALE_CONFIG, enabledCountries: ['IN', 'US'], defaultCountry: 'IN' };
    expect(LocaleConfigSchema.safeParse(cfg).success).toBe(true);
    await db.platformSetting.create({ data: { key: LOCALE_CONFIG_KEY, value: cfg } });
    invalidateLocaleCache();
    expect((await getLocaleConfig()).enabledCountries).toEqual(['IN', 'US']);
  });

  it('translation overrides are stored per language and returned to the page', async () => {
    await db.translationOverride.create({ data: { locale: 'de', key: 'common.save', value: 'Sichern' } });
    invalidateLocaleCache();
    expect((await getOverrides()).de?.['common.save']).toBe('Sichern');
  });
});
