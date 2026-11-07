-- Database-level guards for financial integrity.

-- Cashback coupons may only use the approved promotional tiers.
ALTER TABLE "Coupon" ADD CONSTRAINT "coupon_percent_allowed"
  CHECK ("percent" IN (10, 20, 30, 50));

-- Money can never be negative at rest.
ALTER TABLE "Product"       ADD CONSTRAINT "product_price_nonneg"      CHECK ("priceMinor" >= 0);
ALTER TABLE "Order"         ADD CONSTRAINT "order_amounts_nonneg"      CHECK ("subtotalMinor" >= 0 AND "pvInrMinor" >= 0 AND "cashbackMinor" >= 0 AND "refundDueMinor" >= 0);
ALTER TABLE "Commission"    ADD CONSTRAINT "commission_amount_nonneg"  CHECK ("amountMinor" > 0);
ALTER TABLE "PvLeg"         ADD CONSTRAINT "pvleg_nonneg"              CHECK ("pvMinor" >= 0);
ALTER TABLE "Withdrawal"    ADD CONSTRAINT "withdrawal_amount_pos"     CHECK ("amountMinor" > 0);
ALTER TABLE "LedgerEntry"   ADD CONSTRAINT "ledger_amount_pos"         CHECK ("amountMinor" > 0);
ALTER TABLE "FxRate"        ADD CONSTRAINT "fx_rate_pos"               CHECK ("rateE8" > 0);
ALTER TABLE "AdCampaign"    ADD CONSTRAINT "campaign_reward_nonneg"    CHECK ("rewardMinor" >= 0);

-- Only one order may be redeemed against a given coupon by a given user per order (defence in depth).
-- Ledger entries are append-only: corrections are made with reversing transactions, never by editing history.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ledger history is append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_append_only
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TRIGGER ledger_tx_append_only
  BEFORE UPDATE OR DELETE ON "LedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
