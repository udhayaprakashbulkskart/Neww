import { describe, expect, it } from 'vitest';
import { csvCell, dateRange, minorToDecimal, normalBalance, reconcileWithdrawals, toCsv, trialIssues } from '@/lib/domain/finance';

describe('finance rules', () => {
  it('computes normal-side balances', () => {
    expect(normalBalance('CREDIT', 30n, 100n)).toBe(70n);
    expect(normalBalance('DEBIT', 100n, 30n)).toBe(70n);
    expect(normalBalance('CREDIT', 100n, 30n)).toBe(-70n);
  });

  it('reports an issue when a currency does not balance or a transaction is unbalanced', () => {
    expect(trialIssues([
      { key: 'A', currency: 'INR', debitMinor: 500n, creditMinor: 0n },
      { key: 'B', currency: 'INR', debitMinor: 0n, creditMinor: 500n },
    ], 0)).toEqual([]);
    expect(trialIssues([{ key: 'A', currency: 'INR', debitMinor: 500n, creditMinor: 400n }], 0)[0]).toMatch(/INR/);
    expect(trialIssues([], 2)).toEqual(['2 ledger transaction(s) are unbalanced']);
  });

  it('matches withdrawal requests against pending money exactly', () => {
    expect(reconcileWithdrawals(60_000n, 60_000n).ok).toBe(true);
    const off = reconcileWithdrawals(60_000n, 59_000n);
    expect(off.ok).toBe(false);
    expect(off.differenceMinor).toBe(-1_000n);
  });

  it('formats minor units as decimals', () => {
    expect(minorToDecimal(12345n)).toBe('123.45');
    expect(minorToDecimal(5n)).toBe('0.05');
    expect(minorToDecimal(-250n)).toBe('-2.50');
    expect(minorToDecimal(0n)).toBe('0.00');
  });

  it('escapes CSV cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('A,B\r\n1,x\r\n');
  });

  it('turns an inclusive date range into a half-open interval', () => {
    const r = dateRange('2026-11-01', '2026-11-01');
    expect(r?.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(r?.lt.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(dateRange('2026-11-05', '2026-11-01')).toBeNull();
    expect(dateRange('bad', '2026-11-01')).toBeNull();
  });
});
