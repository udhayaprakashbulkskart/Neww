import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { refundDecisionSchema } from '@/lib/validation/schemas';
import { decideRefund } from '@/lib/services/donations';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = refundDecisionSchema.parse(await readJson(req));
  return json(await decideRefund({ actorId: user.id, refundId: params.id, decision: body.decision, note: body.note, ip: clientIp(req) }));
});
