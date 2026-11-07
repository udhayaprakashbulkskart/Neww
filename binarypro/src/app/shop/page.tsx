import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { formatMoney } from '@/lib/domain/money';
import { ShopItem } from '@/components/client';
import { Section, Notice, Money } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Shop() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const [products, orders] = await Promise.all([
    db.product.findMany({ where: { active: true, merchant: { active: true } }, include: { merchant: true }, orderBy: { name: 'asc' }, take: 100 }),
    db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { merchant: true, items: { include: { product: true } } } }),
  ]);
  const active = user.membership && user.membership.expiresAt > new Date();

  return (
    <div className="space-y-6">
      {!active && <Notice tone="warn">An active membership is required to shop. Choose a plan on your dashboard.</Notice>}
      <Section title="Shop" subtitle="Buy from partner merchants. Cashback and commissions are released only after delivery and the return window.">
        {products.length === 0 ? (
          <p className="text-sm text-[#a39a86]">No products are listed yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ShopItem key={p.id} productId={p.id} name={p.name} price={formatMoney(p.priceMinor, p.currency)} merchant={p.merchant.name} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Your orders">
        {orders.length === 0 ? (
          <p className="text-sm text-[#a39a86]">No orders yet.</p>
        ) : (
          <table className="table w-full text-sm">
            <thead><tr><th>Items</th><th>Total</th><th>Status</th><th>Cashback</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.items.map((i) => `${i.quantity} × ${i.product.name}`).join(', ')}<div className="text-xs text-[#6f6758]">{o.merchant.name}</div></td>
                  <td><Money minor={o.subtotalMinor} currency={o.currency} /></td>
                  <td>{o.status.replace('_', ' ')}{o.commissionBlocked && <div className="text-xs text-orange-300">Review</div>}</td>
                  <td><Money minor={o.cashbackMinor} currency={o.currency} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
