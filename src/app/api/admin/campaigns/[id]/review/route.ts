import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { campaignReviewSchema } from '@/lib/validation/schemas';
import { reviewCampaign } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

/** Staff: move a campaign through review. Permission and state checks happen in the service. */
export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = campaignReviewSchema.parse(await readJson(req));
  return json(await reviewCampaign({ actorId: user.id, campaignId: params.id, action: body.action, note: body.note, ip: clientIp(req) }));
});
