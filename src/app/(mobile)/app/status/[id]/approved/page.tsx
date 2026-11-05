import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getOwnedCampaign } from '@/lib/services/campaigns';
import { formatINR } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { Icon } from '@/components/ui/icons';
import { ProgressBar, VerifiedBadge } from '@/components/ui/primitives';

export const metadata = { title: 'Campaign approved' };

export default async function ApprovedStatusPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(`/app/status/${params.id}/approved`);
  let c;
  try {
    c = await getOwnedCampaign(user.id, params.id);
  } catch {
    notFound();
  }
  const live = c.status === 'PUBLISHED';
  const percent = c.requestedPaise > 0 ? Math.min(100, Math.round((c.raisedPaise / c.requestedPaise) * 100)) : 0;

  return (
    <main className="pb-12">
      <TopBar back="/app/create" title={live ? 'Campaign live' : 'Campaign approved'} />
      <div className="space-y-6 px-5">
        <section className="flex flex-col items-center px-2 pt-4 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-mint/15 text-mint shadow-glow animate-rise">
            <Icon name="checkCircle" className="h-14 w-14" strokeWidth={1.6} />
          </div>
          <h1 className="mt-6 text-[28px] font-extrabold tracking-tight">{live ? 'You are live' : 'Verified and approved'}</h1>
          <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-ui-muted">
            {live
              ? 'Donors can now see and support your campaign. We will tell you about every donation.'
              : 'Your campaign passed verification and will go live shortly.'}
          </p>
          <div className="mt-4">
            <VerifiedBadge />
          </div>
        </section>

        <section className="surface p-5">
          <p className="font-semibold">{c.title}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-xs text-ui-muted">Raised</p>
              <p className="text-xl font-bold text-mint">{formatINR(c.raisedPaise)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ui-muted">Requested</p>
              <p className="text-xl font-bold">{formatINR(c.requestedPaise)}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={percent} />
          </div>
          <p className="mt-3 text-xs text-ui-subtle">{c.donorCount} donors so far</p>
        </section>

        <div className="space-y-3">
          {live && (
            <Link href={`/app/campaign/${c.slug}`} className="btn-primary w-full">
              View live campaign
            </Link>
          )}
          <Link href="/app/beneficiary" className="btn-ghost w-full">
            Go to my dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
