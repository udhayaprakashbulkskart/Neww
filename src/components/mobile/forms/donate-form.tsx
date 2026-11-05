'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, rupeesToPaise } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';

const PRESETS = [100, 250, 500, 1000, 2500, 5000];
const MIN_RUPEES = 50;
const MAX_RUPEES = 500_000;

export function DonateForm({ campaignId, slug, title, remainingPaise, beneficiaryFirstName }: { campaignId: string; slug: string; title: string; remainingPaise: number; beneficiaryFirstName: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState<number | null>(500);
  const [custom, setCustom] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenRupees = custom ? Number(custom.replace(/[,\s₹]/g, '')) : amount ?? NaN;
  const remainingRupees = Math.floor(remainingPaise / 100);

  function validate(): string | null {
    if (!Number.isFinite(chosenRupees)) return 'Choose or enter an amount.';
    if (chosenRupees < MIN_RUPEES) return `The minimum donation is ₹${MIN_RUPEES}.`;
    if (chosenRupees > MAX_RUPEES) return `The maximum donation is ₹${MAX_RUPEES.toLocaleString('en-IN')}.`;
    if (chosenRupees > remainingRupees) return `This campaign needs ₹${remainingRupees.toLocaleString('en-IN')} more.`;
    return null;
  }

  async function continueToPay() {
    setError(null);
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    const idempotencyKey = `don_${crypto.randomUUID()}`;
    const res = await api<{ donationId: string; orderId: string | null; keyId: string; amountPaise: number; mock: boolean; sandbox: boolean; campaignTitle: string }>('/api/donations', {
      body: { campaignId, amountPaise: rupeesToPaise(chosenRupees), isAnonymous: anonymous, idempotencyKey },
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    try {
      sessionStorage.setItem(`ht.checkout.${res.data.donationId}`, JSON.stringify(res.data));
    } catch {
      // Without storage the pay page re-reads the donation from the server.
    }
    router.push(`/app/donate/${slug}/pay?d=${res.data.donationId}`);
  }

  return (
    <div className="space-y-7">
      <section aria-labelledby="amount-h">
        <h2 id="amount-h" className="mb-4 text-[17px] font-semibold">
          Choose amount
        </h2>
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Preset amounts">
          {PRESETS.map((p) => {
            const active = amount === p && !custom;
            return (
              <button
                type="button"
                key={p}
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setAmount(p);
                  setCustom('');
                }}
                className={`h-14 rounded-2xl border text-[16px] font-bold transition ${active ? 'border-mint bg-mint text-ink-950 shadow-glow-soft' : 'border-white/[0.08] bg-ink-850 text-ui-text hover:border-white/20'}`}
              >
                ₹{p.toLocaleString('en-IN')}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label htmlFor="custom" className="label">
          Or enter a custom amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ui-muted">₹</span>
          <input
            id="custom"
            inputMode="numeric"
            placeholder="Enter amount"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value.replace(/[^\d,]/g, ''));
              setAmount(null);
            }}
            className="input pl-9"
          />
        </div>
      </section>

      <section aria-labelledby="donor-h" className="space-y-3">
        <h2 id="donor-h" className="text-[17px] font-semibold">
          Donate as
        </h2>
        <label className={`surface-flat flex cursor-pointer items-center gap-4 p-4 ${!anonymous ? 'border-mint/40' : ''}`}>
          <input type="radio" name="visibility" className="h-5 w-5 accent-[#5CFFB1]" checked={!anonymous} onChange={() => setAnonymous(false)} />
          <span>
            <span className="block font-semibold">Show my name</span>
            <span className="block text-xs text-ui-muted">Your first name and last initial appear in recent support.</span>
          </span>
        </label>
        <label className={`surface-flat flex cursor-pointer items-center gap-4 p-4 ${anonymous ? 'border-mint/40' : ''}`}>
          <input type="radio" name="visibility" className="h-5 w-5 accent-[#5CFFB1]" checked={anonymous} onChange={() => setAnonymous(true)} />
          <span>
            <span className="block font-semibold">Anonymous</span>
            <span className="block text-xs text-ui-muted">Hide my name from the public. Your receipt still shows your details.</span>
          </span>
        </label>
      </section>

      <div className="surface-flat flex items-center gap-3 p-4 text-sm text-ui-muted">
        <Icon name="shield" className="h-5 w-5 shrink-0 text-mint" />
        <p>
          Your payment goes through an authorised payment provider. HelpTrust never sees your card or UPI PIN. This donation supports {beneficiaryFirstName} in &ldquo;{title}&rdquo;.
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="button" onClick={continueToPay} disabled={busy} className="btn-primary sticky bottom-4 w-full shadow-glow">
        {busy ? 'Preparing payment…' : `Continue to pay${Number.isFinite(chosenRupees) && chosenRupees > 0 ? ` · ₹${chosenRupees.toLocaleString('en-IN')}` : ''}`}
      </button>
    </div>
  );
}
