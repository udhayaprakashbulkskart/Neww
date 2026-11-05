import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { listMyCampaigns } from '@/lib/services/campaigns';
import { db } from '@/lib/db';
import { formatINR, percent } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/state/campaign-machine';
import { TopBar } from '@/components/mobile/shell';
import { EmptyState, StatusPill } from '@/components/ui/primitives';
import { StartCampaignButton } from '@/components/wizard/create-button';
import { Icon } from '@/components/ui/icons';

export const metadata = { title: 'Create a campaign' };

const TONE: Record<string, 'mint' | 'amber' | 'red' | 'grey' | 'sky'> = {
  DRAFT: 'grey',
  PENDING: 'sky',
  UNDER_REVIEW: 'sky',
  ADDITIONAL_INFO_REQUIRED: 'amber',
  APPROVED: 'mint',
  PUBLISHED: 'mint',
  REJECTED: 'red',
  CLOSED: 'grey',
};

export default async function CreateHubPage() {
  const user = await requirePageUser('/app/create');
  const [mine, account] = await Promise.all([listMyCampaigns(user.id), db.user.findUnique({ where: { id: user.id }, select: { status: true } })]);
  const canStart = account?.status === 'ACTIVE';

  return (
    <main className="pb-36">
      <TopBar title="Create a campaign" subtitle="Verified before it goes live" />
      <div className="space-y-7 px-5">
        <section className="surface relative overflow-hidden p-6">
          <div aria-hidden="true" className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-mint/10 blur-2xl" />
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-[22px] font-bold leading-tight">Tell your story, prove it, then go live.</h2>
          <ol className="mt-5 space-y-3 text-sm text-ui-muted">
            {['Describe your situation and what you need', 'Share your ID, address and bills', 'Verify your bank account', 'Our team reviews it before donors see it'].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-xs font-bold text-mint">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-ui-subtle">You can save a draft at any step and come back later. Up to 3 open campaigns at a time.</p>
        </section>

        {canStart ? <StartCampaignButton /> : <p className="text-sm text-ui-warning">Your account must be active before you can start a campaign.</p>}

        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-3 text-[17px] font-semibold">
            Your campaigns
          </h2>
          {mine.length === 0 ? (
            <EmptyState icon="file" title="No campaigns yet" body="Drafts and submitted campaigns appear here, with their status." />
          ) : (
            <ul className="space-y-3">
              {mine.map((c) => {
                const draft = c.status === 'DRAFT' || c.status === 'ADDITIONAL_INFO_REQUIRED' || c.status === 'REJECTED';
                const href = c.status === 'DRAFT' || c.status === 'ADDITIONAL_INFO_REQUIRED' ? `/app/create/${c.id}/details` : c.status === 'REJECTED' ? `/app/status/${c.id}/pending` : `/app/status/${c.id}`;
                return (
                  <li key={c.id}>
                    <Link href={href} className="surface flex items-center gap-4 p-4 transition hover:border-mint/20">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.title === 'Untitled campaign' ? 'Untitled draft' : c.title}</p>
                        <p className="mt-1 text-xs text-ui-muted">
                          {formatINR(c.requestedPaise)} requested · {percent(c.raisedPaise, c.requestedPaise)}% funded
                        </p>
                        {c.reviewNote && <p className="mt-2 line-clamp-2 text-xs text-ui-warning">{c.reviewNote}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusPill tone={TONE[c.status] ?? 'grey'}>{STATUS_LABEL[c.status]}</StatusPill>
                        <span className="text-xs font-semibold text-mint">{draft ? 'Continue' : 'View'}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ui-subtle">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
          Your documents and bank details are encrypted and visible only to our verification team.
        </p>
      </div>
    </main>
  );
}
