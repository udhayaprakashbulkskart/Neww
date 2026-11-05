'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { clearPendingOtp, getPendingOtp, setPendingOtp, type PendingOtp } from '@/lib/client/pending-otp';
import { Notice } from '@/components/ui/primitives';

const RESEND_SECONDS = 30;

export function OtpForm() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingOtp | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    setPending(getPendingOtp());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (pending === undefined) return <div className="skeleton mt-10 h-28" aria-busy="true" />;
  if (pending === null) {
    return (
      <div className="mt-8 space-y-4">
        <Notice tone="warning">Your session expired. Start again to receive a new code.</Notice>
        <button className="btn-primary w-full" onClick={() => router.push('/app/login')}>
          Back to login
        </button>
      </div>
    );
  }

  const masked = `+91 ••••••${pending.mobile.slice(-4)}`;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code we sent.');
    setBusy(true);
    const res = await api<{ next: string }>('/api/auth/otp/verify', { body: { mobile: pending!.mobile, purpose: pending!.purpose, code } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    clearPendingOtp();
    const next = pending!.purpose === 'REGISTER' ? '/app/user-type' : pending!.next && pending!.next.startsWith('/') ? pending!.next : res.data.next;
    router.replace(next);
    router.refresh();
  }

  async function resend() {
    if (cooldown > 0 || !pending) return;
    setError(null);
    setInfo(null);
    const res = await api('/api/auth/otp/request', {
      body: {
        mobile: pending.mobile,
        purpose: pending.purpose,
        fullName: pending.fullName,
        consent: pending.consent,
      },
    });
    if (!res.ok) return setError(res.message);
    setInfo('A new code is on its way.');
    setCooldown(RESEND_SECONDS);
    setPendingOtp(pending);
  }

  return (
    <form onSubmit={verify} className="mt-8 space-y-6" noValidate>
      <p className="text-sm leading-relaxed text-ui-muted">
        Enter the 6-digit code sent to <span className="font-semibold text-ui-text">{masked}</span>. It expires in 5 minutes.
      </p>

      <div>
        <label htmlFor="otp" className="label sr-only">
          One-time code
        </label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input h-20 text-center font-mono text-[32px] tracking-[0.5em]"
          placeholder="••••••"
          aria-invalid={!!error}
        />
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}

      <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full">
        {busy ? 'Verifying…' : 'Verify and continue'}
      </button>

      <div className="text-center text-sm text-ui-muted">
        Didn&apos;t get it?{' '}
        <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-mint disabled:text-ui-subtle">
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
