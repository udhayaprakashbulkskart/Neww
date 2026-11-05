import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { complaintUpdateSchema } from '@/lib/validation/schemas';
import { updateComplaint } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = complaintUpdateSchema.parse(await readJson(req));
  return json(await updateComplaint({ actorId: user.id, complaintId: params.id, status: body.status, response: body.response, ip: clientIp(req) }));
});
