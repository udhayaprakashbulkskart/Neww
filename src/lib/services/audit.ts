import { db } from '../db';
import type { Prisma } from '@prisma/client';

/**
 * Append-only audit trail for every privileged or money-moving action.
 * Metadata must never contain raw personal data, card data, or document contents.
 */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    // Audit failures must be visible in logs, but a logging hiccup should not silently drop a
    // money movement, so we surface them loudly.
    console.error('[audit] failed to write audit entry', entry.action, err instanceof Error ? err.message : '');
  }
}
