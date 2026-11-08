import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { registerMember, loginWithPassword, type RegisterInput } from '@/lib/server/auth';
import { deleteAccount } from '@/lib/server/account';
import { postTransaction } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { requestWithdrawal } from '@/lib/server/wallet';
import { DomainError } from '@/lib/server/errors';
import { assertLedgerBalanced, makeMerchantWithProduct, makeUser, resetDb } from './helpers';
import { createOrder, markDelivered } from '@/lib/server/orders';
import { handleCapturedEvent } from '@/lib/server/payments';
import { hashPassword } from '@/lib/server/password';

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('scan')]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.from('pan')]);

const PASSWORD = 'Sturdy-pass-123';
function input(over: Partial<RegisterInput> = {}): RegisterInput {
  return {
    name: 'Leaving Member', email: 'leaving@example.com', password: PASSWORD, phone: '+919812345678',
    referralCode: null, sponsorId: null,
    bank: { accountHolder: 'Leaving Member', bankName: 'State Bank', ifsc: 'SBIN0001234', accountNumber: '123456789012' },
    documents: [{ kind: 'AADHAAR', buffer: JPG, mime: 'image/jpeg' }, { kind: 'PAN', buffer: PDF, mime: 'application/pdf' }],
    ...over,
  };
}

async function fund(userId: string, amount: bigint) {
  await db.$transaction((tx) => postTransaction(tx, {
    reference: `TEST-FUND:${userId}:${amount}`, type: 'TEST_FUND', description: 'Test funding',
    legs: [
      { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: amount },
      { ...accounts.wallet(userId, 'INR'), direction: 'CREDIT', amountMinor: amount },
    ],
  }));
}

describe('account deletion', () => {
  beforeEach(resetDb);

  it('refuses a wrong password and changes nothing', async () => {
    const user = await registerMember(input());
    await expect(deleteAccount(user.id, 'wrong-password-here')).rejects.toMatchObject({ code: 'BAD_PASSWORD' });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('ACTIVE');
  });

  it('refuses while money or a withdrawal is outstanding', async () => {
    const user = await registerMember(input());
    await fund(user.id, 50_000n);
    await expect(deleteAccount(user.id, PASSWORD)).rejects.toMatchObject({ code: 'BALANCE_REMAINING' });
    await requestWithdrawal(user.id, 'INR', 50_000n).catch(() => undefined);
    await expect(deleteAccount(user.id, PASSWORD)).rejects.toBeInstanceOf(DomainError);
  });

  it('removes personal data and documents, keeps financial history, and blocks sign-in', async () => {
    const user = await registerMember(input());
    await deleteAccount(user.id, PASSWORD);

    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.status).toBe('DELETED');
    expect(row.name).toBe('Deleted member');
    expect(row.email).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.passwordHash).toBeNull();
    expect(row.referralCode).toBeNull();
    expect(row.kyc).toBe('NOT_SUBMITTED');
    expect(await db.kycDocument.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.bankAccount.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.membership.findUniqueOrThrow({ where: { userId: user.id } })).active).toBe(false);

    await expect(loginWithPassword('leaving@example.com', PASSWORD)).rejects.toBeInstanceOf(DomainError);
    expect(await db.auditLog.count({ where: { action: 'account.deleted', targetId: user.id } })).toBe(1);
    await assertLedgerBalanced();
  });

  it('keeps completed orders and their commission history after deletion', async () => {
    const buyer = await makeUser({ name: 'Buyer', kyc: 'VERIFIED' });
    const { product } = await makeMerchantWithProduct(100_000n);
    const order = await createOrder(buyer.id, [{ productId: product.id, quantity: 1 }], null);
    const payment = await db.payment.findFirstOrThrow({ where: { referenceId: order.id, kind: 'ORDER' } });
    await handleCapturedEvent({ id: `evt_${order.id}`, type: 'payment.captured', providerRef: payment.providerRef, amountMinor: payment.amountMinor.toString(), currency: payment.currency });
    await markDelivered(order.id, 'test');
    await db.order.update({ where: { id: order.id }, data: { status: 'RETURNED', returnedAt: new Date() } });

    await db.user.update({ where: { id: buyer.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    await deleteAccount(buyer.id, PASSWORD);
    expect(await db.order.count({ where: { buyerId: buyer.id } })).toBe(1);
    await assertLedgerBalanced();
  });
});
