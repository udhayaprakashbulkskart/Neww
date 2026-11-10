import { ApiError, clientIp, handle, json, parseBody } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { loginSchema } from '@/lib/team/schemas';
import { dummyPasswordHash, namesMatch, normalizePhone, phoneHash, verifyPassword } from '@/lib/team/security';
import { createTeamSessionToken, TEAM_SESSION_COOKIE, teamSessionCookieOptions } from '@/lib/team/session';

export const dynamic = 'force-dynamic';

const INVALID = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Phone number or password is incorrect.');

export const POST = handle(async (req) => {
  const input = await parseBody(req, loginSchema, 8 * 1024);
  rateLimit(`team-login-ip:${clientIp(req)}`, 30, 15 * 60_000);

  let canonical: string;
  try {
    canonical = normalizePhone(input.phone);
  } catch {
    // Same response as a wrong password, so the form does not reveal which numbers are valid.
    await verifyPassword(input.password, await dummyPasswordHash());
    throw INVALID();
  }
  const hash = phoneHash(canonical);
  rateLimit(`team-login-phone:${hash}`, 8, 15 * 60_000);

  const member = await db.teamMember.findUnique({
    where: { phoneHash: hash },
    select: { id: true, fullName: true, role: true, active: true, sessionVersion: true, passwordHash: true },
  });
  const passwordOk = await verifyPassword(input.password, member?.passwordHash ?? (await dummyPasswordHash()));
  const nameOk = !!member && namesMatch(input.name, member.fullName);
  if (!member || !passwordOk || !nameOk || !member.active) throw INVALID();

  await db.teamMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } });
  const token = await createTeamSessionToken(member.id, member.sessionVersion);
  const res = json({ id: member.id, fullName: member.fullName, isAdmin: member.role === 'ADMIN' });
  res.cookies.set(TEAM_SESSION_COOKIE, token, teamSessionCookieOptions());
  return res;
});
