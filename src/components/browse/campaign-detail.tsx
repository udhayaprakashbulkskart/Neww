import Link from 'next/link';
import { getPublicCampaign } from '@/lib/services/campaigns';
import { formatDate, formatINR, formatINRCompact, daysLeft, initials } from '@/lib/format';
import { CampaignImage, ProgressBar, VerifiedBadge } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { CampaignActions } from '@/components/mobile/forms/campaign-actions';
import { STATUS_LABEL } from '@/lib/state/campaign-machine';

type Detail = NonNullable<Awaited<ReturnType<typeof getPublicCampaign>>>;

const DOC_LABEL: Record<string, string> = {
  IDENTITY: 'Government ID',
  ADDRESS: 'Address proof',
  INCOME: 'Income proof',
  LOAN_STATEMENT: 'Loan statement',
  MEDICAL_BILL: 'Medical bill',
  EDUCATION_FEE: 'Fee receipt',
  BANK_PROOF: 'Bank proof',
  OTHER: 'Supporting document',
};

/**
 * Campaign detail. Shared by the app (mobile) and the website. Personal details stay masked:
 * the beneficiary appears by first name and last initial, and donors who chose anonymity are hidden.
 */
export function CampaignDetail({ c, mobile = true, viewerSignedIn }: { c: Detail; mobile?: boolean; viewerSignedIn: boolean }) {
  const days = daysLeft(c.endsAt);
  const donateHref = `/app/donate/${c.slug}`;
  const hasPhoto = !!c.imageUrl;
  const closed = c.status === 'CLOSED' || c.fundingPercent >= 100;

  return (
    <article className={`${mobile ? 'pb-36' : 'pb-16'}`}>
      <div className={`relative ${mobile ? 'h-[340px]' : 'h-[420px] rounded-[32px] overflow-hidden'}`}>
        <CampaignImage src={c.imageUrl} name={c.beneficiaryName} className="h-full w-full" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 space-y-3">
          <VerifiedBadge className="bg-mint/90 text-ink-950" />
          <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight">{c.title}</h1>
        </div>
      </div>

      <div className="space-y-6 px-5 pt-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-mint">
            {initials(c.beneficiaryName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.beneficiaryName}</p>
            <p className="flex items-center gap-1 text-xs text-ui-muted">
              <Icon name="map" className="h-3.5 w-3.5" />
              {c.city || 'India'}
              {c.state ? `, ${c.state}` : ''} · {c.category.name}
            </p>
          </div>
          <span className="pill bg-white/5 text-ui-muted">{STATUS_LABEL[c.status]}</span>
        </div>

        <section className="surface p-5" aria-label="Funding">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-ui-muted">Raised</p>
              <p className="text-[28px] font-extrabold text-mint">{formatINR(c.raisedPaise)}</p>
              <p className="text-xs text-ui-muted">of {formatINR(c.requestedPaise)} requested</p>
            </div>
            <div className="text-right">
              <p className="text-[28px] font-extrabold">{c.fundingPercent}%</p>
              <p className="text-xs text-ui-muted">{days !== null ? `${days} days left` : 'Open'}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressBar value={c.fundingPercent} />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-5 text-center">
            <Stat label="Donors" value={String(c.donorCount)} />
            <Stat label="Total debt" value={formatINRCompact(c.totalDebtPaise)} />
            <Stat label="Remaining" value={formatINRCompact(c.remainingPaise)} />
          </dl>
        </section>

        <section aria-labelledby="story-h">
          <h2 id="story-h" className="mb-2 text-[17px] font-semibold">
            Their story
          </h2>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ui-muted">{c.story}</p>
        </section>

        <section className="surface-flat p-5" aria-labelledby="verify-h">
          <h2 id="verify-h" className="mb-4 flex items-center gap-2 text-[17px] font-semibold">
            <Icon name="shield" className="h-5 w-5 text-mint" />
            Verification checklist
          </h2>
          <ul className="space-y-3">
            {c.checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {item.label}
              </li>
            ))}
          </ul>
          {c.documentKinds.length > 0 && (
            <p className="mt-4 text-xs leading-relaxed text-ui-subtle">
              Reviewed document types: {c.documentKinds.map((k) => DOC_LABEL[k] ?? k).join(', ')}. Documents are private and are never published.
            </p>
          )}
        </section>

        {c.updates.length > 0 && (
          <section aria-labelledby="updates-h">
            <h2 id="updates-h" className="mb-3 text-[17px] font-semibold">
              Updates
            </h2>
            <ol className="space-y-3">
              {c.updates.map((u) => (
                <li key={u.id} className="surface-flat p-4">
                  <p className="text-[11px] uppercase tracking-wider text-ui-subtle">{formatDate(u.createdAt)}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ui-muted">{u.body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {c.recentDonations.length > 0 && (
          <section aria-labelledby="donors-h">
            <h2 id="donors-h" className="mb-3 text-[17px] font-semibold">
              Recent support
            </h2>
            <ul className="divide-y divide-white/[0.06] rounded-3xl border border-white/[0.06] bg-ink-850">
              {c.recentDonations.map((d, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-ui-muted">{d.donorName}</span>
                  <span className="font-semibold">{formatINR(d.amountPaise)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <CampaignActions slug={c.slug} campaignId={c.id} saved={c.saved} signedIn={viewerSignedIn} />
        {!closed && c.status === 'PUBLISHED' && (
          <div className={`${mobile ? 'fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-white/[0.06] bg-ink-950/95 p-4 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur-xl' : 'mt-8'}`}>
            <Link href={viewerSignedIn ? donateHref : `/app/login?next=${encodeURIComponent(donateHref)}`} className="btn-primary w-full">
              Donate to {c.beneficiaryName.split(' ')[0]}
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>
          </div>
        )}
        {!hasPhoto && <span className="sr-only">No approved photo has been published for this campaign yet.</span>}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ui-subtle">{label}</dt>
      <dd className="mt-1 text-base font-bold">{value}</dd>
    </div>
  );
}
