// Phone OTP sign-in and JWT sessions. OTP codes are stored only as keyed hashes.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getConfig } from './config';
import { db } from './db';
import { DomainError } from './errors';
import { deliverSms } from './sms';
import { PLANS } from '@/lib/domain/plans';
import { addDays } from './time';

export const SESSION_COOKIE = 'bp_session';
const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_10_MIN = 3;

export function normalisePhone(input: string): string {
  const digits = input.replace(/[\s()-]/g, '');
  if (!/^\+?\d{8,15}$/.test(digits)) throw new DomainError('INVALID_PHONE', 'Enter a valid phone number with country code');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function hashCode(phone: string, code: string): string {
  return createHmac('sha256', getConfig().otpPepper).update(`${phone}:${code}`).digest('hex');
}

export async function requestOtp(rawPhone: string, now = new Date()): Promise<{ sent: true }> {
  const phone = normalisePhone(rawPhone);
  const recent = await db.otpCode.count({ where: { phone, createdAt: { gt: new Date(now.getTime() - 10 * 60_000) } } });
  if (recent >= OTP_MAX_SENDS_PER_10_MIN) throw new DomainError('OTP_RATE_LIMIT', 'Too many codes requested. Try again in 10 minutes.', 429);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.otpCode.create({
    data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
  });
  await deliverSms(phone, `Your BinaryPro code is ${code}. It expires in 5 minutes.`);
  return { sent: true };
}

export async function verifyOtp(rawPhone: string, code: string, now = new Date()) {
  const phone = normalisePhone(rawPhone);
  const otp = await db.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new DomainError('OTP_INVALID', 'Code is invalid or expired', 401);
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new DomainError('OTP_LOCKED', 'Too many attempts. Request a new code.', 429);
  await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
  const a = Buffer.from(hashCode(phone, code));
  const b = Buffer.from(otp.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new DomainError('OTP_INVALID', 'Code is invalid or expired', 401);
  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  return { phone };
}

/** Finds or creates the member for a verified phone. New members start on BASIC and must be placed. */
export async function signInMember(phone: string, name: string | null, sponsorId: string | null) {
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.status !== 'ACTIVE') throw new DomainError('ACCOUNT_SUSPENDED', 'This account is suspended', 403);
    return existing;
  }
  const sponsor = sponsorId ? await db.user.findUnique({ where: { id: sponsorId }, select: { id: true } }) : null;
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { phone, name: name?.trim() || 'Member', sponsorId: sponsor?.id ?? null },
    });
    await tx.membership.create({
      data: { userId: user.id, tier: 'BASIC', active: true, expiresAt: addDays(new Date(), PLANS.BASIC.durationDays) },
    });
    return user;
  });
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
