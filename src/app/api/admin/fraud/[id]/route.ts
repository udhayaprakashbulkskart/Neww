import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { fraudUpdateSchema } from '@/lib/validation/schemas';
import { updateFraudReport } from '@/lib/services/admin';

export const dynamic = 'force-dynamic';

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = fraudUpdateSchema.parse(await readJson(req));
  return json(await updateFraudReport({ actorId: user.id, reportId: params.id, status: body.status, resolution: body.resolution, ip: clientIp(req) }));
});
