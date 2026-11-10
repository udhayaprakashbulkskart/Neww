import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db';
import { env } from '../env';
import { errors } from '../http';

/**
 * Team portal session. Same JWT approach as the main platform (HS256, session version for instant
 * revocation), but its own cookie and audience so the two sessions cannot be swapped.
 */
export const TEAM_SESSION_COOKIE = 'tp_session';
const TTL_SECONDS = 60 * 60 * 24 * 7;
const ISSUER = 'team-portal';
const AUDIENCE = 'team-portal-web';

/** The signed-in member as seen by the server. Never sent to the browser in this shape. */
export type Actor = {
  id: string;
  fullName: string;
  isAdmin: boolean;
};

export async function createTeamSessionToken(memberId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(env().sessionSecret);
}

export function teamSessionCookieOptions() {
  const e = env();
  return {
    httpOnly: true,
    secure: e.isProduction || e.NEXT_PUBLIC_APP_URL.startsWith('https://'),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TTL_SECONDS,
  };
}

/** Resolve the signed-in member. Deactivated members, bumped session versions and bad tokens all return null. */
export async function getTeamActor(): Promise<Actor | null> {
  const token = cookies().get(TEAM_SESSION_COOKIE)?.value;
  if (!token) return null;
  let sub: string | undefined;
  let sv: unknown;
  try {
    const verified = await jwtVerify(token, env().sessionSecret, { issuer: ISSUER, audience: AUDIENCE });
    sub = verified.payload.sub;
    sv = verified.payload.sv;
  } catch {
    return null;
  }
  if (!sub) return null;
  const member = await db.teamMember.findUnique({
    where: { id: sub },
    select: { id: true, fullName: true, role: true, active: true, sessionVersion: true },
  });
  if (!member || !member.active || member.sessionVersion !== sv) return null;
  return { id: member.id, fullName: member.fullName, isAdmin: member.role === 'ADMIN' };
}

/** For API routes: 401 when signed out or deactivated. */
export async function requireActor(): Promise<Actor> {
  const actor = await getTeamActor();
  if (!actor) throw errors.unauthorized();
  return actor;
}

export function requireAdmin(actor: Actor): void {
  if (!actor.isAdmin) throw errors.forbidden('Only administrators can do this.');
}

/** For portal pages: send signed-out visitors to the team login. */
export async function requireTeamPage(): Promise<Actor> {
  const actor = await getTeamActor();
  if (!actor) redirect('/team/login');
  return actor;
}

export async function requireAdminPage(): Promise<Actor> {
  const actor = await requireTeamPage();
  if (!actor.isAdmin) redirect('/team?error=admin-only');
  return actor;
}
