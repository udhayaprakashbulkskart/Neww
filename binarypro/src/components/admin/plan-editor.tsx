'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export interface PlanForm {
  tier: string;
  name: string;
  price: string;
  durationDays: number;
  couponMaxPercent: number;
  adViewsPerDay: number;
  benefits: string;
  active: boolean;
  directPercent: number;
  binaryPercent: number;
}

/** Edits one membership package. Commission rates are shown read-only; they are not changed here. */
export function PlanEditor({ plan }: { plan: PlanForm }) {
  const router = useRouter();
  const [v, setV] = useState(plan);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/plans/${plan.tier}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: v.name, price: v.price, durationDays: Number(v.durationDays), couponMaxPercent: Number(v.couponMaxPercent),
          adViewsPerDay: Number(v.adViewsPerDay), benefits: v.benefits, active: v.active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: json?.error?.message ?? 'Save failed' });
      else { setMsg({ ok: true, text: 'Saved. New purchases use these values. Existing memberships keep their expiry date.' }); router.refresh(); }
    } catch {
      setMsg({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const field = 'input mt-1.5';
  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-white/5 bg-black/40 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-widest text-[#f7e09a]">{plan.tier}</div>
        <label className="flex items-center gap-2 text-xs text-[#b9b09a]">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Available to buy
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`${plan.tier}-name`}>Name</label><input id={`${plan.tier}-name`} className={field} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={40} required /></div>
        <div><label className="label" htmlFor={`${plan.tier}-price`}>Price (INR)</label><input id={`${plan.tier}-price`} className={field} inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} required /></div>
        <div><label className="label" htmlFor={`${plan.tier}-days`}>Duration (days)</label><input id={`${plan.tier}-days`} type="number" min={30} max={1095} className={field} value={v.durationDays} onChange={(e) => setV({ ...v, durationDays: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor={`${plan.tier}-cap`}>Coupon cap</label><select id={`${plan.tier}-cap`} className={field} value={v.couponMaxPercent} onChange={(e) => setV({ ...v, couponMaxPercent: Number(e.target.value) })}>{[10, 20, 30, 50].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
        <div><label className="label" htmlFor={`${plan.tier}-ads`}>Ad videos per day</label><input id={`${plan.tier}-ads`} type="number" min={0} max={50} className={field} value={v.adViewsPerDay} onChange={(e) => setV({ ...v, adViewsPerDay: Number(e.target.value) })} /></div>
        <div className="rounded-xl bg-white/[0.03] p-3 text-xs text-[#8f8672]"><div className="label">Fixed by commission plan</div>Direct {plan.directPercent}% · Binary {plan.binaryPercent}%. Not editable here.</div>
      </div>
      <div><label className="label" htmlFor={`${plan.tier}-benefits`}>Benefits (one per line)</label><textarea id={`${plan.tier}-benefits`} rows={4} className={field} value={v.benefits} onChange={(e) => setV({ ...v, benefits: e.target.value })} /></div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-brand px-5 py-2.5 text-sm" disabled={busy}>{busy ? 'Saving…' : 'Save package'}</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
