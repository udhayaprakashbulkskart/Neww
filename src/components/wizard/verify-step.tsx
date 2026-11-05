'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { nextStepHref, type WizardStepKey } from '@/lib/wizard';
import { Notice, StatusPill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

type Status = 'PENDING' | 'UNDER_REVIEW' | 'ADDITIONAL_INFO_REQUIRED' | 'VERIFIED' | 'REJECTED' | string;

const TONE: Record<string, 'mint' | 'amber' | 'red' | 'grey' | 'sky'> = {
  VERIFIED: 'mint',
  PENDING: 'grey',
  UNDER_REVIEW: 'sky',
  ADDITIONAL_INFO_REQUIRED: 'amber',
  REJECTED: 'red',
};

/**
 * Identity and address checks. The browser only requests a check; the provider decides and the server
 * records the result. Nothing the user types here is trusted on its own.
 */
export function VerifyStep({
  campaignId,
  step,
  status,
  endpoint,
  title,
  body,
  disabledReason,
  consentRequired,
}: {
  campaignId: string;
  step: WizardStepKey;
  status: Status;
  endpoint: string;
  title: string;
  body: string;
  disabledReason?: string;
  consentRequired?: boolean;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = status === 'VERIFIED';

  async function run() {
    setError(null);
    if (consentRequired && !consent) return setError('Please give consent before we start the check.');
    setBusy(true);
    const res = await api<{ status: string }>(endpoint, { body: consentRequired ? { consent: true } : {} });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.status !== 'VERIFIED') setError('We could not verify this yet. Check your details, then try again.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="surface flex items-start gap-4 p-5">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${verified ? 'bg-mint/15 text-mint' : 'bg-white/5 text-ui-muted'}`}>
          <Icon name={verified ? 'checkCircle' : 'shield'} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ui-muted">{body}</p>
          <div className="mt-3">
            <StatusPill tone={TONE[status] ?? 'grey'}>{status.toLowerCase().replace(/_/g, ' ')}</StatusPill>
          </div>
        </div>
      </div>

      {consentRequired && !verified && (
        <label className="surface-flat flex cursor-pointer items-start gap-3 p-4 text-sm leading-relaxed text-ui-muted">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#5CFFB1]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I consent to HelpTrust asking its authorised verification partner to check my identity. HelpTrust does not store my Aadhaar number, and I can withdraw consent by contacting support.
          </span>
        </label>
      )}

      {disabledReason && !verified && <Notice tone="warning">{disabledReason}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {verified ? (
        <button type="button" className="btn-primary w-full" onClick={() => router.push(nextStepHref(campaignId, step))}>
          Continue
        </button>
      ) : (
        <div className="space-y-3">
          <button type="button" disabled={busy || !!disabledReason} onClick={run} className="btn-primary w-full">
            {busy ? 'Checking…' : status === 'PENDING' ? 'Check status' : 'Start verification'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => router.push(nextStepHref(campaignId, step))}>
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
