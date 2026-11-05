import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { verificationReviewSchema } from '@/lib/validation/schemas';
import { reviewVerification } from '@/lib/services/verification';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = verificationReviewSchema.parse(await readJson(req));
  return json(await reviewVerification({ actorId: user.id, verificationId: params.id, decision: body.decision, note: body.note, ip: clientIp(req) }));
});
