import type { OtpPurpose, UserType } from '@prisma/client';
import { db } from '../db';
import { decryptText, encryptText, keyedHash } from '../crypto';
import { errors } from '../http';
import { createOtp, verifyOtp, otpFailureMessage } from '../auth/otp';
import { sendOtpSms } from '../providers/messaging';
import { rateLimit } from '../rate-limit';
import { audit } from './audit';

export type RegistrationPayload = { fullName: string; userType: UserType; email?: string; consentAt: string };

export const mobileHashOf = (mobile: string) => keyedHash(mobile, 'mobile');

/**
 * Step 1 of sign-in or registration. Always returns the same shape so the response does not reveal
 * whether a number is registered (anti-enumeration). Registration does reveal an existing account,
 * because the user must be told to log in instead; that trade-off is documented.
 */
export async function requestOtp(input: {
  mobile: string;
  purpose: OtpPurpose;
  fullName?: string;
  userType?: UserType;
  email?: string;
  consent?: boolean;
  ip: string;
}): Promise<{ sent: true; expiresInSeconds: number }> {
  const mobileHash = mobileHashOf(input.mobile);
  const last4 = input.mobile.slice(-4);
  // Per-IP ceilings are generous because many people share one mobile-network IP.
  rateLimit(`auth:ip:${input.ip}`, 60, 15 * 60_000);

  let pendingEncrypted: string | null = null;
  if (input.purpose === 'REGISTER') {
    if (!input.fullName || input.consent !== true) {
      throw errors.badRequest('Name and consent are required to register.');
    }
    const existing = await db.user.findUnique({ where: { mobileHash }, select: { id: true } });
    if (existing) throw errors.conflict('This mobile number already has an account. Please log in instead.');
    const payload: RegistrationPayload = {
      fullName: input.fullName,
      userType: input.userType ?? 'DONOR',
      email: input.email,
      consentAt: new Date().toISOString(),
    };
    pendingEncrypted = encryptText(JSON.stringify(payload));
  } else {
    const user = await db.user.findUnique({ where: { mobileHash }, select: { id: true, status: true, deletedAt: true } });
    if (!user || user.deletedAt || user.status === 'DELETED') {
      // Respond exactly as if an OTP was sent, without sending one.
      return { sent: true, expiresInSeconds: 300 };
    }
  }

  const { code, expiresAt } = await createOtp({ mobileHash, purpose: input.purpose, ip: input.ip, pendingEncrypted });
  await sendOtpSms(last4, code, input.mobile);
  return { sent: true, expiresInSeconds: Math.round((expiresAt.getTime() - Date.now()) / 1000) };
}

export async function verifyOtpAndSignIn(input: { mobile: string; purpose: OtpPurpose; code: string; ip: string }) {
  const mobileHash = mobileHashOf(input.mobile);
  rateLimit(`auth:verify:${mobileHash}`, 15, 15 * 60_000);

  const check = await verifyOtp({ mobileHash, purpose: input.purpose, code: input.code });
  if (!check.ok) throw errors.badRequest(otpFailureMessage(check.reason));

  if (input.purpose === 'REGISTER') {
    if (!check.pendingEncrypted) throw errors.badRequest('Registration session expired. Please start again.');
    const payload = JSON.parse(decryptText(check.pendingEncrypted)) as RegistrationPayload;
    const user = await db.user
      .create({
        data: {
          mobileHash,
          mobileEncrypted: encryptText(input.mobile),
          mobileLast4: input.mobile.slice(-4),
          emailHash: payload.email ? keyedHash(payload.email.toLowerCase(), 'email') : null,
          emailEncrypted: payload.email ? encryptText(payload.email.toLowerCase()) : null,
          fullName: payload.fullName,
          userType: payload.userType,
          status: 'ACTIVE',
          mobileVerifiedAt: new Date(),
          consentAcceptedAt: new Date(payload.consentAt),
          lastLoginAt: new Date(),
          profile: { create: { notifyEmail: !!payload.email } },
        },
        select: { id: true, sessionVersion: true },
      })
      .catch((err: { code?: string }) => {
        if (err?.code === 'P2002') throw errors.conflict('This mobile number already has an account. Please log in instead.');
        throw err;
      });
    await audit({ actorId: user.id, action: 'auth.register', entityType: 'User', entityId: user.id, ip: input.ip });
    return user;
  }

  const user = await db.user.findUnique({
    where: { mobileHash },
    select: { id: true, sessionVersion: true, status: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw errors.badRequest('Sign-in failed. Check the code and try again.');
  if (user.status === 'SUSPENDED') {
    await audit({ actorId: user.id, action: 'auth.login_blocked_suspended', entityType: 'User', entityId: user.id, ip: input.ip });
    throw errors.forbidden('This account is suspended. Contact support@helptrust.in for help.');
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ip: input.ip });
  return user;
}

/** Sign out all devices by bumping the session version. Existing tokens stop working immediately. */
export async function signOutEverywhere(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}
