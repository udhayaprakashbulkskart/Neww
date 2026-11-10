import { clientIp, handle, json } from '@/lib/http';
import { listMessages, sendMessage } from '@/lib/team/chat';
import { readMessageInput } from '@/lib/team/upload';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

/** Without `after`: the latest 60 messages. With `after` (ISO time): everything since, for polling. */
export const GET = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  const after = new URL(req.url).searchParams.get('after');
  return json(await listMessages({ kind: 'private', conversationId: params.id }, actor, after));
});

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  const input = await readMessageInput(req);
  const message = await sendMessage({ kind: 'private', conversationId: params.id }, actor, input, clientIp(req));
  return json({ message }, { status: 201 });
});
