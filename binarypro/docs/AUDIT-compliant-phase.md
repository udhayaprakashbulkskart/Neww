# Audit: compliant phase (8 Nov 2026)

Scope: the eight items requested. No commission or reward formula is changed by this audit.

## 1. Membership package catalogue
- Present: four tiers (Basic, Silver, Gold, Platinum) in `src/lib/domain/plans.ts`. Prices, direct rate, binary rate, daily caps, ad limits and coupon caps are constants.
- Missing: admin editing. Prices and benefits cannot be changed without a code deploy.
- Change needed: a `MembershipPlan` table, admin screen, audit entry per change, and plan code reading from the table.

## 2. Binary genealogy dashboard
- Present: interactive tree (`/tree`) two levels at a time, focus summary (team sizes, unmatched volume), placement form, legend.
- Missing: full genealogy export, depth beyond four levels, team search by member, admin-wide tree view.
- No commission is paid on joining or membership purchases (verified in code).

## 3. Verified retail sales tracking
- Present: order PV recorded at creation; counted only when status is VERIFIED (delivered and past the 7-day return window).
- Missing: a sales report (per member, per period, per merchant) and a reversal report for returns.

## 4. Retail-sales commission engine (approved rules only)
- Present, awaiting approval:
  - Direct commission on verified retail PV of a sponsored member: 3% / 5% / 7% / 10% by the sponsor's tier.
  - Binary commission: 10% of matched PV, capped per day by tier (₹0 / ₹5,000 / ₹15,000 / ₹50,000) and limited by available reserve. Unpaid volume carries forward.
- Funding source: 25% of each verified order's PV moves from escrow into the INR commission reserve. Commissions cannot exceed the reserve.
- Missing: configurable rates in the admin console; a written carry-forward expiry rule (none is set, so none is applied).

## 5. Wallet and withdrawal funded by retail revenue and reserve
- Present: multi-currency wallets, double-entry ledger, withdrawal request, finance approve/reject, KYC requirement, minimum amounts, one open withdrawal at a time.
- Present: reserve check (payouts stop when the reserve is empty).
- Missing: a reconciliation check that the reserve covers outstanding commission liability, and a withdrawal approval report.

## 6. Admin finance dashboard and reconciliation
- Present: withdrawal queue, order verify/return, binary run, FX rates, merchants, coupons, campaigns, fraud flags.
- Missing: finance overview (revenue, reserve balance, liabilities, payouts by day), reconciliation report (ledger totals against wallets, reserve and escrow), Excel and PDF export.

## 7. Milestone rewards from own verified retail sales
- Present: dashboard card showing own verified retail sales against ₹50,000, prizes listed as subject to terms.
- Missing: milestone records, eligibility rule set by admin, approval workflow, award history, and an export. The ₹50,000 threshold and prize list are placeholders until approved.

## 8. Transaction history and audit logs
- Present: ledger entries shown in the wallet (latest 40), audit log written for money-moving and admin actions.
- Missing: an audit log viewer for admins, filters and date ranges on transaction history, CSV/Excel export.

## Decisions needed before formulas change
1. Confirm direct rates by tier (3/5/7/10%) and binary rate (10%) and daily caps.
2. Confirm reserve funding share (currently 25% of verified PV).
3. Confirm carry-forward rule (currently none expires).
4. Confirm the milestone threshold (currently ₹50,000 personal verified retail sales) and prize eligibility.
5. Confirm whether prizes are awarded by staff after approval (current plan) and who approves.

## Proposed order of work (no formula changes until approved)
1. Admin-editable membership catalogue (no commission attached).
2. Finance reports: revenue, reserve, liabilities, reconciliation; Excel and PDF export.
3. Audit log viewer and transaction history with filters and export.
4. Verified retail sales report and returns report.
5. Milestone records, admin-set eligibility, approval workflow, award history.
6. Admin-editable commission rates, shown with a preview of the calculation before saving.
