'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';

/**
 * Waits for the webhook to confirm a donation. Polls the server (never trusts the browser) every 2s
 * for up to 40s, then tells the donor it is still being confirmed and that they will be notified.
 */
export function PollDonation({ donationId, targetPath }: { donationId: string; targetPath: 'success' | 'failed' }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function tick() {
      if (cancelled) return;
      attempts += 1;
      const res = await api<{ status: string }>(`/api/donations/${donationId}`);
      if (cancelled) return;
      if (res.ok && res.data.status === 'SUCCESS') return router.replace(`/app/donate/success/${donationId}`);
      if (res.ok && res.data.status === 'FAILED') return router.replace(`/app/donate/failed/${donationId}`);
      if (attempts >= 20) return setTimedOut(true);
      setTimeout(tick, 2000);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [donationId, router, targetPath]);

  if (timedOut) {
    return (
      <p className="text-sm leading-relaxed text-ui-muted">
        Your payment is still being confirmed by the bank. You will get a notification and a receipt as soon as it is confirmed. You can close this screen.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm text-ui-muted" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      <span className="flex items-center gap-1.5">
        <Icon name="lock" className="h-4 w-4" />
        Confirming with your payment provider…
      </span>
    </div>
  );
}
