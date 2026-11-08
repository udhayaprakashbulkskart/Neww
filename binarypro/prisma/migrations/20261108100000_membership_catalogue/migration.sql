-- CreateTable
CREATE TABLE "MembershipPlan" (
    "tier" "Tier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceInrMinor" BIGINT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "couponMaxPercent" INTEGER NOT NULL,
    "adViewsPerDay" INTEGER NOT NULL,
    "benefits" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("tier")
);

-- Coupon caps may only be the approved tiers, matching the code and the earlier CHECK on Coupon.
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "plan_coupon_cap_allowed" CHECK ("couponMaxPercent" IN (10, 20, 30, 50));
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "plan_price_nonneg" CHECK ("priceInrMinor" >= 0);

-- Seed the catalogue with the values currently in use, so existing behaviour does not change.
INSERT INTO "MembershipPlan" (tier, name, "priceInrMinor", "durationDays", "couponMaxPercent", "adViewsPerDay", benefits, active, "updatedAt")
VALUES
  ('BASIC', 'Basic', 0, 365, 10, 5, ARRAY['Shop with 10% cashback coupons', 'Up to 5 ad rewards a day', 'Partner offers (Basic)'], true, now()),
  ('SILVER', 'Silver', 99900, 365, 20, 10, ARRAY['Shop with 20% cashback coupons', 'Up to 10 ad rewards a day', 'Binary team matching', 'Partner offers (Silver)'], true, now()),
  ('GOLD', 'Gold', 299900, 365, 30, 15, ARRAY['Shop with 30% cashback coupons', 'Up to 15 ad rewards a day', 'Binary team matching', 'Partner offers (Gold)'], true, now()),
  ('PLATINUM', 'Platinum', 999900, 365, 50, 20, ARRAY['Shop with 50% cashback coupons', 'Up to 20 ad rewards a day', 'Binary team matching', 'Partner offers (Platinum)'], true, now())
ON CONFLICT (tier) DO NOTHING;
