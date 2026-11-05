import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { submissionChecklist } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await submissionChecklist(user.id, params.id));
});
