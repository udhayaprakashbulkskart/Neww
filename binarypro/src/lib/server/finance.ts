// Finance management: ledger integrity, reserve and liability summaries, withdrawal reconciliation,
// and verified-sales and commission reports. Read-only: nothing here posts money.
import { CURRENCIES, type Currency } from '@/lib/domain/money';
import { normalBalance, reconcileWithdrawals, trialIssues, type TrialRow } from '@/lib/domain/finance';
import { db, type Tx } from './db';
import { accounts } from './accounts';

type Db = Tx | typeof db;

interface RawTrial {
  key: string;
  currency: Currency;
  normal: 'DEBIT' | 'CREDIT';
  debit: string;
  credit: string;
}

export async function trialBalance(client: Db = db) {
  const raw = await client.$queryRaw<RawTrial[]>`
    SELECT a.key, a.currency::text AS currency, a.normal::text AS normal,
      COALESCE(SUM(CASE WHEN e.direction = 'DEBIT' THEN e."amountMinor" ELSE 0 END), 0)::text AS debit,
      COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e."amountMinor" ELSE 0 END), 0)::text AS credit
    FROM "LedgerAccount" a
    LEFT JOIN "LedgerEntry" e ON e."accountId" = a.id
    GROUP BY a.key, a.currency, a.normal
    ORDER BY a.key`;
  const [{ n }] = await client.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT "txId", currency FROM "LedgerEntry"
      GROUP BY "txId", currency
      HAVING SUM(CASE WHEN direction = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END) <> 0
    ) x`;

  const rows: (TrialRow & { normal: 'DEBIT' | 'CREDIT'; balanceMinor: bigint })[] = raw.map((r) => {
    const debitMinor = BigInt(r.debit);
    const creditMinor = BigInt(r.credit);
    return {
      key: r.key,
      currency: r.currency,
      normal: r.normal,
      debitMinor,
      creditMinor,
      balanceMinor: normalBalance(r.normal, debitMinor, creditMinor),
    };
  });
  const issues = trialIssues(rows, n);
  return { rows, issues, balanced: issues.length === 0, unbalancedTransactions: n };
}

/** Sum of balances for all accounts whose key starts with a prefix, in one currency. */
function sumByPrefix(rows: { key: string; currency: Currency; balanceMinor: bigint }[], prefix: string, currency: Currency) {
  return rows
    .filter((r) => r.currency === currency && r.key.startsWith(prefix))
    .reduce((acc, r) => acc + r.balanceMinor, 0n);
}

export async function financeOverview(client: Db = db) {
  const trial = await trialBalance(client);
  const requested = await client.withdrawal.groupBy({
    by: ['currency'],
    where: { status: 'REQUESTED' },
    _sum: { amountMinor: true },
    _count: { _all: true },
  });

  const liabilities = CURRENCIES.map((currency) => ({
    currency,
    wallets: sumByPrefix(trial.rows, 'WALLET:', currency),
    merchantPayable: sumByPrefix(trial.rows, 'MERCHANT_PAYABLE:', currency),
    escrow: sumByPrefix(trial.rows, `ESCROW:${currency}`, currency),
    pools: sumByPrefix(trial.rows, 'POOL:', currency),
    withdrawalPending: sumByPrefix(trial.rows, `WITHDRAWAL_PENDING:${currency}`, currency),
    clawbackReceivable: sumByPrefix(trial.rows, `CLAWBACK_RECEIVABLE:${currency}`, currency),
  })).filter((l) => l.wallets || l.merchantPayable || l.escrow || l.pools || l.withdrawalPending || l.clawbackReceivable);

  const reserveAccount = trial.rows.find((r) => r.key === accounts.commissionReserve().key);
  const reserve = {
    balanceMinor: reserveAccount?.balanceMinor ?? 0n,
    currency: 'INR' as const,
  };

  const withdrawalChecks = CURRENCIES.map((currency) => {
    const requestedMinor = requested
      .filter((r) => r.currency === currency)
      .reduce((acc, r) => acc + (r._sum.amountMinor ?? 0n), 0n);
    const count = requested.filter((r) => r.currency === currency).reduce((acc, r) => acc + r._count._all, 0);
    const ledgerPendingMinor = sumByPrefix(trial.rows, `WITHDRAWAL_PENDING:${currency}`, currency);
    return { currency, count, ...reconcileWithdrawals(requestedMinor, ledgerPendingMinor) };
  }).filter((c) => c.count > 0 || c.ledgerPendingMinor !== 0n);

  return {
    trial,
    liabilities,
    reserve,
    withdrawalChecks,
    withdrawalsOk: withdrawalChecks.every((c) => c.ok),
  };
}

export interface SalesRow {
  currency: Currency;
  verifiedOrders: number;
  verifiedSubtotalMinor: bigint;
  verifiedPvInrMinor: bigint;
  verifiedCashbackMinor: bigint;
  returnedOrders: number;
  returnedSubtotalMinor: bigint;
}

/** Verified retail sales (by verification date) and returns (by return date) inside an interval. */
export async function salesReport(range: { gte: Date; lt: Date }, client: Db = db): Promise<SalesRow[]> {
  const verified = await client.order.groupBy({
    by: ['currency'],
    where: { status: 'VERIFIED', verifiedAt: { gte: range.gte, lt: range.lt } },
    _count: { _all: true },
    _sum: { subtotalMinor: true, pvInrMinor: true, cashbackMinor: true },
  });
  const returned = await client.order.groupBy({
    by: ['currency'],
    where: { status: 'RETURNED', returnedAt: { gte: range.gte, lt: range.lt } },
    _count: { _all: true },
    _sum: { subtotalMinor: true },
  });
  return CURRENCIES.map((currency) => {
    const v = verified.find((r) => r.currency === currency);
    const r = returned.find((x) => x.currency === currency);
    return {
      currency,
      verifiedOrders: v?._count._all ?? 0,
      verifiedSubtotalMinor: v?._sum.subtotalMinor ?? 0n,
      verifiedPvInrMinor: v?._sum.pvInrMinor ?? 0n,
      verifiedCashbackMinor: v?._sum.cashbackMinor ?? 0n,
      returnedOrders: r?._count._all ?? 0,
      returnedSubtotalMinor: r?._sum.subtotalMinor ?? 0n,
    };
  }).filter((row) => row.verifiedOrders > 0 || row.returnedOrders > 0);
}

export interface CommissionRow {
  type: string;
  status: string;
  count: number;
  amountMinor: bigint;
}

/** Commission postings by type and status, by the date they were created. */
export async function commissionReport(range: { gte: Date; lt: Date }, client: Db = db): Promise<CommissionRow[]> {
  const rows = await client.commission.groupBy({
    by: ['type', 'status'],
    where: { createdAt: { gte: range.gte, lt: range.lt } },
    _count: { _all: true },
    _sum: { amountMinor: true },
    orderBy: [{ type: 'asc' }, { status: 'asc' }],
  });
  return rows.map((r) => ({
    type: r.type,
    status: r.status,
    count: r._count._all,
    amountMinor: r._sum.amountMinor ?? 0n,
  }));
}

export async function withdrawalReport(range: { gte: Date; lt: Date }, client: Db = db) {
  const rows = await client.withdrawal.groupBy({
    by: ['currency', 'status'],
    where: { requestedAt: { gte: range.gte, lt: range.lt } },
    _count: { _all: true },
    _sum: { amountMinor: true },
  });
  return rows.map((r) => ({
    currency: r.currency,
    status: r.status,
    count: r._count._all,
    amountMinor: r._sum.amountMinor ?? 0n,
  }));
}
