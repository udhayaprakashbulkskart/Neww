// Email and password sign-in with JWT sessions. Passwords are stored only as scrypt hashes.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getConfig } from './config';
import { db } from './db';
import { DomainError } from './errors';
import { hashPassword, verifyPassword, passwordPolicyError } from './password';
import { PLANS } from '@/lib/domain/plans';
import { addDays } from './time';

export const SESSION_COOKIE = 'bp_session';
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export function normaliseEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new DomainError('INVALID_EMAIL', 'Enter a valid email address', 422);
  }
  return email;
}

/** Creates a member with a password. New members start on BASIC and must be placed in the tree. */
export async function registerMember(input: { name: string; email: string; password: string; sponsorId: string | null }) {
  const email = normaliseEmail(input.email);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new DomainError('WEAK_PASSWORD', policy, 422);
  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new DomainError('EMAIL_TAKEN', 'An account with this email already exists', 409);
  const sponsor = input.sponsorId ? await db.user.findUnique({ where: { id: input.sponsorId }, select: { id: true } }) : null;
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, name: input.name.trim() || 'Member', sponsorId: sponsor?.id ?? null },
    });
    await tx.membership.create({
      data: { userId: user.id, tier: 'BASIC', active: true, expiresAt: addDays(new Date(), PLANS.BASIC.durationDays) },
    });
    return user;
  });
}

// Used to keep response time similar when the email does not exist.
const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

export async function loginWithPassword(rawEmail: string, password: string, now = new Date()) {
  const invalid = new DomainError('BAD_CREDENTIALS', 'Email or password is incorrect', 401);
  let email: string;
  try {
    email = normaliseEmail(rawEmail);
  } catch {
    await verifyPassword(password, DUMMY_HASH);
    throw invalid;
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await verifyPassword(password, DUMMY_HASH);
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new DomainError('ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.', 429);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw invalid;
  }
  if (user.status !== 'ACTIVE') throw new DomainError('ACCOUNT_SUSPENDED', 'This account is suspended', 403);
  if (user.failedLogins || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  return user;
}

export async function issueSession(userId: string, sessionVersion: number): Promise<string> {
  const key = new TextEncoder().encode(getConfig().sessionSecret);
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function setSessionCookie(token: string) {
  const cfg = getConfig();
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cfg.isProd || cfg.appUrl.startsWith('https://'),
    path: '/',
    maxAge: 7 * 24 * 3600,
  });
}

/** Resolves the current user from the session cookie. Returns null when signed out or revoked. */
export async function currentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const key = new TextEncoder().encode(getConfig().sessionSecret);
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const user = await db.user.findUnique({
      where: { id: String(payload.sub) },
      include: { membership: true },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    if (user.sessionVersion !== Number(payload.sv)) return null;
    return user;
  } catch {
    return null;
  }
}
