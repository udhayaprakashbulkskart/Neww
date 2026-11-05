import type { UserType } from '@prisma/client';
import { db } from '../db';
import { encryptText, keyedHash } from '../crypto';
import { errors } from '../http';
import { rateLimit } from '../rate-limit';
import { hashPassword, verifyPassword } from '../password';
import { audit } from './audit';

export const mobileHashOf = (mobile: string) => keyedHash(mobile, 'mobile');

/** Create an account with a mobile number and password. The mobile number is the login identifier. */
export async function registerWithPassword(input: {
  mobile: string;
  fullName: string;
  password: string;
  userType?: UserType;
  email?: string;
  ip: string;
}): Promise<{ id: string; sessionVersion: number }> {
  rateLimit(`auth:register:ip:${input.ip}`, 20, 60 * 60_000);
  const mobileHash = mobileHashOf(input.mobile);
  const passwordHash = await hashPassword(input.password);

  const user = await db.user
    .create({
      data: {
        mobileHash,
        mobileEncrypted: encryptText(input.mobile),
        mobileLast4: input.mobile.slice(-4),
        emailHash: input.email ? keyedHash(input.email.toLowerCase(), 'email') : null,
        emailEncrypted: input.email ? encryptText(input.email.toLowerCase()) : null,
        fullName: input.fullName,
        userType: input.userType ?? 'DONOR',
        status: 'ACTIVE',
        passwordHash,
        consentAcceptedAt: new Date(),
        lastLoginAt: new Date(),
        profile: { create: { notifyEmail: !!input.email } },
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

/** Sign in with mobile and password. Failures return one generic message, and repeated failures are throttled. */
export async function loginWithPassword(input: { mobile: string; password: string; ip: string }) {
  const mobileHash = mobileHashOf(input.mobile);
  rateLimit(`auth:login:ip:${input.ip}`, 60, 15 * 60_000);
  rateLimit(`auth:login:mobile:${mobileHash}`, 10, 15 * 60_000);

  const user = await db.user.findUnique({
    where: { mobileHash },
    select: { id: true, sessionVersion: true, status: true, deletedAt: true, passwordHash: true },
  });
  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || user.deletedAt || !ok) {
    await audit({ actorId: user?.id ?? null, action: 'auth.login_failed', entityType: 'User', entityId: user?.id ?? 'unknown', ip: input.ip });
    throw errors.badRequest('Mobile number or password is incorrect.');
  }
  if (user.status === 'SUSPENDED') {
    await audit({ actorId: user.id, action: 'auth.login_blocked_suspended', entityType: 'User', entityId: user.id, ip: input.ip });
    throw errors.forbidden('This account is suspended. Contact support@helptrust.in for help.');
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ip: input.ip });
  return { id: user.id, sessionVersion: user.sessionVersion };
}

/** Sign out all devices by bumping the session version. Existing tokens stop working immediately. */
export async function signOutEverywhere(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}
