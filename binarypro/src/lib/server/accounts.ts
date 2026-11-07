// Chart of accounts. Keys are built here so that every module uses identical account names.
import type { Currency } from '@/lib/domain/money';
import { walletKey } from '@/lib/domain/ledger-rules';
import type { AccountSpec } from './ledger';
import { BASE_CURRENCY } from '@/lib/domain/money';

export const accounts = {
  wallet: (userId: string, currency: Currency): AccountSpec => ({
    key: walletKey(userId, currency), normal: 'CREDIT', allowNegative: false, currency, userId,
  }),
  cash: (currency: Currency): AccountSpec => ({
    key: `CASH:${currency}`, normal: 'DEBIT', allowNegative: true, currency,
  }),
  membershipRevenue: (currency: Currency): AccountSpec => ({
    key: `REVENUE:MEMBERSHIP:${currency}`, normal: 'CREDIT', allowNegative: true, currency,
  }),
  escrow: (currency: Currency): AccountSpec => ({
    key: `ESCROW:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  merchantPayable: (merchantId: string, currency: Currency): AccountSpec => ({
    key: `MERCHANT_PAYABLE:${merchantId}:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  fxClearing: (currency: Currency): AccountSpec => ({
    key: `FX_CLEARING:${currency}`, normal: 'DEBIT', allowNegative: true, currency,
  }),
  commissionReserve: (): AccountSpec => ({
    key: `COMMISSION_RESERVE:${BASE_CURRENCY}`, normal: 'CREDIT', allowNegative: false, currency: BASE_CURRENCY,
  }),
  merchantPool: (merchantId: string, currency: Currency): AccountSpec => ({
    key: `POOL:MERCHANT:${merchantId}:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  promoPool: (couponId: string, currency: Currency): AccountSpec => ({
    key: `POOL:PROMO:${couponId}:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  advertiserPool: (campaignId: string, currency: Currency): AccountSpec => ({
    key: `POOL:ADV:${campaignId}:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  withdrawalPending: (currency: Currency): AccountSpec => ({
    key: `WITHDRAWAL_PENDING:${currency}`, normal: 'CREDIT', allowNegative: false, currency,
  }),
  clawbackReceivable: (currency: Currency): AccountSpec => ({
    key: `CLAWBACK_RECEIVABLE:${currency}`, normal: 'DEBIT', allowNegative: true, currency,
  }),
};
