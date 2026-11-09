// Financial reconciliation. Read-only checks over the ledger and the engine records; each run is stored as a report.
import { db } from './db';
import { audit } from './audit';
import { balanceOf } from './ledger';
import { pendingAccount } from './commission-engine';

export interface Finding { check: string; ok: boolean; detail: string }

export async function runReconciliation(actorId: string | null, reason: string, now = new Date()) {
  const findings: Finding[] = [];

  // 1. Every ledger transaction balances per currency.
  const unbalanced = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT "txId", currency FROM "LedgerEntry" GROUP BY "txId", currency
      HAVING SUM(CASE WHEN direction = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END) <> 0) x`;
  findings.push({ check: 'Ledger transactions balance', ok: unbalanced[0]!.n === 0, detail: `${unbalanced[0]!.n} unbalanced` });

  // 2. Pending commission on the ledger equals unsettled commission on the engine records, per member.
  const members = await db.commissionEntry.findMany({ distinct: ['userId'], select: { userId: true } });
  let pendingMismatch = 0;
  let pendingTotal = 0n;
  for (const { userId } of members) {
    const entries = await db.commissionEntry.findMany({ where: { userId }, include: { events: true } });
    const unsettled = entries.reduce((a, e) => a + e.amountMinor - e.events.reduce((x, ev) => x + ev.amountMinor, 0n), 0n);
    const ledger = await balanceOf(db, pendingAccount(userId).key);
    pendingTotal += ledger;
    if (ledger !== unsettled) pendingMismatch += 1;
  }
  findings.push({ check: 'Pending commission matches the commission ledger', ok: pendingMismatch === 0, detail: `${members.length} members, ${pendingMismatch} mismatched, total pending ${pendingTotal}` });

  // 3. No commission entry is released or reversed beyond what it accrued.
  const over = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "CommissionEntry" e
    WHERE e."amountMinor" < COALESCE((SELECT sum(ev."amountMinor") FROM "CommissionEvent" ev WHERE ev."entryId" = e.id), 0)`;
  findings.push({ check: 'No commission over-released or over-reversed', ok: over[0]!.n === 0, detail: `${over[0]!.n} entries over-settled` });

  // 4. Released commission equals the daily summaries' payable amounts.
  const released = await db.commissionEvent.aggregate({ where: { type: 'RELEASE' }, _sum: { amountMinor: true } });
  const payable = await db.dailyCommissionSummary.aggregate({ _sum: { payableMinor: true } });
  const releasedMinor = released._sum.amountMinor ?? 0n;
  const payableMinor = payable._sum.payableMinor ?? 0n;
  findings.push({ check: 'Released commission equals daily settlement payouts', ok: releasedMinor === payableMinor, detail: `released ${releasedMinor}, settled ${payableMinor}` });

  // 5. Volume: every reversal has an accrual, and no member has negative volume.
  const orphanReversals = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "VolumeEntry" r
    WHERE r.kind = 'REVERSE' AND NOT EXISTS (SELECT 1 FROM "VolumeEntry" a WHERE a."orderId" = r."orderId" AND a."userId" = r."userId" AND a.kind = 'ACCRUE')`;
  const negativeVolume = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (SELECT "userId" FROM "VolumeEntry" GROUP BY "userId"
      HAVING SUM(CASE WHEN kind = 'ACCRUE' THEN "pvMinor" ELSE -"pvMinor" END) < 0) x`;
  findings.push({ check: 'Volume reversals have accruals and no negative volume', ok: orphanReversals[0]!.n === 0 && negativeVolume[0]!.n === 0, detail: `${orphanReversals[0]!.n} orphan reversals, ${negativeVolume[0]!.n} negative balances` });

  // 6. Refunds match the returned orders they belong to.
  const badRefunds = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "Refund" r JOIN "Order" o ON o.id = r."orderId" WHERE r."amountMinor" <> o."subtotalMinor"`;
  findings.push({ check: 'Refund amounts match the order value', ok: badRefunds[0]!.n === 0, detail: `${badRefunds[0]!.n} mismatched` });

  // 7. Daily settlements never pay above the cap they were calculated with.
  const overCap = await db.dailyCommissionSummary.count({ where: { payableMinor: { gt: 0n } } });
  const capBroken = await db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "DailyCommissionSummary" WHERE "payableMinor" > "capMinor"`;
  findings.push({ check: 'Settlements respect the daily cap', ok: capBroken[0]!.n === 0, detail: `${overCap} settlements with payouts, ${capBroken[0]!.n} above cap` });

  // 8. Sponsor and binary commission have never been posted.
  const forbidden = await db.ledgerTransaction.count({ where: { type: { in: ['DIRECT_COMMISSION', 'BINARY_COMMISSION'] } } });
  findings.push({ check: 'No sponsor or binary commission posted', ok: forbidden === 0, detail: `${forbidden} such transactions` });

  const status = findings.every((f) => f.ok) ? 'PASS' : 'FAIL';
  const totals = { pendingTotal: pendingTotal.toString(), releasedMinor: releasedMinor.toString(), payableMinor: payableMinor.toString() };
  const report = await db.$transaction(async (tx) => {
    const r = await tx.reconciliationReport.create({ data: { status, findings: findings as unknown as object, totals, actorId, createdAt: now } });
    await audit(tx, { action: 'reconciliation.run', actorId, targetId: r.id, meta: { status, reason: reason.trim() } });
    return r;
  });
  return { id: report.id, status, findings, totals };
}
