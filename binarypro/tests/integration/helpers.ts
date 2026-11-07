import { db } from '@/lib/server/db';
import { loadRates, toRateE8 } from '@/lib/server/rates';
import { RATE_SCALE } from '@/lib/domain/money';

/** Wipes all business tables. TRUNCATE bypasses the append-only row triggers by design (test DB only). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  const currencies = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'MYR', 'SAR'] as const;
  const inrPer: Record<string, number> = { USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 62.1, MYR: 17.8, SAR: 22.3 };
  for (const c of currencies) {
    await db.fxRate.create({ data: { currency: c, rateE8: toRateE8(inrPer[c]!) } });
  }
  await loadRates(); // sanity: every currency has a rate
  void RATE_SCALE;
}

let phoneSeq = 9000000000;
export async function makeUser(opts: {
  name: string;
  sponsorId?: string | null;
  parentId?: string | null;
  side?: 'LEFT' | 'RIGHT' | null;
  tier?: 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM';
  kyc?: 'VERIFIED' | 'NOT_SUBMITTED';
  role?: 'MEMBER' | 'ADMIN' | 'FINANCE' | 'MERCHANT' | 'ADVERTISER';
  merchantId?: string | null;
}) {
  phoneSeq += 1;
  const user = await db.user.create({
    data: {
      phone: `+${phoneSeq}`,
      name: opts.name,
      sponsorId: opts.sponsorId ?? null,
      parentId: opts.parentId ?? null,
      side: opts.side ?? null,
      kyc: opts.kyc ?? 'NOT_SUBMITTED',
      role: opts.role ?? 'MEMBER',
      merchantId: opts.merchantId ?? null,
    },
  });
  await db.membership.create({
    data: { userId: user.id, tier: opts.tier ?? 'GOLD', active: true, expiresAt: new Date('2100-01-01T00:00:00Z') },
  });
  return user;
}

export async function makeMerchantWithProduct(priceMinor: bigint, currency: 'INR' | 'USD' = 'INR') {
  const merchant = await db.merchant.create({ data: { name: 'Test Merchant' } });
  const product = await db.product.create({
    data: { merchantId: merchant.id, name: 'Widget', priceMinor, currency },
  });
  return { merchant, product };
}

/** Sum of all ledger entries per currency must be zero (double-entry invariant). */
export async function assertLedgerBalanced() {
  const rows = await db.ledgerEntry.groupBy({
    by: ['currency', 'direction'],
    _sum: { amountMinor: true },
  });
  const net = new Map<string, bigint>();
  for (const r of rows) {
    const signed = r.direction === 'DEBIT' ? r._sum.amountMinor! : -r._sum.amountMinor!;
    net.set(r.currency, (net.get(r.currency) ?? 0n) + signed);
  }
  for (const [currency, total] of net) {
    if (total !== 0n) throw new Error(`Ledger out of balance in ${currency}: ${total}`);
  }
}
