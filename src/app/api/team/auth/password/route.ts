import { clientIp, handle, json, parseBody } from '@/lib/http';
import { passwordChangeSchema } from '@/lib/team/schemas';
import { changeOwnPassword } from '@/lib/team/members';
import { createTeamSessionToken, requireActor, TEAM_SESSION_COOKIE, teamSessionCookieOptions } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const actor = await requireActor();
  const input = await parseBody(req, passwordChangeSchema, 8 * 1024);
  const { sessionVersion } = await changeOwnPassword(actor, input, clientIp(req));
  // Other devices are signed out by the version bump; keep this one signed in.
  const token = await createTeamSessionToken(actor.id, sessionVersion);
  const res = json({ changed: true });
  res.cookies.set(TEAM_SESSION_COOKIE, token, teamSessionCookieOptions());
  return res;
});
