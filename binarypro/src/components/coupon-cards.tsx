'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface CouponCardData {
  id: string;
  code: string;
  percent: number;
  merchantId: string | null;
  merchantName: string;
  maxCashback: string;
  minOrder: string;
  endsAt: string;
  usesLeft: number;
  locked: boolean;
  requiredTier: string | null;
  promo: boolean;
}

function CopyCode({ code, disabled }: { code: string; disabled: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
      className="btn btn-ghost px-3 py-2 text-xs disabled:opacity-40"
    >
      {done ? 'Copied' : 'Copy code'}
    </button>
  );
}

/** Coupon cards for every active merchant offer. Locked or used-up coupons are shown but cannot be used. */
export function CouponCards({ coupons }: { coupons: CouponCardData[] }) {
  if (coupons.length === 0) {
    return <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-[#8f8672]">No coupons are active right now. New merchant offers appear here as they are published.</div>;
  }
  return (
    <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
      {coupons.map((c) => {
        const unusable = c.locked || c.usesLeft <= 0;
        return (
          <article key={c.id} className={`group relative flex min-w-[290px] snap-start flex-col overflow-hidden rounded-3xl border p-5 transition sm:min-w-0 ${unusable ? 'border-white/5 bg-white/[0.02] opacity-75' : 'border-[#d4af37]/30 bg-[linear-gradient(150deg,#1f1706,#0a0a0a_60%)] hover:-translate-y-1 hover:border-[#d4af37]/60'}`}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.25),transparent_70%)]" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8f8672]">{c.promo ? 'Platform offer' : 'Merchant offer'}</div>
                <div className="mt-1 truncate text-sm font-bold text-[#e8e8e8]">{c.merchantName}</div>
              </div>
              <div className="text-right">
                <div className="bg-[linear-gradient(90deg,#f7e09a,#d4af37,#ff8c33)] bg-clip-text text-4xl font-black leading-none text-transparent">{c.percent}%</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#f7e09a]">cashback</div>
              </div>
            </div>
            <div className="relative mt-5 rounded-2xl border border-dashed border-[#d4af37]/40 bg-black/40 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[.2em] text-[#8f8672]">Coupon code</div>
              <div className="mt-1 font-mono text-lg font-bold tracking-[.12em]">{c.code}</div>
            </div>
            <dl className="relative mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-[#8f8672]">Up to</dt><dd className="font-semibold">{c.maxCashback}</dd></div>
              <div><dt className="text-[#8f8672]">Minimum order</dt><dd className="font-semibold">{c.minOrder}</dd></div>
              <div><dt className="text-[#8f8672]">Valid until</dt><dd className="font-semibold">{c.endsAt}</dd></div>
              <div><dt className="text-[#8f8672]">Your uses left</dt><dd className="font-semibold">{c.usesLeft}</dd></div>
            </dl>
            <div className="relative mt-5 flex flex-wrap items-center gap-2">
              {c.locked ? (
                <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-[#b9b09a]">Requires {c.requiredTier} membership</span>
              ) : c.usesLeft <= 0 ? (
                <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-[#b9b09a]">Used up for your account</span>
              ) : (
                <>
                  <CopyCode code={c.code} disabled={false} />
                  {c.merchantId && <Link href={`/shop?m=${c.merchantId}#products`} className="btn btn-brand px-3 py-2 text-xs">Shop now</Link>}
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
