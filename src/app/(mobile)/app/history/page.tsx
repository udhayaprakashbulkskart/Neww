import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { listDonationsForDonor } from '@/lib/services/donations';
import { formatDate, formatINR } from '@/lib/format';
import { TopBar } from '@/components/mobile/shell';
import { EmptyState, StatusPill } from '@/components/ui/primitives';

export const metadata = { title: 'Donation history' };

const TONE = { SUCCESS: 'mint', PENDING: 'amber', FAILED: 'red', REFUNDED: 'grey' } as const;

export default async function HistoryPage() {
  const user = await requirePageUser('/app/history');
  const items = await listDonationsForDonor(user.id);
  const total = items.filter((d) => d.status === 'SUCCESS').reduce((s, d) => s + d.amountPaise, 0);

  return (
    <main className="pb-36">
      <TopBar back="/app/donor" title="Donation history" />
      <div className="space-y-5 px-5">
        <div className="surface flex items-center justify-between p-5">
          <div>
            <p className="text-xs text-ui-muted">Total confirmed</p>
            <p className="text-[26px] font-extrabold text-mint">{formatINR(total)}</p>
          </div>
          <p className="text-right text-sm text-ui-muted">
            {items.length} {items.length === 1 ? 'donation' : 'donations'}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState icon="wallet" title="No donations yet" body="When you support a campaign, your receipts and refund options appear here." action={{ href: '/app/explore', label: 'Explore campaigns' }} />
        ) : (
          <ul className="space-y-3">
            {items.map((d) => (
              <li key={d.id}>
                <Link href={`/app/donation/${d.id}`} className="surface flex items-center gap-4 p-4 transition hover:border-mint/20">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.campaign.title}</p>
                    <p className="mt-1 text-xs text-ui-muted">
                      {formatDate(d.paidAt ?? d.createdAt)}
                      {d.receiptNumber ? ` · ${d.receiptNumber}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatINR(d.amountPaise)}</p>
                    <div className="mt-1 flex justify-end">
                      <StatusPill tone={TONE[d.status as keyof typeof TONE] ?? 'grey'}>{d.status.toLowerCase()}</StatusPill>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
