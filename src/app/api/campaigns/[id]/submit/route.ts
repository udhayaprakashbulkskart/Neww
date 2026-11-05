import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { submitCampaign } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const user = await requireUser();
  return json(await submitCampaign(user.id, params.id));
});
