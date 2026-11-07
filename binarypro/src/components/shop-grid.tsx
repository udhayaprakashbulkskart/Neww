'use client';

import { useMemo, useState } from 'react';
import { ShopItem } from './client';

export interface ShopProduct { id: string; name: string; price: string; merchant: string }

const TONES = [
  'from-[#ff6a00] via-[#ff8c33] to-[#d4af37]',
  'from-[#d4af37] via-[#8a6a1a] to-[#1a1408]',
  'from-[#7c3a00] via-[#ff6a00] to-[#2b1000]',
  'from-[#f7e09a] via-[#b8902a] to-[#2a1c05]',
];

/** Product grid with live search over name and merchant. */
export function ShopGrid({ products }: { products: ShopProduct[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? products.filter((p) => `${p.name} ${p.merchant}`.toLowerCase().includes(term)) : products;
  }, [products, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          className="input max-w-sm"
          placeholder="Search products or merchants"
          aria-label="Search products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-sm text-[#8f8672]">{shown.length} of {products.length} products</span>
      </div>
      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-[#8f8672]">No products match “{q}”.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => (
            <article key={p.id} className="group flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-[#0a0a0a] transition hover:-translate-y-0.5 hover:border-[#d4af37]/40">
              <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${TONES[i % TONES.length]}`}>
                <span className="select-none text-6xl font-black text-black/40">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#f7e09a]">{p.merchant}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <ShopItem productId={p.id} name={p.name} price={p.price} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
