'use client';

import { useState } from 'react';
import { teamApi } from '@/lib/team/client';
import { btnPrimary, card, inputBase, Notice } from './ui';

export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await teamApi('/api/team/auth/password', { body: { currentPassword: current, newPassword: next } });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} max-w-lg space-y-4 p-6`}>
      <h2 className="text-lg font-bold">Change password</h2>
      <p className="text-sm text-tp-muted">Changing your password signs out your other devices.</p>
      {error && <Notice>{error}</Notice>}
      {done && <Notice tone="success">Your password has been changed.</Notice>}
      <input className={inputBase} type="password" placeholder="Current password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <input className={inputBase} type="password" placeholder="New password (10+ characters)" autoComplete="new-password" minLength={10} required value={next} onChange={(e) => setNext(e.target.value)} />
      <input className={inputBase} type="password" placeholder="Confirm new password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
