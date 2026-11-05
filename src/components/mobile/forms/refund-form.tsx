'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';

export function RefundForm({ donationId }: { donationId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 10) return setError('Tell us why you want a refund (10+ characters).');
    setBusy(true);
    const res = await api(`/api/donations/${donationId}/refund`, { body: { reason: reason.trim() } });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="refund-reason" className="label">
        Reason for refund
      </label>
      <textarea id="refund-reason" className="textarea" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: I donated by mistake." />
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className="btn-dark w-full">
        {busy ? 'Sending request…' : 'Request refund'}
      </button>
    </form>
  );
}
