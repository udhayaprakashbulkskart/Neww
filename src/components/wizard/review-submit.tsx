'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';
import { WIZARD_STEPS, type WizardStepKey } from '@/lib/wizard';

type Item = { key: string; label: string; ok: boolean };

const FIX_STEP: Record<string, WizardStepKey> = {
  personal: 'personal',
  campaign: 'details',
  financial: 'financial',
  identity: 'identity',
  address: 'address',
  bank: 'bank',
};

function stepFor(item: Item): WizardStepKey {
  if (item.key.startsWith('doc:')) return 'documents';
  return FIX_STEP[item.key] ?? 'review';
}

export function ReviewSubmit({ campaignId, items, complete, summary }: { campaignId: string; items: Item[]; complete: boolean; summary: { title: string; requested: string; debt: string; city: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const res = await api(`/api/campaigns/${campaignId}/submit`, { body: {} });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.replace(`/app/status/${campaignId}/pending`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5" aria-labelledby="sum-h">
        <h2 id="sum-h" className="text-[13px] font-semibold uppercase tracking-wider text-ui-subtle">
          Summary
        </h2>
        <p className="mt-2 text-lg font-bold">{summary.title}</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ui-muted">Requested</dt>
            <dd className="font-semibold text-mint">{summary.requested}</dd>
          </div>
          <div>
            <dt className="text-ui-muted">Total debt</dt>
            <dd className="font-semibold">{summary.debt}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ui-muted">Location</dt>
            <dd className="font-semibold">{summary.city || 'Not set'}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="check-h">
        <h2 id="check-h" className="mb-3 text-[17px] font-semibold">
          Submission checklist
        </h2>
        <ul className="divide-y divide-white/[0.06] surface-flat">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
              <span className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i.ok ? 'bg-mint/15 text-mint' : 'bg-ui-warning/15 text-ui-warning'}`}>
                  <Icon name={i.ok ? 'check' : 'alert'} className="h-3.5 w-3.5" strokeWidth={2.6} />
                </span>
                {i.label}
              </span>
              {!i.ok && (
                <Link href={`/app/create/${campaignId}/${stepFor(i)}`} className="text-xs font-semibold text-mint">
                  Fix
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <label className="surface-flat flex cursor-pointer items-start gap-3 p-4 text-sm leading-relaxed text-ui-muted">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#5CFFB1]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I confirm everything here is true and complete. I understand that false information can lead to my campaign being rejected, and that knowingly giving false information may be reported to the authorities.
        </span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" disabled={!complete || !agreed || busy} onClick={submit} className="btn-primary w-full">
        {busy ? 'Submitting…' : 'Submit for verification'}
      </button>
      {!complete && <p className="text-center text-xs text-ui-subtle">Complete every item in the checklist to submit.</p>}
      <p className="text-center text-xs text-ui-subtle">{WIZARD_STEPS.length} steps · Our team usually responds within 2 working days.</p>
    </div>
  );
}
