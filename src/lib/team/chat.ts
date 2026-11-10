import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { decryptText } from '../crypto';
import { errors } from '../http';
import { rateLimit } from '../rate-limit';
import { audit } from '../services/audit';
import type { Actor } from './session';
import { requireAdmin } from './session';
import { ALLOWED_DOCUMENT_TYPES, fileUrl, storeFile } from './files';
import { isImageMime, safeFileName } from './security';
import { TEAM_GROUP_ID, TEAM_GROUP_NAME, ensureTeamGroup, initialsOf, getMemberCard, type MemberCard } from './members';
import { TEAM_MESSAGE_MAX } from './schemas';

/**
 * Private (one-to-one) and group chat. Every function checks participation on the server; the client
 * never decides who can read or write a conversation.
 */

export type ChatScope = { kind: 'private'; conversationId: string } | { kind: 'group' };

export type ChatMessage = {
  id: string;
  body: string | null;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderPhotoUrl: string | null;
  createdAt: string;
  file: null | { id: string; name: string; mimeType: string; sizeBytes: number; isImage: boolean; url: string };
};

const messageSelect = {
  id: true,
  body: true,
  senderId: true,
  createdAt: true,
  sender: { select: { fullName: true, photoFileId: true } },
  file: { select: { id: true, nameEncrypted: true, mimeType: true, sizeBytes: true } },
} satisfies Prisma.PrivateMessageSelect;

type MessageRow = Prisma.PrivateMessageGetPayload<{ select: typeof messageSelect }>;

function serializeMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    body: row.body,
    senderId: row.senderId,
    senderName: row.sender.fullName,
    senderInitials: initialsOf(row.sender.fullName),
    senderPhotoUrl: row.sender.photoFileId ? fileUrl(row.sender.photoFileId) : null,
    createdAt: row.createdAt.toISOString(),
    file: row.file
      ? {
          id: row.file.id,
          name: decryptText(row.file.nameEncrypted),
          mimeType: row.file.mimeType,
          sizeBytes: row.file.sizeBytes,
          isImage: isImageMime(row.file.mimeType),
          url: fileUrl(row.file.id),
        }
      : null,
  };
}

/** Throws 404 unless the actor may read and write this chat. */
async function assertParticipant(scope: ChatScope, actor: Actor): Promise<void> {
  if (scope.kind === 'private') {
    const convo = await db.privateConversation.findUnique({
      where: { id: scope.conversationId },
      select: { memberAId: true, memberBId: true },
    });
    if (!convo || (convo.memberAId !== actor.id && convo.memberBId !== actor.id)) throw errors.notFound('Conversation');
    return;
  }
  const membership = await db.groupMembership.findUnique({
    where: { groupId_memberId: { groupId: TEAM_GROUP_ID, memberId: actor.id } },
    select: { memberId: true },
  });
  if (!membership) throw errors.notFound('Group');
}

// ---------- Private conversations ----------

export async function openConversation(actor: Actor, otherId: string): Promise<{ id: string }> {
  if (otherId === actor.id) throw errors.badRequest('You cannot start a chat with yourself.');
  const other = await db.teamMember.findUnique({ where: { id: otherId }, select: { id: true, active: true } });
  if (!other || !other.active) throw errors.notFound('Member');
  const [memberAId, memberBId] = [actor.id, otherId].sort();
  const convo = await db.privateConversation.upsert({
    where: { memberAId_memberBId: { memberAId, memberBId } },
    update: {},
    create: { memberAId, memberBId },
    select: { id: true },
  });
  return convo;
}

export async function getPrivateConversation(actor: Actor, conversationId: string) {
  const convo = await db.privateConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, memberAId: true, memberBId: true, lastReadAtA: true, lastReadAtB: true },
  });
  if (!convo || (convo.memberAId !== actor.id && convo.memberBId !== actor.id)) throw errors.notFound('Conversation');
  const otherId = convo.memberAId === actor.id ? convo.memberBId : convo.memberAId;
  const other = await getMemberCard(otherId);
  if (!other) throw errors.notFound('Member');
  return { id: convo.id, other: publicPerson(other) };
}

function publicPerson(m: MemberCard) {
  return { id: m.id, fullName: m.fullName, initials: m.initials, photoUrl: m.photoUrl, jobTitle: m.jobTitle, kycStatus: m.kycStatus, active: m.active };
}

export async function listConversations(actor: Actor) {
  const convos = await db.privateConversation.findMany({
    where: { OR: [{ memberAId: actor.id }, { memberBId: actor.id }] },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      memberAId: true,
      memberBId: true,
      lastMessageAt: true,
      lastReadAtA: true,
      lastReadAtB: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fileId: true, senderId: true } },
    },
  });

  return Promise.all(
    convos.map(async (c) => {
      const iAmA = c.memberAId === actor.id;
      const otherId = iAmA ? c.memberBId : c.memberAId;
      const lastRead = iAmA ? c.lastReadAtA : c.lastReadAtB;
      const [other, unread] = await Promise.all([
        getMemberCard(otherId),
        db.privateMessage.count({
          where: { conversationId: c.id, senderId: { not: actor.id }, ...(lastRead ? { createdAt: { gt: lastRead } } : {}) },
        }),
      ]);
      const last = c.messages[0];
      return {
        id: c.id,
        other: other ? publicPerson(other) : null,
        lastMessageAt: c.lastMessageAt.toISOString(),
        preview: last ? (last.body ?? '📎 Attachment') : null,
        unread,
      };
    }),
  );
}

// ---------- Messages (shared for private and group) ----------

export async function listMessages(scope: ChatScope, actor: Actor, after?: string | null) {
  await assertParticipant(scope, actor);
  const where = scopeWhere(scope, after);
  const rows =
    scope.kind === 'private'
      ? await db.privateMessage.findMany({
          where,
          orderBy: { createdAt: after ? 'asc' : 'desc' },
          take: after ? 200 : 60,
          select: messageSelect,
        })
      : await db.groupMessage.findMany({
          where,
          orderBy: { createdAt: after ? 'asc' : 'desc' },
          take: after ? 200 : 60,
          select: messageSelect,
        });
  const ordered = after ? rows : [...rows].reverse();
  return { messages: ordered.map(serializeMessage), serverTime: new Date().toISOString() };
}

function scopeWhere(scope: ChatScope, after?: string | null) {
  const base = scope.kind === 'private' ? { conversationId: scope.conversationId } : { groupId: TEAM_GROUP_ID };
  if (!after) return base;
  const when = new Date(after);
  if (Number.isNaN(when.getTime())) throw errors.badRequest('Invalid "after" timestamp.');
  return { ...base, createdAt: { gte: when } };
}

export async function sendMessage(
  scope: ChatScope,
  actor: Actor,
  input: { body?: string | null; file?: { bytes: Buffer; fileName: string } | null },
  ip?: string | null,
) {
  await assertParticipant(scope, actor);
  rateLimit(`team-msg:${actor.id}`, 120, 60_000);

  const body = input.body?.trim() || null;
  if (body && body.length > TEAM_MESSAGE_MAX) throw errors.badRequest(`Messages can be ${TEAM_MESSAGE_MAX} characters or fewer.`);
  if (!body && !input.file) throw errors.badRequest('Write a message or attach a file.');

  const file = input.file
    ? await storeFile({
        kind: scope.kind === 'private' ? 'CHAT_ATTACHMENT' : 'GROUP_ATTACHMENT',
        bytes: input.file.bytes,
        fileName: safeFileName(input.file.fileName),
        uploadedById: actor.id,
        allowed: ALLOWED_DOCUMENT_TYPES,
      })
    : null;

  const data = { senderId: actor.id, body, fileId: file?.id ?? null };
  let row: MessageRow;
  if (scope.kind === 'private') {
    row = await db.privateMessage.create({
      data: { ...data, conversationId: scope.conversationId },
      select: messageSelect,
    });
    await db.privateConversation.update({ where: { id: scope.conversationId }, data: { lastMessageAt: row.createdAt } });
  } else {
    row = await db.groupMessage.create({ data: { ...data, groupId: TEAM_GROUP_ID }, select: messageSelect });
  }

  if (file) {
    await audit({
      actorId: actor.id,
      action: scope.kind === 'private' ? 'team.chat.attachment_sent' : 'team.group.attachment_sent',
      entityType: 'TeamFile',
      entityId: file.id,
      metadata: { mimeType: file.mimeType, sizeBytes: file.sizeBytes },
      ip,
    });
  }
  return serializeMessage(row);
}

export async function markRead(scope: ChatScope, actor: Actor) {
  await assertParticipant(scope, actor);
  const now = new Date();
  if (scope.kind === 'private') {
    const convo = await db.privateConversation.findUnique({
      where: { id: scope.conversationId },
      select: { memberAId: true },
    });
    if (!convo) throw errors.notFound('Conversation');
    await db.privateConversation.update({
      where: { id: scope.conversationId },
      data: convo.memberAId === actor.id ? { lastReadAtA: now } : { lastReadAtB: now },
    });
  } else {
    await db.groupMembership.update({
      where: { groupId_memberId: { groupId: TEAM_GROUP_ID, memberId: actor.id } },
      data: { lastReadAt: now },
    });
  }
  return { readAt: now.toISOString() };
}

// ---------- Group ----------

export async function getGroup(actor: Actor) {
  await ensureTeamGroup();
  const memberships = await db.groupMembership.findMany({
    where: { groupId: TEAM_GROUP_ID, member: { active: true } },
    orderBy: { member: { fullName: 'asc' } },
    select: { memberId: true, lastReadAt: true },
  });
  const mine = memberships.find((m) => m.memberId === actor.id);
  const unread = mine
    ? await db.groupMessage.count({
        where: {
          groupId: TEAM_GROUP_ID,
          senderId: { not: actor.id },
          ...(mine.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
        },
      })
    : 0;
  const members = await Promise.all(memberships.map((m) => getMemberCard(m.memberId)));
  return {
    id: TEAM_GROUP_ID,
    name: TEAM_GROUP_NAME,
    isMember: !!mine,
    unread,
    memberCount: memberships.length,
    members: members.filter((m): m is MemberCard => !!m).map(publicPerson),
  };
}

/** Admin only: add or remove a member from the common group. Removal keeps history but blocks access. */
export async function setGroupMembership(actor: Actor, memberId: string, shouldBeMember: boolean, ip?: string | null) {
  requireAdmin(actor);
  await ensureTeamGroup();
  const member = await db.teamMember.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) throw errors.notFound('Member');
  if (shouldBeMember) {
    await db.groupMembership.upsert({
      where: { groupId_memberId: { groupId: TEAM_GROUP_ID, memberId } },
      update: {},
      create: { groupId: TEAM_GROUP_ID, memberId, addedById: actor.id },
    });
  } else {
    await db.groupMembership.deleteMany({ where: { groupId: TEAM_GROUP_ID, memberId } });
  }
  await audit({
    actorId: actor.id,
    action: shouldBeMember ? 'team.group.member_added' : 'team.group.member_removed',
    entityType: 'GroupMembership',
    entityId: `${TEAM_GROUP_ID}:${memberId}`,
    ip,
  });
}

export async function isGroupMember(memberId: string): Promise<boolean> {
  const m = await db.groupMembership.findUnique({
    where: { groupId_memberId: { groupId: TEAM_GROUP_ID, memberId } },
    select: { memberId: true },
  });
  return !!m;
}

