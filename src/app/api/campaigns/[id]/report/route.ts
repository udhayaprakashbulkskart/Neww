import { handle, json, readJson, clientIp } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { reportCampaign } from '@/lib/services/profile';
import { fraudReportSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const POST = handle<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser();
  const body = fraudReportSchema.parse({ ...((await readJson(req)) as object), campaignId: params.id });
  return json(await reportCampaign(user.id, params.id, body.reason, clientIp(req)), { status: 201 });
});
