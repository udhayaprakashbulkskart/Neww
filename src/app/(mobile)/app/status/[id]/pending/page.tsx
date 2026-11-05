import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getOwnedCampaign } from '@/lib/services/campaigns';
import { formatDate } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/state/campaign-machine';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';
import { Notice, StatusPill } from '@/components/ui/primitives';
import { ReopenButton } from '@/components/mobile/forms/reopen-button';

export const metadata = { title: 'Campaign status' };

const STEPS = ['Submitted', 'Under review', 'Verification', 'Decision'] as const;

export default async function PendingStatusPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/status/${params.id}/pending`);
  let c;
  try {
    c = await getOwnedCampaign(user.id, params.id);
  } catch {
    notFound();
  }
  const reached = c.status === 'PENDING' ? 1 : c.status === 'UNDER_REVIEW' ? 2 : c.status === 'ADDITIONAL_INFO_REQUIRED' ? 2 : c.status === 'REJECTED' ? 4 : 1;
  const docLabel = (k: string) => k.toLowerCase().replace(/_/g, ' ');

  return (
    <main className="pb-12">
      <TopBar back="/app/create" title="Campaign status" subtitle={c.title} />
      <div className="space-y-6 px-5">
        <section className="surface p-6 text-center">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${c.status === 'REJECTED' ? 'bg-ui-danger/10 text-ui-danger' : c.status === 'ADDITIONAL_INFO_REQUIRED' ? 'bg-ui-warning/10 text-ui-warning' : 'bg-mint/10 text-mint'} animate-rise`}>
            <Icon name={c.status === 'REJECTED' ? 'x' : c.status === 'ADDITIONAL_INFO_REQUIRED' ? 'alert' : 'clock'} className="h-9 w-9" strokeWidth={1.6} />
          </div>
          <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">{c.status === 'PENDING' ? 'Pending approval' : STATUS_LABEL[c.status]}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ui-muted">
            {c.status === 'PENDING' && 'Thanks for submitting. A verification officer will review your campaign. Most reviews take 2 working days.'}
            {c.status === 'UNDER_REVIEW' && 'A verification officer is checking your documents and verification results.'}
            {c.status === 'ADDITIONAL_INFO_REQUIRED' && 'We need a few more details before we can continue. See the note below.'}
            {c.status === 'REJECTED' && 'This campaign was not approved. You can correct it and submit again.'}
            {c.status === 'DRAFT' && 'This campaign is still a draft. Finish the steps to submit it.'}
          </p>
          {c.submittedAt && <p className="mt-3 text-xs text-ui-subtle">Submitted {formatDate(c.submittedAt)}</p>}
        </section>

        {(c.reviewNote || c.rejectionReason) && (
          <Notice tone={c.status === 'REJECTED' ? 'error' : 'warning'}>
            <span className="font-semibold">From our team: </span>
            {c.rejectionReason ?? c.reviewNote}
          </Notice>
        )}

        <ol className="surface-flat space-y-5 p-5" aria-label="Progress">
          {STEPS.map((label, i) => {
            const done = i < reached;
            const current = i === reached - 1 && c.status !== 'REJECTED';
            return (
              <li key={label} className="flex items-center gap-4">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-mint text-ink-950' : 'bg-white/5 text-ui-subtle'} ${current ? 'shadow-glow' : ''}`}>
                  {done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-sm ${done ? 'font-semibold text-ui-text' : 'text-ui-subtle'}`}>{label}</span>
              </li>
            );
          })}
        </ol>

        <section aria-labelledby="docs-h" className="surface-flat p-5">
          <h2 id="docs-h" className="mb-4 font-semibold">
            Document status
          </h2>
          {c.documents.length === 0 ? (
            <p className="text-sm text-ui-muted">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize text-ui-muted">{docLabel(d.kind)}</span>
                  <StatusPill tone={d.reviewStatus === 'APPROVED' ? 'mint' : d.reviewStatus === 'REJECTED' ? 'red' : d.reviewStatus === 'ADDITIONAL_REQUIRED' ? 'amber' : 'grey'}>
                    {d.reviewStatus.toLowerCase().replace(/_/g, ' ')}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-3">
          {(c.status === 'DRAFT' || c.status === 'ADDITIONAL_INFO_REQUIRED') && (
            <Link href={`/app/create/${c.id}/details`} className="btn-primary w-full">
              Continue editing
            </Link>
          )}
          {c.status === 'REJECTED' && <ReopenButton campaignId={c.id} />}
          <Link href="/app/help" className="btn-ghost w-full">
            Ask a question
          </Link>
        </div>
      </div>
    </main>
  );
}
