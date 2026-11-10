import { handle, json } from '@/lib/http';
import { markRead } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const POST = handle(async () => {
  const actor = await requireActor();
  return json(await markRead({ kind: 'group' }, actor));
});
