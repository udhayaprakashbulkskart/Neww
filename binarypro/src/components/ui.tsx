import type { ReactNode } from 'react';
import { type DisplayCurrency } from '@/lib/domain/money';
import { MoneyView } from '@/components/region/region-context';

/** CrowTree logo: crown mark plus wordmark. The mark is a square crop of the brand artwork. */
export function Logo({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/crowntree-mark-160.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
      <div className="leading-tight">
        <div className="text-lg font-black tracking-[.06em] text-[#e8e8e8]">CROWN<span className="gold-text">TREE</span></div>
        {showTagline && <div className="text-[10px] uppercase tracking-[.22em] text-[#a39a86]">Global Business Network</div>}
      </div>
    </div>
  );
}

/** Money in its original currency, with an approximate figure in the visitor's display currency. */
export function Money({ minor, currency = 'INR' }: { minor: bigint | string | number; currency?: DisplayCurrency }) {
  return <MoneyView minor={String(minor)} currency={currency} />;
}

export function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[#a39a86]">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{children}</div>
      {hint && <div className="mt-1 text-xs text-[#a39a86]">{hint}</div>}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  const cls = tone === 'warn' ? 'border-orange-500/40 bg-orange-500/10 text-orange-200' : 'border-[#2a2116] bg-[#0e0b06] text-[#cfc6b0]';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** Required wording: no guaranteed income, earnings depend on verified retail. */
export function Disclaimer() {
  return (
    <p className="text-xs leading-relaxed text-[#8a8170]">
      CrownTree does not guarantee income. Earnings depend on verified retail sales, your own activity and the
      performance of the platform. Commissions are never paid for joining, recruiting or membership fees. Advertising
      rewards are paid only from advertiser budgets. See the{' '}
      <a href="/compliance">compliance statement</a> for full terms.
    </p>
  );
}
