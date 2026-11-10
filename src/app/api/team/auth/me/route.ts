import { handle, json } from '@/lib/http';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const actor = await requireActor();
  return json({ id: actor.id, fullName: actor.fullName, isAdmin: actor.isAdmin });
});
