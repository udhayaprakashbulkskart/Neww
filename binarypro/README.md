# BinaryPro

**Commerce. Community. Rewards.**

BinaryPro is a retail-led membership platform: members buy from partner merchants, earn cashback from merchant-funded
coupons, earn commission on *verified, delivered* retail sales, build a left/right binary team, and earn rewards for
watching advertiser-funded videos. Every rupee is held in a balanced double-entry ledger.

This folder (`binarypro/`) is a self-contained app. The existing HelpTrust app at the repository root is untouched.

---

## Status

| Module | Status | Where |
| --- | --- | --- |
| Double-entry wallet ledger (balanced per currency, append-only, row-locked, overdraft-safe, idempotent) | Done | `src/lib/server/ledger.ts`, DB triggers in `prisma/migrations/*_financial_guards` |
| Multi-currency wallets (INR, USD, EUR, GBP, AED, SGD, MYR, SAR), FX rates, conversion with 1.5% spread | Done | `src/lib/server/wallet.ts`, `rates.ts`, `api/admin/fx` |
| Membership tiers Basic / Silver / Gold / Platinum, paid via checkout, membership fees never generate commission | Done | `src/lib/server/membership.ts`, `payments.ts` |
| Binary tree: user-selected placement inside sponsor downline, one member per slot, PV propagation | Done | `src/lib/server/binary.ts`, `tree.ts`, `/tree` |
| Binary commission: left/right matching, unmatched carry-forward, daily cap, reserve-limited, once per day | Done | `binary.ts` (`runBinaryPayouts`), `domain/binary.ts` |
| Direct commission on verified retail sales only | Done | `orders.ts` (`verifyOrder`) |
| Retail orders: escrow, delivery, 7-day return window, verification, returns with reversal | Done | `orders.ts` |
| Cashback coupons 10/20/30/50 %, merchant- or promo-funded, capped, budget-limited | Done | `coupons.ts`, `domain/cashback.ts` |
| Advertising rewards: advertiser-funded pools, full-watch check, daily plan limit, one view per campaign per day | Done | `ads.ts`, `domain/ads.ts`, `/ads` |
| Ranks: Member → Ambassador from active directs and verified team PV | Done (thresholds are placeholders) | `ranks.ts`, `domain/ranks.ts` |
| Withdrawals: KYC required, minimum per currency, one open request, finance approve/reject | Done | `wallet.ts`, `/api/withdrawals`, `/admin` |
| Secure auth: phone OTP (hashed, expiring, attempt-limited, rate-limited), JWT sessions with revocation version, same-origin checks | Done (SMS adapter is dev console only) | `auth.ts`, `http.ts` |
| Payment webhooks: HMAC over raw body, timing-safe, idempotent by event id, amount/currency mismatch held for review | Done (mock gateway only) | `payments.ts`, `api/webhooks/payments` |
| Role-based permissions (Admin, Finance, Support, Merchant, Member) | Done | `domain/rbac.ts`, enforced in every route |
| Fraud rules: self-purchase loops withheld, payment mismatches, all raise flags and never move money | Partial (two rules) | `orders.ts`, `payments.ts` |
| Audit log on money-moving and privileged actions | Done (writes; no viewer UI yet) | `audit.ts` |
| Dashboards: member dashboard, binary tree, shop, wallet, ads, admin | Done (functional, not yet fully styled for every screen) | `src/app` |
| Automated tests: unit, database integration, HTTP end-to-end | Done | `tests/`, `scripts/e2e-smoke.mjs` |
| Deployment: Dockerfile, docker-compose, CI workflow | Done | `Dockerfile`, `docker-compose.yml`, `../.github/workflows/binarypro-ci.yml` |

### Not built yet (required by the brief, must be completed before launch)

- **Live payment gateway** (Razorpay or similar). Only the sandbox provider exists. The webhook and settlement code is
  provider-agnostic and ready for a real adapter.
- **Live SMS provider** for OTP. Production refuses the console provider; no real provider adapter exists yet.
- **KYC submission and review.** Withdrawals check `kyc = VERIFIED`, but no screen or provider flow sets it yet.
- **Merchant dashboard UI and merchant onboarding.** Merchant staff can deliver their own orders via the API, but there
  is no merchant screen and no route that links a user to a merchant (`User.merchantId` exists for that purpose).
- **Affiliate shopping integrations** (external marketplace feeds, affiliate click tracking APIs).
- **Refund execution.** Returns reverse commissions and cashback and record `refundDueMinor`; the refund itself must be
  made through the payment provider and then posted to the ledger.
- **Merchant settlement.** Merchant share accrues in `MERCHANT_PAYABLE` accounts; payout is manual.
- **Scheduled jobs.** Binary payouts, order verification and rank recalculation are run from the admin dashboard or the
  API. They should be scheduled (cron or a queue) for production.
- **Clawback collection.** Shortfalls from returns are booked to `CLAWBACK_RECEIVABLE`; there is no collection process.
- **Further fraud rules** (device and velocity signals, sponsor-ring detection beyond upline loops).
- **Session revocation UI** ("sign out everywhere"), **user management screens**, and a **legal review** (see below).

---

## Business rules, as implemented

- **No joining-fee or recruitment-only commission.** Membership payments are recognised as revenue
  (`REVENUE:MEMBERSHIP`) and never reach the commission code.
- **Retail-led.** Direct commission and binary PV come only from orders that are `VERIFIED`: paid, delivered, and past
  the 7-day return window. Returns reverse what was released.
- **Self-purchase.** If the commission recipient sits in the buyer's own sponsor chain, the order is verified for
  delivery but commission, PV and cashback are withheld and a fraud flag is raised.
- **Funded payouts only.** A fixed share (`COMMISSION_FUNDING_BPS`, 25 % of verified PV) moves from escrow into the
  INR commission reserve. Direct and binary commissions are paid from that reserve and cannot exceed it. If the
  reserve runs short, binary payouts are reduced and unpaid volume carries forward; nothing is paid on credit.
- **Cashback** is paid from the coupon's merchant pool or promotional pool, never beyond the balance of that pool.
- **Advertising** is paid from an advertiser deposit into the campaign pool. A view pays only after at least 95 % of the
  video has elapsed on the server clock, once per campaign per day, within the plan's daily limit.
- **No guaranteed income.** The landing page, dashboard and compliance page state this.

---

## Plan parameters (defaults, to be confirmed by the business owner and counsel)

All parameters are in `src/lib/domain/plans.ts` and `src/lib/domain/ranks.ts`.

| Tier | Price / year (INR) | Direct on verified sales | Binary on matched PV | Binary cap / day | Ad videos / day |
| --- | --- | --- | --- | --- | --- |
| Basic | Free | 3 % | — | — | 5 |
| Silver | ₹999 | 5 % | 10 % | ₹5,000 | 10 |
| Gold | ₹2,999 | 7 % | 10 % | ₹15,000 | 15 |
| Platinum | ₹9,999 | 10 % | 10 % | ₹50,000 | 20 |

Withdrawal minimum: ₹500 (or equivalent). Commission funding: 25 %. FX spread: 1.5 %. Return window: 7 days.

---

## Quick start (development)

Requirements: Node 22, PostgreSQL 14+ (16 tested).

```bash
cd binarypro
cp .env.example .env                    # set DATABASE_URL and DIRECT_URL
npm install                             # also runs prisma generate
npx prisma migrate deploy               # applies all migrations
npx tsx prisma/seed.ts                  # demo staff, members, merchant, coupon, ad campaign
npm run dev                             # http://localhost:3000
```

Sign in at `/login` with an email and password. Seeded accounts use the `SEED_PASSWORD` value (default
`DemoPassword123` in development only). New members can create an account from the same page; an invite link
(`/login?ref=<member id>`) places the new member under the inviter.

| Role | Email | Notes |
| --- | --- | --- |
| Admin | platformadmin@binarypro.test | All permissions |
| Finance | financelead@binarypro.test | Withdrawals, FX, ad funding |
| Founder (Platinum, root) | founder@binarypro.test | Top of the demo tree |
| Alice (Gold) | alice@binarypro.test | Left child of the founder |
| Bob (Silver) | bob@binarypro.test | Right child of the founder |
| Carol (Basic) | carol@binarypro.test | Left child of Alice |

---

## Testing

```bash
npm run typecheck              # TypeScript, strict
npm test                       # unit tests: money, binary, ledger rules, cashback, ads, ranks, RBAC, signatures
TEST_DATABASE_URL=postgresql://... ./scripts/test-db-setup.sh   # migrate a dedicated TEST database
npm run test:integration       # ledger, commissions, returns, withdrawals, FX, ads, webhooks, concurrency
npm run build && npm start &   # then:
APP_URL=http://localhost:3000 SEED_PASSWORD=DemoPassword123 node scripts/e2e-smoke.mjs   # real HTTP flows
```

The integration suite runs TRUNCATE on the database it is given. Point it only at a dedicated test database; the default
`TEST_DATABASE_URL` is `binarypro_test`.

---

## Deployment

1. Provision PostgreSQL 14+ (region close to your users; for Indian personal data, an India region is advisable).
2. Copy `.env.production.example` to `.env.production`. Set `APP_URL`, `APP_ENV=production`, and three secrets
   (`SESSION_SECRET`, `OTP_PEPPER`, `PAYMENT_WEBHOOK_SECRET`, each at least 32 characters). The app refuses to start
   in production with development secrets, the mock payment provider, or the console SMS provider.
3. `docker compose up -d --build` (set `POSTGRES_PASSWORD`). The container applies migrations on start.
4. Put TLS in front of the app and point the payment gateway's webhook at `/api/webhooks/payments`.
5. Schedule: daily binary payout (`POST /api/admin/binary-run`), order verification after each return window
   (`POST /api/orders/:id/verify`), rank recalculation (`POST /api/admin/ranks`). Use a cron job with a staff API key
   or a queue worker.
6. CI: `.github/workflows/binarypro-ci.yml` runs typecheck, unit tests, integration tests against PostgreSQL, the build,
   and the HTTP smoke test.

Security controls in place: strict CSP and security headers (`next.config.mjs`), HttpOnly SameSite session cookies,
same-origin checks on every mutating route, Zod validation on every input, parameterised queries only (Prisma),
hashed OTPs with attempt and send limits, HMAC-verified webhooks, append-only ledger enforced by database triggers,
CHECK constraints on money columns and cashback tiers, and role checks on every staff route.

---

## Legal and compliance (read before launch)

This software enforces the commercial rules in the brief, but **it does not make the business lawful**. Before taking
money from the public, obtain written advice on at least:

- India's Direct Selling Guidelines (2016), including buy-back and product-return policies.
- The Prize Chits and Money Circulation Schemes (Banning) Act, 1978, and how a binary compensation plan is assessed under it.
- GST on supplies, commissions and cashback.
- The Consumer Protection (E-Commerce) Rules, 2020.
- The Digital Personal Data Protection Act, 2023, and the rules of every other country you operate in.
- Payment-aggregator rules for the gateway you choose.

Any binary or multi-level compensation plan is a regulatory risk, particularly where advertising rewards and new-member
placement are involved. Treat the plan parameters as provisional until counsel signs off.
