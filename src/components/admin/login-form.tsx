'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Logo } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

/** Staff sign-in uses the same OTP flow as members, followed by a permission check. */
export function AdminLoginForm({ forbidden }: { forbidden: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(forbidden ? 'Your account does not have access to the admin dashboard.' : null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const digits = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Enter a valid 10-digit mobile number.');
    setBusy(true);
    setError(null);
    const res = await api('/api/auth/otp/request', { body: { mobile: digits, purpose: 'LOGIN' } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setMobile(digits);
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api('/api/auth/otp/verify', { body: { mobile, purpose: 'LOGIN', code } });
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

        {step === 'mobile' ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4" noValidate>
            <label htmlFor="adm-mobile" className="mb-1 block text-xs font-medium text-ui-muted">
              Staff mobile number
            </label>
            <input id="adm-mobile" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} className="input" placeholder="10-digit number" autoComplete="tel-national" />
            {error && <Notice tone="error">{error}</Notice>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
            <label htmlFor="adm-code" className="mb-1 block text-xs font-medium text-ui-muted">
              6-digit code
            </label>
            <input id="adm-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="input text-center font-mono text-2xl tracking-[0.4em]" />
            {error && <Notice tone="error">{error}</Notice>}
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full">
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
