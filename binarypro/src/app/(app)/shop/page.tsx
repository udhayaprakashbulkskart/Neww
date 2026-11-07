import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { formatMoney } from '@/lib/domain/money';
import { ShopItem } from '@/components/client';
import { Notice, Money } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TONES = [
  'from-[#ff6a00] to-[#d4af37]',
  'from-[#d4af37] to-[#7a5a10]',
  'from-[#ff8c33] to-[#2b1000]',
  'from-[#f7e09a] to-[#8a6a1a]',
];

export default async function Shop() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const [products, orders, coupons] = await Promise.all([
    db.product.findMany({ where: { active: true, merchant: { active: true } }, include: { merchant: true }, orderBy: { name: 'asc' }, take: 100 }),
    db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { merchant: true, items: { include: { product: true } } } }),
    db.coupon.findMany({ where: { active: true, endsAt: { gt: new Date() } }, take: 5, orderBy: { percent: 'desc' } }),
  ]);
  const active = user.membership && user.membership.expiresAt > new Date();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Shop</h1>
          <p className="mt-1 text-sm text-[#8f8672]">Partner merchants. Cashback is released after delivery and the return window.</p>
        </div>
      </header>

      {!active && <Notice tone="warn">An active membership is required to shop. Choose a plan on your dashboard.</Notice>}

      {coupons.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {coupons.map((c) => (
            <div key={c.id} className="min-w-[240px] rounded-2xl border border-[#d4af37]/30 bg-[linear-gradient(120deg,#1f1706,#0b0b0b)] p-4">
              <div className="text-xs uppercase tracking-widest text-[#f7e09a]">{c.percent}% cashback</div>
              <div className="mt-1 font-mono text-lg font-bold">{c.code}</div>
              <div className="mt-1 text-xs text-[#8f8672]">Up to {formatMoney(c.maxCashbackMinor, c.currency)} · {c.perUserLimit} use per member</div>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <Notice>No products are listed yet.</Notice>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p, i) => (
            <div key={p.id} className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03]">
              <div className={`relative flex h-40 items-end bg-gradient-to-br ${TONES[i % TONES.length]} p-4`}>
                <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">{p.merchant.name}</span>
              </div>
              <div className="p-5">
                <ShopItem productId={p.id} name={p.name} price={formatMoney(p.priceMinor, p.currency)} merchant={p.merchant.name} />
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-3xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-lg font-bold">Your orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-[#8f8672]">No orders yet.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>Items</th><th>Total</th><th>Status</th><th>Cashback</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.items.map((i) => `${i.quantity} × ${i.product.name}`).join(', ')}<div className="text-xs text-[#8f8672]">{o.merchant.name}</div></td>
                  <td><Money minor={o.subtotalMinor} currency={o.currency} /></td>
                  <td>{o.status.replace('_', ' ')}{o.commissionBlocked && <div className="text-xs text-orange-300">Under review</div>}</td>
                  <td><Money minor={o.cashbackMinor} currency={o.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
