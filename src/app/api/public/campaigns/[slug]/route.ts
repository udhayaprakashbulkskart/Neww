import { handle, json, errors } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { getPublicCampaign } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { slug: string } }>(async (_req, { params }) => {
  const viewer = await getCurrentUser();
  const c = await getPublicCampaign(params.slug, viewer?.id ?? null);
  if (!c) throw errors.notFound('Campaign');
  return json(c);
});
