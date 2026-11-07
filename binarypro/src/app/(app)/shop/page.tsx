import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { formatMoney } from '@/lib/domain/money';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { Notice, Money } from '@/components/ui';
import { ShopGrid } from '@/components/shop-grid';

export const dynamic = 'force-dynamic';

export default async function Shop() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const [products, orders, coupons] = await Promise.all([
    db.product.findMany({ where: { active: true, merchant: { active: true } }, include: { merchant: true }, orderBy: { name: 'asc' }, take: 100 }),
    db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { merchant: true, items: { include: { product: true } } } }),
    db.coupon.findMany({ where: { active: true, endsAt: { gt: new Date() } }, take: 5, orderBy: { percent: 'desc' } }),
  ]);
  const active = user.membership && user.membership.expiresAt > new Date();
  const cap = PLANS[(user.membership?.tier ?? 'BASIC') as Tier].couponMaxPercent;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Shop</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#8f8672]">Buy from partner merchants. Cashback is released after delivery and the 7-day return window, and it is capped by your membership tier (up to {cap}%).</p>
      </header>

      {!active && <Notice tone="warn">An active membership is required to shop. Choose a plan on your dashboard.</Notice>}

      {coupons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[.18em] text-[#8f8672]">Cashback coupons</h2>
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {coupons.map((c) => (
              <div key={c.id} className="min-w-[250px] snap-start rounded-2xl border border-[#d4af37]/30 bg-[linear-gradient(120deg,#1f1706,#0b0b0b)] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#f7e09a]">{c.percent}% cashback</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#8f8672]">{c.perUserLimit}× per member</span>
                </div>
                <div className="mt-3 font-mono text-xl font-bold tracking-wider">{c.code}</div>
                <div className="mt-1 text-xs text-[#8f8672]">Up to {formatMoney(c.maxCashbackMinor, c.currency)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Products</h2>
        {products.length === 0 ? (
          <Notice>No products are listed yet.</Notice>
        ) : (
          <ShopGrid products={products.map((p) => ({ id: p.id, name: p.name, price: formatMoney(p.priceMinor, p.currency), merchant: p.merchant.name }))} />
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
