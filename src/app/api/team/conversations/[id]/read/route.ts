import { handle, json } from '@/lib/http';
import { markRead } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const actor = await requireActor();
  return json(await markRead({ kind: 'private', conversationId: params.id }, actor));
});
