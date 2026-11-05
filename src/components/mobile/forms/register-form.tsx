'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { setPendingOtp } from '@/lib/client/pending-otp';
import { Notice } from '@/components/ui/primitives';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = mobile.replace(/\D/g, '');
    if (fullName.trim().length < 2) return setError('Enter your full name as it appears on your ID.');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Enter a valid 10-digit mobile number.');
    if (!consent) return setError('Please accept the Terms and Privacy Policy to continue.');

    setBusy(true);
    const res = await api('/api/auth/otp/request', {
      body: { mobile: digits, purpose: 'REGISTER', fullName: fullName.trim(), consent: true },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setPendingOtp({ mobile: digits, purpose: 'REGISTER', fullName: fullName.trim(), consent: true });
    window.location.assign('/app/otp');
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="fullName" className="label">
          Full name
        </label>
        <input id="fullName" className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As on your government ID" />
      </div>
      <div>
        <label htmlFor="mobile" className="label">
          Mobile number
        </label>
        <div className="flex gap-2">
          <span className="input flex w-[78px] shrink-0 items-center justify-center text-ui-muted">+91</span>
          <input id="mobile" inputMode="numeric" autoComplete="tel-national" maxLength={14} className="input" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
      </div>

      <label className="surface-flat flex cursor-pointer items-start gap-3 p-4 text-sm leading-relaxed text-ui-muted">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#5CFFB1]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I agree to the{' '}
          <Link href="/terms" className="text-mint">
            Terms
          </Link>
          , the{' '}
          <Link href="/privacy" className="text-mint">
            Privacy Policy
          </Link>{' '}
          and consent to HelpTrust collecting my details for verification as described there.
        </span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Sending code…' : 'Continue'}
      </button>
      <p className="text-center text-sm text-ui-muted">
        Already have an account?{' '}
        <Link href="/app/login" className="font-semibold text-mint">
          Log in
        </Link>
      </p>
    </form>
  );
}
