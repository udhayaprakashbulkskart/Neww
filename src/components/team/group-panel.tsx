'use client';

import Link from 'next/link';
import { ChatView } from './chat-view';
import { Avatar } from './ui';

export type GroupPerson = { id: string; fullName: string; initials: string; photoUrl: string | null; jobTitle: string | null };

/** Team Group chat with its member list. Used full-width on the group page and as the desktop side panel. */
export function GroupChat({
  meId,
  memberCount,
  members,
  compact = false,
}: {
  meId: string;
  memberCount: number;
  members: GroupPerson[];
  compact?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-tp-line px-4 py-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Team Group</p>
          <p className="text-xs text-tp-muted">{memberCount} members · Real-time</p>
        </div>
        <div className="flex -space-x-2">
          {members.slice(0, 4).map((m) => (
            <Avatar key={m.id} name={m.fullName} initials={m.initials} photoUrl={m.photoUrl} size="sm" seed={m.id} />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatView
          messagesUrl="/api/team/group/messages"
          readUrl="/api/team/group/read"
          meId={meId}
          showSenderNames
          compact={compact}
          emptyText="The whole team is here. Start the conversation."
        />
      </div>
      {!compact && (
        <details className="border-t border-tp-line px-4 py-3 text-sm lg:hidden">
          <summary className="cursor-pointer font-semibold text-tp-purple">Members ({memberCount})</summary>
          <ul className="mt-2 space-y-2">
            {members.map((m) => (
              <li key={m.id}>
                <Link href={`/team/members/${m.id}`} className="hover:underline">
                  {m.fullName}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
