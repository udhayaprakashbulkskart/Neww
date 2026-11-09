'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function OfflinePaymentForm({ paymentId, amountRupees }: { paymentId: string; amountRupees: string }) {
  const router = useRouter();
  const [bankRef, setBankRef] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'BANK' | 'CASH'>('BANK');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ method, bankRef, amountRupees: amount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: json?.error?.message ?? 'Could not confirm' });
      else { setMsg({ ok: true, text: 'Confirmed. Membership activated.' }); router.refresh(); }
    } catch {
      setMsg({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={confirm} className="flex min-w-[220px] flex-col gap-2">
      <select className="input py-1.5 text-xs" value={method} onChange={(e) => setMethod(e.target.value as 'BANK' | 'CASH')} aria-label="Payment method">
        <option value="BANK">Bank transfer</option>
        <option value="CASH">Cash received</option>
      </select>
      <input className="input py-1.5 text-xs" placeholder={method === 'CASH' ? 'Cash receipt reference' : 'Bank reference (UTR)'} value={bankRef} onChange={(e) => setBankRef(e.target.value)} required minLength={6} maxLength={120} />
      <input className="input py-1.5 text-xs" placeholder={`Amount received (${amountRupees})`} value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" />
      <button className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy}>{busy ? 'Confirming…' : 'Confirm payment'}</button>
      {msg && <span role="status" className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</span>}
    </form>
  );
}
