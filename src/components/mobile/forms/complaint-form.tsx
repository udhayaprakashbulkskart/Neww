'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Notice } from '@/components/ui/primitives';

export function ComplaintForm({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 5) return setMsg({ tone: 'error', text: 'Add a short subject (5+ characters).' });
    if (body.trim().length < 20) return setMsg({ tone: 'error', text: 'Describe the issue in at least 20 characters.' });
    setBusy(true);
    setMsg(null);
    const res = await api('/api/complaints', { body: { subject: subject.trim(), body: body.trim(), campaignId } });
    setBusy(false);
    if (!res.ok) return setMsg({ tone: 'error', text: res.message });
    setSubject('');
    setBody('');
    setMsg({ tone: 'success', text: 'Thanks. Our support team will reply here and by email.' });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="c-subject" className="label">
          Subject
        </label>
        <input id="c-subject" className="input" maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" />
      </div>
      <div>
        <label htmlFor="c-body" className="label">
          Details
        </label>
        <textarea id="c-body" className="textarea" maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell us what happened. Never share your password with anyone." />
      </div>
      {msg && <Notice tone={msg.tone === 'success' ? 'success' : 'error'}>{msg.text}</Notice>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
