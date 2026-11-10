import { clientIp, handle, json, parseBody } from '@/lib/http';
import { createMemberSchema } from '@/lib/team/schemas';
import { createMember, listMembers, getMemberCard } from '@/lib/team/members';
import { requireActor, requireAdmin } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

/** Directory: active members for everyone; administrators may include deactivated accounts. */
export const GET = handle(async (req) => {
  const actor = await requireActor();
  const includeInactive = new URL(req.url).searchParams.get('inactive') === '1';
  return json({ members: await listMembers(actor, { includeInactive }) });
});

export const POST = handle(async (req) => {
  const actor = await requireActor();
  requireAdmin(actor);
  const input = await parseBody(req, createMemberSchema, 16 * 1024);
  const created = await createMember(actor, input, clientIp(req));
  const card = await getMemberCard(created.id);
  return json({ member: card }, { status: 201 });
});
