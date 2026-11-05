'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { nextStepHref } from '@/lib/wizard';
import { Icon } from '@/components/ui/icons';
import { Notice, StatusPill } from '@/components/ui/primitives';

export type DocRow = { id: string; kind: string; mimeType: string; sizeBytes: number; reviewStatus: string; reviewNote: string | null };

const SLOTS: { kind: string; label: string; help: string; accept: string; required: boolean; multiple?: boolean }[] = [
  { kind: 'IDENTITY', label: 'Government ID', help: 'Aadhaar, PAN, passport or voter ID. Shown only to our verification team.', accept: 'application/pdf,image/jpeg,image/png', required: true },
  { kind: 'ADDRESS', label: 'Address proof', help: 'Electricity bill, ration card or bank statement from the last 3 months.', accept: 'application/pdf,image/jpeg,image/png', required: true },
  { kind: 'LOAN_STATEMENT', label: 'Loan statement', help: 'Statement showing the outstanding balance, if the debt is a loan.', accept: 'application/pdf,image/jpeg,image/png', required: false },
  { kind: 'MEDICAL_BILL', label: 'Medical bill', help: 'Hospital or pharmacy bill for the treatment you need help with.', accept: 'application/pdf,image/jpeg,image/png', required: false },
  { kind: 'EDUCATION_FEE', label: 'Fee receipt', help: 'School or college fee demand or receipt.', accept: 'application/pdf,image/jpeg,image/png', required: false },
  { kind: 'INCOME', label: 'Income proof', help: 'Salary slip, business records or a short income declaration.', accept: 'application/pdf,image/jpeg,image/png', required: false },
  { kind: 'PHOTO', label: 'Photos (optional)', help: 'Up to 5 photos. Approved photos appear on your campaign.', accept: 'image/jpeg,image/png,image/webp', required: false, multiple: true },
  { kind: 'VIDEO', label: 'Short video (optional)', help: 'One MP4 up to 25 MB, under 2 minutes.', accept: 'video/mp4', required: false },
];

const REVIEW_TONE: Record<string, 'mint' | 'amber' | 'red' | 'grey' | 'sky'> = {
  APPROVED: 'mint',
  PENDING: 'grey',
  REJECTED: 'red',
  ADDITIONAL_REQUIRED: 'amber',
};

export function DocumentsStep({ campaignId, docs, editable }: { campaignId: string; docs: DocRow[]; editable: boolean }) {
  const router = useRouter();
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(kind: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusyKind(kind);
    const limit = kind === 'PHOTO' ? 5 : kind === 'VIDEO' ? 1 : 1;
    const existing = docs.filter((d) => d.kind === kind).length;
    const list = Array.from(files).slice(0, Math.max(0, limit - existing));
    if (list.length === 0) {
      setBusyKind(null);
      return setError(`You can upload up to ${limit} ${kind === 'PHOTO' ? 'photos' : 'file'} for this item.`);
    }
    for (const file of list) {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file);
      const res = await api(`/api/campaigns/${campaignId}/documents`, { form });
      if (!res.ok) {
        setError(`${file.name}: ${res.message}`);
        break;
      }
    }
    setBusyKind(null);
    router.refresh();
  }

  const byKind = (k: string) => docs.filter((d) => d.kind === k);

  return (
    <div className="space-y-5">
      {!editable && <Notice tone="info">Documents are locked while your campaign is under review. Edit it again if we ask for more information.</Notice>}
      {SLOTS.map((slot) => {
        const uploaded = byKind(slot.kind);
        const canAdd = editable && (slot.multiple ? uploaded.length < 5 : uploaded.length === 0 || slot.kind === 'LOAN_STATEMENT' || slot.kind === 'MEDICAL_BILL' || slot.kind === 'EDUCATION_FEE' || slot.kind === 'INCOME');
        const inputId = `file-${slot.kind}`;
        return (
          <section key={slot.kind} className="surface-flat space-y-3 p-5" aria-labelledby={`${inputId}-h`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`${inputId}-h`} className="font-semibold">
                  {slot.label} {slot.required && <span className="text-ui-danger" aria-label="required">*</span>}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ui-subtle">{slot.help}</p>
              </div>
              <Icon name={slot.kind === 'PHOTO' ? 'camera' : slot.kind === 'VIDEO' ? 'camera' : 'file'} className="h-5 w-5 shrink-0 text-mint" />
            </div>

            {uploaded.length > 0 && (
              <ul className="space-y-2">
                {uploaded.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900 px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-ui-muted">
                      {d.mimeType.split('/')[1]?.toUpperCase()} · {(d.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                    <StatusPill tone={REVIEW_TONE[d.reviewStatus] ?? 'grey'}>{d.reviewStatus.toLowerCase().replace(/_/g, ' ')}</StatusPill>
                  </li>
                ))}
                {uploaded.some((d) => d.reviewNote) && (
                  <li className="text-xs text-ui-warning">Reviewer note: {uploaded.find((d) => d.reviewNote)?.reviewNote}</li>
                )}
              </ul>
            )}

            {canAdd && (
              <label htmlFor={inputId} className="btn-dark btn-sm w-full cursor-pointer">
                <Icon name="upload" className="h-4 w-4" />
                {busyKind === slot.kind ? 'Uploading…' : uploaded.length ? 'Add another' : 'Choose file'}
                <input
                  id={inputId}
                  type="file"
                  className="sr-only"
                  accept={slot.accept}
                  multiple={slot.multiple}
                  disabled={busyKind !== null}
                  onChange={(e) => {
                    upload(slot.kind, e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </section>
        );
      })}

      <p className="text-xs leading-relaxed text-ui-subtle">
        Files are checked by their content, encrypted on upload and stored privately. Only our verification team can open them. Do not upload anything you are not allowed to share.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="button" className="btn-primary w-full" onClick={() => router.push(nextStepHref(campaignId, 'documents'))}>
        Continue
      </button>
    </div>
  );
}
