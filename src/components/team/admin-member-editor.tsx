'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { KycStatus, TeamRole } from '@prisma/client';
import { teamApi } from '@/lib/team/client';
import { KYC_LABEL_TEXT, KYC_STATUS_TEXT } from '@/lib/team/labels';
import { btnGhost, btnPrimary, card, formatBytes, inputBase, KycBadge, Notice } from './ui';

export type EditorMember = {
  id: string;
  fullName: string;
  phone: string;
  jobTitle: string | null;
  bio: string | null;
  role: TeamRole;
  active: boolean;
  kycStatus: KycStatus;
  photoUrl: string | null;
  initials: string;
};

export type EditorDoc = { id: string; label: string | null; mimeType: string; sizeBytes: number; createdAt: string; url: string };

const LABELS = Object.keys(KYC_LABEL_TEXT);

/** Administrator controls for one team member. Every change is validated and audited on the server. */
export function AdminMemberEditor({ member, documents, inGroup, isSelf }: { member: EditorMember; documents: EditorDoc[]; inGroup: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [form, setForm] = useState({
    fullName: member.fullName,
    phone: member.phone,
    jobTitle: member.jobTitle ?? '',
    bio: member.bio ?? '',
    role: member.role,
  });
  const [kyc, setKyc] = useState<KycStatus>(member.kycStatus);
  const [newPassword, setNewPassword] = useState('');
  const [docLabel, setDocLabel] = useState<string>('AADHAAR');
  const [docFile, setDocFile] = useState<File | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'success', text: success });
      router.refresh();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(null);
    }
  }

  const saveDetails = () =>
    run(
      'details',
      () => teamApi(`/api/team/members/${member.id}`, { method: 'PATCH', body: form }),
      'Profile saved.',
    );

  const saveKyc = () =>
    run('kyc', () => teamApi(`/api/team/members/${member.id}`, { method: 'PATCH', body: { kycStatus: kyc } }), 'KYC status updated.');

  const toggleActive = () =>
    run(
      'active',
      () => teamApi(`/api/team/members/${member.id}`, { method: 'PATCH', body: { active: !member.active } }),
      member.active ? 'Account deactivated. Their sessions have been signed out.' : 'Account activated.',
    );

  const toggleGroup = () =>
    run(
      'group',
      () => teamApi('/api/team/group/members', { body: { memberId: member.id, member: !inGroup } }),
      inGroup ? 'Removed from Team Group.' : 'Added to Team Group.',
    );

  const resetPassword = () =>
    run(
      'password',
      async () => {
        await teamApi(`/api/team/members/${member.id}`, { method: 'PATCH', body: { password: newPassword } });
        setNewPassword('');
      },
      'Password reset. The member must use the new password next time they sign in.',
    );

  const uploadPhoto = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    return run('photo', () => teamApi(`/api/team/members/${member.id}/photo`, { body: fd }), 'Photo updated.');
  };

  const uploadDoc = async () => {
    if (!docFile) return;
    const fd = new FormData();
    fd.append('label', docLabel);
    fd.append('file', docFile);
    await run('doc', () => teamApi(`/api/team/members/${member.id}/documents`, { body: fd }), 'Document uploaded.');
    setDocFile(null);
  };

  const removeDoc = (id: string) => {
    if (!window.confirm('Delete this KYC document? This cannot be undone.')) return;
    return run('remove-' + id, () => teamApi(`/api/team/files/${id}`, { method: 'DELETE' }), 'Document deleted.');
  };

  return (
    <div className="space-y-6">
      <Link href="/team/admin" className="text-sm font-semibold text-tp-muted hover:text-tp-purple">
        ← Back to administration
      </Link>

      {notice && <Notice tone={notice.tone === 'error' ? 'error' : 'success'}>{notice.text}</Notice>}

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className={`${card} space-y-5 p-6`}>
          <h2 className="text-lg font-bold">Profile</h2>
          <div className="flex items-center gap-4">
            {member.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-tp-lilac text-xl font-bold text-tp-purple">{member.initials}</div>
            )}
            <label className={`${btnGhost} cursor-pointer`}>
              {busy === 'photo' ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy !== null} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <p className="-mt-2 text-xs text-tp-muted">JPG, PNG or WebP, up to 4 MB.</p>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <input className={inputBase} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Phone number">
              <input className={inputBase} value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Job title">
              <input className={inputBase} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={inputBase} value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value as TeamRole })}>
                <option value="MEMBER">Team member</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </Field>
          </div>
          <Field label="About">
            <textarea className={`${inputBase} min-h-24`} value={form.bio} maxLength={1000} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <button type="button" onClick={saveDetails} disabled={busy !== null} className={btnPrimary}>
            {busy === 'details' ? 'Saving…' : 'Save profile'}
          </button>
        </section>

        <div className="space-y-6">
          <section className={`${card} space-y-4 p-6`}>
            <h2 className="text-lg font-bold">Status and access</h2>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tp-canvas p-4">
              <div>
                <p className="font-semibold">{member.active ? 'Account active' : 'Account deactivated'}</p>
                <p className="text-xs text-tp-muted">Deactivated members cannot sign in or open any chat.</p>
              </div>
              <button type="button" onClick={toggleActive} disabled={busy !== null || isSelf} className={member.active ? btnGhost : btnPrimary}>
                {member.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tp-canvas p-4">
              <div>
                <p className="font-semibold">Team Group</p>
                <p className="text-xs text-tp-muted">{inGroup ? 'Member of the common group chat.' : 'Not in the common group chat.'}</p>
              </div>
              <button type="button" onClick={toggleGroup} disabled={busy !== null} className={inGroup ? btnGhost : btnPrimary}>
                {inGroup ? 'Remove from group' : 'Add to group'}
              </button>
            </div>
            <div className="space-y-3 rounded-xl bg-tp-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">KYC verification</p>
                  <div className="mt-1">
                    <KycBadge status={member.kycStatus} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select className={`${inputBase} !w-auto min-w-0`} value={kyc} onChange={(e) => setKyc(e.target.value as KycStatus)} aria-label="KYC status">
                    {(Object.keys(KYC_STATUS_TEXT) as KycStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {KYC_STATUS_TEXT[s]}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={saveKyc} disabled={busy !== null || kyc === member.kycStatus} className={btnPrimary}>
                    Update
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className={`${card} space-y-4 p-6`}>
            <h2 className="text-lg font-bold">KYC documents</h2>
            <p className="text-xs text-tp-muted">Visible only to this member and administrators. PDF, JPG, PNG or WebP, up to 4 MB.</p>
            <div className="flex flex-col gap-3 md:flex-row">
              <select className={`${inputBase} md:w-52`} value={docLabel} onChange={(e) => setDocLabel(e.target.value)} aria-label="Document type">
                {LABELS.map((l) => (
                  <option key={l} value={l}>
                    {KYC_LABEL_TEXT[l]}
                  </option>
                ))}
              </select>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-tp-lilac file:px-3 file:py-2 file:text-sm file:font-semibold file:text-tp-purple"
              />
              <button type="button" onClick={uploadDoc} disabled={!docFile || busy !== null} className={btnPrimary}>
                {busy === 'doc' ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-tp-line p-5 text-center text-sm text-tp-muted">No documents yet.</p>
            ) : (
              <ul className="divide-y divide-tp-line rounded-xl border border-tp-line">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{d.label ? KYC_LABEL_TEXT[d.label] ?? 'Document' : 'Document'}</p>
                      <p className="text-xs text-tp-muted">
                        {formatBytes(d.sizeBytes)} · {new Date(d.createdAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <a href={d.url} className="text-xs font-semibold text-tp-purple hover:underline">
                      Open
                    </a>
                    <button type="button" onClick={() => removeDoc(d.id)} disabled={busy !== null} className="text-xs font-semibold text-rose-600 hover:underline">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${card} space-y-3 p-6`}>
            <h2 className="text-lg font-bold">Reset password</h2>
            <p className="text-xs text-tp-muted">Minimum 10 characters. This signs the member out everywhere.</p>
            <div className="flex gap-3">
              <input
                type="password"
                className={`${inputBase} min-w-0 flex-1`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="New password"
                aria-label="New password"
              />
              <button type="button" onClick={resetPassword} disabled={newPassword.length < 10 || busy !== null} className={btnGhost}>
                Reset
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-tp-muted">{label}</span>
      {children}
    </label>
  );
}
