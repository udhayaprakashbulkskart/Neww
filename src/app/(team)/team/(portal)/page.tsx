import type { Metadata } from 'next';
import { requireTeamPage } from '@/lib/team/session';
import { listMembers } from '@/lib/team/members';
import { getGroup } from '@/lib/team/chat';
import { Directory } from '@/components/team/directory';
import { GroupChat } from '@/components/team/group-panel';
import { card, Notice } from '@/components/team/ui';

export const metadata: Metadata = { title: { absolute: 'Team directory · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DirectoryPage({ searchParams }: { searchParams: { error?: string } }) {
  const actor = await requireTeamPage();
  const [members, group] = await Promise.all([listMembers(actor), getGroup(actor)]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Team Directory</h1>
          <p className="mt-1 text-sm text-tp-muted">Profiles, contact details and verification status for everyone on the team.</p>
        </header>
        {searchParams.error === 'admin-only' && (
          <div className="mb-5">
            <Notice>Only administrators can open that page.</Notice>
          </div>
        )}
        <Directory members={members} meId={actor.id} />
      </section>

      <aside className="hidden xl:block">
        <div className={`${card} sticky top-8 flex h-[calc(100dvh-4rem)] flex-col overflow-hidden`}>
          {group.isMember ? (
            <GroupChat meId={actor.id} memberCount={group.memberCount} members={group.members} compact />
          ) : (
            <div className="p-5">
              <Notice>You are not in the Team Group yet. Ask an administrator to add you.</Notice>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
