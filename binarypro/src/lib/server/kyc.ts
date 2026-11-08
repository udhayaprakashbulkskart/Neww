// Identity review: list pending sign-ups, approve or reject them, and open their documents.
import { db } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { decryptBytes } from './crypto';

export async function listKycQueue(limit = 200) {
  const users = await db.user.findMany({
    where: { kyc: 'PENDING' },
    orderBy: { kycSubmittedAt: 'asc' },
    take: limit,
    select: {
      id: true, name: true, email: true, phone: true, referralCode: true, kycSubmittedAt: true,
      sponsor: { select: { name: true, referralCode: true } },
      bankAccount: { select: { accountHolder: true, bankName: true, ifsc: true, accountLast4: true } },
      kycDocuments: { select: { id: true, kind: true, mime: true, sizeBytes: true, sha256: true, uploadedAt: true } },
    },
  });
  return users;
}

export async function decideKyc(userId: string, decision: 'APPROVE' | 'REJECT', note: string | null, actorId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, kyc: true } });
    if (!user) throw new DomainError('NOT_FOUND', 'Member not found', 404);
    if (user.kyc !== 'PENDING') throw new DomainError('INVALID_TRANSITION', 'This sign-up is not waiting for review', 409);
    const next = decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
    // Conditional update so two reviewers cannot both decide the same sign-up.
    const result = await tx.user.updateMany({
      where: { id: userId, kyc: 'PENDING' },
      data: { kyc: next, kycReviewedAt: new Date(), kycReviewedBy: actorId, kycNote: note?.trim() || null },
    });
    if (result.count !== 1) throw new DomainError('CONFLICT', 'This sign-up was just reviewed by someone else', 409);
    await audit(tx, { action: `kyc.${decision.toLowerCase()}`, actorId, targetId: userId, meta: { note: note?.trim() || null } });
    return { status: next };
  });
}

/** Decrypts one identity document for an authorised reviewer. Every view is recorded in the audit log. */
export async function openKycDocument(documentId: string, actorId: string) {
  const doc = await db.kycDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new DomainError('NOT_FOUND', 'Document not found', 404);
  const plain = decryptBytes(Buffer.from(doc.ciphertext));
  await db.$transaction((tx) => audit(tx, { action: 'kyc.document_viewed', actorId, targetId: doc.userId, meta: { kind: doc.kind, documentId } }));
  return { mime: doc.mime, kind: doc.kind, bytes: plain };
}
