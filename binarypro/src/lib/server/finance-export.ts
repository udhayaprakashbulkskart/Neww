// Turns finance reports into flat tables. The same table feeds the CSV (Excel-compatible) download
// and the print-ready HTML page that can be saved as PDF from the browser.
import { minorToDecimal, toCsv, type CsvCell } from '@/lib/domain/finance';
import { trialBalance, salesReport, commissionReport, withdrawalReport } from './finance';
import { db, type Tx } from './db';
import { auditEntries, ledgerHistory, type AuditFilter, type LedgerFilter } from './audit-view';
import { orderTracker } from './order-tracker';

export const REPORTS = ['sales', 'commissions', 'withdrawals', 'trial', 'audit', 'transactions', 'orders', 'refunds'] as const;
export type ReportName = (typeof REPORTS)[number];

export interface ExportTable {
  title: string;
  headers: string[];
  rows: CsvCell[][];
}

export async function buildTable(
  report: ReportName,
  range: { gte: Date; lt: Date },
  from: string,
  to: string,
  client: Tx | typeof db = db,
  filters: { audit?: AuditFilter; ledger?: LedgerFilter } = {},
): Promise<ExportTable> {
  const period = `${from} to ${to}`;
  if (report === 'audit') {
    const rows = await auditEntries(range, filters.audit ?? {});
    return {
      title: `Audit log, ${period}`,
      headers: ['Time (UTC)', 'Action', 'Actor', 'Target', 'Details'],
      rows: rows.map((r) => [r.createdAt.toISOString(), r.action, r.actor, r.targetId ?? '', r.meta]),
    };
  }
  if (report === 'transactions') {
    const rows = await ledgerHistory(range, filters.ledger ?? {});
    return {
      title: `Ledger transactions, ${period}`,
      headers: ['Time (UTC)', 'Transaction ID', 'Reference', 'Type', 'Description', 'Account', 'Currency', 'Direction', 'Amount'],
      rows: rows.flatMap((t) =>
        t.legs.map((leg) => [
          t.createdAt.toISOString(),
          t.id,
          t.reference,
          t.type,
          t.description,
          leg.account,
          leg.currency,
          leg.direction,
          minorToDecimal(leg.amountMinor),
        ]),
      ),
    };
  }
  if (report === 'orders' || report === 'refunds') {
    const tracked = await orderTracker(range, new Date(), client);
    const list = report === 'refunds' ? tracked.rows.filter((r) => r.status === 'RETURNED' || r.status === 'CANCELLED') : tracked.rows;
    return {
      title: `${report === 'refunds' ? 'Refunds and cancellations' : 'Order tracking'}, ${period}`,
      headers: ['Order ID', 'Created (UTC)', 'Status', 'Bucket', 'Merchant', 'Buyer', 'Currency', 'Sales', 'PV (INR)', 'Cashback', 'Delivered', 'Return window ends', 'Verified', 'Returned', 'Refund due', 'Commission eligible', 'Commission posted', 'Commission reversed', 'Withheld reason'],
      rows: list.map((r) => [
        r.id,
        r.createdAt.toISOString(),
        r.status,
        r.bucketLabel,
        r.merchant,
        r.buyer,
        r.currency,
        minorToDecimal(r.subtotalMinor),
        minorToDecimal(r.pvInrMinor),
        minorToDecimal(r.cashbackMinor),
        r.deliveredAt?.toISOString() ?? '',
        r.returnWindowEndsAt?.toISOString() ?? '',
        r.verifiedAt?.toISOString() ?? '',
        r.returnedAt?.toISOString() ?? '',
        minorToDecimal(r.refundDueMinor),
        r.commissionEligible ? 'yes' : 'no',
        minorToDecimal(r.commissionPostedMinor),
        minorToDecimal(r.commissionReversedMinor),
        r.commissionBlocked ?? '',
      ]),
    };
  }
  if (report === 'sales') {
    const rows = await salesReport(range, client);
    return {
      title: `Verified retail sales, ${period}`,
      headers: ['Currency', 'Verified orders', 'Verified sales', 'PV (INR)', 'Cashback', 'Returned orders', 'Returned sales'],
      rows: rows.map((r) => [
        r.currency,
        r.verifiedOrders,
        minorToDecimal(r.verifiedSubtotalMinor),
        minorToDecimal(r.verifiedPvInrMinor),
        minorToDecimal(r.verifiedCashbackMinor),
        r.returnedOrders,
        minorToDecimal(r.returnedSubtotalMinor),
      ]),
    };
  }
  if (report === 'commissions') {
    const rows = await commissionReport(range, client);
    return {
      title: `Commission postings, ${period}`,
      headers: ['Type', 'Status', 'Count', 'Amount (INR)'],
      rows: rows.map((r) => [r.type, r.status, r.count, minorToDecimal(r.amountMinor)]),
    };
  }
  if (report === 'withdrawals') {
    const rows = await withdrawalReport(range, client);
    return {
      title: `Withdrawal requests, ${period}`,
      headers: ['Currency', 'Status', 'Count', 'Amount'],
      rows: rows.map((r) => [r.currency, r.status, r.count, minorToDecimal(r.amountMinor)]),
    };
  }
  const trial = await trialBalance(client);
  return {
    title: 'Trial balance (current, all time)',
    headers: ['Account', 'Currency', 'Normal side', 'Debits', 'Credits', 'Balance'],
    rows: trial.rows.map((r) => [
      r.key,
      r.currency,
      r.normal,
      minorToDecimal(r.debitMinor),
      minorToDecimal(r.creditMinor),
      minorToDecimal(r.balanceMinor),
    ]),
  };
}

export function toCsvDocument(table: ExportTable): string {
  // Byte-order mark so Excel reads UTF-8 correctly.
  return '﻿' + toCsv(table.headers, table.rows);
}

export function toPrintHtml(table: ExportTable, generatedAt: Date): string {
  const esc = (v: CsvCell) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const head = table.headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(table.title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.meta { font-size: 12px; color: #555; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
  th { background: #f1ede3; }
  td:nth-child(n+3) { text-align: right; }
  button { margin-bottom: 16px; padding: 6px 12px; }
  @media print { button { display: none; } body { margin: 12mm; } }
</style></head>
<body>
  <button onclick="window.print()">Print / Save as PDF</button>
  <h1>BinaryPro: ${esc(table.title)}</h1>
  <p class="meta">Generated ${esc(generatedAt.toISOString())} (UTC). Amounts in minor-unit decimals.</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}
