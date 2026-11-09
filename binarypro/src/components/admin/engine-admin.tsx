'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Result = { ok: boolean; text: string } | null;

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<{ ok: boolean; text: string; data?: unknown }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, text: json?.error?.message ?? 'Request failed' };
    return { ok: true, text: 'Saved', data: json };
  } catch {
    return { ok: false, text: 'Network error. Try again.' };
  }
}

const field = 'input mt-1.5';
const Status = ({ r }: { r: Result }) => (r ? <span role="status" className={`text-xs ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>{r.text}</span> : null);

export function CapForm({ capRupees }: { capRupees: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(capRupees ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/engine/cap', 'PATCH', { capRupees: value.trim() === '' ? null : value.trim(), reason });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Daily cap saved' } : r);
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
      <div><label className="label">Daily cap per member (INR)</label><input className={field} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="Not set" /></div>
      <div className="sm:col-span-2"><label className="label">Reason for this change</label><input className={field} value={reason} onChange={(e) => setReason(e.target.value)} minLength={8} maxLength={300} required /></div>
      <div className="flex items-end gap-3"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Saving…' : 'Save cap'}</button><Status r={msg} /></div>
      <p className="sm:col-span-3 text-xs text-[#8f8672]">Leave the cap empty to stop all releases. Nothing is released until a cap is set.</p>
    </form>
  );
}

export function PolicyForm() {
  const router = useRouter();
  const [kind, setKind] = useState('PRODUCT');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/engine/policies', 'POST', {
      kind, rateBps: Number(f.get('rateBps')), active: f.get('active') === 'on',
      legalApprovalRef: String(f.get('legalApprovalRef') ?? '') || null, reason: String(f.get('reason') ?? ''),
    });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'New policy version saved' } : r);
    if (r.ok) { e.currentTarget.reset(); router.refresh(); }
  }
  const blocked = kind === 'BINARY' || kind === 'DIRECT_SPONSOR';
  return (
    <form onSubmit={publish} className="grid gap-3 rounded-xl border border-dashed border-white/10 p-4 sm:grid-cols-2">
      <div><label className="label">Commission type</label>
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="PRODUCT">Product sales</option><option value="SERVICE">Service sales</option>
          <option value="DIRECT_SPONSOR">Sponsor-linked (disabled)</option><option value="BINARY">Binary team (disabled)</option>
        </select>
      </div>
      <div><label className="label">Maximum rate (basis points, 1000 = 10%)</label><input name="rateBps" type="number" min={0} max={10000} defaultValue={blocked ? 0 : 1000} className={field} required /></div>
      <div><label className="label">Legal approval reference</label><input name="legalApprovalRef" className={field} maxLength={120} placeholder={blocked ? 'Not allowed' : 'Required to activate'} /></div>
      <div className="flex items-end gap-3"><label className="flex items-center gap-2 text-xs"><input name="active" type="checkbox" disabled={blocked} /> Active</label></div>
      <div className="sm:col-span-2"><label className="label">Reason for this version</label><input name="reason" className={field} minLength={8} maxLength={300} required /></div>
      <div className="sm:col-span-2 flex items-center gap-3"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Saving…' : 'Save as new version'}</button><Status r={msg} /></div>
      {blocked && <p className="sm:col-span-2 text-xs text-orange-200">This commission type is disabled until documented legal approval. It cannot be activated.</p>}
    </form>
  );
}

export function SettleForm({ defaultDay }: { defaultDay: string }) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/engine/settle', 'POST', { dayKey: day, reason });
    setBusy(false);
    if (r.ok) {
      const d = r.data as { members: number; results: { status: string }[] };
      const settled = d.results.filter((x) => x.status === 'SETTLED').length;
      setMsg({ ok: true, text: `Settled ${settled} new member(s) for ${day}. ${d.results.length - settled} already settled.` });
      router.refresh();
    } else setMsg(r);
  }
  return (
    <form onSubmit={run} className="grid gap-3 sm:grid-cols-3">
      <div><label className="label">Business day (IST)</label><input type="date" className={field} value={day} onChange={(e) => setDay(e.target.value)} required /></div>
      <div className="sm:col-span-2"><label className="label">Reason</label><input className={field} value={reason} onChange={(e) => setReason(e.target.value)} minLength={8} maxLength={300} required /></div>
      <div className="sm:col-span-3 flex items-center gap-3"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Settling…' : 'Run daily settlement'}</button><Status r={msg} /></div>
      <p className="sm:col-span-3 text-xs text-[#8f8672]">Each member is settled once per business day. Running it again does nothing for members already settled.</p>
    </form>
  );
}

export function ReconcileButton() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/engine/reconcile', 'POST', { reason });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: 'Reconciliation run and recorded' }); router.refresh(); } else setMsg(r);
  }
  return (
    <form onSubmit={run} className="flex flex-wrap items-end gap-3">
      <div><label className="label">Reason</label><input className={field} value={reason} onChange={(e) => setReason(e.target.value)} minLength={8} maxLength={300} required /></div>
      <button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Checking…' : 'Run reconciliation'}</button>
      <Status r={msg} />
    </form>
  );
}

export function ServiceCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/services', 'POST', {
      name: String(f.get('name') ?? ''), description: String(f.get('description') ?? ''), priceRupees: String(f.get('priceRupees') ?? ''),
      currency: 'INR', reason: String(f.get('reason') ?? ''),
    });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Service added to the catalogue' } : r);
    if (r.ok) { e.currentTarget.reset(); router.refresh(); }
  }
  return (
    <form onSubmit={create} className="grid gap-3 rounded-xl border border-dashed border-white/10 p-4 sm:grid-cols-2">
      <div><label className="label">Service name</label><input name="name" className={field} required maxLength={120} /></div>
      <div><label className="label">Price (INR)</label><input name="priceRupees" inputMode="decimal" className={field} required /></div>
      <div className="sm:col-span-2"><label className="label">Description</label><input name="description" className={field} required maxLength={500} /></div>
      <div className="sm:col-span-2"><label className="label">Reason</label><input name="reason" className={field} required minLength={8} maxLength={300} /></div>
      <div className="sm:col-span-2 flex items-center gap-3"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Adding…' : 'Add service'}</button><Status r={msg} /></div>
    </form>
  );
}
