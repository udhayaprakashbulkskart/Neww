'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function KycDecision({ userId }: { userId: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function decide(decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !window.confirm('Reject this sign-up? The member will not be able to withdraw until they resubmit documents.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/kyc/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: note || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: json?.error?.message ?? 'Request failed' });
      else { setMsg({ ok: true, text: decision === 'APPROVE' ? 'Approved' : 'Rejected' }); router.refresh(); }
    } catch {
      setMsg({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input className="input py-1.5 text-xs" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <div className="flex gap-2">
        <button className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy} onClick={() => decide('APPROVE')}>Approve</button>
        <button className="btn btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => decide('REJECT')}>Reject</button>
      </div>
      {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </div>
  );
}
