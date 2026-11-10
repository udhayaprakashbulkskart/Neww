import type { KycStatus, Prisma, TeamRole } from '@prisma/client';
import { db } from '../db';
import { decryptText, encryptText } from '../crypto';
import { errors } from '../http';
import { audit } from '../services/audit';
import type { Actor } from './session';
import { requireAdmin } from './session';
import { assertPasswordPolicy, hashPassword, normalizePhone, phoneHash, phoneLast4, verifyPassword } from './security';
import { ALLOWED_DOCUMENT_TYPES, deleteKycOrPhoto, fileUrl, storeFile } from './files';
import type { z } from 'zod';
import type { createMemberSchema, updateMemberSchema, passwordChangeSchema, kycLabelSchema } from './schemas';

export const TEAM_GROUP_ID = 'team-group';
export const TEAM_GROUP_NAME = 'Team Group';

export type MemberCard = {
  id: string;
  fullName: string;
  phone: string;
  jobTitle: string | null;
  bio: string | null;
  role: TeamRole;
  active: boolean;
  kycStatus: KycStatus;
  photoUrl: string | null;
  initials: string;
};

const cardSelect = {
  id: true,
  fullName: true,
  phoneEncrypted: true,
  jobTitle: true,
  bio: true,
  role: true,
  active: true,
  kycStatus: true,
  photoFileId: true,
} satisfies Prisma.TeamMemberSelect;

type CardRow = Prisma.TeamMemberGetPayload<{ select: typeof cardSelect }>;

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function toCard(row: CardRow): MemberCard {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: decryptText(row.phoneEncrypted),
    jobTitle: row.jobTitle,
    bio: row.bio,
    role: row.role,
    active: row.active,
    kycStatus: row.kycStatus,
    photoUrl: row.photoFileId ? fileUrl(row.photoFileId) : null,
    initials: initialsOf(row.fullName),
  };
}

/** Ensures the single common group exists. Idempotent. */
export async function ensureTeamGroup(): Promise<void> {
  await db.groupConversation.upsert({
    where: { id: TEAM_GROUP_ID },
    update: {},
    create: { id: TEAM_GROUP_ID, name: TEAM_GROUP_NAME },
  });
}

export async function listMembers(actor: Actor, opts: { includeInactive?: boolean } = {}): Promise<MemberCard[]> {
  const includeInactive = !!opts.includeInactive && actor.isAdmin;
  const rows = await db.teamMember.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ fullName: 'asc' }],
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getMemberCard(id: string): Promise<MemberCard | null> {
  const row = await db.teamMember.findUnique({ where: { id }, select: cardSelect });
  return row ? toCard(row) : null;
}

/** Profile view. KYC documents are only listed for the member themself and administrators. */
export async function getMemberProfile(actor: Actor, id: string) {
  const card = await getMemberCard(id);
  if (!card) throw errors.notFound('Member');
  if (!card.active && !actor.isAdmin) throw errors.notFound('Member');

  const canSeeKyc = actor.isAdmin || actor.id === id;
  const documents = canSeeKyc ? await listKycDocuments(actor, id) : null;
  const meta = await db.teamMember.findUnique({
    where: { id },
    select: { createdAt: true, kycUpdatedAt: true },
  });
  return { member: card, documents, canSeeKyc, kycUpdatedAt: meta?.kycUpdatedAt ?? null, joinedAt: meta?.createdAt ?? null };
}

export async function listKycDocuments(actor: Actor, memberId: string) {
  if (!actor.isAdmin && actor.id !== memberId) throw errors.notFound('Member');
  const docs = await db.teamFile.findMany({
    where: { kind: 'KYC_DOCUMENT', memberId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return docs.map((d) => ({ ...d, url: fileUrl(d.id), createdAt: d.createdAt.toISOString() }));
}

export async function createMember(actor: Actor, input: z.infer<typeof createMemberSchema>, ip?: string | null) {
  requireAdmin(actor);
  assertPasswordPolicy(input.password);
  const canonical = normalizePhone(input.phone);
  const hash = phoneHash(canonical);
  const existing = await db.teamMember.findUnique({ where: { phoneHash: hash }, select: { id: true } });
  if (existing) throw errors.conflict('A team member with this phone number already exists.');

  const member = await db.teamMember.create({
    data: {
      fullName: input.fullName,
      phoneEncrypted: encryptText(canonical),
      phoneHash: hash,
      phoneLast4: phoneLast4(canonical),
      passwordHash: await hashPassword(input.password),
      role: input.role ?? 'MEMBER',
      jobTitle: input.jobTitle || null,
      bio: input.bio || null,
    },
    select: { id: true },
  });

  // Every new member joins the common group automatically; admins can remove them later.
  await ensureTeamGroup();
  await db.groupMembership.create({
    data: { groupId: TEAM_GROUP_ID, memberId: member.id, addedById: actor.id },
  });
  await audit({
    actorId: actor.id,
    action: 'team.member.created',
    entityType: 'TeamMember',
    entityId: member.id,
    metadata: { role: input.role ?? 'MEMBER' },
    ip,
  });
  return { id: member.id };
}

export async function updateMember(actor: Actor, id: string, input: z.infer<typeof updateMemberSchema>, ip?: string | null) {
  requireAdmin(actor);
  const current = await db.teamMember.findUnique({ where: { id }, select: { id: true, role: true, active: true } });
  if (!current) throw errors.notFound('Member');

  if (id === actor.id) {
    if (input.active === false) throw errors.invalidState('You cannot deactivate your own account.');
    if (input.role === 'MEMBER') throw errors.invalidState('You cannot remove your own administrator role.');
  }

  const data: Prisma.TeamMemberUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle || null;
  if (input.bio !== undefined) data.bio = input.bio || null;
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) {
    data.active = input.active;
    if (!input.active) data.sessionVersion = { increment: 1 }; // revoke any open sessions immediately
  }
  if (input.kycStatus !== undefined) {
    data.kycStatus = input.kycStatus;
    data.kycUpdatedAt = new Date();
  }
  if (input.phone !== undefined) {
    const canonical = normalizePhone(input.phone);
    const hash = phoneHash(canonical);
    const clash = await db.teamMember.findFirst({ where: { phoneHash: hash, NOT: { id } }, select: { id: true } });
    if (clash) throw errors.conflict('Another team member already uses this phone number.');
    data.phoneEncrypted = encryptText(canonical);
    data.phoneHash = hash;
    data.phoneLast4 = phoneLast4(canonical);
    data.sessionVersion = { increment: 1 };
  }
  if (input.password !== undefined) {
    assertPasswordPolicy(input.password);
    data.passwordHash = await hashPassword(input.password);
    data.sessionVersion = { increment: 1 };
  }

  await db.teamMember.update({ where: { id }, data });
  if (input.active === true && !current.active) {
    await ensureTeamGroup();
  }

  const changed = Object.keys(input).filter((k) => k !== 'password' && k !== 'phone');
  await audit({
    actorId: actor.id,
    action: input.kycStatus !== undefined ? 'team.kyc.status_changed' : 'team.member.updated',
    entityType: 'TeamMember',
    entityId: id,
    metadata: {
      fields: [...changed, ...(input.phone !== undefined ? ['phone'] : []), ...(input.password !== undefined ? ['password'] : [])],
      kycStatus: input.kycStatus ?? null,
    },
    ip,
  });
}

export async function setMemberPhoto(actor: Actor, memberId: string, bytes: Buffer, fileName: string, ip?: string | null) {
  requireAdmin(actor);
  const member = await db.teamMember.findUnique({ where: { id: memberId }, select: { id: true, photoFileId: true } });
  if (!member) throw errors.notFound('Member');
  const photo = await storeFile({
    kind: 'PHOTO',
    bytes,
    fileName,
    uploadedById: actor.id,
    memberId,
    allowed: ['jpeg', 'png', 'webp'],
  });
  await db.teamMember.update({ where: { id: memberId }, data: { photoFileId: photo.id } });
  if (member.photoFileId) await db.teamFile.delete({ where: { id: member.photoFileId } }).catch(() => undefined);
  await audit({ actorId: actor.id, action: 'team.photo.updated', entityType: 'TeamMember', entityId: memberId, ip });
  return { photoUrl: fileUrl(photo.id) };
}

export async function uploadKycDocument(
  actor: Actor,
  memberId: string,
  label: z.infer<typeof kycLabelSchema>,
  bytes: Buffer,
  fileName: string,
  ip?: string | null,
) {
  requireAdmin(actor);
  const exists = await db.teamMember.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!exists) throw errors.notFound('Member');
  const doc = await storeFile({
    kind: 'KYC_DOCUMENT',
    bytes,
    fileName,
    uploadedById: actor.id,
    memberId,
    label,
    allowed: ALLOWED_DOCUMENT_TYPES,
  });
  await audit({
    actorId: actor.id,
    action: 'team.kyc.document_uploaded',
    entityType: 'TeamFile',
    entityId: doc.id,
    metadata: { memberId, label },
    ip,
  });
  return { id: doc.id, url: fileUrl(doc.id) };
}

export async function removeFile(actor: Actor, fileId: string, ip?: string | null) {
  requireAdmin(actor);
  await deleteKycOrPhoto(actor, fileId, ip);
}

export async function changeOwnPassword(actor: Actor, input: z.infer<typeof passwordChangeSchema>, ip?: string | null) {
  const row = await db.teamMember.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!row) throw errors.unauthorized();
  if (!(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw errors.badRequest('Your current password is incorrect.');
  }
  assertPasswordPolicy(input.newPassword);
  // Bumping the version signs out every other device; the caller re-issues its own cookie with the returned value.
  const updated = await db.teamMember.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await audit({ actorId: actor.id, action: 'team.password.changed', entityType: 'TeamMember', entityId: actor.id, ip });
  return { sessionVersion: updated.sessionVersion };
}
