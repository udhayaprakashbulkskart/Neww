# BinaryPro build plan and status

## Audit (current state)
- Working: ledger (double-entry, append-only, row-locked), binary placement and payouts,
  verified-sale commissions, cashback pools, ad rewards, withdrawals, FX conversion, RBAC,
  signed idempotent webhooks, OTP sign-in, staff admin console, Neon + Vercel deployment.
- Gaps against the brief: membership benefit tiers (10/20/30/50 %), Member ID / Referral ID,
  advertiser and merchant dashboards, affiliate marketplace, KYC flow, bank/UPI withdrawal
  rails, reports, live payment and SMS providers, fraud rules beyond self-purchase.

## Phases
1. Membership tiers: coupon benefit cap per tier (Basic 10, Silver 20, Gold 30, Platinum 50). [this change]
2. User dashboard matching the mockup (KPIs, binary preview, earnings, rank progress, wallets, plans). [this change]
3. Earnings report (commission and reward history by type, INR-equivalent). [this change]
4. Member ID and Referral ID (unique, backfilled) — pending schema migration.
5. Advertiser dashboard, campaign budgets, view verification reports — pending.
6. Merchant dashboard, product management, offers, affiliate tracking — pending.
7. Affiliate marketplace (sandbox until a provider approves cashback incentives) — pending.
8. KYC submission and review; bank and UPI withdrawal rails — pending.
9. Admin reports and financial reconciliation — pending.
10. Live payment gateway, SMS provider, production deployment hardening — pending.

## Compliance guardrails (unchanged)
- Commissions only from verified, delivered retail sales; never from joining or membership fees.
- Cashback and ad rewards only from funded pools; never guaranteed income.
