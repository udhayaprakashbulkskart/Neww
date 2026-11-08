import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { auditEntries, ledgerHistory, resolveUserId } from '@/lib/server/audit-view';
import { accounts } from '@/lib/server/accounts';
import { postTransaction } from '@/lib/server/ledger';
import { buildTable, toCsvDocument } from '@/lib/server/finance-export';
import { dateRange } from '@/lib/domain/finance';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const range = (() => {
  const d = new Date().toISOString().slice(0, 10);
  return dateRange(d, d)!;
})();

describe('audit log and transaction history', () => {
  beforeEach(resetDb);

  it('filters audit entries by action prefix and actor, and names the actor', async () => {
    const admin = await makeUser({ name: 'Ops', role: 'ADMIN' });
    await db.user.update({ where: { id: admin.id }, data: { email: 'ops@example.com' } });
    await db.$transaction(async (tx) => {
      await audit(tx, { action: 'order.verified', actorId: admin.id, targetId: 'o1' });
      await audit(tx, { action: 'withdrawal.approve', actorId: admin.id, targetId: 'w1' });
      await audit(tx, { action: 'order.paid', targetId: 'o2' });
    });

    expect(await auditEntries(range)).toHaveLength(3);
    const orders = await auditEntries(range, { action: 'order.' });
    expect(orders.map((r) => r.action).sort()).toEqual(['order.paid', 'order.verified']);
    const byAdmin = await auditEntries(range, { actorId: admin.id });
    expect(byAdmin).toHaveLength(2);
    expect(byAdmin[0]!.actor).toBe('ops@example.com');
    const system = (await auditEntries(range, { action: 'order.paid' }))[0]!;
    expect(system.actor).toBe('system');
  });

  it('finds a member by email or id and filters ledger history to that member', async () => {
    const a = await makeUser({ name: 'Alice', kyc: 'VERIFIED' });
    const b = await makeUser({ name: 'Bob' });
    await db.user.update({ where: { id: a.id }, data: { email: 'alice@example.com' } });
    await db.$transaction((tx) => postTransaction(tx, {
      reference: `TEST:A:${a.id}`, type: 'TEST_CREDIT', description: 'Credit Alice',
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 5_000n },
        { ...accounts.wallet(a.id, 'INR'), direction: 'CREDIT', amountMinor: 5_000n },
      ],
    }));
    await db.$transaction((tx) => postTransaction(tx, {
      reference: `TEST:B:${b.id}`, type: 'TEST_CREDIT', description: 'Credit Bob',
      legs: [
        { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 1_000n },
        { ...accounts.wallet(b.id, 'INR'), direction: 'CREDIT', amountMinor: 1_000n },
      ],
    }));

    expect(await resolveUserId('Alice@Example.com')).toBe(a.id);
    expect(await resolveUserId(a.id)).toBe(a.id);
    expect(await resolveUserId('nobody@example.com')).toBeNull();

    const aliceTxs = await ledgerHistory(range, { userId: a.id });
    expect(aliceTxs).toHaveLength(1);
    expect(aliceTxs[0]!.description).toBe('Credit Alice');
    expect(aliceTxs[0]!.legs.map((l) => l.amountMinor).sort()).toEqual([5_000n, 5_000n]);

    const byRef = await ledgerHistory(range, { reference: 'TEST:B' });
    expect(byRef.map((t) => t.description)).toEqual(['Credit Bob']);

    const byId = await ledgerHistory(range, { txId: aliceTxs[0]!.id });
    expect(byId).toHaveLength(1);

    const table = await buildTable('transactions', range, 'f', 't', undefined, { ledger: { userId: a.id } });
    expect(table.rows).toHaveLength(2);
    expect(toCsvDocument(table)).toContain('TEST_CREDIT');
    await assertLedgerBalanced();
  });
});
