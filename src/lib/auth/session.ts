import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import type { User, UserType } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { errors } from '../http';
import { PERMISSIONS, type Permission, permissionsFor } from '../rbac';

export const SESSION_COOKIE = 'ht_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = Pick<User, 'id' | 'fullName' | 'userType' | 'status' | 'mobileLast4'> & {
  isStaff: boolean;
};

/** Issue a signed JWT carrying only the user id and session version. Roles are read live from the DB. */
export async function createSessionToken(userId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer('helptrust')
    .setAudience('helptrust-web')
    .sign(env().sessionSecret);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env().isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

/**
 * Resolve the current user from the session cookie. Returns null when signed out, when the token
 * is invalid or expired, when the session version was bumped (logout everywhere), or when the
 * account is suspended. Suspension therefore takes effect on the very next request.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let payload;
  try {
    const verified = await jwtVerify(token, env().sessionSecret, {
      issuer: 'helptrust',
      audience: 'helptrust-web',
    });
    payload = verified.payload;
  } catch {
    return null;
  }
  const userId = payload.sub;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, userType: true, status: true, mobileLast4: true, sessionVersion: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return null;
  if (user.sessionVersion !== payload.sv) return null;
  if (user.status === 'SUSPENDED' || user.status === 'DELETED') return null;

  const perms = await permissionsFor(user.id);
  return {
    id: user.id,
    fullName: user.fullName,
    userType: user.userType as UserType,
    status: user.status,
    mobileLast4: user.mobileLast4,
    isStaff: perms.size > 0,
  };
}

/** For API routes: throws 401 when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  return user;
}

/** For server-rendered app pages: redirects to login. */
export async function requirePageUser(next = '/app/home'): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/app/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Staff gate: the user must hold the permission through a role. */
export async function requireStaff(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  const perms = await permissionsFor(user.id);
  if (!perms.has(permission)) throw errors.forbidden();
  return user;
}

export async function requireStaffPage(permission: Permission = PERMISSIONS.OVERVIEW_VIEW): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  const perms = await permissionsFor(user.id);
  if (!perms.has(permission)) redirect('/admin/login?error=forbidden');
  return user;
}

export async function staffPermissionsOf(userId: string): Promise<Set<string>> {
  return permissionsFor(userId);
}
