'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useT } from '@/components/region/region-context';

/** A labelled field with an optional hint. Keeps spacing and label style identical everywhere. */
function Field({ id, label, hint, children, className = '' }: { id: string; label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#e8e0cc]">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-[#8f8672]">{hint}</p>}
    </div>
  );
}

const input = 'input h-11 text-[15px]';

/** A numbered card that groups related fields. */
function StepCard({ step, title, subtitle, children }: { step: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ff6a00,#d4af37)] text-sm font-black text-black">{step}</span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm leading-relaxed text-[#8f8672]">{subtitle}</p>}
        </div>
      </header>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Upload area: a dashed drop zone that shows the chosen file name. */
function FileField({ id, name, label, hint, chooseLabel, noFileLabel }: { id: string; name: string; label: string; hint?: string; chooseLabel: string; noFileLabel: string }) {
  const [file, setFile] = useState<string | null>(null);
  return (
    <Field id={id} label={label} hint={hint} className="sm:col-span-2">
      <label htmlFor={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3.5 transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/[0.04] ${file ? 'border-[#d4af37]/50 bg-[#d4af37]/[0.05]' : 'border-white/15 bg-black/40'}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#f7e09a]" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{file ?? chooseLabel}</span>
          <span className="block truncate text-xs text-[#8f8672]">{file ? '' : noFileLabel}</span>
        </span>
        <input
          id={id}
          name={name}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
        />
      </label>
    </Field>
  );
}

/** Create-account form: referral, contact, bank account and identity documents. */
export function RegisterForm({ ref }: { ref?: string }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    if (ref) data.set('ref', ref);
    if (String(data.get('accountNumber')) !== String(data.get('accountNumberConfirm'))) {
      setError(t('auth.accountMismatch'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', body: data, credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? `${t('auth.signUpFailed')} (${res.status})`);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('common.networkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" encType="multipart/form-data">
      {/* Referral: the one field every new member needs, so it sits in its own highlighted box. */}
      <div className="rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/[0.06] p-4 sm:p-5">
        <Field id="referral" label={t('auth.referralLabel')} hint={t('auth.referralHint')}>
          <input id="referral" name="referral" className={`${input} font-mono uppercase tracking-wider`} required maxLength={32} placeholder="BP…" autoComplete="off" defaultValue="" />
        </Field>
      </div>

      <StepCard step={1} title={t('auth.detailsTitle')}>
        <Field id="name" label={t('auth.fullName')} className="sm:col-span-1">
          <input id="name" name="name" className={input} required minLength={2} maxLength={80} autoComplete="name" />
        </Field>
        <Field id="phone" label={t('auth.mobile')}>
          <input id="phone" name="phone" type="tel" inputMode="tel" className={input} required maxLength={20} placeholder={t('auth.mobilePlaceholder')} autoComplete="tel-national" />
        </Field>
        <Field id="email" label={t('auth.emailLabel')} className="sm:col-span-2">
          <input id="email" name="email" type="email" className={input} required autoComplete="email" />
        </Field>
        <Field id="password" label={t('auth.passwordLabel')} hint={t('auth.passwordHint')} className="sm:col-span-2">
          <input id="password" name="password" type="password" className={input} required minLength={10} maxLength={128} autoComplete="new-password" />
        </Field>
      </StepCard>

      <StepCard step={2} title={t('auth.bankTitle')} subtitle={t('auth.bankSubtitle')}>
        <Field id="accountHolder" label={t('auth.accountHolder')} className="sm:col-span-2">
          <input id="accountHolder" name="accountHolder" className={input} required maxLength={120} autoComplete="off" />
        </Field>
        <Field id="bankName" label={t('auth.bankName')}>
          <input id="bankName" name="bankName" className={input} required maxLength={80} autoComplete="off" />
        </Field>
        <Field id="ifsc" label={t('auth.bankCode')}>
          <input id="ifsc" name="ifsc" className={`${input} font-mono uppercase tracking-wide`} required maxLength={11} placeholder="SBIN0001234" autoComplete="off" />
        </Field>
        <Field id="accountNumber" label={t('auth.accountNumber')}>
          <input id="accountNumber" name="accountNumber" inputMode="numeric" className={`${input} font-mono tracking-wide`} required maxLength={30} autoComplete="off" />
        </Field>
        <Field id="accountNumberConfirm" label={t('auth.accountNumberAgain')}>
          <input id="accountNumberConfirm" name="accountNumberConfirm" inputMode="numeric" className={`${input} font-mono tracking-wide`} required maxLength={30} autoComplete="off" />
        </Field>
      </StepCard>

      <StepCard step={3} title={t('auth.identityTitle')} subtitle={t('auth.identitySubtitle')}>
        <FileField id="aadhaar" name="aadhaar" label={t('auth.aadhaar')} chooseLabel={t('auth.chooseFile')} noFileLabel={t('auth.noFile')} />
        <FileField id="pan" name="pan" label={t('auth.pan')} chooseLabel={t('auth.chooseFile')} noFileLabel={t('auth.noFile')} />
      </StepCard>

      <div className="space-y-4 pt-1">
        <p className="flex items-start gap-2.5 text-xs leading-relaxed text-[#8f8672]">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-[#f7e09a]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span>{t('auth.documentsNote')}</span>
        </p>
        <button className="btn btn-brand h-12 w-full text-[15px]" disabled={busy}>{busy ? t('auth.registerPending') : t('auth.createAccountButton')}</button>
        {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      </div>
    </form>
  );
}
