import { db } from '../db';
import { decryptText, encryptText, keyedHash } from '../crypto';
import { errors } from '../http';
import { profileUpdateSchema } from '../validation/schemas';
import { audit } from './audit';
import { raiseFlag } from './fraud';
import { signOutEverywhere } from './auth';

export async function invalidateUserSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      userType: true,
      status: true,
      mobileLast4: true,
      emailEncrypted: true,
      createdAt: true,
      profile: true,
      roles: { select: { role: { select: { key: true, name: true } } } },
      _count: { select: { campaigns: true, donations: true, savedCampaigns: true } },
    },
  });
  if (!user) throw errors.notFound('Profile');
  return {
    id: user.id,
    fullName: user.fullName,
    userType: user.userType,
    status: user.status,
    mobileLast4: user.mobileLast4,
    email: user.emailEncrypted ? decryptText(user.emailEncrypted) : null,
    createdAt: user.createdAt,
    profile: user.profile,
    roles: user.roles.map((r) => r.role),
    counts: user._count,
  };
}

/** Once identity is verified, the name must match the verified identity. Changing it needs support. */
export async function assertNameUnchangedIfVerified(userId: string, newName: string) {
  const [user, identity] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
    db.verification.findUnique({ where: { userId_type: { userId, type: 'IDENTITY' } }, select: { status: true } }),
  ]);
  if (identity?.status === 'VERIFIED' && user && user.fullName !== newName.trim()) {
    throw errors.forbidden('Your name is linked to your verified identity. Contact support to change it.');
  }
}

export async function updateProfile(userId: string, body: unknown, ip?: string | null) {
  const data = profileUpdateSchema.parse(body);
  if (data.fullName) await assertNameUnchangedIfVerified(userId, data.fullName);
  const { notifyEmail, notifySms, notifyWhatsapp, fullName, email, userType, ...address } = data;

  const update: Record<string, unknown> = {};
  if (fullName) update.fullName = fullName;
  if (userType) update.userType = userType;
  if (email) {
    const emailHash = keyedHash(email.toLowerCase(), 'email');
    const clash = await db.user.findUnique({ where: { emailHash }, select: { id: true } });
    if (clash && clash.id !== userId) throw errors.conflict('This email is already linked to another account.');
    update.emailHash = emailHash;
    update.emailEncrypted = encryptText(email.toLowerCase());
  }
  await db.$transaction([
    ...(Object.keys(update).length ? [db.user.update({ where: { id: userId }, data: update })] : []),
    db.userProfile.upsert({
      where: { userId },
      update: { ...address, notifyEmail, notifySms, notifyWhatsapp },
      create: { userId, ...address, notifyEmail: notifyEmail ?? true, notifySms: notifySms ?? true, notifyWhatsapp: notifyWhatsapp ?? false },
    }),
  ]);
  await audit({ actorId: userId, action: 'profile.updated', entityType: 'User', entityId: userId, metadata: { fields: Object.keys(data) }, ip });
  return getProfile(userId);
}

export async function signOutAll(userId: string, ip?: string | null) {
  await signOutEverywhere(userId);
  await audit({ actorId: userId, action: 'auth.signout_all', entityType: 'User', entityId: userId, ip });
}

export async function deleteAccountRequest(userId: string, ip?: string | null) {
  // Erasure is a workflow, not an immediate wipe: records tied to donations and payouts are retained as
  // the law requires. The request is logged and handled by the support team within the DPDP timelines.
  const open = await db.campaign.count({ where: { beneficiaryId: userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] } } });
  if (open > 0) throw errors.invalidState('Close your active campaigns before requesting account deletion.');
  await db.complaint.create({ data: { userId, subject: 'Account deletion request', body: 'User requested deletion of their account and personal data.' } });
  await audit({ actorId: userId, action: 'privacy.erasure_requested', entityType: 'User', entityId: userId, ip });
  return { received: true };
}

/* ---------- Notifications ---------- */

export async function listNotifications(userId: string, limit = 50) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
}

export async function markNotificationsRead(userId: string, id?: string) {
  await db.notification.updateMany({
    where: { userId, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

/* ---------- Complaints and reports ---------- */

export async function createComplaint(userId: string, input: { subject: string; body: string; campaignId?: string }, ip?: string | null) {
  if (input.campaignId) {
    const c = await db.campaign.findUnique({ where: { id: input.campaignId }, select: { id: true } });
    if (!c) throw errors.notFound('Campaign');
  }
  const row = await db.complaint.create({
    data: { userId, subject: input.subject, body: input.body, campaignId: input.campaignId ?? null },
    select: { id: true, status: true, createdAt: true },
  });
  await audit({ actorId: userId, action: 'complaint.created', entityType: 'Complaint', entityId: row.id, ip });
  return row;
}

export async function listMyComplaints(userId: string) {
  return db.complaint.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, subject: true, status: true, response: true, createdAt: true, resolvedAt: true },
  });
}

/** A public user report on a campaign. Goes to fraud review; the reporter is recorded for abuse checks. */
export async function reportCampaign(userId: string, campaignId: string, reason: string, ip?: string | null) {
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { id: true, status: true, beneficiaryId: true } });
  if (!c || !['PUBLISHED', 'CLOSED'].includes(c.status)) throw errors.notFound('Campaign');
  if (c.beneficiaryId === userId) throw errors.badRequest('You cannot report your own campaign.');
  const id = await raiseFlag({
    ruleCode: 'USER_REPORT',
    reason: reason.slice(0, 1000),
    severity: 'LOW',
    campaignId,
    reporterId: userId,
    source: 'USER_REPORT',
    evidence: { reportedBy: 'user' },
  });
  await audit({ actorId: userId, action: 'campaign.reported', entityType: 'Campaign', entityId: campaignId, ip });
  return { reportId: id };
}
