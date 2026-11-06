'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { formatINR } from '@/lib/format';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

type Checkout = {
  donationId: string;
  orderId: string | null;
  keyId: string;
  amountPaise: number;
  mock: boolean;
  sandbox: boolean;
  simulator: boolean;
  campaignTitle: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: unknown) => void): void };
  }
}

/**
 * Opens Razorpay Checkout for the order created on the server. The browser's success callback only
 * triggers a server-side signature check. The donation becomes successful only after the webhook.
 */
export function PayPanel({ donationId, campaignSlug }: { donationId: string; campaignSlug: string }) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<Checkout | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`ht.checkout.${donationId}`);
      setCheckout(raw ? (JSON.parse(raw) as Checkout) : null);
    } catch {
      setCheckout(null);
    }
  }, [donationId]);

  if (checkout === undefined) return <div className="skeleton h-40" aria-busy="true" />;
  if (checkout === null || !checkout.orderId) {
    return (
      <div className="space-y-4">
        <Notice tone="warning">This payment session has ended. No money has been taken. Start the donation again to continue.</Notice>
        <Link href={`/app/donate/${campaignSlug}`} className="btn-primary w-full">
          Start again
        </Link>
      </div>
    );
  }
  const details = checkout;

  async function payWithCheckout() {
    setError(null);
    if (!window.Razorpay) return setError('Secure checkout is still loading. Try again in a moment.');
    setBusy(true);
    const rzp = new window.Razorpay({
      key: details.keyId,
      amount: details.amountPaise,
      currency: 'INR',
      name: 'HelpTrust',
      description: details.campaignTitle,
      order_id: details.orderId,
      theme: { color: '#5CFFB1' },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const res = await api('/api/donations/verify', {
          body: { donationId: details.donationId, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature },
        });
        if (!res.ok) {
          setBusy(false);
          return setError(res.message);
        }
        router.push(`/app/donate/success/${details.donationId}`);
      },
    });
    rzp.on('payment.failed', () => router.push(`/app/donate/failed/${details.donationId}`));
    rzp.open();
  }

  async function sandbox(outcome: 'success' | 'failed') {
    setError(null);
    setBusy(true);
    const res = await api(`/api/donations/${details.donationId}/simulate`, { body: { outcome } });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    router.push(outcome === 'success' ? `/app/donate/success/${details.donationId}` : `/app/donate/failed/${details.donationId}`);
  }

  return (
    <div className="space-y-6">
      {!details.mock && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}

      <div className="surface p-5 text-center">
        <p className="text-xs uppercase tracking-wider text-ui-subtle">You are donating</p>
        <p className="mt-1 text-[34px] font-extrabold text-mint">{formatINR(details.amountPaise)}</p>
        <p className="mt-1 text-sm text-ui-muted">{details.campaignTitle}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-ui-muted" aria-label="Accepted payment methods">
        {['UPI', 'Cards', 'Net banking', 'RuPay'].map((m) => (
          <span key={m} className="rounded-xl border border-white/[0.08] bg-ink-850 px-3 py-2">
            {m}
          </span>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {details.mock && !details.simulator ? (
        <Notice tone="info">Online payment is not connected yet. No money has been taken. Please try again later.</Notice>
      ) : details.mock ? (
        <div className="surface-flat space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ui-muted">Test mode: this completes the same signed confirmation the live gateway sends. No money moves.</p>
          <button type="button" disabled={busy} onClick={() => sandbox('success')} className="btn-primary w-full">
            {busy ? 'Processing…' : 'Confirm test payment'}
          </button>
          <button type="button" disabled={busy} onClick={() => sandbox('failed')} className="btn-ghost w-full">
            Test a failed payment
          </button>
        </div>
      ) : (
        <button type="button" disabled={busy || !scriptReady} onClick={payWithCheckout} className="btn-primary w-full">
          <Icon name="lock" className="h-5 w-5" />
          {busy ? 'Opening secure checkout…' : `Pay ${formatINR(details.amountPaise)} securely`}
        </button>
      )}

      <p className="text-center text-xs leading-relaxed text-ui-subtle">
        Your donation is confirmed only after our payment provider confirms it to us. Card and UPI details are entered on the provider&apos;s secure page.
      </p>
    </div>
  );
}
