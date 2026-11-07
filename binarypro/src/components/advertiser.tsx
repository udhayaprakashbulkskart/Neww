'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CURRENCIES } from '@/lib/domain/money';

type R<T> = { ok: true; data: T } | { ok: false; message: string };

async function api<T>(url: string, method: 'POST', body?: unknown): Promise<R<T>> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json?.error?.message ?? `Request failed (${res.status})` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, message: 'Network error. Try again.' };
  }
}

const field = 'input mt-1.5';
const label = 'label';

export function CreateCampaignForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setMsg(null);
    const r = await api('/api/advertiser/campaigns', 'POST', {
      title: String(f.get('title') ?? ''),
      advertiser: String(f.get('advertiser') ?? ''),
      videoUrl: String(f.get('videoUrl') ?? ''),
      durationSec: Number(f.get('durationSec')),
      rewardText: String(f.get('rewardText') ?? ''),
      currency: String(f.get('currency') ?? 'INR'),
    });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: 'ok', text: 'Campaign submitted for review. You will see it go live here once approved.' });
      e.currentTarget.reset();
      router.refresh();
    } else setMsg({ kind: 'err', text: r.message });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className={label} htmlFor="c-title">Campaign title</label><input id="c-title" name="title" className={field} required minLength={3} maxLength={160} placeholder="Spring collection launch" /></div>
      <div><label className={label} htmlFor="c-adv">Advertiser name</label><input id="c-adv" name="advertiser" className={field} required minLength={2} maxLength={120} placeholder="Your brand" /></div>
      <div><label className={label} htmlFor="c-url">Video link (https, MP4 or WebM)</label><input id="c-url" name="videoUrl" type="url" className={field} required placeholder="https://cdn.example.com/spring.mp4" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="c-dur">Length (sec)</label><input id="c-dur" name="durationSec" type="number" min={5} max={600} className={field} required defaultValue={15} /></div>
        <div><label className={label} htmlFor="c-cur">Currency</label><select id="c-cur" name="currency" className={field} defaultValue="INR">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-rew">Reward per completed view</label><input id="c-rew" name="rewardText" className={field} required inputMode="decimal" placeholder="3.00" pattern="\d+(\.\d{1,2})?" /></div>
      <button className="btn btn-brand w-full py-3" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button>
      {msg && <div role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.kind === 'ok' ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border border-red-500/30 bg-red-500/10 text-red-200'}`}>{msg.text}</div>}
    </form>
  );
}

export function TopUpButton({ campaignId, currency }: { campaignId: string; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function topUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const started = await api<{ providerRef: string }>(`/api/advertiser/campaigns/${campaignId}/topup`, 'POST', { amount });
    if (!started.ok) { setBusy(false); return setMsg(started.message); }
    const paid = await api(`/api/payments/${started.data.providerRef}/mock-pay`, 'POST');
    setBusy(false);
    if (!paid.ok) return setMsg(paid.message);
    setOpen(false); setAmount('');
    router.refresh();
  }

  if (!open) return <button className="btn btn-ghost px-3 py-2 text-xs" onClick={() => setOpen(true)}>Add budget</button>;
  return (
    <form onSubmit={topUp} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input className="input w-32 py-2 text-sm" placeholder={`Amount ${currency}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-label="Top-up amount" />
        <button className="btn btn-brand px-3 py-2 text-xs" disabled={busy}>{busy ? 'Paying…' : 'Pay'}</button>
        <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <span className="text-[11px] text-[#8f8672]">Sandbox payment. The budget is added only when the payment is confirmed.</span>
      {msg && <span className="text-xs text-red-300">{msg}</span>}
    </form>
  );
}
