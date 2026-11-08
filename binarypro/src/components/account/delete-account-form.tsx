'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function DeleteAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password, confirm }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? `Could not delete the account (${res.status})`);
        return;
      }
      router.push('/login?deleted=1');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="delete-password">Your password</label>
        <input id="delete-password" type="password" className="input mt-2" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} autoComplete="current-password" />
      </div>
      <div>
        <label className="label" htmlFor="delete-confirm">Type DELETE to confirm</label>
        <input id="delete-confirm" className="input mt-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} required pattern="DELETE" autoComplete="off" />
      </div>
      <button className="btn btn-danger w-full py-3" disabled={busy || confirm !== 'DELETE' || !password}>{busy ? 'Deleting…' : 'Delete my account'}</button>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    </form>
  );
}
