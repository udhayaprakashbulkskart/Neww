'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Result = { ok: boolean; text: string } | null;

async function send(url: string, method: 'POST' | 'PATCH', body?: unknown): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, text: json?.error?.message ?? 'Request failed' };
    return { ok: true, text: 'Saved' };
  } catch {
    return { ok: false, text: 'Network error. Try again.' };
  }
}

const field = 'input mt-1.5';

function Status({ r }: { r: Result }) {
  if (!r) return null;
  return <span role="status" className={`text-xs ${r.ok ? 'text-emerald-300' : 'text-red-300'}`}>{r.text}</span>;
}

export function SpinSettingsForm({ enabled, cooldownDays }: { enabled: boolean; cooldownDays: number }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [days, setDays] = useState(cooldownDays);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/spin/settings', 'PATCH', { enabled: on, cooldownDays: Number(days) });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Settings saved' } : r);
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Spin &amp; Win enabled</label>
      <div><label className="label" htmlFor="cooldown">Cooldown (days)</label><input id="cooldown" type="number" min={1} max={60} className={`${field} w-28`} value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>
      <button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      <Status r={msg} />
    </form>
  );
}

export function RewardCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/spin/rewards', 'POST', {
      name: String(f.get('name') ?? ''), description: String(f.get('description') ?? ''),
      kind: String(f.get('kind') ?? 'BADGE'), amountRupees: String(f.get('amountRupees') ?? '0') || '0',
    });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Reward created. Add it to a wheel to make it appear.' } : r);
    if (r.ok) { e.currentTarget.reset(); router.refresh(); }
  }
  return (
    <form onSubmit={create} className="grid gap-3 rounded-xl border border-dashed border-white/10 p-4 sm:grid-cols-2">
      <div><label className="label">Name</label><input name="name" className={field} required maxLength={80} /></div>
      <div><label className="label">Kind</label>
        <select name="kind" className={field} defaultValue="BADGE"><option value="BADGE">Badge (no money)</option><option value="VOUCHER">Voucher (staff issue it)</option></select>
      </div>
      <div className="sm:col-span-2"><label className="label">Description shown to members</label><input name="description" className={field} required maxLength={240} /></div>
      <div><label className="label">Voucher value (INR, vouchers only)</label><input name="amountRupees" inputMode="decimal" className={field} placeholder="0" /></div>
      <div className="flex items-end"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Creating…' : 'Create reward'}</button></div>
      <div className="sm:col-span-2 text-xs text-[#8f8672]">Cash rewards are not created here. They are locked from the start and activated only with documented legal approval and a verified funding source.</div>
      <Status r={msg} />
    </form>
  );
}

export function RewardEditor({ reward, cashSwitchOn }: { reward: { id: string; name: string; description: string; kind: string; amountMinor: string; active: boolean; cashLegalRef: string | null; cashFundingRef: string | null; cashActivatedAt: string | null } ; cashSwitchOn: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(reward.name);
  const [description, setDescription] = useState(reward.description);
  const [active, setActive] = useState(reward.active);
  const [legal, setLegal] = useState('');
  const [funding, setFunding] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  const isCash = reward.kind === 'CASH';
  const activated = !!reward.cashActivatedAt;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await send(`/api/admin/spin/rewards/${reward.id}`, 'PATCH', { name, description, active: isCash && !activated ? false : active });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Saved' } : r);
    if (r.ok) router.refresh();
  }
  async function activate() {
    setBusy(true); setMsg(null);
    const r = await send(`/api/admin/spin/rewards/${reward.id}/activate`, 'POST', { legalRef: legal, fundingRef: funding });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Activated' } : r);
    if (r.ok) router.refresh();
  }
  async function deactivate() {
    if (!window.confirm('Switch this cash reward off? It will stop appearing on wheels.')) return;
    setBusy(true); setMsg(null);
    const r = await send(`/api/admin/spin/rewards/${reward.id}/deactivate`, 'POST');
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Switched off' } : r);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/5 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{reward.name} <span className="text-xs text-[#8f8672]">· {reward.kind}{isCash ? ` · ${(Number(reward.amountMinor) / 100).toLocaleString('en-IN')} INR` : ''}</span></div>
        {isCash ? (
          <span className={`rounded-full px-2 py-0.5 text-xs ${activated && reward.active && cashSwitchOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-orange-500/15 text-orange-300'}`}>
            {activated ? (reward.active ? (cashSwitchOn ? 'Live' : 'Activated, platform switch off') : 'Switched off') : 'Locked'}
          </span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-xs ${reward.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-[#8f8672]'}`}>{reward.active ? 'Active' : 'Off'}</span>
        )}
      </div>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Name</label><input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={isCash && !activated ? false : active} disabled={isCash && !activated} onChange={(e) => setActive(e.target.checked)} /> Active</label>
          <button className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busy}>Save</button>
        </div>
        <div className="sm:col-span-2"><label className="label">Description</label><input className={field} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} required /></div>
      </form>
      {isCash && !activated && (
        <div className="space-y-2 rounded-lg border border-orange-500/20 p-3">
          <div className="text-xs text-orange-200">Locked. Activate only with the written legal approval reference and the verified funding source reference. Requires the platform switch SPIN_CASH_ENABLED=true{cashSwitchOn ? ' (on)' : ' (currently off)'}.</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={field} placeholder="Legal approval reference" value={legal} onChange={(e) => setLegal(e.target.value)} maxLength={120} />
            <input className={field} placeholder="Verified funding source reference" value={funding} onChange={(e) => setFunding(e.target.value)} maxLength={120} />
          </div>
          <button type="button" className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy || !legal || !funding} onClick={activate}>Activate cash reward</button>
        </div>
      )}
      {isCash && activated && (
        <div className="space-y-2 text-xs text-[#8f8672]">
          <div>Legal ref: {reward.cashLegalRef} · Funding ref: {reward.cashFundingRef}</div>
          {reward.active && <button type="button" className="btn btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={deactivate}>Switch off</button>}
        </div>
      )}
      <Status r={msg} />
    </div>
  );
}

export function SlotEditor({ slot }: { slot: { id: string; tier: string; rewardName: string; weight: number; active: boolean } }) {
  const router = useRouter();
  const [weight, setWeight] = useState(slot.weight);
  const [active, setActive] = useState(slot.active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function save() {
    setBusy(true); setMsg(null);
    const r = await send(`/api/admin/spin/slots/${slot.id}`, 'PATCH', { weight: Number(weight), active });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Saved' } : r);
    if (r.ok) router.refresh();
  }
  return (
    <tr className="border-t border-white/5">
      <td className="py-2">{slot.rewardName}</td>
      <td><input type="number" min={1} max={1000} className="input w-24 py-1 text-xs" value={weight} onChange={(e) => setWeight(Number(e.target.value))} aria-label="Weight" /></td>
      <td><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> On wheel</label></td>
      <td><button type="button" className="btn btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={save}>Save</button> <Status r={msg} /></td>
    </tr>
  );
}

export function SlotCreateForm({ rewards }: { rewards: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/spin/slots', 'POST', {
      tier: String(f.get('tier')), rewardId: String(f.get('rewardId')), weight: Number(f.get('weight') ?? 1), active: f.get('active') === 'on',
    });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Segment added' } : r);
    if (r.ok) { e.currentTarget.reset(); router.refresh(); }
  }
  return (
    <form onSubmit={create} className="grid gap-3 rounded-xl border border-dashed border-white/10 p-4 sm:grid-cols-5">
      <div><label className="label">Membership</label><select name="tier" className={field} defaultValue="SILVER"><option value="SILVER">999 (Silver)</option><option value="GOLD">2,999 (Gold)</option><option value="PLATINUM">9,999 (Platinum)</option></select></div>
      <div className="sm:col-span-2"><label className="label">Reward</label><select name="rewardId" className={field} required>{rewards.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
      <div><label className="label">Weight</label><input name="weight" type="number" min={1} max={1000} defaultValue={10} className={field} /></div>
      <div className="flex items-end gap-3"><label className="flex items-center gap-2 text-xs"><input name="active" type="checkbox" defaultChecked /> On wheel</label><button className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy}>Add</button></div>
      <Status r={msg} />
    </form>
  );
}

export function PoolFundForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function fund(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await send('/api/admin/spin/pool', 'POST', { amountRupees: String(f.get('amountRupees')), fundingRef: String(f.get('fundingRef')) });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Deposit recorded' } : r);
    if (r.ok) { e.currentTarget.reset(); router.refresh(); }
  }
  return (
    <form onSubmit={fund} className="grid gap-3 sm:grid-cols-3">
      <div><label className="label">Amount (INR)</label><input name="amountRupees" inputMode="decimal" className={field} required /></div>
      <div><label className="label">Bank or payment reference</label><input name="fundingRef" className={field} required minLength={6} maxLength={120} /></div>
      <div className="flex items-end gap-3"><button className="btn btn-brand px-4 py-2 text-sm" disabled={busy}>{busy ? 'Recording…' : 'Record deposit'}</button><Status r={msg} /></div>
      <p className="sm:col-span-3 text-xs text-[#8f8672]">Only an external deposit that you have verified in the bank may be recorded here. Membership payments never fund the pool.</p>
    </form>
  );
}

export function RedemptionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Result>(null);
  async function act(action: 'APPROVE' | 'REJECT' | 'FULFIL') {
    if (action === 'REJECT' && !window.confirm('Reject this voucher request?')) return;
    setBusy(true); setMsg(null);
    const r = await send(`/api/admin/spin/redemptions/${id}`, 'POST', { action, voucherCode: action === 'FULFIL' ? code : null });
    setBusy(false); setMsg(r.ok ? { ok: true, text: 'Updated' } : r);
    if (r.ok) router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      {status === 'REQUESTED' && (
        <div className="flex gap-2">
          <button className="btn btn-brand px-3 py-1 text-xs" disabled={busy} onClick={() => act('APPROVE')}>Approve</button>
          <button className="btn btn-danger px-3 py-1 text-xs" disabled={busy} onClick={() => act('REJECT')}>Reject</button>
        </div>
      )}
      {status === 'APPROVED' && (
        <div className="flex flex-wrap gap-2">
          <input className="input w-40 py-1 text-xs" placeholder="Voucher code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={120} />
          <button className="btn btn-brand px-3 py-1 text-xs" disabled={busy || !code.trim()} onClick={() => act('FULFIL')}>Mark issued</button>
        </div>
      )}
      <Status r={msg} />
    </div>
  );
}
