import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { requestRefund } from '@/lib/services/donations';
import { refundRequestSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = refundRequestSchema.parse(await readJson(req));
  return json(await requestRefund({ donorId: user.id, donationId: params.id, reason: body.reason, ip: clientIp(req) }), { status: 201 });
});
