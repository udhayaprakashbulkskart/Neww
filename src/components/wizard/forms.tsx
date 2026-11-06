'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api, paiseToRupeeInput, rupeesToPaise } from '@/lib/client/api';
import { nextStepHref, type WizardStepKey } from '@/lib/wizard';
import { Notice } from '@/components/ui/primitives';

/** Generic save-and-continue wrapper: PATCHes one wizard step, then moves to the next. */
function useStepSave(campaignId: string, step: WizardStepKey) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: unknown, next?: string) {
    setBusy(true);
    setError(null);
    const res = await api(`/api/campaigns/${campaignId}/step/${step}`, { method: 'PATCH', body });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return false;
    }
    router.push(next ?? nextStepHref(campaignId, step));
    return true;
  }
  return { busy, error, setError, save };
}

export function FormCard({ children, onSubmit }: { children: ReactNode; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {children}
    </form>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-xs text-ui-danger">
      {message}
    </p>
  );
}

/* ---------- Step 1: campaign details ---------- */

export function DetailsForm({
  campaignId,
  initial,
  categories,
}: {
  campaignId: string;
  initial: { title: string; categorySlug: string; story: string; urgency: string };
  categories: { slug: string; name: string }[];
}) {
  const { busy, error, setError, save } = useStepSave(campaignId, 'details');
  const [title, setTitle] = useState(initial.title === 'Untitled campaign' ? '' : initial.title);
  const [categorySlug, setCategorySlug] = useState(initial.categorySlug || categories[0]?.slug || '');
  const [story, setStory] = useState(initial.story);
  const [urgency, setUrgency] = useState(initial.urgency || 'MEDIUM');
  const [endsInDays, setEndsInDays] = useState(60);

  return (
    <FormCard
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length < 10) return setError('Give your campaign a clear title (10+ characters).');
        if (story.trim().length < 100) return setError(`Describe your situation in at least 100 characters (${story.trim().length} so far).`);
        save({ title: title.trim(), categorySlug, story: story.trim(), urgency, endsInDays });
      }}
    >
      <div>
        <label htmlFor="title" className="label">
          Campaign title
        </label>
        <input id="title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Help clear my shop loan after the flood" />
      </div>

      <fieldset>
        <legend className="label">Category</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.slug} className={`chip cursor-pointer ${categorySlug === c.slug ? 'chip-active' : ''}`}>
              <input type="radio" name="category" value={c.slug} checked={categorySlug === c.slug} onChange={() => setCategorySlug(c.slug)} className="sr-only" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="story" className="label">
          Tell your story
        </label>
        <textarea id="story" className="textarea min-h-[180px]" maxLength={4000} value={story} onChange={(e) => setStory(e.target.value)} placeholder="What happened, what you need the money for, and how it affects your family. Be specific and honest." />
        <p className="mt-2 text-right text-xs text-ui-subtle">{story.length} / 4000</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="urgency" className="label">
            Urgency
          </label>
          <select id="urgency" className="select" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
        <div>
          <label htmlFor="duration" className="label">
            Open for
          </label>
          <select id="duration" className="select" value={endsInDays} onChange={(e) => setEndsInDays(Number(e.target.value))}>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </FormCard>
  );
}

/* ---------- Step 2: personal information ---------- */

export function PersonalForm({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: { fullName: string; addressLine: string; city: string; state: string; pincode: string };
}) {
  const { busy, error, setError, save } = useStepSave(campaignId, 'personal');
  const [v, setV] = useState({ ...initial, mobile: '' });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <FormCard
      onSubmit={(e) => {
        e.preventDefault();
        if (v.fullName.trim().length < 2) return setError('Enter your full name.');
        if (!/^\d{10}$/.test(v.mobile.replace(/\D/g, ''))) return setError('Enter the 10-digit mobile number you verified at sign-in.');
        if (v.addressLine.trim().length < 5) return setError('Enter your street address.');
        save({ ...v, mobile: v.mobile.replace(/\D/g, '') });
      }}
    >
      <Field id="fullName" label="Full name" value={v.fullName} onChange={set('fullName')} autoComplete="name" />
      <Field id="mobile" label="Mobile number (same as sign-in)" value={v.mobile} onChange={set('mobile')} inputMode="numeric" placeholder="10-digit number" autoComplete="tel-national" />
      <div>
        <label htmlFor="addressLine" className="label">
          Address
        </label>
        <textarea id="addressLine" className="textarea min-h-[96px]" value={v.addressLine} onChange={(e) => setV({ ...v, addressLine: e.target.value })} placeholder="House number, street, area" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id="city" label="City" value={v.city} onChange={set('city')} />
        <Field id="state" label="State" value={v.state} onChange={set('state')} />
      </div>
      <Field id="pincode" label="Pincode" value={v.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </FormCard>
  );
}

/* ---------- Step 3: financial details ---------- */

export function FinancialForm({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: { totalDebtPaise: number; paidPaise: number; requestedPaise: number };
}) {
  const { busy, error, setError, save } = useStepSave(campaignId, 'financial');
  const [total, setTotal] = useState(paiseToRupeeInput(initial.totalDebtPaise));
  const [paid, setPaid] = useState(paiseToRupeeInput(initial.paidPaise));
  const [requested, setRequested] = useState(paiseToRupeeInput(initial.requestedPaise));

  const totalP = rupeesToPaise(total || 0);
  const paidP = rupeesToPaise(paid || 0);
  const remainingP = Number.isFinite(totalP) && Number.isFinite(paidP) ? Math.max(0, totalP - paidP) : 0;
  const fmt = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;

  return (
    <FormCard
      onSubmit={(e) => {
        e.preventDefault();
        const t = rupeesToPaise(total), p = rupeesToPaise(paid || 0), r = rupeesToPaise(requested);
        if (!Number.isFinite(t) || t <= 0) return setError('Enter the total debt.');
        if (!Number.isFinite(r) || r < 10_000) return setError('Requested amount must be at least ₹100.');
        if (p > t) return setError('Amount already paid cannot be more than the total debt.');
        if (r > t - p) return setError(`You can request up to the remaining balance (${fmt(t - p)}).`);
        save({ totalDebtPaise: t, paidPaise: p, requestedPaise: r });
      }}
    >
      <Money id="total" label="Total debt" value={total} onChange={setTotal} hint="Everything you owe for this need, in total." />
      <Money id="paid" label="Amount already paid" value={paid} onChange={setPaid} hint="Payments made so far. Leave blank if none." />
      <div className="surface-flat flex items-center justify-between p-4">
        <span className="text-sm text-ui-muted">Remaining balance</span>
        <span className="text-lg font-bold text-mint">{fmt(remainingP)}</span>
      </div>
      <Money id="requested" label="Amount you are requesting" value={requested} onChange={setRequested} hint={`Up to ${fmt(remainingP)}. Donations go directly toward this amount.`} />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </FormCard>
  );
}

/* ---------- Step 7: bank account ---------- */

export function BankForm({ campaignId, existing }: { campaignId: string; existing: { holder: string; account: string; ifsc: string; bank: string | null; status: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ accountHolderName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await api('/api/verifications/bank', { body: { ...v, ifscCode: v.ifscCode.toUpperCase() } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.push(nextStepHref(campaignId, 'bank'));
  }

  return (
    <div className="space-y-6">
      {existing && (
        <div className="surface-flat p-4 text-sm">
          <p className="text-ui-muted">Current payout account</p>
          <p className="mt-1 font-semibold">
            {existing.bank ?? 'Bank'} · {existing.account}
          </p>
          <p className="text-xs text-ui-subtle">
            {existing.ifsc} · status: {existing.status.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
      )}
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Field id="holder" label="Account holder name" value={v.accountHolderName} onChange={(e) => setV({ ...v, accountHolderName: e.target.value })} autoComplete="off" />
        <Field id="acc" label="Account number" value={v.accountNumber} onChange={(e) => setV({ ...v, accountNumber: e.target.value.replace(/\D/g, '') })} inputMode="numeric" autoComplete="off" />
        <Field id="acc2" label="Re-enter account number" value={v.confirmAccountNumber} onChange={(e) => setV({ ...v, confirmAccountNumber: e.target.value.replace(/\D/g, '') })} inputMode="numeric" autoComplete="off" />
        <Field id="ifsc" label="IFSC code" value={v.ifscCode} onChange={(e) => setV({ ...v, ifscCode: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" maxLength={11} />
        <Field id="bank" label="Bank name (optional)" value={v.bankName} onChange={(e) => setV({ ...v, bankName: e.target.value })} />
        <p className="text-xs leading-relaxed text-ui-subtle">
          The account must be in your own name. We verify it with a name-match check before any payout. Full account numbers are encrypted and never shown publicly.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Verifying account…' : 'Verify and continue'}
        </button>
      </form>
    </div>
  );
}

/* ---------- Shared field primitives ---------- */

export function Field({
  id,
  label,
  value,
  onChange,
  ...rest
}: { id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="input" value={value} onChange={onChange} {...rest} />
    </div>
  );
}

export function Money({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ui-muted">₹</span>
        <input id={id} inputMode="numeric" className="input pl-9" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" />
      </div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-ui-subtle">{hint}</p>}
    </div>
  );
}
