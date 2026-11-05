'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';

/** Moves a rejected campaign back to draft so the beneficiary can correct it and resubmit. */
export function ReopenButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        className="btn-primary w-full"
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await api(`/api/campaigns/${campaignId}/reopen`, { body: {} });
          if (!res.ok) {
            setBusy(false);
            return setError(res.message);
          }
          router.push(`/app/create/${campaignId}/details`);
        }}
      >
        {busy ? 'Reopening…' : 'Correct and resubmit'}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
