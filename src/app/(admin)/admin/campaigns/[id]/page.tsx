import Link from 'next/link';
import { notFound } from 'next/navigation';
import { campaignDetailForAdmin } from '@/lib/services/admin';
import { adminContext } from '@/lib/services/admin-pages';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { signedDocumentPath } from '@/lib/services/documents';
import { approvalBlockers } from '@/lib/services/campaigns';
import { AdminFrame, PageTitle, Table, Badge, statusTone, formatCell } from '@/components/admin/shell';
import { CampaignReviewActions, DocumentReviewActions, VerificationReviewActions } from '@/components/admin/actions';
import { formatDate, formatINR, formatDateTime } from '@/lib/format';
import { Notice } from '@/components/ui/primitives';

export const metadata = { title: 'Review campaign' };

export default async function CampaignReview({ params }: { params: { id: string } }) {
  const { user, perms } = await adminContext(PERMISSIONS.CAMPAIGN_VIEW);
  const c = await campaignDetailForAdmin(params.id);
  if (!c) notFound();
  const canReview = await hasPermission(user.id, PERMISSIONS.CAMPAIGN_REVIEW);
  const canPublish = await hasPermission(user.id, PERMISSIONS.CAMPAIGN_PUBLISH);
  const canDocs = await hasPermission(user.id, PERMISSIONS.DOCUMENT_REVIEW);
  const canVerify = await hasPermission(user.id, PERMISSIONS.VERIFICATION_REVIEW);
  const blockers = ['PENDING', 'UNDER_REVIEW'].includes(c.status) ? await approvalBlockers(c.id) : [];

  return (
    <AdminFrame permissions={perms} active="/admin/campaigns" name={user.fullName}>
      <PageTitle
        title={c.title}
        description={`${c.category.name} · ${c.city || 'No city'}${c.state ? `, ${c.state}` : ''} · submitted ${formatDate(c.submittedAt)}`}
        actions={
          <>
            <Badge tone={statusTone(c.status)}>{formatCell(c.status)}</Badge>
            <Link href="/admin/campaigns" className="btn-ghost btn-sm">
              Back to queue
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="surface-flat space-y-4 p-6" aria-labelledby="story-h">
            <h2 id="story-h" className="font-semibold">
              Story
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ui-muted">{c.story}</p>
            <dl className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4 text-sm md:grid-cols-4">
              <Fact label="Total debt" value={formatINR(c.totalDebtPaise)} />
              <Fact label="Already paid" value={formatINR(c.paidPaise)} />
              <Fact label="Remaining" value={formatINR(c.remainingPaise)} />
              <Fact label="Requested" value={formatINR(c.requestedPaise)} />
            </dl>
          </section>

          <section aria-labelledby="docs-h">
            <h2 id="docs-h" className="mb-3 font-semibold">
              Documents
            </h2>
            <div className="space-y-3">
              {c.documents.length === 0 && <p className="surface-flat p-5 text-sm text-ui-muted">No documents uploaded.</p>}
              {c.documents.map((d) => (
                <div key={d.id} className="surface-flat flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{formatCell(d.kind)}</p>
                    <p className="text-xs text-ui-subtle">
                      {d.mimeType} · {(d.sizeBytes / 1024).toFixed(0)} KB · uploaded {formatDateTime(d.createdAt)} · hash {d.sha256.slice(0, 12)}…
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Badge tone={statusTone(d.reviewStatus)}>{formatCell(d.reviewStatus)}</Badge>
                      {d.reviewNote && <span className="text-xs text-ui-muted">{d.reviewNote}</span>}
                      <a href={signedDocumentPath(d.id, 300)} target="_blank" rel="noopener" className="text-xs font-semibold text-mint">
                        Open file (5 min link)
                      </a>
                    </div>
                  </div>
                  {canDocs && d.reviewStatus !== 'APPROVED' && <div className="w-full md:w-80"><DocumentReviewActions documentId={d.id} /></div>}
                </div>
              ))}
            </div>
          </section>

          {canReview && (
            <section className="surface-flat p-6" aria-labelledby="dec-h">
              <h2 id="dec-h" className="mb-4 font-semibold">
                Decision
              </h2>
              {blockers.length > 0 && <div className="mb-4"><Notice tone="warning">Not ready to approve: {blockers.join('; ')}.</Notice></div>}
              <CampaignReviewActions campaignId={c.id} status={c.status} canReview={canReview} canPublish={canPublish} />
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="surface-flat space-y-3 p-6 text-sm" aria-labelledby="ben-h">
            <h2 id="ben-h" className="font-semibold">
              Beneficiary
            </h2>
            <Fact label="Name" value={c.beneficiary.fullName} />
            <Fact label="Mobile" value={`••••••${c.beneficiary.mobileLast4}`} />
            <Fact label="Address" value={[c.beneficiary.profile?.addressLine, c.beneficiary.profile?.city, c.beneficiary.profile?.pincode].filter(Boolean).join(', ') || '—'} />
            <Fact label="Account" value={formatCell(c.beneficiary.status)} />
            <Link href={`/admin/users/${c.beneficiary.id}`} className="inline-block pt-1 text-xs font-semibold text-mint">
              Open user record →
            </Link>
          </section>

          <section className="surface-flat space-y-4 p-6" aria-labelledby="ver-h">
            <h2 id="ver-h" className="font-semibold">
              Verification
            </h2>
            <ul className="space-y-3">
              {c.verifications.map((v) => (
                <li key={v.id} className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ui-muted">{formatCell(v.type)}</span>
                    <Badge tone={statusTone(v.status)}>{formatCell(v.status)}</Badge>
                  </div>
                  {canVerify && v.status !== 'VERIFIED' && <VerificationReviewActions verificationId={v.id} />}
                </li>
              ))}
              {c.verifications.length === 0 && <li className="text-sm text-ui-subtle">No verification checks started.</li>}
            </ul>
            {c.bank && (
              <div className="rounded-2xl bg-ink-900 p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-ui-subtle">Payout account</p>
                <p className="mt-1 font-medium">{c.bank.accountHolderName}</p>
                <p className="text-ui-muted">
                  XXXXXX{c.bank.accountLast4} · {c.bank.ifscCode}
                </p>
                <p className="mt-2">
                  <Badge tone={statusTone(c.bank.status)}>{formatCell(c.bank.status)}</Badge>
                </p>
              </div>
            )}
          </section>

          <section className="surface-flat space-y-3 p-6" aria-labelledby="flags-h">
            <h2 id="flags-h" className="font-semibold">
              Flags
            </h2>
            {c.fraudReports.length === 0 && <p className="text-sm text-ui-subtle">No flags raised.</p>}
            <ul className="space-y-3 text-sm">
              {c.fraudReports.map((f) => (
                <li key={f.id} className="rounded-2xl bg-ink-900 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatCell(f.ruleCode)}</span>
                    <Badge tone={statusTone(f.severity)}>{formatCell(f.severity)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ui-muted">{f.reason}</p>
                  <p className="mt-1 text-[11px] text-ui-subtle">
                    {formatCell(f.status)} · {formatDate(f.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="don-h">
            <h2 id="don-h" className="mb-3 font-semibold">
              Recent donations
            </h2>
            <Table head={['Amount', 'Receipt', 'Date']} empty="No confirmed donations.">
              {c.donations.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">{formatINR(d.amountPaise)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.receiptNumber}</td>
                  <td className="px-4 py-3 text-ui-muted">{formatDate(d.paidAt)}</td>
                </tr>
              ))}
            </Table>
          </section>
        </aside>
      </div>
    </AdminFrame>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ui-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
