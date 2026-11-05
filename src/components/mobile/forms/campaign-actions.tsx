'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Icon } from '@/components/ui/icons';
import { Notice } from '@/components/ui/primitives';

/** Save, share and report actions for a campaign. Save and report need a session. */
export function CampaignActions({ slug, campaignId, saved: initialSaved, signedIn }: { slug: string; campaignId: string; saved: boolean; signedIn: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function toggleSave() {
    if (!signedIn) {
      window.location.assign(`/app/login?next=${encodeURIComponent(`/app/campaign/${slug}`)}`);
      return;
    }
    setBusy(true);
    const res = await api(`/api/campaigns/${campaignId}/save`, { method: saved ? 'DELETE' : 'POST' });
    setBusy(false);
    if (res.ok) setSaved(!saved);
    else setNote({ tone: 'error', text: res.message });
  }

  async function share() {
    const url = `${window.location.origin}/app/campaign/${slug}`;
    const data = { title: 'HelpTrust campaign', text: 'Help this verified campaign on HelpTrust', url };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(url);
      setNote({ tone: 'success', text: 'Link ready to share.' });
    } catch {
      setNote({ tone: 'error', text: 'Sharing was cancelled or is not supported here.' });
    }
  }

  async function submitReport() {
    if (reason.trim().length < 15) return setNote({ tone: 'error', text: 'Describe the concern in at least 15 characters.' });
    setBusy(true);
    const res = await api(`/api/campaigns/${campaignId}/report`, { body: { reason: reason.trim() } });
    setBusy(false);
    if (res.ok) {
      setReporting(false);
      setReason('');
      setNote({ tone: 'success', text: 'Thank you. Our fraud team will review this report.' });
    } else setNote({ tone: 'error', text: res.message });
  }

  return (
    <section aria-label="Campaign actions" className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={toggleSave} disabled={busy} aria-pressed={saved} className="btn-ghost btn-sm h-12 flex-col gap-1 rounded-2xl text-xs">
          <Icon name="bookmark" className={`h-5 w-5 ${saved ? 'fill-mint text-mint' : ''}`} />
          {saved ? 'Saved' : 'Save'}
        </button>
        <button type="button" onClick={share} className="btn-ghost btn-sm h-12 flex-col gap-1 rounded-2xl text-xs">
          <Icon name="share" className="h-5 w-5" />
          Share
        </button>
        <button
          type="button"
          onClick={() => (signedIn ? setReporting((r) => !r) : window.location.assign(`/app/login?next=${encodeURIComponent(`/app/campaign/${slug}`)}`))}
          className="btn-ghost btn-sm h-12 flex-col gap-1 rounded-2xl text-xs"
        >
          <Icon name="flag" className="h-5 w-5" />
          Report
        </button>
      </div>

      {reporting && (
        <div className="surface-flat space-y-3 p-4">
          <label htmlFor="report-reason" className="label">
            What concerns you?
          </label>
          <textarea id="report-reason" className="textarea min-h-[96px]" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe what you noticed. Do not include anyone's personal details." />
          <button type="button" onClick={submitReport} disabled={busy} className="btn-danger btn-sm w-full">
            Submit report
          </button>
        </div>
      )}

      {note && <Notice tone={note.tone === 'success' ? 'success' : 'error'}>{note.text}</Notice>}
      <p className="text-center text-xs text-ui-subtle">
        Need help with this campaign?{' '}
        <Link href="/app/help" className="text-mint">
          Contact support
        </Link>
      </p>
    </section>
  );
}
