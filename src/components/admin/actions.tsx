'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';

/** Shared control styles for compact admin actions. */
const BTN = 'inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold transition disabled:opacity-40';
const BTN_MINT = `${BTN} bg-mint text-ink-950 hover:brightness-105`;
const BTN_GHOST = `${BTN} border border-white/10 text-ui-text hover:bg-white/[0.06]`;
const BTN_DANGER = `${BTN} border border-ui-danger/30 text-ui-danger hover:bg-ui-danger/10`;

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError(null);
    const res = await api(path, { method, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return false;
    }
    router.refresh();
    return true;
  }
  return { busy, error, setError, run };
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="mt-2 text-xs text-ui-danger">{text}</p>;
}

/** Campaign review controls, shown according to the campaign's current state. */
export function CampaignReviewActions({ campaignId, status, canReview, canPublish }: { campaignId: string; status: string; canReview: boolean; canPublish: boolean }) {
  const { busy, error, setError, run } = useAction();
  const [note, setNote] = useState('');
  const needsNote = (a: string) => (a === 'REQUEST_INFO' || a === 'REJECT') && note.trim().length < 3;
  const act = async (action: string) => {
    if (needsNote(action)) return setError('Add a note the beneficiary can act on.');
    await run(`/api/admin/campaigns/${campaignId}/review`, { action, note: note.trim() || undefined });
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="rev-note" className="mb-2 block text-xs font-medium text-ui-muted">
          Note to beneficiary (required to request information or reject)
        </label>
        <textarea id="rev-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="textarea min-h-[90px] text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        {canReview && status === 'PENDING' && (
          <button className={BTN_MINT} disabled={busy} onClick={() => act('START_REVIEW')}>
            Start review
          </button>
        )}
        {canReview && status === 'UNDER_REVIEW' && (
          <>
            <button className={BTN_MINT} disabled={busy} onClick={() => act('APPROVE')}>
              Approve
            </button>
            <button className={BTN_GHOST} disabled={busy} onClick={() => act('REQUEST_INFO')}>
              Request more info
            </button>
            <button className={BTN_DANGER} disabled={busy} onClick={() => act('REJECT')}>
              Reject
            </button>
          </>
        )}
        {canPublish && status === 'APPROVED' && (
          <button className={BTN_MINT} disabled={busy} onClick={() => act('PUBLISH')}>
            Publish live
          </button>
        )}
        {canReview && (status === 'APPROVED' || status === 'PUBLISHED') && (
          <button className={BTN_DANGER} disabled={busy} onClick={() => act('CLOSE')}>
            Close campaign
          </button>
        )}
        {status === 'ADDITIONAL_INFO_REQUIRED' || status === 'REJECTED' || status === 'CLOSED' ? (
          <span className="self-center text-xs text-ui-subtle">No further review actions for this status.</span>
        ) : null}
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function DocumentReviewActions({ documentId }: { documentId: string }) {
  const { busy, error, setError, run } = useAction();
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={BTN_MINT} disabled={busy} onClick={() => run(`/api/admin/documents/${documentId}/review`, { decision: 'APPROVED' })}>
          Approve
        </button>
        <button
          className={BTN_GHOST}
          disabled={busy}
          onClick={() => (note.trim().length < 3 ? setError('Add a note first.') : run(`/api/admin/documents/${documentId}/review`, { decision: 'ADDITIONAL_REQUIRED', note: note.trim() }))}
        >
          Needs more
        </button>
        <button
          className={BTN_DANGER}
          disabled={busy}
          onClick={() => (note.trim().length < 3 ? setError('Add a reason first.') : run(`/api/admin/documents/${documentId}/review`, { decision: 'REJECTED', note: note.trim() }))}
        >
          Reject
        </button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for beneficiary" maxLength={500} className="h-9 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
      <ErrorLine text={error} />
    </div>
  );
}

export function VerificationReviewActions({ verificationId }: { verificationId: string }) {
  const { busy, error, setError, run } = useAction();
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={BTN_MINT} disabled={busy} onClick={() => run(`/api/admin/verifications/${verificationId}/review`, { decision: 'VERIFIED' })}>
          Verify
        </button>
        <button
          className={BTN_GHOST}
          disabled={busy}
          onClick={() => (note.trim().length < 3 ? setError('Add a note first.') : run(`/api/admin/verifications/${verificationId}/review`, { decision: 'ADDITIONAL_INFO_REQUIRED', note: note.trim() }))}
        >
          More info
        </button>
        <button
          className={BTN_DANGER}
          disabled={busy}
          onClick={() => (note.trim().length < 3 ? setError('Add a reason first.') : run(`/api/admin/verifications/${verificationId}/review`, { decision: 'REJECTED', note: note.trim() }))}
        >
          Reject
        </button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or note" maxLength={500} className="h-9 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
      <ErrorLine text={error} />
    </div>
  );
}

export function SuspendControl({ userId, suspended }: { userId: string; suspended: boolean }) {
  const { busy, error, setError, run } = useAction();
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" maxLength={500} className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
        <button
          className={suspended ? BTN_GHOST : BTN_DANGER}
          disabled={busy}
          onClick={() => (reason.trim().length < 10 ? setError('Give a reason of at least 10 characters.') : run(`/api/admin/users/${userId}/suspend`, { suspended: !suspended, reason: reason.trim() }))}
        >
          {suspended ? 'Reinstate' : 'Suspend'}
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function RefundDecision({ refundId }: { refundId: string }) {
  const { busy, error, setError, run } = useAction();
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note" maxLength={500} className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
        <button className={BTN_MINT} disabled={busy} onClick={() => (note.trim().length < 3 ? setError('Add a note.') : run(`/api/admin/refunds/${refundId}/decide`, { decision: 'APPROVE', note: note.trim() }))}>
          Approve
        </button>
        <button className={BTN_DANGER} disabled={busy} onClick={() => (note.trim().length < 3 ? setError('Add a note.') : run(`/api/admin/refunds/${refundId}/decide`, { decision: 'REJECT', note: note.trim() }))}>
          Reject
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function FraudControl({ reportId }: { reportId: string }) {
  const { busy, error, setError, run } = useAction();
  const [resolution, setResolution] = useState('');
  const set = (status: string) => (resolution.trim().length < 3 && status !== 'UNDER_INVESTIGATION' ? setError('Record your reasoning first.') : run(`/api/admin/fraud/${reportId}`, { status, resolution: resolution.trim() || undefined }, 'PATCH'));
  return (
    <div className="space-y-2">
      <input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Reasoning (recorded in audit)" maxLength={1000} className="h-9 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text placeholder:text-ui-subtle focus:border-mint/50 focus:outline-none" />
      <div className="flex flex-wrap gap-2">
        <button className={BTN_GHOST} disabled={busy} onClick={() => set('UNDER_INVESTIGATION')}>
          Investigate
        </button>
        <button className={BTN_GHOST} disabled={busy} onClick={() => set('DISMISSED')}>
          Dismiss
        </button>
        <button className={BTN_DANGER} disabled={busy} onClick={() => set('CONFIRMED')}>
          Confirm concern
        </button>
      </div>
      <p className="text-[11px] text-ui-subtle">Confirming a concern does not suspend anyone. Suspension is a separate decision.</p>
      <ErrorLine text={error} />
    </div>
  );
}

export function ComplaintControl({ complaintId }: { complaintId: string }) {
  const { busy, error, setError, run } = useAction();
  const [response, setResponse] = useState('');
  return (
    <div className="space-y-2">
      <textarea value={response} onChange={(e) => setResponse(e.target.value)} maxLength={2000} placeholder="Reply to the user" className="textarea min-h-[70px] text-xs" />
      <div className="flex flex-wrap gap-2">
        <button className={BTN_GHOST} disabled={busy} onClick={() => run(`/api/admin/complaints/${complaintId}`, { status: 'IN_PROGRESS', response: response.trim() || undefined }, 'PATCH')}>
          In progress
        </button>
        <button
          className={BTN_MINT}
          disabled={busy}
          onClick={() => (response.trim().length < 5 ? setError('Write a reply before resolving.') : run(`/api/admin/complaints/${complaintId}`, { status: 'RESOLVED', response: response.trim() }, 'PATCH'))}
        >
          Resolve
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function StaffRoleControl({ userId, roles, options }: { userId: string; roles: string[]; options: { key: string; name: string }[] }) {
  const { busy, error, run } = useAction();
  const [role, setRole] = useState(options[0]?.key ?? '');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button key={r} className={BTN_GHOST} disabled={busy} onClick={() => run('/api/admin/staff', { userId, roleKey: r, remove: true })} title="Remove role">
            {r.toLowerCase().replace(/_/g, ' ')} ✕
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 flex-1 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-xs text-ui-text focus:outline-none">
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.name}
            </option>
          ))}
        </select>
        <button className={BTN_MINT} disabled={busy} onClick={() => run('/api/admin/staff', { userId, roleKey: role })}>
          Assign
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function SettingsControl({ settingKey, value, kind }: { settingKey: string; value: unknown; kind: 'number' | 'boolean' | 'string' }) {
  const { busy, error, setError, run } = useAction();
  const [draft, setDraft] = useState(String(value ?? ''));
  const save = (v: string | number | boolean) => run('/api/admin/settings', { key: settingKey, value: v }, 'PATCH');
  if (kind === 'boolean') {
    const on = value === true;
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-ui-muted">{on ? 'On' : 'Off'}</span>
        <button className={on ? BTN_MINT : BTN_GHOST} disabled={busy} onClick={() => save(!on)} aria-pressed={on}>
          {on ? 'Turn off' : 'Turn on'}
        </button>
        <ErrorLine text={error} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} inputMode={kind === 'number' ? 'numeric' : 'text'} className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-sm text-ui-text focus:border-mint/50 focus:outline-none" />
        <button
          className={BTN_MINT}
          disabled={busy}
          onClick={() => {
            if (kind === 'number' && !Number.isFinite(Number(draft))) return setError('Enter a number.');
            save(kind === 'number' ? Number(draft) : draft);
          }}
        >
          Save
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={BTN_GHOST}
      onClick={async () => {
        await api('/api/auth/logout', { body: {} });
        router.replace('/admin/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
