import { clientIp, handle, json, parseBody } from '@/lib/http';
import { groupMembershipSchema } from '@/lib/team/schemas';
import { setGroupMembership } from '@/lib/team/chat';
import { requireActor } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

/** Admin only (enforced in the service): add or remove a member from the common group. */
export const POST = handle(async (req) => {
  const actor = await requireActor();
  const input = await parseBody(req, groupMembershipSchema, 4 * 1024);
  await setGroupMembership(actor, input.memberId, input.member, clientIp(req));
  return json({ updated: true });
});
