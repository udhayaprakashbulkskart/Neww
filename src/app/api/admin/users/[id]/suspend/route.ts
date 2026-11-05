import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { suspendSchema } from '@/lib/validation/schemas';
import { setUserSuspended } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = suspendSchema.parse(await readJson(req));
  return json(await setUserSuspended({ actorId: user.id, userId: params.id, suspended: body.suspended, reason: body.reason, ip: clientIp(req) }));
});
