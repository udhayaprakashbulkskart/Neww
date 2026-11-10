import type { Metadata } from 'next';
import { requireTeamPage } from '@/lib/team/session';
import { getMemberCard } from '@/lib/team/members';
import { ROLE_TEXT } from '@/lib/team/labels';
import { Avatar, card, KycBadge } from '@/components/team/ui';
import { ChangePassword } from '@/components/team/change-password';

export const metadata: Metadata = { title: { absolute: 'My profile · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function MyProfilePage() {
  const actor = await requireTeamPage();
  const me = await getMemberCard(actor.id);
  if (!me) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">My profile</h1>
        <p className="mt-1 text-sm text-tp-muted">Your details are managed by a team administrator. You can change your password below.</p>
      </header>
      <section className={`${card} flex flex-col gap-5 p-6 sm:flex-row sm:items-center`}>
        <Avatar name={me.fullName} initials={me.initials} photoUrl={me.photoUrl} size="xl" seed={me.id} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xl font-bold">{me.fullName}</p>
          <p className="text-sm text-tp-muted">{me.jobTitle ?? 'Team member'} · {ROLE_TEXT[me.role]}</p>
          <p className="text-sm font-medium">{me.phone}</p>
          <KycBadge status={me.kycStatus} />
        </div>
      </section>
      <ChangePassword />
    </div>
  );
}
