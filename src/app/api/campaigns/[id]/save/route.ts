import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { setSaved } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await setSaved(user.id, params.id, true));
});

export const DELETE = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await setSaved(user.id, params.id, false));
});
