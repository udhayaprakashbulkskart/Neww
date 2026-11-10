import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTeamPage } from '@/lib/team/session';
import { getPrivateConversation } from '@/lib/team/chat';
import { ApiError } from '@/lib/http';
import { card } from '@/components/team/ui';
import { PrivateChat } from '@/components/team/private-chat';

export const metadata: Metadata = { title: { absolute: 'Private chat · Team Portal' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PrivateChatPage({ params }: { params: { id: string } }) {
  const actor = await requireTeamPage();
  let convo;
  try {
    convo = await getPrivateConversation(actor, params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3">
      <Link href="/team/chat" className="text-sm font-semibold text-tp-muted hover:text-tp-purple">
        ← All conversations
      </Link>
      <div className={`${card} flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100dvh-8rem)]`}>
        <PrivateChat conversationId={convo.id} other={convo.other} meId={actor.id} />
      </div>
    </div>
  );
}
