'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';

export function PostUpdate({ campaignId, title }: { campaignId: string; title: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 10) return setMsg({ tone: 'error', text: 'Write at least 10 characters.' });
    setBusy(true);
    setMsg(null);
    const res = await api(`/api/campaigns/${campaignId}/updates`, { body: { body: body.trim() } });
    setBusy(false);
    if (!res.ok) return setMsg({ tone: 'error', text: res.message });
    setBody('');
    setMsg({ tone: 'success', text: 'Update posted. Donors who supported this campaign will be notified.' });
    router.refresh();
  }

  return (
    <form onSubmit={post} className="surface-flat space-y-3 p-4">
      <label htmlFor={`upd-${campaignId}`} className="text-sm font-semibold">
        {title}
      </label>
      <textarea id={`upd-${campaignId}`} className="textarea min-h-[90px]" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How are things going? Share a genuine update, without personal details of others." />
      {msg && <Notice tone={msg.tone === 'success' ? 'success' : 'error'}>{msg.text}</Notice>}
      <button type="submit" disabled={busy} className="btn-dark btn-sm w-full">
        {busy ? 'Posting…' : 'Post update'}
      </button>
    </form>
  );
}
