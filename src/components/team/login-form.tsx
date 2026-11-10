'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { teamApi } from '@/lib/team/client';
import { btnPrimary, inputBase, Notice } from './ui';

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await teamApi('/api/team/auth/login', { body: { phone, password } });
      router.replace('/team');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Notice>{error}</Notice>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-tp-ink">Phone number</span>
        <input
          className={inputBase}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="username"
          placeholder="+91 98765 43210"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-tp-ink">Password</span>
        <input
          className={inputBase}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-3`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-xs text-tp-muted">Accounts are created by a team administrator.</p>
    </form>
  );
}
