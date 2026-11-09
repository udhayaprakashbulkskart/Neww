import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { confirmOfflineMembershipPayment, pendingMembershipPayments } from '@/lib/server/payments-offline';
import { balanceOf } from '@/lib/server/ledger';
import { DomainError } from '@/lib/server/errors';
import { assertLedgerBalanced, makeUser, resetDb } from './helpers';

const DAY = 86_400_000;

async function pendingPayment(userId: string, tier: 'SILVER' | 'GOLD' | 'PLATINUM' = 'SILVER', amount = 99900n, kind: 'MEMBERSHIP' | 'ORDER' = 'MEMBERSHIP') {
  return db.payment.create({
    data: {
      kind, referenceId: tier, userId, amountMinor: amount, currency: 'INR', status: 'PENDING',
      providerRef: `PR-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
}

describe('offline membership payments', () => {
  beforeEach(resetDb);

  it('activates the membership and recognises the revenue once the exact amount is confirmed', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const member = await makeUser({ name: 'Ashok', tier: 'SILVER' });
    await db.membership.update({ where: { userId: member.id }, data: { tier: 'BASIC', expiresAt: new Date('2027-11-07T00:00:00Z') } });
    const pay = await pendingPayment(member.id);

    await confirmOfflineMembershipPayment(pay.id, { bankRef: 'UTR123456789', amountRupees: '999' }, admin.id);

    const membership = await db.membership.findUniqueOrThrow({ where: { userId: member.id } });
    expect(membership.tier).toBe('SILVER');
    expect(membership.active).toBe(true);
    expect(membership.expiresAt.getTime()).toBeGreaterThan(Date.now() + 300 * DAY);
    const row = await db.payment.findUniqueOrThrow({ where: { id: pay.id } });
    expect(row).toMatchObject({ status: 'CAPTURED', bankRef: 'UTR123456789', confirmedBy: admin.id });
    expect(await balanceOf(db, 'REVENUE:MEMBERSHIP:INR')).toBe(99900n);
    expect(await db.auditLog.count({ where: { action: 'payment.offline_confirmed', targetId: pay.id } })).toBe(1);
    await assertLedgerBalanced();
  });

  it('refuses an amount that does not match the payment, and changes nothing', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const member = await makeUser({ name: 'Short', tier: 'SILVER' });
    await db.membership.update({ where: { userId: member.id }, data: { tier: 'BASIC' } });
    const pay = await pendingPayment(member.id);
    await expect(confirmOfflineMembershipPayment(pay.id, { bankRef: 'UTR000000001', amountRupees: '500' }, admin.id)).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' });
    expect((await db.membership.findUniqueOrThrow({ where: { userId: member.id } })).tier).toBe('BASIC');
    expect((await db.payment.findUniqueOrThrow({ where: { id: pay.id } })).status).toBe('PENDING');
  });

  it('confirms each payment and each bank reference only once', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const a = await makeUser({ name: 'A', tier: 'SILVER' });
    const b = await makeUser({ name: 'B', tier: 'SILVER' });
    const pa = await pendingPayment(a.id);
    const pb = await pendingPayment(b.id);
    await confirmOfflineMembershipPayment(pa.id, { bankRef: 'UTR-SAME-0001', amountRupees: '999' }, admin.id);
    await expect(confirmOfflineMembershipPayment(pa.id, { bankRef: 'UTR-OTHER-0002', amountRupees: '999' }, admin.id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(confirmOfflineMembershipPayment(pb.id, { bankRef: 'UTR-SAME-0001', amountRupees: '999' }, admin.id)).rejects.toMatchObject({ code: 'DUPLICATE_BANK_REF' });
    expect((await db.payment.findUniqueOrThrow({ where: { id: pb.id } })).status).toBe('PENDING');
  });

  it('refuses order payments and short bank references', async () => {
    const admin = await makeUser({ name: 'Finance', role: 'FINANCE' });
    const m = await makeUser({ name: 'M' });
    const order = await pendingPayment(m.id, 'SILVER', 899900n, 'ORDER');
    await expect(confirmOfflineMembershipPayment(order.id, { bankRef: 'UTR-ORDER-0001', amountRupees: '8999' }, admin.id)).rejects.toMatchObject({ code: 'INVALID_KIND' });
    const mem = await pendingPayment(m.id);
    await expect(confirmOfflineMembershipPayment(mem.id, { bankRef: 'x', amountRupees: '999' }, admin.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('lists the pending membership payments waiting for confirmation', async () => {
    const m = await makeUser({ name: 'Waiting' });
    await pendingPayment(m.id);
    const list = await pendingMembershipPayments();
    expect(list.length).toBe(1);
    expect(list[0]!.user.name).toBe('Waiting');
  });
});
