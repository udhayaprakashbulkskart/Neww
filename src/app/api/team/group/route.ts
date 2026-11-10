import { handle, json } from '@/lib/http';
import { getGroup } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const actor = await requireActor();
  return json(await getGroup(actor));
});
