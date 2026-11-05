'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Logo } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

/** Staff sign-in with mobile and password, followed by a permission check. */
export function AdminLoginForm({ forbidden }: { forbidden: boolean }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(forbidden ? 'Your account does not have access to the admin dashboard.' : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api('/api/auth/login', { body: { mobile: mobile.replace(/\D/g, ''), password } });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    const me = await api<{ staffPermissions: string[] }>('/api/auth/me');
    if (!me.ok || me.data.staffPermissions.length === 0) {
      await api('/api/auth/logout', { body: {} });
      setBusy(false);
      return setError('This account does not have access to the admin dashboard.');
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 p-6">
      <div className="surface w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-bold">HelpTrust Admin</p>
            <p className="text-xs text-ui-subtle">Authorised staff only</p>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-ui-muted">Every sign-in and action on this dashboard is audited.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="adm-mobile" className="mb-1 block text-xs font-medium text-ui-muted">
              Staff mobile number
            </label>
            <input id="adm-mobile" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} className="input" placeholder="10-digit number" autoComplete="username" />
          </div>
          <div>
            <label htmlFor="adm-password" className="mb-1 block text-xs font-medium text-ui-muted">
              Password
            </label>
            <input id="adm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
