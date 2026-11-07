import type { ReactNode } from 'react';
import { formatMoney, type Currency } from '@/lib/domain/money';

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff6a00,#d4af37)] font-black text-black">B</div>
      <div className="leading-tight">
        <div className="gold-text text-lg font-extrabold tracking-tight">BinaryPro</div>
        <div className="text-[10px] uppercase tracking-[.22em] text-[#a39a86]">Commerce. Community. Rewards.</div>
      </div>
    </div>
  );
}

export function Money({ minor, currency = 'INR' }: { minor: bigint | string | number; currency?: Currency }) {
  return <span className="kpi">{formatMoney(BigInt(minor), currency)}</span>;
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
      BinaryPro does not guarantee income. Earnings depend on verified retail sales, your own activity and the
      performance of the platform. Commissions are never paid for joining, recruiting or membership fees. Advertising
      rewards are paid only from advertiser budgets. See the{' '}
      <a href="/compliance">compliance statement</a> for full terms.
    </p>
  );
}
