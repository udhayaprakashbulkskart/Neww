'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Enter a valid 10-digit mobile number.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    const res = await api<{ next: string }>('/api/auth/login', { body: { mobile: digits, password } });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    router.replace(next && next.startsWith('/app') ? next : res.data.next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="mobile" className="label">
          Mobile number
        </label>
        <div className="flex gap-2">
          <span className="input flex w-[78px] shrink-0 items-center justify-center text-ui-muted">+91</span>
          <input id="mobile" name="mobile" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210" className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Logging in…' : 'Log in'}
      </button>

      <p className="text-center text-sm text-ui-muted">
        New to HelpTrust?{' '}
        <Link href="/app/register" className="font-semibold text-mint">
          Create an account
        </Link>
      </p>
    </form>
  );
}
