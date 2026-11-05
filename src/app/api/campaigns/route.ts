import { handle, json } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { createDraft, searchCampaigns } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

/** Public search and filters. Only PUBLISHED campaigns are returned. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  return json(await searchCampaigns(params));
});

/** Beneficiary: start a new draft. Returns the id used by the wizard. */
export const POST = handle(async () => {
  const user = await requireUser();
  const draft = await createDraft(user.id);
  return json({ id: draft.id }, { status: 201 });
});
