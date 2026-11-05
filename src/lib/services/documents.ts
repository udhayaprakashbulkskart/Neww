import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DocKind, ReviewStatus } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { encryptBytes, decryptBytes, sha256Hex, signFileUrl, verifyFileSignature, encryptText, decryptText } from '../crypto';
import { errors } from '../http';
import { hasPermission, PERMISSIONS } from '../rbac';
import { EDITABLE_STATUSES } from '../state/campaign-machine';
import { audit } from './audit';
import { notify } from './notifications';
import { checkDuplicateDocument } from './fraud';

/**
 * Private document handling.
 *  - Type is decided by file signature (magic bytes), never by the browser-declared MIME alone.
 *  - Files are encrypted with AES-256-GCM before they touch disk and live outside /public.
 *  - Downloads use short-lived HMAC-signed URLs, or an authenticated reviewer or owner session.
 */

const MAX_DOCS_PER_CAMPAIGN = 40;

type Kind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'mp4';
const MIME: Record<Kind, string> = { pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };

export function sniffFileType(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'mp4';
  return null;
}

export function allowedTypesFor(kind: DocKind): { types: Kind[]; maxBytes: number } {
  const maxMb = env().MAX_UPLOAD_MB;
  switch (kind) {
    case 'PHOTO':
      return { types: ['jpeg', 'png', 'webp'], maxBytes: Math.min(maxMb, 8) * 1024 * 1024 };
    case 'VIDEO':
      return { types: ['mp4'], maxBytes: 25 * 1024 * 1024 };
    default:
      return { types: ['pdf', 'jpeg', 'png'], maxBytes: maxMb * 1024 * 1024 };
  }
}

export function sanitiseFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
  return base || 'document';
}

function storageRoot(): string {
  return path.resolve(process.cwd(), env().STORAGE_DIR);
}

/** Resolve a stored key and refuse anything that escapes the private storage root. */
function resolveStoragePath(storageKey: string): string {
  const root = storageRoot();
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage path');
  return full;
}

export async function uploadDocument(args: {
  userId: string;
  campaignId: string;
  kind: DocKind;
  fileName: string;
  declaredType: string;
  bytes: Buffer;
  ip?: string | null;
}) {
  const owner = await db.campaign.findUnique({
    where: { id: args.campaignId },
    select: { beneficiaryId: true, status: true, _count: { select: { documents: true } } },
  });
  if (!owner || owner.beneficiaryId !== args.userId) throw errors.notFound('Campaign');
  if (!EDITABLE_STATUSES.includes(owner.status)) throw errors.invalidState('Documents can only be changed while the campaign is editable.');
  if (owner._count.documents >= MAX_DOCS_PER_CAMPAIGN) throw errors.invalidState('This campaign has reached the document limit.');

  const detected = sniffFileType(args.bytes);
  const { types, maxBytes } = allowedTypesFor(args.kind);
  if (!detected || !types.includes(detected)) {
    throw errors.badRequest('This file type is not allowed for this document. Upload a PDF, JPG, PNG, WebP or MP4 as required.');
  }
  if (args.declaredType && args.declaredType !== MIME[detected] && !(detected === 'jpeg' && args.declaredType === 'image/jpg')) {
    throw errors.badRequest('The file content does not match its extension. Please upload the original file.');
  }
  if (args.bytes.length > maxBytes) {
    throw errors.badRequest(`File is too large. The limit for this document is ${Math.round(maxBytes / 1048576)} MB.`);
  }

  const sha256 = sha256Hex(args.bytes);
  const storageKey = path.posix.join('campaigns', args.campaignId, `${crypto.randomBytes(16).toString('hex')}.bin`);
  const fullPath = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(fullPath, encryptBytes(args.bytes), { mode: 0o600 });

  const doc = await db.campaignDocument.create({
    data: {
      campaignId: args.campaignId,
      uploaderId: args.userId,
      kind: args.kind,
      mimeType: MIME[detected],
      sizeBytes: args.bytes.length,
      storageKey,
      sha256,
      originalNameEncrypted: encryptText(sanitiseFileName(args.fileName)),
      sensitive: args.kind !== 'PHOTO' && args.kind !== 'VIDEO',
    },
    select: { id: true, kind: true, mimeType: true, sizeBytes: true, reviewStatus: true, createdAt: true },
  });

  if (args.kind !== 'PHOTO' && args.kind !== 'VIDEO') await checkDuplicateDocument(args.campaignId, sha256);
  await audit({ actorId: args.userId, action: 'document.uploaded', entityType: 'CampaignDocument', entityId: doc.id, metadata: { kind: args.kind, campaignId: args.campaignId }, ip: args.ip });
  return doc;
}

async function readPlain(doc: { storageKey: string }): Promise<Buffer> {
  const raw = await fs.readFile(resolveStoragePath(doc.storageKey));
  return decryptBytes(raw);
}

/** Signed URL valid for `ttlSeconds`. Only returned to authorised callers. */
export function signedDocumentPath(documentId: string, ttlSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signFileUrl(documentId, exp);
  return `/api/files/${documentId}?exp=${exp}&sig=${sig}`;
}

export async function readDocumentForDownload(args: {
  documentId: string;
  exp?: string | null;
  sig?: string | null;
  viewerId?: string | null;
}): Promise<{ bytes: Buffer; mimeType: string; name: string }> {
  const doc = await db.campaignDocument.findUnique({
    where: { id: args.documentId },
    include: { campaign: { select: { beneficiaryId: true } } },
  });
  if (!doc) throw errors.notFound('Document');

  let allowed = false;
  if (args.exp && args.sig) {
    allowed = verifyFileSignature(doc.id, Number(args.exp), args.sig);
  }
  if (!allowed && args.viewerId) {
    allowed = doc.campaign.beneficiaryId === args.viewerId || (await hasPermission(args.viewerId, PERMISSIONS.DOCUMENT_REVIEW));
  }
  if (!allowed) throw errors.forbidden('This link has expired or you do not have access to the file.');

  await audit({ actorId: args.viewerId ?? null, action: 'document.accessed', entityType: 'CampaignDocument', entityId: doc.id });
  return { bytes: await readPlain(doc), mimeType: doc.mimeType, name: decryptText(doc.originalNameEncrypted) };
}

/** Public photos and videos only, and only after a reviewer approved them on a live campaign. */
export async function readPublicMedia(documentId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const doc = await db.campaignDocument.findUnique({
    where: { id: documentId },
    select: { storageKey: true, mimeType: true, kind: true, reviewStatus: true, campaign: { select: { status: true } } },
  });
  if (
    !doc ||
    (doc.kind !== 'PHOTO' && doc.kind !== 'VIDEO') ||
    doc.reviewStatus !== 'APPROVED' ||
    (doc.campaign.status !== 'PUBLISHED' && doc.campaign.status !== 'CLOSED')
  ) {
    throw errors.notFound('Media');
  }
  return { bytes: await readPlain(doc), mimeType: doc.mimeType };
}

export async function reviewDocument(args: {
  actorId: string;
  documentId: string;
  decision: ReviewStatus;
  note?: string;
  ip?: string | null;
}) {
  if (!(await hasPermission(args.actorId, PERMISSIONS.DOCUMENT_REVIEW))) throw errors.forbidden();
  if (args.decision !== 'APPROVED' && !args.note) throw errors.badRequest('Add a note explaining the decision for the beneficiary.');
  const doc = await db.campaignDocument.findUnique({
    where: { id: args.documentId },
    select: { id: true, kind: true, campaignId: true, campaign: { select: { beneficiaryId: true } } },
  });
  if (!doc) throw errors.notFound('Document');

  await db.campaignDocument.update({
    where: { id: doc.id },
    data: { reviewStatus: args.decision, reviewNote: args.note ?? null, reviewedById: args.actorId, reviewedAt: new Date() },
  });
  await syncFinancialVerification(doc.campaign.beneficiaryId, doc.campaignId);

  const label = doc.kind.toLowerCase().replace(/_/g, ' ');
  const text: Record<ReviewStatus, string> = {
    APPROVED: `Your ${label} was approved.`,
    REJECTED: `Your ${label} was rejected. ${args.note ?? ''}`.trim(),
    ADDITIONAL_REQUIRED: `We need another ${label}. ${args.note ?? ''}`.trim(),
    PENDING: `Your ${label} is pending review.`,
  };
  await notify({
    userId: doc.campaign.beneficiaryId,
    type: 'DOCUMENT_REVIEW',
    title: 'Document review update',
    body: text[args.decision],
    link: `/app/status/${doc.campaignId}`,
  });
  await audit({ actorId: args.actorId, action: `document.${args.decision.toLowerCase()}`, entityType: 'CampaignDocument', entityId: doc.id, metadata: { campaignId: doc.campaignId }, ip: args.ip });
  return { reviewStatus: args.decision };
}

/**
 * Keeps the per-user FINANCIAL_DOCUMENTS and LOAN_DOCUMENTS verification rows in step with the
 * latest campaign review. Campaign approval itself checks each document directly (source of truth).
 */
async function syncFinancialVerification(userId: string, campaignId: string) {
  const docs = await db.campaignDocument.findMany({ where: { campaignId }, select: { kind: true, reviewStatus: true } });
  const groups: { type: 'FINANCIAL_DOCUMENTS' | 'LOAN_DOCUMENTS'; kinds: DocKind[] }[] = [
    { type: 'LOAN_DOCUMENTS', kinds: ['LOAN_STATEMENT'] },
    { type: 'FINANCIAL_DOCUMENTS', kinds: ['INCOME', 'BANK_PROOF', 'MEDICAL_BILL', 'EDUCATION_FEE', 'OTHER'] },
  ];
  for (const g of groups) {
    const relevant = docs.filter((d) => g.kinds.includes(d.kind));
    if (relevant.length === 0) continue;
    let status: 'VERIFIED' | 'REJECTED' | 'ADDITIONAL_INFO_REQUIRED' | 'UNDER_REVIEW' = 'UNDER_REVIEW';
    if (relevant.some((d) => d.reviewStatus === 'REJECTED')) status = 'REJECTED';
    else if (relevant.some((d) => d.reviewStatus === 'ADDITIONAL_REQUIRED')) status = 'ADDITIONAL_INFO_REQUIRED';
    else if (relevant.every((d) => d.reviewStatus === 'APPROVED')) status = 'VERIFIED';
    await db.verification.upsert({
      where: { userId_type: { userId, type: g.type } },
      update: { status, verifiedAt: status === 'VERIFIED' ? new Date() : null, providerName: 'manual-review' },
      create: { userId, type: g.type, status, providerName: 'manual-review', verifiedAt: status === 'VERIFIED' ? new Date() : null },
    });
  }
}

export async function documentsNeedingReview(limit = 50) {
  return db.campaignDocument.findMany({
    where: { reviewStatus: 'PENDING', kind: { notIn: ['PHOTO', 'VIDEO'] } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      kind: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      campaign: { select: { id: true, title: true, slug: true } },
    },
  });
}
