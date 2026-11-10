import { clientIp, handle, json } from '@/lib/http';
import { listMessages, sendMessage } from '@/lib/team/chat';
import { readMessageInput } from '@/lib/team/upload';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const actor = await requireActor();
  const after = new URL(req.url).searchParams.get('after');
  return json(await listMessages({ kind: 'group' }, actor, after));
});

export const POST = handle(async (req) => {
  const actor = await requireActor();
  const input = await readMessageInput(req);
  const message = await sendMessage({ kind: 'group' }, actor, input, clientIp(req));
  return json({ message }, { status: 201 });
});
