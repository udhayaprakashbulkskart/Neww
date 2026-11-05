import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { documentReviewSchema } from '@/lib/validation/schemas';
import { reviewDocument } from '@/lib/services/documents';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = documentReviewSchema.parse(await readJson(req));
  return json(await reviewDocument({ actorId: user.id, documentId: params.id, decision: body.decision, note: body.note, ip: clientIp(req) }));
});
