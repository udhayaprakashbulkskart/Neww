// Development seed: staff, a placed binary tree, a merchant with products and coupons, and an ad campaign.
// Refuses to run in production.
import { PrismaClient } from '@prisma/client';
import { balanceOf } from '../src/lib/server/ledger';
import { accounts } from '../src/lib/server/accounts';
import { fundCouponPool } from '../src/lib/server/coupons';
import { fundCampaign } from '../src/lib/server/ads';
import { hashPassword } from '../src/lib/server/password';

// Demo password: set SEED_PASSWORD, or use the development default. Seeding never runs in production.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'DemoPassword123';

if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
  console.error('Seed refused: never seed a production database.');
  process.exit(1);
}

const db = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  const rates: Record<string, number> = { USD: 83.5, EUR: 90.2, GBP: 105.8, AED: 22.7, SGD: 62.1, MYR: 17.8, SAR: 22.3 };
  for (const [currency, inr] of Object.entries(rates)) {
    await db.fxRate.upsert({
      where: { currency: currency as 'USD' },
      create: { currency: currency as 'USD', rateE8: BigInt(Math.round(inr * 1e8)) },
      update: {},
    });
  }

  const farFuture = new Date('2100-01-01T00:00:00Z');
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const mk = async (phone: string, name: string, data: Record<string, unknown> = {}) =>
    db.user.upsert({
      where: { phone },
      create: { phone, name, passwordHash, email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@binarypro.test`, ...data },
      update: { passwordHash, email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@binarypro.test` },
    });
  const withMembership = async (userId: string, tier: 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM') =>
    db.membership.upsert({
      where: { userId },
      create: { userId, tier, active: true, expiresAt: farFuture },
      update: { tier, active: true, expiresAt: farFuture },
    });

  await mk('+919000000001', 'Platform Admin', { role: 'ADMIN', kyc: 'VERIFIED' });
  await mk('+919000000002', 'Finance Lead', { role: 'FINANCE', kyc: 'VERIFIED' });
  const advertiser = await mk('+919300000001', 'Demo Advertiser', { role: 'ADVERTISER', kyc: 'VERIFIED' });

  const founder = await mk('+919100000001', 'Founder', { kyc: 'VERIFIED' });
  await withMembership(founder.id, 'PLATINUM');
  const alice = await mk('+919100000002', 'Alice', { sponsorId: founder.id, parentId: founder.id, side: 'LEFT', kyc: 'VERIFIED' });
  await withMembership(alice.id, 'GOLD');
  const bob = await mk('+919100000003', 'Bob', { sponsorId: founder.id, parentId: founder.id, side: 'RIGHT', kyc: 'VERIFIED' });
  await withMembership(bob.id, 'SILVER');
  const carol = await mk('+919100000004', 'Carol', { sponsorId: alice.id, parentId: alice.id, side: 'LEFT' });
  await withMembership(carol.id, 'BASIC');

  const merchant = await db.merchant.upsert({
    where: { id: 'seed-merchant' },
    create: { id: 'seed-merchant', name: 'Demo Electronics Store' },
    update: {},
  });
  const products = [
    { name: 'Wireless Earbuds', price: 249900n },
    { name: 'Smart Watch', price: 899900n },
    { name: 'Travel Backpack', price: 129900n },
  ];
  for (const p of products) {
    const exists = await db.product.findFirst({ where: { merchantId: merchant.id, name: p.name } });
    if (!exists) await db.product.create({ data: { merchantId: merchant.id, name: p.name, priceMinor: p.price, currency: 'INR' } });
  }

  const now = new Date();
  const coupon = await db.coupon.upsert({
    where: { code: 'WELCOME20' },
    create: {
      code: 'WELCOME20', funding: 'MERCHANT', merchantId: merchant.id, percent: 20,
      maxCashbackMinor: 200_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 10_000_000n,
      perUserLimit: 1, startsAt: new Date(now.getTime() - DAY), endsAt: new Date(now.getTime() + 90 * DAY),
    },
    update: {},
  });
  // Fund the cashback pool through the real ledger service (only once).
  if ((await balanceOf(db as never, accounts.merchantPool(merchant.id, 'INR').key)) === 0n) {
    await fundCouponPool(coupon.id, 10_000_000n, 'seed');
  }

  const owned = await db.adCampaign.findFirst({ where: { title: 'Summer Collection Launch' } });
  if (!owned) {
    const c = await db.adCampaign.create({
      data: {
        ownerId: advertiser.id, advertiser: 'Demo Advertiser', title: 'Summer Collection Launch',
        videoUrl: 'https://cdn.example.com/summer.mp4', durationSec: 10, rewardMinor: 300n, currency: 'INR', status: 'ACTIVE',
      },
    });
    await fundCampaign(c.id, 2_000_000n, 'seed');
  }

  const campaign = await db.adCampaign.findFirst({ where: { title: 'Launch Spotlight' } });
  if (!campaign) {
    const created = await db.adCampaign.create({
      data: {
        advertiser: 'Demo Brand', title: 'Launch Spotlight', videoUrl: 'https://cdn.example.com/spotlight.mp4',
        durationSec: 15, rewardMinor: 300n, currency: 'INR', status: 'ACTIVE',
      },
    });
    await fundCampaign(created.id, 5_000_000n, 'seed');
  }
  console.log('Seed complete. Sign in with phone numbers listed in the README (dev OTP prints to the server console).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
