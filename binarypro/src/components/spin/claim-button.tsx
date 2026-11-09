'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ClaimButton({ spinId, enabled }: { spinId: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!enabled) {
    return (
      <span className="text-xs text-[#8f8672]">
        Held. <a className="underline text-[#f7e09a]" href="/dashboard">Activate a paid membership</a> to claim.
      </span>
    );
  }
  async function claim() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/spin/claims/${spinId}/claim`, { method: 'POST', credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(json?.error?.message ?? 'Could not claim this reward');
      else { setMsg('Claimed'); router.refresh(); }
    } catch {
      setMsg('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn btn-brand px-3 py-1.5 text-xs" disabled={busy} onClick={claim}>{busy ? 'Claiming…' : 'Claim reward'}</button>
      {msg && <span role="status" className="text-xs text-[#cfc6b0]">{msg}</span>}
    </div>
  );
}
