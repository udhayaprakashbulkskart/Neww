import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { reopenRejected } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await reopenRejected(user.id, params.id));
});
