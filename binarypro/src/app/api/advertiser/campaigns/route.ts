import { z } from 'zod';
import { requirePermission, handle, ok, readJson } from '@/lib/server/http';
import { createOwnCampaign, listOwnCampaigns, summarise } from '@/lib/server/advertiser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Create = z.object({
  title: z.string().max(200),
  advertiser: z.string().max(200),
  videoUrl: z.string().max(2000),
  durationSec: z.number().int(),
  rewardText: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().max(3),
});

export async function GET() {
  return handle(async () => {
    const user = await requirePermission('campaigns:own');
    const campaigns = await listOwnCampaigns(user.id);
    return ok({ campaigns, summary: summarise(campaigns) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requirePermission('campaigns:own');
    const body = await readJson(req, Create);
    const campaign = await createOwnCampaign(user.id, body);
    return ok({ id: campaign.id, status: campaign.status }, 201);
  });
}
