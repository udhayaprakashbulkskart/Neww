// Self-service account deletion. Personal data is removed; financial records (orders, ledger, payments) are kept
// because accounting and tax rules require them. The account can never sign in again.
import { db } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { verifyPassword } from './password';
import { walletBalances } from './wallet';

export async function deleteAccount(userId: string, password: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, passwordHash: true } });
  if (!user || user.status === 'DELETED') throw new DomainError('NOT_FOUND', 'Account not found', 404);
  if (user.role !== 'MEMBER') throw new DomainError('FORBIDDEN', 'Staff, merchant and advertiser accounts are closed by an administrator. Contact support.', 403);
  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new DomainError('BAD_PASSWORD', 'Password is incorrect', 401);
  }

  const balances = await walletBalances(userId);
  const hasMoney = Object.values(balances).some((v) => v > 0n);
  if (hasMoney) throw new DomainError('BALANCE_REMAINING', 'Withdraw your wallet balance before deleting your account', 409);
  const openWithdrawals = await db.withdrawal.count({ where: { userId, status: 'REQUESTED' } });
  if (openWithdrawals > 0) throw new DomainError('WITHDRAWAL_OPEN', 'You have a withdrawal awaiting review. Wait for it to be decided first.', 409);
  const openOrders = await db.order.count({ where: { buyerId: userId, status: { in: ['PAID', 'DELIVERED'] } } });
  if (openOrders > 0) throw new DomainError('ORDER_OPEN', 'You have orders in progress. Wait until they are delivered and verified.', 409);

  return db.$transaction(async (tx) => {
    await tx.kycDocument.deleteMany({ where: { userId } });
    await tx.bankAccount.deleteMany({ where: { userId } });
    await tx.membership.updateMany({ where: { userId }, data: { active: false } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        name: 'Deleted member',
        email: null,
        phone: null,
        passwordHash: null,
        referralCode: null,
        kyc: 'NOT_SUBMITTED',
        kycNote: null,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    await audit(tx, { action: 'account.deleted', actorId: userId, targetId: userId, meta: { by: 'member' } });
    return { deleted: true };
  });
}
