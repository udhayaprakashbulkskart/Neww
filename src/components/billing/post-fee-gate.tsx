'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { formatINR } from '@/lib/format';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

type Order = { postFeeId: string; orderId: string; keyId: string; amountPaise: number; sandbox: boolean; mock: boolean; simulator: boolean };

type CheckoutCtor = new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: () => void): void };
const checkout = () => (window as unknown as { Razorpay?: CheckoutCtor }).Razorpay;

/** Paywall: each campaign post costs Rs 100. Paying opens the dashboard and allows creating a campaign. */
export function PostFeeGate({ feePaise, reason, paymentConnected }: { feePaise: number; reason: 'dashboard' | 'post'; paymentConnected: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  /** The credit appears only after the verified webhook. Poll the server, never trust the browser. */
  async function waitForCredit() {
    for (let i = 0; i < 20; i++) {
      const res = await api<{ hasDashboardAccess: boolean }>('/api/billing/status');
      if (res.ok && res.data.hasDashboardAccess) {
        router.refresh();
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setBusy(false);
    setError('Your payment is still being confirmed. This page will update when it is.');
  }

  async function start() {
    setError(null);
    setBusy(true);
    const res = await api<Order>('/api/billing/post-fee', { body: {} });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    setOrder(res.data);
    if (res.data.mock) return setBusy(false);
    openCheckout(res.data);
  }

  function openCheckout(o: Order) {
    const Ctor = checkout();
    if (!Ctor) {
      setBusy(false);
      return setError('Secure checkout is still loading. Try again in a moment.');
    }
    const rzp = new Ctor({
      key: o.keyId,
      amount: o.amountPaise,
      currency: 'INR',
      name: 'HelpTrust',
      description: 'Campaign post fee',
      order_id: o.orderId,
      theme: { color: '#5CFFB1' },
      modal: { ondismiss: () => setBusy(false) },
      handler: () => waitForCredit(),
    });
    rzp.on('payment.failed', () => {
      setBusy(false);
      setError('The payment did not go through. Please try again.');
    });
    rzp.open();
  }

  async function simulate() {
    if (!order) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/billing/post-fee/${order.postFeeId}/simulate`, { body: {} });
    if (!res.ok) {
      setBusy(false);
      return setError(res.message);
    }
    await waitForCredit();
  }

  return (
    <section className="space-y-6" aria-labelledby="gate-h">
      {order && !order.mock && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}

      <div className="surface relative overflow-hidden p-6 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mint/15 blur-3xl animate-pulse-mint" />
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/15 text-mint animate-rise">
          <Icon name="wallet" className="h-8 w-8" />
        </span>
        <p className="eyebrow mt-5">{reason === 'dashboard' ? 'Dashboard locked' : 'Post fee'}</p>
        <h1 id="gate-h" className="mt-2 text-[26px] font-extrabold tracking-tight">
          {reason === 'dashboard' ? 'Pay to open your dashboard' : 'Pay to post your campaign'}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ui-muted">
          Each campaign post costs a one-time fee of <span className="font-semibold text-ui-text">{formatINR(feePaise)}</span>. Starting and editing a campaign is free.
        </p>
        <p className="mt-5 text-4xl font-extrabold text-mint">{formatINR(feePaise)}</p>
        <p className="text-xs text-ui-subtle">per campaign post</p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {!paymentConnected && !order?.simulator ? (
        <Notice tone="info">Online payment is not connected yet, so posts cannot be paid for at the moment. Your campaign is saved and will be posted as soon as payment is available.</Notice>
      ) : order?.mock && order.simulator ? (
        <div className="surface-flat space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ui-muted">Test mode: this completes the same signed confirmation the live gateway sends. No money moves.</p>
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={simulate}>
            {busy ? 'Confirming…' : `Confirm test payment of ${formatINR(feePaise)}`}
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary w-full" disabled={busy || (!!order && !scriptReady)} onClick={start}>
          <Icon name="lock" className="h-5 w-5" />
          {busy ? 'Opening secure checkout…' : `Pay ${formatINR(feePaise)} to continue`}
        </button>
      )}

      <p className="text-center text-xs leading-relaxed text-ui-subtle">
        The fee is confirmed only after our payment provider confirms it to us. Card and UPI details are entered on the provider&apos;s secure page.
      </p>
    </section>
  );
}
