// Email and password sign-in with JWT sessions. Passwords are stored only as scrypt hashes.
import { randomInt } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { audit } from './audit';
import { getConfig } from './config';
import { encryptBytes, sha256Hex } from './crypto';
import { db } from './db';
import { DomainError } from './errors';
import { hashPassword, verifyPassword, passwordPolicyError } from './password';
import { effectivePlan } from './plans';
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
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone: string; // +91XXXXXXXXXX, already normalised
  referralCode: string | null; // the sponsor's referral number, typed or from the invite link
  sponsorId: string | null; // legacy invite links carry the sponsor's id
  bank: { accountHolder: string; bankName: string; ifsc: string; accountNumber: string };
  documents: { kind: 'AADHAAR' | 'PAN'; buffer: Buffer; mime: string }[];
}

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I look-alikes

function newReferralCode(): string {
  let code = 'BP';
  for (let i = 0; i < 10; i++) code += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  return code;
}

export async function registerMember(input: RegisterInput) {
  const email = normaliseEmail(input.email);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new DomainError('WEAK_PASSWORD', policy, 422);
  const kinds = new Set(input.documents.map((d) => d.kind));
  if (!kinds.has('AADHAAR') || !kinds.has('PAN')) throw new DomainError('DOCUMENTS_REQUIRED', 'Upload both your Aadhaar and PAN documents', 422);

  const [emailTaken, phoneTaken] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.user.findUnique({ where: { phone: input.phone }, select: { id: true } }),
  ]);
  if (emailTaken) throw new DomainError('EMAIL_TAKEN', 'An account with this email already exists', 409);
  if (phoneTaken) throw new DomainError('PHONE_TAKEN', 'An account with this mobile number already exists', 409);

  let sponsorId: string | null = null;
  if (input.referralCode) {
    const sponsor = await db.user.findUnique({ where: { referralCode: input.referralCode }, select: { id: true } });
    if (!sponsor) throw new DomainError('INVALID_REFERRAL', 'That referral number was not found', 422);
    sponsorId = sponsor.id;
  } else if (input.sponsorId) {
    const sponsor = await db.user.findUnique({ where: { id: input.sponsorId }, select: { id: true } });
    sponsorId = sponsor?.id ?? null;
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  return db.$transaction(async (tx) => {
    let referralCode = newReferralCode();
    for (let attempt = 0; attempt < 5 && (await tx.user.findUnique({ where: { referralCode }, select: { id: true } })); attempt++) {
      referralCode = newReferralCode();
    }
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.name.trim() || 'Member',
        phone: input.phone,
        referralCode,
        sponsorId,
        kyc: 'PENDING',
        kycSubmittedAt: now,
      },
    });
    await tx.membership.create({
      data: { userId: user.id, tier: 'BASIC', active: true, expiresAt: addDays(now, (await effectivePlan('BASIC', tx)).durationDays) },
    });
    await tx.bankAccount.create({
      data: {
        userId: user.id,
        accountHolder: input.bank.accountHolder,
        bankName: input.bank.bankName,
        ifsc: input.bank.ifsc,
        accountLast4: input.bank.accountNumber.slice(-4),
        accountCipher: encryptBytes(Buffer.from(input.bank.accountNumber, 'utf8')),
      },
    });
    for (const d of input.documents) {
      await tx.kycDocument.create({
        data: {
          userId: user.id,
          kind: d.kind,
          mime: d.mime,
          sizeBytes: d.buffer.length,
          sha256: sha256Hex(d.buffer),
          ciphertext: encryptBytes(d.buffer),
        },
      });
    }
    await audit(tx, { action: 'kyc.submitted', actorId: user.id, targetId: user.id, meta: { documents: input.documents.map((d) => d.kind) } });
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
