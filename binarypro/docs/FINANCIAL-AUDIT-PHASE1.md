# CrownTree financial engine: Phase 1 audit

Scope: database, wallet, double-entry ledger, order verification, refunds, commissions, binary volume, withdrawals.
Inspected at commit `8e20eaf` (production build). Production financial activity at audit time: 0 ledger
transactions, 0 commissions, 0 withdrawals, 0 verified orders, 0 captured payments (read-only query).

## What is sound and will be kept

| Area | Finding | Evidence |
|---|---|---|
| Double-entry ledger | Every posting must balance per currency; legs validated before writing. | `src/lib/domain/ledger-rules.ts` `validateLegs` |
| Append-only protection | Ledger tables are protected by database triggers and checks. | migration `20261107130000_financial_guards` |
| Idempotent postings | `LedgerTransaction.reference` is unique; a repeated reference is a no-op. | `src/lib/server/ledger.ts` |
| Concurrency | Accounts are locked (`SELECT ... FOR UPDATE`) in a fixed order; overdraft check on non-negative accounts. | `ledger.ts` |
| Verification idempotency | `verifyOrder` claims the order with a conditional update; a second call returns `alreadyVerified`. | `src/lib/server/orders.ts` |
| Money type | All money is `BigInt` minor units; FX rates scaled by 1e8. | `src/lib/domain/money.ts` |
| Payment webhooks | Signed body, webhook event id stored once, amount and currency checked, mismatch held. | `src/lib/server/payments.ts` |

## Gaps against the approved specification

1. **Single wallet balance.** `WALLET:{user}:{currency}` is the only member balance. There is no pending,
   withdrawable, withdrawn or reversed split.
2. **Direct sponsor commission is paid at verification** (`orders.ts`, step 2). It is linked to who referred
   the buyer, so it is recruitment-linked. Must be disabled.
3. **Binary commission:** `addPvUpline` writes left/right legs on every verified order (`binary.ts`), and
   `runBinaryPayouts` pays matched volume. Both must be disabled; left/right attribution must stay off.
4. **Product cashback is paid immediately** to the wallet at verification (`orders.ts`, step 4). It has no
   daily cap, no pending state and no release rule.
5. **Day boundaries are UTC.** `dayKey` in `time.ts` uses `toISOString()`. The business day must be
   Asia/Kolkata. Four call sites use it (binary daily limits, ad daily limits, ad view counts).
6. **No daily cap setting**, no commission policy table, no policy versioning.
7. **No volume ledger.** Volume exists only as `PvLeg` rows, which are attribution by side, and are mutable.
8. **No refund record.** `returnOrder` reverses commissions and cashback and sets `refundDueMinor`, but no
   refund table records each refund.
9. **No service catalogue.** Only merchant products exist (`Product`). Services are not modelled.
10. **Clawback account is global** (`CLAWBACK_RECEIVABLE:{currency}`), so reversed value cannot be reported
    per member without a derived query.
11. **Admin actions do not require a reason.** Audit records exist but the reason is not mandatory.
12. **No reconciliation report** is stored; reconciliation exists only as ad-hoc finance page checks.
13. **Withdrawn amount** is not on the ledger per member; it is derivable from `Withdrawal` rows with
    status `APPROVED`, and the approval already posts `WITHDRAWAL_PAID`.

## Existing financial data

Production has no financial history, so these changes do not alter any historical record.
Test data in the local database and the test database is disposable.

## Migration approach

- Additive migrations only: new tables, new accounts, new columns with defaults. No existing row is updated
  except seed rows inserted by the migration.
- New immutable tables (volume entries, commission entries, commission events, daily summaries, refunds,
  policies, reconciliation reports) are protected by an append-only trigger, the same pattern as the spin log.
- Existing behaviour changed on purpose: direct commission and binary payouts stop; product cashback becomes
  pending and daily-capped. Tests that asserted the old behaviour are updated and listed in the phase reports.
