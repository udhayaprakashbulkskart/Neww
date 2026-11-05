import { handle, json, readJson } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { postUpdate } from '@/lib/services/campaigns';
import { updateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = updateSchema.parse(await readJson(req));
  return json(await postUpdate(user.id, params.id, body.body), { status: 201 });
});
