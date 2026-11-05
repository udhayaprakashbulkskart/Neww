'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

export function StartCampaignButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await api<{ id: string }>('/api/campaigns', { body: {} });
          if (!res.ok) {
            setBusy(false);
            return setError(res.message);
          }
          router.push(`/app/create/${res.data.id}/details`);
        }}
        className="btn-primary w-full"
      >
        <Icon name="plus" className="h-5 w-5" />
        {busy ? 'Starting…' : 'Start a new campaign'}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
