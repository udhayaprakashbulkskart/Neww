'use client';

import { useMemo, useState } from 'react';

export interface EarningRow { id: string; date: string; source: string; label: string; amount: string }

const SOURCES: { key: string; label: string; tone: string }[] = [
  { key: 'ALL', label: 'All', tone: 'text-[#f7e09a]' },
  { key: 'DIRECT_COMMISSION', label: 'Direct sales', tone: 'text-[#ff8c33]' },
  { key: 'BINARY_COMMISSION', label: 'Binary', tone: 'text-[#f7e09a]' },
  { key: 'AD_REWARD', label: 'Ads', tone: 'text-emerald-300' },
  { key: 'CASHBACK', label: 'Cashback', tone: 'text-sky-300' },
];

/** Filterable credit history. Filters by source; table on desktop, cards on phones. */
export function EarningsHistory({ rows }: { rows: EarningRow[] }) {
  const [source, setSource] = useState('ALL');
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    for (const r of rows) c[r.source] = (c[r.source] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = source === 'ALL' ? rows : rows.filter((r) => r.source === source);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Filter by source" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SOURCES.filter((s) => s.key === 'ALL' || counts[s.key]).map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={source === s.key}
            onClick={() => setSource(s.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              source === s.key ? 'bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-black' : 'border border-white/10 text-[#b9b09a] hover:text-white'
            }`}
          >
            {s.label} <span className="ml-1 opacity-70">{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-[#8f8672]">
          No credits in this category yet.
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {shown.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.label}</div>
                  <div className="text-xs text-[#8f8672]">{r.date}</div>
                </div>
                <div className="shrink-0 font-extrabold text-emerald-300">+{r.amount}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border border-white/5 md:block">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[11px] uppercase tracking-[.14em] text-[#8f8672]">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Description</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap px-5 py-3.5 text-[#b9b09a]">{r.date}</td>
                    <td className="px-5 py-3.5">{r.label}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-300">+{r.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
