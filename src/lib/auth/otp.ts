import { db } from '../db';
import { env } from '../env';
import { errors } from '../http';
import { keyedHash, randomDigits } from '../crypto';
import { rateLimit } from '../rate-limit';
import type { OtpPurpose } from '@prisma/client';

/**
 * OTP lifecycle:
 *  - Codes are 6 digits from a CSPRNG and stored only as keyed hashes, bound to mobile and purpose.
 *  - Codes expire after OTP_TTL_SECONDS, allow OTP_MAX_ATTEMPTS guesses, and are single-use.
 *  - Requests are throttled per number and per IP to stop SMS pumping and brute force.
 */

export const OTP_RESEND_COOLDOWN_MS = 30_000;

export function otpCodeHash(mobileHash: string, purpose: OtpPurpose, code: string): string {
  return keyedHash(code, `otp:${mobileHash}:${purpose}`);
}

export function generateOtp(): string {
  return randomDigits(6);
}

export async function createOtp(args: {
  mobileHash: string;
  purpose: OtpPurpose;
  ip: string;
  pendingEncrypted?: string | null;
}): Promise<{ code: string; expiresAt: Date }> {
  rateLimit(`otp:mobile:${args.mobileHash}`, 5, 10 * 60_000);
  rateLimit(`otp:ip:${args.ip}`, 40, 60 * 60_000);

  const latest = await db.otpCode.findFirst({
    where: { mobileHash: args.mobileHash, purpose: args.purpose },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw errors.tooMany();
  }

  // Invalidate older unconsumed codes so only the newest one can be used.
  await db.otpCode.updateMany({
    where: { mobileHash: args.mobileHash, purpose: args.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env().OTP_TTL_SECONDS * 1000);
  const row = await db.otpCode.create({
    data: {
      mobileHash: args.mobileHash,
      purpose: args.purpose,
      codeHash: otpCodeHash(args.mobileHash, args.purpose, code),
      expiresAt,
      pendingEncrypted: args.pendingEncrypted ?? null,
    },
  });
  return { code, expiresAt: row.expiresAt };
}

export type OtpCheck =
  | { ok: true; pendingEncrypted: string | null }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'INVALID' | 'LOCKED' };

/**
 * Verify a code. Attempts are counted atomically before the comparison so parallel guesses
 * cannot exceed the limit.
 */
export async function verifyOtp(args: { mobileHash: string; purpose: OtpPurpose; code: string }): Promise<OtpCheck> {
  const row = await db.otpCode.findFirst({
    where: { mobileHash: args.mobileHash, purpose: args.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  if (row.attempts >= env().OTP_MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };

  const bumped = await db.otpCode.updateMany({
    where: { id: row.id, consumedAt: null, attempts: { lt: env().OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) return { ok: false, reason: 'LOCKED' };

  const expected = otpCodeHash(args.mobileHash, args.purpose, args.code);
  if (expected !== row.codeHash) return { ok: false, reason: 'INVALID' };

  const consumed = await db.otpCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: 'NOT_FOUND' };
  return { ok: true, pendingEncrypted: row.pendingEncrypted };
}

export function otpFailureMessage(reason: Exclude<OtpCheck, { ok: true }>['reason']): string {
  switch (reason) {
    case 'EXPIRED':
      return 'This code has expired. Request a new one.';
    case 'LOCKED':
      return 'Too many incorrect attempts. Request a new code.';
    case 'INVALID':
      return 'The code is incorrect. Please check and try again.';
    default:
      return 'No active code found. Request a new one.';
  }
}
