import type { Metadata } from 'next';
import Link from 'next/link';
import { requireTeamPage } from '@/lib/team/session';
import { listConversations } from '@/lib/team/chat';
import { listMembers } from '@/lib/team/members';
import { Avatar, btnPrimary, card } from '@/components/team/ui';
import { StartChatButton } from '@/components/team/start-chat-button';

export const metadata: Metadata = { title: { absolute: 'Chat · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ChatInboxPage() {
  const actor = await requireTeamPage();
  const [conversations, members] = await Promise.all([listConversations(actor), listMembers(actor)]);
  const withConversation = new Set(conversations.map((c) => c.other?.id).filter(Boolean));
  const others = members.filter((m) => m.id !== actor.id && !withConversation.has(m.id));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Private chat</h1>
        <p className="mt-1 text-sm text-tp-muted">One-to-one conversations. Only you and the other person can see them.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-tp-muted">Conversations</h2>
        {conversations.length === 0 && (
          <p className={`${card} p-6 text-center text-sm text-tp-muted`}>No conversations yet. Start one below or from the directory.</p>
        )}
        <ul className={`${card} divide-y divide-tp-line overflow-hidden`}>
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/team/chat/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-tp-canvas">
                {c.other ? (
                  <Avatar name={c.other.fullName} initials={c.other.initials} photoUrl={c.other.photoUrl} size="md" seed={c.other.id} />
                ) : (
                  <span className="h-11 w-11 rounded-full bg-tp-canvas" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold">
                    {c.other?.fullName ?? 'Former member'}
                    {c.other && !c.other.active && <span className="text-xs font-medium text-rose-600">Deactivated</span>}
                  </p>
                  <p className={`truncate text-sm ${c.unread > 0 ? 'font-semibold text-tp-ink' : 'text-tp-muted'}`}>{c.preview ?? 'No messages yet'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] text-tp-muted">{new Date(c.lastMessageAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  {c.unread > 0 && (
                    <span className="min-w-[1.4rem] rounded-full bg-tp-purple px-1.5 py-0.5 text-center text-[11px] font-bold text-white" aria-label={`${c.unread} unread`}>
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tp-muted">Start a new chat</h2>
          <ul className={`${card} divide-y divide-tp-line overflow-hidden`}>
            {others.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-4 py-3">
                <Avatar name={m.fullName} initials={m.initials} photoUrl={m.photoUrl} size="sm" seed={m.id} />
                <span className="min-w-0 flex-1 truncate font-semibold">{m.fullName}</span>
                <StartChatButton memberId={m.id} className={`${btnPrimary} !px-3 !py-2`} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
