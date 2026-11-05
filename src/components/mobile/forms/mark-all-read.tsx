'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api('/api/notifications', { method: 'PATCH', body: {} });
        setBusy(false);
        router.refresh();
      }}
      className="btn-ghost btn-sm shrink-0"
    >
      Mark all read
    </button>
  );
}
