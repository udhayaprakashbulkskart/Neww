'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Result = { ok: boolean; text: string } | null;

async function sendJson(url: string, method: 'POST' | 'PATCH', body?: unknown): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, text: json?.error?.message ?? 'Request failed' };
    return { ok: true, text: 'Saved' };
  } catch {
    return { ok: false, text: 'Network error. Try again.' };
  }
}

const field = 'input mt-1.5';

export function RuleEditor({ rule }: { rule: { id: string; name: string; thresholdRupees: string; startsAt: string; endsAt: string; active: boolean } }) {
  const router = useRouter();
  const [v, setV] = useState(rule);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await sendJson(`/api/admin/milestones/rules/${rule.id}`, 'PATCH', {
      name: v.name,
      thresholdRupees: v.thresholdRupees,
      startsAt: new Date(`${v.startsAt}T00:00:00.000Z`).toISOString(),
      endsAt: v.endsAt ? new Date(`${v.endsAt}T00:00:00.000Z`).toISOString() : null,
      active: v.active,
    });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Rule saved. Applies to the next evaluation; existing awards are kept.' } : r);
    if (r.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="lg:col-span-2"><label className="label" htmlFor="rule-name">Name</label><input id="rule-name" className={field} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={120} required /></div>
      <div><label className="label" htmlFor="rule-threshold">Threshold (INR)</label><input id="rule-threshold" className={field} inputMode="decimal" value={v.thresholdRupees} onChange={(e) => setV({ ...v, thresholdRupees: e.target.value })} required /></div>
      <div><label className="label" htmlFor="rule-start">Counts sales from</label><input id="rule-start" type="date" className={field} value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} required /></div>
      <div><label className="label" htmlFor="rule-end">Ends (optional)</label><input id="rule-end" type="date" className={field} value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></div>
      <div className="flex flex-col justify-end gap-2">
        <label className="flex items-center gap-2 text-xs text-[#b9b09a]"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} /> Active</label>
        <button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Saving…' : 'Save rule'}</button>
      </div>
      {msg && <p role="status" className={`text-xs sm:col-span-2 lg:col-span-5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </form>
  );
}

export function EvaluateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        className="btn btn-ghost px-4 py-2 text-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await sendJson('/api/admin/milestones/evaluate', 'POST');
          setBusy(false);
          setMsg(r.ok ? { ok: true, text: 'Checked every member. New qualifiers appear in the queue below.' } : r);
          if (r.ok) router.refresh();
        }}
      >
        {busy ? 'Checking…' : 'Check for new qualifiers'}
      </button>
      {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </div>
  );
}

export interface PrizeRow {
  id: string; name: string; model: string; imageUrl: string; description: string;
  details: string[]; supplierNote: string; active: boolean; sortOrder: number;
}

export function PrizeEditor({ prize }: { prize?: PrizeRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  const [open, setOpen] = useState(!prize);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name') ?? ''),
      model: String(f.get('model') ?? ''),
      imageUrl: String(f.get('imageUrl') ?? ''),
      description: String(f.get('description') ?? ''),
      details: String(f.get('details') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      supplierNote: String(f.get('supplierNote') ?? ''),
      sortOrder: Number(f.get('sortOrder') ?? 0),
      active: f.get('active') === 'on',
    };
    setBusy(true); setMsg(null);
    const r = prize
      ? await sendJson(`/api/admin/prizes/${prize.id}`, 'PATCH', body)
      : await sendJson('/api/admin/prizes', 'POST', body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Prize saved' } : r);
    if (r.ok) {
      router.refresh();
      if (!prize) e.currentTarget.reset();
    }
  }

  async function toggle() {
    if (!prize) return;
    setBusy(true); setMsg(null);
    const r = await sendJson(`/api/admin/prizes/${prize.id}`, 'PATCH', {
      name: prize.name, model: prize.model, imageUrl: prize.imageUrl, description: prize.description,
      details: prize.details, supplierNote: prize.supplierNote, sortOrder: prize.sortOrder, active: !prize.active,
    });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: prize.active ? 'Hidden from new awards' : 'Available again' } : r);
    if (r.ok) router.refresh();
  }

  if (prize && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 p-3 text-sm">
        <div>
          <span className="font-semibold">{prize.name}: {prize.model}</span>
          <span className={`ml-2 text-xs ${prize.active ? 'text-emerald-300' : 'text-[#8f8672]'}`}>{prize.active ? 'Active' : 'Hidden'}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>Edit</button>
          <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={toggle}>{prize.active ? 'Hide' : 'Show'}</button>
        </div>
        {msg && <span role="status" className={`w-full text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-white/5 bg-black/30 p-4 sm:grid-cols-2">
      <div><label className="label">Name</label><input name="name" className={field} defaultValue={prize?.name} required maxLength={60} /></div>
      <div><label className="label">Model</label><input name="model" className={field} defaultValue={prize?.model} required maxLength={120} /></div>
      <div><label className="label">Image (/prizes/… or https)</label><input name="imageUrl" className={field} defaultValue={prize?.imageUrl} required maxLength={300} /></div>
      <div><label className="label">Sort order</label><input name="sortOrder" type="number" min={0} max={999} className={field} defaultValue={prize?.sortOrder ?? 0} /></div>
      <div className="sm:col-span-2"><label className="label">Description</label><textarea name="description" rows={2} className={field} defaultValue={prize?.description} required maxLength={500} /></div>
      <div><label className="label">Details (one per line)</label><textarea name="details" rows={3} className={field} defaultValue={prize?.details.join('\n')} /></div>
      <div><label className="label">Supplier note</label><textarea name="supplierNote" rows={3} className={field} defaultValue={prize?.supplierNote} maxLength={300} /></div>
      <label className="flex items-center gap-2 text-xs text-[#b9b09a] sm:col-span-2"><input type="checkbox" name="active" defaultChecked={prize?.active ?? true} /> Available for awards</label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Saving…' : prize ? 'Save prize' : 'Add prize'}</button>
        {prize && <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => setOpen(false)}>Cancel</button>}
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

export function AwardActions({ awardId, status, prizes }: { awardId: string; status: string; prizes: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  const [prizeId, setPrizeId] = useState(prizes[0]?.id ?? '');
  const [note, setNote] = useState('');

  async function act(action: 'APPROVE' | 'REJECT' | 'FULFIL') {
    if (action === 'REJECT' && !window.confirm('Reject this milestone? The member will not receive a prize.')) return;
    setBusy(true); setMsg(null);
    const r = await sendJson(`/api/admin/milestones/awards/${awardId}`, 'POST', {
      action, prizeId: action === 'APPROVE' ? prizeId : null, note: note || null,
    });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Updated' } : r);
    if (r.ok) router.refresh();
  }

  if (status === 'QUALIFIED') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <select className="input py-1.5 text-xs" value={prizeId} onChange={(e) => setPrizeId(e.target.value)} aria-label="Prize">
            {prizes.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy || !prizeId} onClick={() => act('APPROVE')}>Approve</button>
          <button className="btn btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => act('REJECT')}>Reject</button>
        </div>
        <input className="input py-1.5 text-xs" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    );
  }
  if (status === 'APPROVED') {
    return (
      <div className="flex flex-col items-start gap-1">
        <button className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy} onClick={() => act('FULFIL')}>Mark prize handed over</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
      </div>
    );
  }
  return <span className="text-xs text-[#8f8672]">No further action</span>;
}
