// Read models and exports for the financial engine admin pages.
import { db } from './db';
import { balanceOf } from './ledger';
import { accounts } from './accounts';
import { dailyCap, pendingAccount } from './commission-engine';
import { minorToDecimal, toCsv, type CsvCell } from '@/lib/domain/finance';
import { MAX_ROWS } from './audit-view';

export const ENGINE_REPORTS = ['pending', 'volume', 'refunds', 'settlements', 'reconciliation'] as const;
export type EngineReport = (typeof ENGINE_REPORTS)[number];

export async function engineOverview() {
  const [cap, policies, reports, services, refunds] = await Promise.all([
    dailyCap(),
    db.commissionPolicy.findMany({ orderBy: [{ kind: 'asc' }, { version: 'desc' }] }),
    db.reconciliationReport.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    db.service.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], take: 200 }),
    db.refund.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const pendingRows = await pendingReport();
  const volumeRows = await volumeReport();
  return {
    capMinor: cap,
    policies: policies.map((p) => ({ id: p.id, kind: p.kind, version: p.version, rateBps: p.rateBps, active: p.active, legalApprovalRef: p.legalApprovalRef, reason: p.reason, createdAt: p.createdAt })),
    reports: reports.map((r) => ({ id: r.id, status: r.status, findings: r.findings as unknown as { check: string; ok: boolean; detail: string }[], createdAt: r.createdAt })),
    services: services.map((s) => ({ id: s.id, name: s.name, description: s.description, priceMinor: s.priceMinor, currency: s.currency, active: s.active })),
    refunds: refunds.map((r) => ({ id: r.id, orderId: r.orderId, amountMinor: r.amountMinor, reason: r.reason, createdAt: r.createdAt })),
    pending: pendingRows,
    pendingTotalMinor: pendingRows.reduce((a, r) => a + r.pendingMinor, 0n),
    volume: volumeRows,
    volumeTotal: volumeRows.reduce((a, r) => a + r.volume, 0n),
  };
}

export async function pendingReport(limit = MAX_ROWS) {
  const users = await db.commissionEntry.findMany({ distinct: ['userId'], select: { userId: true }, take: limit * 4 });
  const rows: { userId: string; name: string; email: string | null; pendingMinor: bigint }[] = [];
  for (const { userId } of users) {
    const pendingMinor = await balanceOf(db, pendingAccount(userId).key);
    if (pendingMinor === 0n) continue;
    const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    rows.push({ userId, name: u?.name ?? '', email: u?.email ?? null, pendingMinor });
  }
  return rows.sort((a, b) => (a.pendingMinor < b.pendingMinor ? 1 : -1)).slice(0, limit);
}

export async function volumeReport(limit = MAX_ROWS) {
  const grouped = await db.volumeEntry.groupBy({ by: ['userId', 'kind'], _sum: { pvMinor: true } });
  const byUser = new Map<string, bigint>();
  for (const g of grouped) {
    const v = g._sum.pvMinor ?? 0n;
    byUser.set(g.userId, (byUser.get(g.userId) ?? 0n) + (g.kind === 'ACCRUE' ? v : -v));
  }
  const ids = [...byUser.entries()].filter(([, v]) => v !== 0n).map(([id]) => id);
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  const name = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => ({ userId: id, name: name.get(id)?.name ?? '', email: name.get(id)?.email ?? null, volume: byUser.get(id)! }))
    .sort((a, b) => (a.volume < b.volume ? 1 : -1))
    .slice(0, limit);
}

/** Tables for the exports. Amounts are rupee decimals. */
export async function engineExportTable(report: EngineReport, from: string, to: string) {
  if (report === 'pending') {
    const rows = await pendingReport();
    return { title: 'Pending commission (current)', headers: ['Member', 'Email', 'Pending (INR)'], rows: rows.map((r) => [r.name, r.email ?? '', minorToDecimal(r.pendingMinor)]) };
  }
  if (report === 'volume') {
    const rows = await volumeReport();
    return { title: 'Volume carry-forward (current, not money)', headers: ['Member', 'Email', 'Volume (INR)'], rows: rows.map((r) => [r.name, r.email ?? '', minorToDecimal(r.volume)]) };
  }
  const gte = new Date(`${from}T00:00:00.000Z`);
  const lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000);
  if (report === 'refunds') {
    const rows = await db.refund.findMany({ where: { createdAt: { gte, lt } }, orderBy: { createdAt: 'desc' }, take: MAX_ROWS * 10 });
    return { title: 'Refunds', headers: ['Created (UTC)', 'Order', 'Amount (INR)', 'Reason', 'Reference'], rows: rows.map((r) => [r.createdAt.toISOString(), r.orderId, minorToDecimal(r.amountMinor), r.reason, r.reference]) };
  }
  if (report === 'settlements') {
    const rows = await db.dailyCommissionSummary.findMany({ where: { dayKey: { gte: from, lte: to } }, orderBy: [{ dayKey: 'desc' }], take: MAX_ROWS * 10, include: { user: { select: { name: true, email: true } } } });
    return {
      title: 'Daily commission settlements',
      headers: ['Business day', 'Member', 'Eligible', 'Carried in', 'Released', 'Carried out', 'Cap'],
      rows: rows.map((r) => [r.dayKey, r.user.email ?? r.user.name, minorToDecimal(r.eligibleMinor), minorToDecimal(r.carriedInMinor), minorToDecimal(r.payableMinor), minorToDecimal(r.carriedOutMinor), minorToDecimal(r.capMinor)]),
    };
  }
  const rows = await db.reconciliationReport.findMany({ where: { createdAt: { gte, lt } }, orderBy: { createdAt: 'desc' }, take: 200 });
  const flat = rows.flatMap((r) => (r.findings as unknown as { check: string; ok: boolean; detail: string }[]).map((f) => [r.createdAt.toISOString(), r.status, f.check, f.ok ? 'OK' : 'FAIL', f.detail] as CsvCell[]));
  return { title: 'Reconciliation', headers: ['Run (UTC)', 'Run status', 'Check', 'Result', 'Detail'], rows: flat };
}

export function engineCsv(table: { headers: string[]; rows: CsvCell[][] }) {
  return '﻿' + toCsv(table.headers, table.rows);
}

