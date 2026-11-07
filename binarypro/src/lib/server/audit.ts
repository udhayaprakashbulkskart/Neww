import type { Prisma } from '@prisma/client';
import type { Tx } from './db';

export async function audit(
  tx: Tx,
  entry: { action: string; actorId?: string | null; targetId?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      targetId: entry.targetId ?? null,
      meta: (entry.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
