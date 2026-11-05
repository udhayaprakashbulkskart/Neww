'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { setPendingOtp } from '@/lib/client/pending-otp';
import { Notice } from '@/components/ui/primitives';

export function LoginForm({ next }: { next?: string }) {
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    const res = await api('/api/auth/otp/request', { body: { mobile: digits, purpose: 'LOGIN' } });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setPendingOtp({ mobile: digits, purpose: 'LOGIN', next });
    window.location.assign('/app/otp');
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="mobile" className="label">
          Mobile number
        </label>
        <div className="flex gap-2">
          <span className="input flex w-[78px] shrink-0 items-center justify-center text-ui-muted">+91</span>
          <input
            id="mobile"
            name="mobile"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            placeholder="98765 43210"
            className="input"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'login-error' : undefined}
          />
        </div>
        <p className="mt-2 text-xs text-ui-subtle">We send a one-time code by SMS. Standard rates may apply.</p>
      </div>

      {error && (
        <div id="login-error">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Sending code…' : 'Send OTP'}
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
