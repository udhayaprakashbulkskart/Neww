import { handle, json } from '@/lib/http';
import { getPrivateConversation } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const actor = await requireActor();
  return json(await getPrivateConversation(actor, params.id));
});
