import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { listMyCampaigns } from '@/lib/services/campaigns';
import { verificationSummary } from '@/lib/services/verification';
import { getProfile } from '@/lib/services/profile';
import { formatINR, formatINRCompact } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/state/campaign-machine';
import { TopBar } from '@/components/mobile/shell';
import { Avatar, EmptyState, ProgressBar, SectionHeader, StatusPill } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { PostUpdate } from '@/components/mobile/forms/post-update';

export const metadata = { title: 'Beneficiary dashboard' };

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

export default async function BeneficiaryPage() {
  const user = await requirePageUser('/app/beneficiary');
  const [campaigns, summary, profile] = await Promise.all([listMyCampaigns(user.id), verificationSummary(user.id), getProfile(user.id)]);

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.requested += c.requestedPaise;
      acc.received += c.raisedPaise;
      acc.remaining += Math.max(0, c.requestedPaise - c.raisedPaise);
      acc.donors += c.donorCount;
      return acc;
    },
    { requested: 0, received: 0, remaining: 0, donors: 0 },
  );
  const live = campaigns.filter((c) => c.status === 'PUBLISHED');

  return (
    <main className="pb-36">
      <TopBar
        title="My dashboard"
        right={
          <Link href="/app/settings" aria-label="Profile settings" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-ink-850">
            <Icon name="settings" className="h-5 w-5" />
          </Link>
        }
      />
      <div className="space-y-8 px-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.fullName}</p>
            <p className="text-sm text-ui-muted">Beneficiary · +91 ••••••{user.mobileLast4}</p>
          </div>
        </div>

        <section aria-label="Totals" className="grid grid-cols-2 gap-3">
          <Metric label="Total requested" value={formatINRCompact(totals.requested)} />
          <Metric label="Total received" value={formatINRCompact(totals.received)} accent />
          <Metric label="Remaining" value={formatINRCompact(totals.remaining)} />
          <Metric label="Donors" value={totals.donors.toLocaleString('en-IN')} />
        </section>

        <section aria-labelledby="camp-h">
          <SectionHeader title="My campaigns" action="New" href="/app/create" />
          {campaigns.length === 0 ? (
            <EmptyState icon="file" title="No campaigns yet" body="Start a campaign to request verified support." action={{ href: '/app/create', label: 'Create campaign' }} />
          ) : (
            <ul className="space-y-3">
              {campaigns.map((c) => (
                <li key={c.id} className="surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={c.status === 'PUBLISHED' ? `/app/campaign/${c.slug}` : `/app/status/${c.id}`} className="min-w-0 font-semibold leading-snug hover:text-mint">
                      <span className="line-clamp-2">{c.title === 'Untitled campaign' ? 'Untitled draft' : c.title}</span>
                    </Link>
                    <StatusPill tone={TONE[c.status] ?? 'grey'}>{STATUS_LABEL[c.status]}</StatusPill>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-ui-muted">
                        {formatINR(c.raisedPaise)} of {formatINR(c.requestedPaise)}
                      </span>
                      <span className="font-semibold text-mint">{c.fundingPercent}%</span>
                    </div>
                    <ProgressBar value={c.fundingPercent} />
                  </div>
                  <p className="mt-3 text-xs text-ui-subtle">
                    {c.donorCount} donors · {c.category.name}
                  </p>
                  {c.reviewNote && c.status === 'ADDITIONAL_INFO_REQUIRED' && <p className="mt-3 rounded-xl bg-ui-warning/10 p-3 text-xs text-ui-warning">{c.reviewNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {live.length > 0 && (
          <section aria-labelledby="upd-h">
            <SectionHeader title="Post an update" />
            <div className="space-y-3">
              {live.map((c) => (
                <PostUpdate key={c.id} campaignId={c.id} title={c.title} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="ver-h">
          <SectionHeader title="Verification status" />
          <ul className="surface-flat divide-y divide-white/[0.06]">
            {summary.items.map((i) => (
              <li key={i.type} className="flex items-center justify-between px-4 py-3.5 text-sm">
                <span>{i.label}</span>
                <StatusPill tone={i.status === 'VERIFIED' ? 'mint' : i.status === 'REJECTED' ? 'red' : i.status === 'PENDING' ? 'grey' : 'amber'}>
                  {i.status.toLowerCase().replace(/_/g, ' ')}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="prof-h" className="surface-flat p-5">
          <h2 id="prof-h" className="mb-3 font-semibold">
            Profile
          </h2>
          <p className="text-sm text-ui-muted">
            {profile.profile?.addressLine ? `${profile.profile.addressLine}, ${profile.profile.city ?? ''}` : 'Address not added yet'}
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/app/settings" className="btn-dark btn-sm flex-1">
              Edit profile
            </Link>
            <Link href="/app/notifications" className="btn-ghost btn-sm flex-1">
              Notifications
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="surface-flat p-4">
      <p className="text-xs text-ui-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-extrabold ${accent ? 'text-mint' : ''}`}>{value}</p>
    </div>
  );
}
