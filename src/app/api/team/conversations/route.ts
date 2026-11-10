import { handle, json, parseBody } from '@/lib/http';
import { createConversationSchema } from '@/lib/team/schemas';
import { listConversations, openConversation } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const actor = await requireActor();
  return json({ conversations: await listConversations(actor) });
});

/** Get or create the private conversation with one other member. */
export const POST = handle(async (req) => {
  const actor = await requireActor();
  const input = await parseBody(req, createConversationSchema, 4 * 1024);
  return json(await openConversation(actor, input.memberId), { status: 201 });
});
