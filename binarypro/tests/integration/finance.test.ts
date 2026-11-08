import { beforeEach, describe, expect, it } from 'vitest';
import { accounts } from '@/lib/server/accounts';
import { postTransaction } from '@/lib/server/ledger';
import { requestWithdrawal, decideWithdrawal } from '@/lib/server/wallet';
import { db } from '@/lib/server/db';
import { financeOverview, salesReport, trialBalance, withdrawalReport } from '@/lib/server/finance';
import { buildTable, toCsvDocument } from '@/lib/server/finance-export';
import { dateRange } from '@/lib/domain/finance';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const today = new Date();
const range = dateRange(today.toISOString().slice(0, 10), today.toISOString().slice(0, 10))!;

describe('finance reconciliation and reports', () => {
  beforeEach(resetDb);

  it('keeps the trial balance balanced and matches pending withdrawals to the ledger', async () => {
    const member = await makeUser({ name: 'Funded', kyc: 'VERIFIED' });
    await db.$transaction((tx) => postTransaction(tx, {
      reference: `TEST-FUND:${member.id}`,
      type: 'TEST_FUND',
      description: 'Test funding',
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 100_000n },
        { ...accounts.wallet(member.id, 'INR'), direction: 'CREDIT', amountMinor: 100_000n },
      ],
    }));
    await requestWithdrawal(member.id, 'INR', 60_000n);

    const trial = await trialBalance();
    expect(trial.balanced).toBe(true);
    expect(trial.unbalancedTransactions).toBe(0);

    const overview = await financeOverview();
    expect(overview.withdrawalsOk).toBe(true);
    const inr = overview.withdrawalChecks.find((c) => c.currency === 'INR');
    expect(inr).toMatchObject({ count: 1, requestedMinor: 60_000n, ledgerPendingMinor: 60_000n, ok: true });
    expect(overview.liabilities.find((l) => l.currency === 'INR')?.wallets).toBe(40_000n);

    await assertLedgerBalanced();
  });

  it('reports withdrawal requests by status and exports them as CSV with a byte-order mark', async () => {
    const member = await makeUser({ name: 'Exporter', kyc: 'VERIFIED' });
    await db.$transaction((tx) => postTransaction(tx, {
      reference: `TEST-FUND:${member.id}`,
      type: 'TEST_FUND',
      description: 'Test funding',
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 90_000n },
        { ...accounts.wallet(member.id, 'INR'), direction: 'CREDIT', amountMinor: 90_000n },
      ],
    }));
    const w = await requestWithdrawal(member.id, 'INR', 60_000n);
    await decideWithdrawal(w.id, 'REJECT', 'finance');

    const rows = await withdrawalReport(range);
    expect(rows).toEqual([expect.objectContaining({ currency: 'INR', status: 'REJECTED', count: 1, amountMinor: 60_000n })]);

    const sales = await salesReport(range);
    expect(sales).toEqual([]);

    const table = await buildTable('withdrawals', range, 'from', 'to');
    const csv = toCsvDocument(table);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Currency,Status,Count,Amount');
    expect(csv).toContain('INR,REJECTED,1,600.00');

    // A rejected withdrawal returns the money, so the pending account is empty again.
    const overview = await financeOverview();
    expect(overview.withdrawalsOk).toBe(true);
    await assertLedgerBalanced();
  });
});
