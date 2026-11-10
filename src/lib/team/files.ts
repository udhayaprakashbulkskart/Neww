import type { TeamFileKind } from '@prisma/client';
import { db } from '../db';
import { decryptBytes, decryptText, encryptBytes, encryptText, sha256Hex } from '../crypto';
import { errors } from '../http';
import type { Actor } from './session';
import { isImageMime, safeFileName, sniffTeamFile, TEAM_MIME, type TeamFileType } from './security';
import { TEAM_MAX_UPLOAD_BYTES } from './schemas';
import { audit } from '../services/audit';

/**
 * Team files (photos, KYC documents, chat attachments) are stored AES-256-GCM encrypted in the
 * database, so they survive serverless deploys and never sit on a public path. Every read goes
 * through `readFileForActor`, which applies the access rule for the file's kind.
 */

export const ALLOWED_DOCUMENT_TYPES: TeamFileType[] = ['pdf', 'jpeg', 'png', 'webp'];

export function validateUpload(bytes: Buffer, allowed: TeamFileType[]): TeamFileType {
  if (bytes.length === 0) throw errors.badRequest('The file is empty.');
  if (bytes.length > TEAM_MAX_UPLOAD_BYTES) {
    throw errors.badRequest(`Files must be ${TEAM_MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  const detected = sniffTeamFile(bytes);
  if (!detected || !allowed.includes(detected)) {
    throw errors.badRequest('This file type is not allowed. Use a PDF, JPG, PNG or WebP file.');
  }
  return detected;
}

export async function storeFile(args: {
  kind: TeamFileKind;
  bytes: Buffer;
  fileName: string;
  uploadedById: string;
  memberId?: string | null;
  label?: string | null;
  allowed: TeamFileType[];
}) {
  const detected = validateUpload(args.bytes, args.allowed);
  return db.teamFile.create({
    data: {
      kind: args.kind,
      memberId: args.memberId ?? null,
      label: args.label ?? null,
      nameEncrypted: encryptText(safeFileName(args.fileName)),
      mimeType: TEAM_MIME[detected],
      sizeBytes: args.bytes.length,
      sha256: sha256Hex(args.bytes),
      data: encryptBytes(args.bytes),
      uploadedById: args.uploadedById,
    },
    select: { id: true, kind: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
}

/**
 * Access rules:
 *  - PHOTO: any active team member (the directory shows photos).
 *  - KYC_DOCUMENT: the member themself, or an administrator. Other members never see KYC files.
 *  - CHAT_ATTACHMENT: only the two participants of that private conversation.
 *  - GROUP_ATTACHMENT: only current members of the group.
 * Anyone without access gets 404, so file ids cannot be used to discover files.
 */
export async function readFileForActor(actor: Actor, fileId: string) {
  const file = await db.teamFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      kind: true,
      memberId: true,
      mimeType: true,
      nameEncrypted: true,
      data: true,
      chatMessage: { select: { conversation: { select: { memberAId: true, memberBId: true } } } },
      groupMessage: { select: { groupId: true } },
    },
  });
  if (!file) throw errors.notFound('File');

  let allowed = false;
  switch (file.kind) {
    case 'PHOTO':
      allowed = true;
      break;
    case 'KYC_DOCUMENT':
      allowed = actor.isAdmin || file.memberId === actor.id;
      break;
    case 'CHAT_ATTACHMENT': {
      const convo = file.chatMessage?.conversation;
      allowed = !!convo && (convo.memberAId === actor.id || convo.memberBId === actor.id);
      break;
    }
    case 'GROUP_ATTACHMENT': {
      if (!file.groupMessage) break;
      const membership = await db.groupMembership.findUnique({
        where: { groupId_memberId: { groupId: file.groupMessage.groupId, memberId: actor.id } },
        select: { memberId: true },
      });
      allowed = !!membership;
      break;
    }
  }
  if (!allowed) throw errors.notFound('File');

  const bytes = decryptBytes(Buffer.from(file.data));
  return { bytes, mimeType: file.mimeType, name: decryptText(file.nameEncrypted), isImage: isImageMime(file.mimeType) };
}

export function fileUrl(fileId: string) {
  return `/api/team/files/${fileId}`;
}

/** Delete a photo or KYC document. Admin only; the caller checks that first. */
export async function deleteKycOrPhoto(actor: Actor, fileId: string, ip?: string | null) {
  const file = await db.teamFile.findUnique({ where: { id: fileId }, select: { id: true, kind: true, memberId: true } });
  if (!file || (file.kind !== 'KYC_DOCUMENT' && file.kind !== 'PHOTO')) throw errors.notFound('File');
  await db.$transaction([
    db.teamMember.updateMany({ where: { photoFileId: fileId }, data: { photoFileId: null } }),
    db.teamFile.delete({ where: { id: fileId } }),
  ]);
  await audit({
    actorId: actor.id,
    action: file.kind === 'PHOTO' ? 'team.photo.removed' : 'team.kyc.document_removed',
    entityType: 'TeamFile',
    entityId: file.id,
    metadata: { memberId: file.memberId },
    ip,
  });
}
