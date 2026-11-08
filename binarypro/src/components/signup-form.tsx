'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const field = 'input mt-2';

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-white/5 bg-black/30 p-4">
      <legend className="px-1 text-sm font-semibold text-[#f7e09a]">{title}</legend>
      {subtitle && <p className="-mt-2 text-xs text-[#8f8672]">{subtitle}</p>}
      {children}
    </fieldset>
  );
}

/** Create-account form: referral, contact, bank account and identity documents. */
export function RegisterForm({ ref }: { ref?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    if (ref) data.set('ref', ref);
    if (String(data.get('accountNumber')) !== String(data.get('accountNumberConfirm'))) {
      setError('The two account numbers do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', body: data, credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? `Sign-up failed (${res.status})`);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" encType="multipart/form-data">
      <div>
        <label className="label" htmlFor="referral">Referral number</label>
        <input id="referral" name="referral" className={`${field} uppercase`} required maxLength={32} placeholder="BP…" autoComplete="off" defaultValue="" />
        <p className="mt-1 text-xs text-[#8f8672]">The referral number of the member who invited you.</p>
      </div>

      <Section title="Your details">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" className={field} required minLength={2} maxLength={80} autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className={field} required maxLength={20} placeholder="10-digit mobile number" autoComplete="tel-national" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className={field} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className={field} required minLength={10} maxLength={128} autoComplete="new-password" />
          <p className="mt-1 text-xs text-[#8f8672]">At least 10 characters, with a letter and a number.</p>
        </div>
      </Section>

      <Section title="Bank account for payouts" subtitle="Withdrawals are paid only to this account, in your own name.">
        <div>
          <label className="label" htmlFor="accountHolder">Account holder name</label>
          <input id="accountHolder" name="accountHolder" className={field} required maxLength={120} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="bankName">Bank name</label>
          <input id="bankName" name="bankName" className={field} required maxLength={80} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="ifsc">IFSC code</label>
          <input id="ifsc" name="ifsc" className={`${field} uppercase`} required maxLength={11} placeholder="SBIN0001234" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="accountNumber">Account number</label>
          <input id="accountNumber" name="accountNumber" inputMode="numeric" className={field} required maxLength={30} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="accountNumberConfirm">Re-enter account number</label>
          <input id="accountNumberConfirm" name="accountNumberConfirm" inputMode="numeric" className={field} required maxLength={30} autoComplete="off" />
        </div>
      </Section>

      <Section title="Identity documents" subtitle="JPG, PNG or PDF, up to 5 MB each. For Aadhaar, upload a masked copy that shows only the last 4 digits.">
        <div>
          <label className="label" htmlFor="aadhaar">Aadhaar (masked copy)</label>
          <input id="aadhaar" name="aadhaar" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-2 block w-full text-sm text-[#cfc6b0] file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" />
        </div>
        <div>
          <label className="label" htmlFor="pan">PAN card</label>
          <input id="pan" name="pan" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-2 block w-full text-sm text-[#cfc6b0] file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" />
        </div>
      </Section>

      <p className="text-xs text-[#8f8672]">Your documents are stored encrypted and used only to verify your identity. Withdrawals unlock once an administrator approves them.</p>

      <button className="btn btn-brand w-full py-3.5" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    </form>
  );
}
