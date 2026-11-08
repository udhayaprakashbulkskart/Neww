// Read-only views over the audit log and the ledger transaction history, with filters.
import { db } from './db';

export const MAX_ROWS = 500;

export interface Range { gte: Date; lt: Date }

export interface AuditFilter {
  action?: string;
  actorId?: string;
  targetId?: string;
}

export interface LedgerFilter {
  userId?: string;
  txId?: string;
  reference?: string;
  type?: string;
}

/** Resolves a user from an id or an email address. Returns null when nobody matches. */
export async function resolveUserId(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const user = await db.user.findFirst({
    where: q.includes('@') ? { email: q.toLowerCase() } : { id: q },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function auditEntries(range: Range, filter: AuditFilter = {}) {
  const rows = await db.auditLog.findMany({
    where: {
      createdAt: { gte: range.gte, lt: range.lt },
      ...(filter.action ? { action: { startsWith: filter.action } } : {}),
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.targetId ? { targetId: filter.targetId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action,
    actorId: r.actorId,
    actor: r.actorId ? (byId.get(r.actorId)?.email ?? byId.get(r.actorId)?.name ?? r.actorId) : 'system',
    targetId: r.targetId,
    meta: r.meta ? JSON.stringify(r.meta) : '',
  }));
}

export async function ledgerHistory(range: Range, filter: LedgerFilter = {}) {
  const txs = await db.ledgerTransaction.findMany({
    where: {
      createdAt: { gte: range.gte, lt: range.lt },
      ...(filter.txId ? { id: filter.txId } : {}),
      ...(filter.reference ? { reference: { contains: filter.reference } } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.userId ? { entries: { some: { account: { userId: filter.userId } } } } : {}),
    },
    include: { entries: { include: { account: { select: { key: true, currency: true } } }, orderBy: { id: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });
  return txs.map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    reference: t.reference,
    type: t.type,
    description: t.description,
    legs: t.entries.map((e) => ({
      account: e.account.key,
      currency: e.account.currency,
      direction: e.direction,
      amountMinor: e.amountMinor,
    })),
  }));
}
