import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { formatMoney } from '@/lib/domain/money';
import { TIERS, type Tier } from '@/lib/domain/plans';
import { loadEffectivePlans } from '@/lib/server/plans';
import { Notice, Money } from '@/components/ui';
import { ShopGrid } from '@/components/shop-grid';
import { CouponCards } from '@/components/coupon-cards';
import type { Currency } from '@/lib/domain/money';

export const dynamic = 'force-dynamic';

export default async function Shop({ searchParams }: { searchParams: { m?: string } }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const now = new Date();
  const tier = (user.membership?.tier ?? 'BASIC') as Tier;
  const plans = await loadEffectivePlans();
  const cap = plans[tier].couponMaxPercent;
  const initialMerchant = typeof searchParams.m === 'string' && /^[a-z0-9]{10,64}$/i.test(searchParams.m) ? searchParams.m : null;

  const [products, orders, coupons, redemptions] = await Promise.all([
    db.product.findMany({ where: { active: true, merchant: { active: true } }, include: { merchant: true }, orderBy: { name: 'asc' }, take: 200 }),
    db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { merchant: true, items: { include: { product: true } } } }),
    db.coupon.findMany({
      where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { merchant: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    db.couponRedemption.groupBy({ by: ['couponId'], where: { userId: user.id, reversed: false }, _count: { _all: true } }),
  ]);
  const used = new Map(redemptions.map((r) => [r.couponId, r._count._all]));
  const active = user.membership && user.membership.expiresAt > now;

  const couponCards = coupons
    .filter((c) => c.merchantId === null || c.merchant?.active !== false)
    .map((c) => ({
      id: c.id,
      code: c.code,
      percent: c.percent,
      merchantId: c.merchantId,
      merchantName: c.merchant?.name ?? 'CrownTree',
      maxCashback: formatMoney(c.maxCashbackMinor, c.currency as Currency),
      minOrder: c.minOrderMinor > 0n ? formatMoney(c.minOrderMinor, c.currency as Currency) : 'None',
      endsAt: c.endsAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      usesLeft: Math.max(0, c.perUserLimit - (used.get(c.id) ?? 0)),
      locked: c.percent > cap,
      requiredTier: c.percent > cap ? (TIERS.find((t) => plans[t].couponMaxPercent >= c.percent) ?? 'Platinum') : null,
      promo: c.funding === 'PROMO',
    }));

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Shop</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Cashback coupons from every partner merchant. <a href="/offers" className="font-semibold text-[#f7e09a] underline-offset-4 hover:underline">Browse partner offers →</a> Cashback is released after delivery and the 7-day return window, and is capped by your membership tier (up to {cap}%).</p>
      </header>

      {!active && <Notice tone="warn">An active membership is required to shop. Choose a plan on your dashboard.</Notice>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Online shopping coupons</h2>
            <p className="text-sm text-[#8f8672]">Copy a code, then shop the merchant. {couponCards.length} active offer{couponCards.length === 1 ? '' : 's'}.</p>
          </div>
        </div>
        <CouponCards coupons={couponCards} />
      </section>

      <section id="products" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-bold">Products</h2>
        {products.length === 0 ? (
          <Notice>No products are listed yet.</Notice>
        ) : (
          <ShopGrid
            initialMerchant={initialMerchant}
            products={products.map((p) => ({ id: p.id, name: p.name, price: formatMoney(p.priceMinor, p.currency), merchant: p.merchant.name, merchantId: p.merchantId }))}
          />
        )}
      </section>

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-lg font-bold">Your orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-[#8f8672]">No orders yet. Your purchases and cashback status appear here.</p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="table w-full min-w-[560px] text-sm">
              <thead><tr><th>Items</th><th>Total</th><th>Status</th><th>Cashback</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.items.map((i) => `${i.quantity} × ${i.product.name}`).join(', ')}<div className="text-xs text-[#8f8672]">{o.merchant.name}</div></td>
                    <td><Money minor={o.subtotalMinor} currency={o.currency} /></td>
                    <td>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${o.status === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-300' : o.status === 'RETURNED' ? 'bg-red-500/15 text-red-300' : 'bg-[#d4af37]/15 text-[#f7e09a]'}`}>{o.status.replace('_', ' ').toLowerCase()}</span>
                      {o.commissionBlocked && <div className="mt-1 text-xs text-orange-300">Under review</div>}
                    </td>
                    <td><Money minor={o.cashbackMinor} currency={o.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
