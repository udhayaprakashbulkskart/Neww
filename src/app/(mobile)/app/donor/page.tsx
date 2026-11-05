import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getProfile } from '@/lib/services/profile';
import { listDonationsForDonor } from '@/lib/services/donations';
import { formatDate, formatINR } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { Avatar, SectionHeader, StatusPill } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/ui/icons';

export const metadata = { title: 'Donor dashboard' };

const TONE = { SUCCESS: 'mint', PENDING: 'amber', FAILED: 'red', REFUNDED: 'grey' } as const;

export default async function DonorPage() {
  const user = await requirePageUser('/app/donor');
  const [profile, donations, savedCount, refunds] = await Promise.all([
    getProfile(user.id),
    listDonationsForDonor(user.id),
    db.savedCampaign.count({ where: { userId: user.id } }),
    db.refund.findMany({ where: { requesterId: user.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, amountPaise: true, createdAt: true, donationId: true } }),
  ]);
  const confirmed = donations.filter((d) => d.status === 'SUCCESS');
  const total = confirmed.reduce((s, d) => s + d.amountPaise, 0);
  const supported = new Set(confirmed.map((d) => d.campaign.slug)).size;
  const canBeneficiary = user.userType !== 'DONOR';

  const quick: { href: string; label: string; icon: IconName }[] = [
    { href: '/app/history', label: 'Donation history', icon: 'receipt' },
    { href: '/app/saved', label: 'Saved campaigns', icon: 'bookmark' },
    { href: '/app/notifications', label: 'Notifications', icon: 'bell' },
    { href: '/app/settings', label: 'Account settings', icon: 'settings' },
    { href: '/app/help', label: 'Help and support', icon: 'help' },
  ];

  return (
    <main className="pb-36">
      <TopBar title="Profile" />
      <div className="space-y-8 px-5">
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.fullName}</p>
            <p className="text-sm text-ui-muted">
              {user.userType === 'BOTH' ? 'Donor and beneficiary' : user.userType === 'BENEFICIARY' ? 'Beneficiary' : 'Donor'} · +91 ••••••{user.mobileLast4}
            </p>
            {profile.email && <p className="truncate text-xs text-ui-subtle">{profile.email}</p>}
          </div>
        </div>

        <section aria-label="Your giving" className="surface grid grid-cols-3 gap-2 p-5 text-center">
          <Stat label="Total given" value={formatINR(total)} accent />
          <Stat label="Campaigns" value={String(supported)} />
          <Stat label="Saved" value={String(savedCount)} />
        </section>

        {canBeneficiary ? (
          <Link href="/app/beneficiary" className="surface flex items-center justify-between p-5 transition hover:border-mint/20">
            <div>
              <p className="font-semibold">Beneficiary dashboard</p>
              <p className="mt-1 text-xs text-ui-muted">Campaigns, progress, verification and updates</p>
            </div>
            <Icon name="chevron" className="h-5 w-5 text-mint" />
          </Link>
        ) : (
          <Link href="/app/create" className="surface flex items-center justify-between p-5 transition hover:border-mint/20">
            <div>
              <p className="font-semibold">Need help yourself?</p>
              <p className="mt-1 text-xs text-ui-muted">Start a verified campaign when you need support.</p>
            </div>
            <Icon name="chevron" className="h-5 w-5 text-mint" />
          </Link>
        )}

        <section aria-labelledby="recent-h">
          <SectionHeader title="Recent donations" action="All" href="/app/history" />
          {donations.length === 0 ? (
            <p className="surface-flat p-5 text-sm text-ui-muted">You have not donated yet. Verified campaigns are waiting for support.</p>
          ) : (
            <ul className="surface-flat divide-y divide-white/[0.06]">
              {donations.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Link href={`/app/donation/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.campaign.title}</span>
                      <span className="text-xs text-ui-subtle">{formatDate(d.paidAt ?? d.createdAt)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold">{formatINR(d.amountPaise)}</span>
                      <StatusPill tone={TONE[d.status as keyof typeof TONE] ?? 'grey'}>{d.status.toLowerCase()}</StatusPill>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {refunds.length > 0 && (
          <section aria-labelledby="ref-h">
            <SectionHeader title="Refund history" />
            <ul className="surface-flat divide-y divide-white/[0.06]">
              {refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3.5 text-sm">
                  <span className="text-ui-muted">{formatDate(r.createdAt)}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">{formatINR(r.amountPaise)}</span>
                    <StatusPill tone={r.status === 'PROCESSED' ? 'mint' : r.status === 'REJECTED' || r.status === 'FAILED' ? 'red' : 'amber'}>{r.status.toLowerCase().replace('_', ' ')}</StatusPill>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Account" className="surface-flat divide-y divide-white/[0.06]">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center justify-between px-4 py-4 text-sm font-medium transition hover:bg-white/[0.02]">
              <span className="flex items-center gap-3">
                <Icon name={q.icon} className="h-5 w-5 text-mint" />
                {q.label}
              </span>
              <Icon name="chevron" className="h-4 w-4 text-ui-subtle" />
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-[17px] font-extrabold ${accent ? 'text-mint' : ''}`}>{value}</p>
      <p className="mt-1 text-[11px] text-ui-muted">{label}</p>
    </div>
  );
}
