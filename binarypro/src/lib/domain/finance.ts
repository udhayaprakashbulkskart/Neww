// Pure finance rules: trial-balance checks, withdrawal reconciliation and CSV encoding.
// No database access here, so every rule is unit-testable.

import type { Currency } from './money';

export interface TrialRow {
  key: string;
  currency: Currency;
  debitMinor: bigint;
  creditMinor: bigint;
}

/** Balance of one account on its normal side (CREDIT-normal accounts show credits minus debits). */
export function normalBalance(normal: 'DEBIT' | 'CREDIT', debitMinor: bigint, creditMinor: bigint): bigint {
  return normal === 'CREDIT' ? creditMinor - debitMinor : debitMinor - creditMinor;
}

/**
 * Double-entry integrity. Across the whole ledger, total debits must equal total credits in every
 * currency, and no individual transaction may be unbalanced. Returns human-readable issues.
 */
export function trialIssues(rows: TrialRow[], unbalancedTransactions: number): string[] {
  const issues: string[] = [];
  const totals = new Map<Currency, { debit: bigint; credit: bigint }>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { debit: 0n, credit: 0n };
    t.debit += r.debitMinor;
    t.credit += r.creditMinor;
    totals.set(r.currency, t);
  }
  for (const [currency, t] of totals) {
    if (t.debit !== t.credit) {
      issues.push(`${currency}: total debits ${t.debit} do not equal total credits ${t.credit}`);
    }
  }
  if (unbalancedTransactions > 0) {
    issues.push(`${unbalancedTransactions} ledger transaction(s) are unbalanced`);
  }
  return issues;
}

export interface WithdrawalReconciliation {
  requestedMinor: bigint;
  ledgerPendingMinor: bigint;
  differenceMinor: bigint;
  ok: boolean;
}

/**
 * Withdrawal requests still awaiting a decision must equal the money parked in WITHDRAWAL_PENDING.
 * Any difference means a request was recorded without its ledger movement, or the reverse.
 */
export function reconcileWithdrawals(requestedMinor: bigint, ledgerPendingMinor: bigint): WithdrawalReconciliation {
  const differenceMinor = ledgerPendingMinor - requestedMinor;
  return { requestedMinor, ledgerPendingMinor, differenceMinor, ok: differenceMinor === 0n };
}

/** Converts an integer minor amount into a plain decimal string, e.g. 12345n -> "123.45". */
export function minorToDecimal(amountMinor: bigint, decimals = 2): string {
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${frac}` : ''}`;
}

export type CsvCell = string | number | bigint | boolean | null | undefined;

/** RFC 4180 cell escaping, plus neutralising spreadsheet formulas (=, +, -, @) so exports are safe to open. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Parses an inclusive YYYY-MM-DD range into a half-open [from, to) UTC interval. */
export function dateRange(from: string, to: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const gte = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(gte.getTime()) || Number.isNaN(end.getTime()) || end < gte) return null;
  const lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}
