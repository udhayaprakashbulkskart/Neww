import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/team/session';
import { listMembers } from '@/lib/team/members';
import { Avatar, card, KycBadge } from '@/components/team/ui';
import { AdminAddMember } from '@/components/team/admin-add-member';
import { ROLE_TEXT } from '@/lib/team/labels';

export const metadata: Metadata = { title: { absolute: 'Administration · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const actor = await requireAdminPage();
  const members = await listMembers(actor, { includeInactive: true });
  const stats = {
    total: members.length,
    verified: members.filter((m) => m.kycStatus === 'VERIFIED').length,
    pending: members.filter((m) => m.kycStatus === 'PENDING').length,
    inactive: members.filter((m) => !m.active).length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Administration</h1>
        <p className="mt-1 text-sm text-tp-muted">Add members, manage profiles, KYC and group access.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Members', value: stats.total },
          { label: 'Verified KYC', value: stats.verified },
          { label: 'Pending KYC', value: stats.pending },
          { label: 'Deactivated', value: stats.inactive },
        ].map((s) => (
          <div key={s.label} className={`${card} p-5`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-tp-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold">{s.value}</p>
          </div>
        ))}
      </div>

      <AdminAddMember />

      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-tp-line px-5 py-4">
          <h2 className="text-lg font-bold">All members</h2>
        </div>
        <ul className="divide-y divide-tp-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
              <Avatar name={m.fullName} initials={m.initials} photoUrl={m.photoUrl} size="md" seed={m.id} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold">
                  {m.fullName}
                  {!m.active && <span className="text-xs font-medium text-rose-600">Deactivated</span>}
                </p>
                <p className="truncate text-sm text-tp-muted">
                  {m.phone} · {ROLE_TEXT[m.role]}
                </p>
              </div>
              <KycBadge status={m.kycStatus} />
              <Link href={`/team/admin/members/${m.id}`} className="rounded-lg border border-tp-line px-3 py-2 text-xs font-semibold text-tp-ink hover:border-tp-purple/40 hover:text-tp-purple">
                Manage
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
