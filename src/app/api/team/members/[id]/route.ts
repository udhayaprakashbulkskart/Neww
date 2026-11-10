import { clientIp, handle, json, parseBody } from '@/lib/http';
import { updateMemberSchema } from '@/lib/team/schemas';
import { getMemberProfile, updateMember } from '@/lib/team/members';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const GET = handle<{ params: { id: string } }>(async (_req, { params }) => {
  const actor = await requireActor();
  return json(await getMemberProfile(actor, params.id));
});

export const PATCH = handle<{ params: { id: string } }>(async (req, { params }) => {
  const actor = await requireActor();
  const input = await parseBody(req, updateMemberSchema, 16 * 1024);
  await updateMember(actor, params.id, input, clientIp(req));
  return json({ updated: true });
});
