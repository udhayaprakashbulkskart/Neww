'use client';

import Link from 'next/link';
import { ChatView } from './chat-view';
import { Avatar, KycBadge } from './ui';
import type { KycStatus } from '@prisma/client';

export type PrivateOther = {
  id: string;
  fullName: string;
  initials: string;
  photoUrl: string | null;
  jobTitle: string | null;
  kycStatus: KycStatus;
  active: boolean;
};

/** One-to-one conversation with a header linking to the other member's profile. */
export function PrivateChat({ conversationId, other, meId }: { conversationId: string; other: PrivateOther; meId: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-tp-line px-4 py-3.5">
        <Avatar name={other.fullName} initials={other.initials} photoUrl={other.photoUrl} size="md" seed={other.id} />
        <div className="min-w-0 flex-1">
          <Link href={`/team/members/${other.id}`} className="block truncate text-sm font-bold hover:underline">
            {other.fullName}
          </Link>
          <p className="truncate text-xs text-tp-muted">{other.jobTitle ?? 'Team member'}</p>
        </div>
        <KycBadge status={other.kycStatus} />
      </div>
      <div className="min-h-0 flex-1">
        <ChatView
          key={conversationId}
          messagesUrl={`/api/team/conversations/${conversationId}/messages`}
          readUrl={`/api/team/conversations/${conversationId}/read`}
          meId={meId}
          showSenderNames={false}
          emptyText={`Start a private conversation with ${other.fullName.split(' ')[0]}.`}
        />
      </div>
    </div>
  );
}
