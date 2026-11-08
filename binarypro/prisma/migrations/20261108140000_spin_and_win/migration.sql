-- CreateEnum
CREATE TYPE "SpinRewardKind" AS ENUM ('BADGE', 'CASH', 'VOUCHER');

-- CreateEnum
CREATE TYPE "SpinOutcome" AS ENUM ('GRANTED', 'CREDITED', 'REDEMPTION_REQUESTED');

-- CreateEnum
CREATE TYPE "SpinRedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "SpinSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownDays" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SpinSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinReward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "SpinRewardKind" NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cashLegalRef" TEXT,
    "cashFundingRef" TEXT,
    "cashActivatedAt" TIMESTAMP(3),
    "cashActivatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpinReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinSlot" (
    "id" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "rewardId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpinSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinSpin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "rewardId" TEXT NOT NULL,
    "rewardName" TEXT NOT NULL,
    "rewardKind" "SpinRewardKind" NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "outcome" "SpinOutcome" NOT NULL,
    "requestKey" TEXT NOT NULL,
    "randomDraw" INTEGER NOT NULL,
    "totalWeight" INTEGER NOT NULL,
    "nextEligibleAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpinSpin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinRedemption" (
    "id" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SpinRedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "voucherCode" TEXT,
    "note" TEXT,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpinRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpinSlot_tier_rewardId_key" ON "SpinSlot"("tier", "rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "SpinSpin_requestKey_key" ON "SpinSpin"("requestKey");

-- CreateIndex
CREATE INDEX "SpinSpin_userId_createdAt_idx" ON "SpinSpin"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SpinSpin_rewardId_idx" ON "SpinSpin"("rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "SpinRedemption_spinId_key" ON "SpinRedemption"("spinId");

-- CreateIndex
CREATE INDEX "SpinRedemption_status_idx" ON "SpinRedemption"("status");

-- AddForeignKey
ALTER TABLE "SpinSlot" ADD CONSTRAINT "SpinSlot_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "SpinReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinSpin" ADD CONSTRAINT "SpinSpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinSpin" ADD CONSTRAINT "SpinSpin_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "SpinReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinRedemption" ADD CONSTRAINT "SpinRedemption_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "SpinSpin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinRedemption" ADD CONSTRAINT "SpinRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The spin log is evidence: rows can be added but never changed or removed.
CREATE OR REPLACE FUNCTION spin_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SpinSpin is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER spin_spin_append_only BEFORE UPDATE OR DELETE ON "SpinSpin"
  FOR EACH ROW EXECUTE FUNCTION spin_log_append_only();

-- Guards: money is never negative, weights are sensible, and a cash reward can be live only after it is
-- legally approved and funded (enforced in the database as well as in the application).
ALTER TABLE "SpinSpin" ADD CONSTRAINT "spin_amount_nonneg" CHECK ("amountMinor" >= 0);
ALTER TABLE "SpinSlot" ADD CONSTRAINT "spin_slot_weight_range" CHECK ("weight" BETWEEN 1 AND 1000);
ALTER TABLE "SpinReward" ADD CONSTRAINT "spin_cash_needs_approval" CHECK (
  "kind" <> 'CASH' OR "active" = false OR ("cashLegalRef" IS NOT NULL AND "cashFundingRef" IS NOT NULL AND "cashActivatedAt" IS NOT NULL)
);

-- Seed: wheel settings. Spin & Win is on, with a 15-day cooldown.
INSERT INTO "SpinSettings" (id, enabled, "cooldownDays", "updatedAt", "updatedBy")
VALUES ('default', true, 15, now(), 'migration');

-- Seed: rewards that are live today. These are non-cash badges, so no money is involved.
INSERT INTO "SpinReward" (id, name, description, kind, "amountMinor", active, "updatedAt") VALUES
  ('badge_silver_spark', 'Silver Spark badge', 'A silver spark badge shown on your profile after a spin win.', 'BADGE', 0, true, now()),
  ('badge_gold_glow', 'Gold Glow badge', 'A gold glow badge shown on your profile after a spin win.', 'BADGE', 0, true, now()),
  ('badge_platinum_crown', 'Platinum Crown badge', 'A platinum crown badge shown on your profile after a spin win.', 'BADGE', 0, true, now()),
  ('badge_lucky_spin', 'Lucky Spin badge', 'A lucky spin badge shown on your profile after a spin win.', 'BADGE', 0, true, now()),
  ('badge_spin_star', 'Spin Star badge', 'A star badge shown on your profile after a spin win.', 'BADGE', 0, true, now());

-- Seed: cash rewards from the requested tiers. They stay locked (inactive) until legal approval and a
-- verified funding source are documented and the administrator activates them.
INSERT INTO "SpinReward" (id, name, description, kind, "amountMinor", active, "updatedAt") VALUES
  ('cash_500', 'Cash reward ₹500', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 50000, false, now()),
  ('cash_1000', 'Cash reward ₹1,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 100000, false, now()),
  ('cash_5000', 'Cash reward ₹5,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 500000, false, now()),
  ('cash_10000', 'Cash reward ₹10,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 1000000, false, now()),
  ('cash_15000', 'Cash reward ₹15,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 1500000, false, now()),
  ('cash_20000', 'Cash reward ₹20,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 2000000, false, now()),
  ('cash_25000', 'Cash reward ₹25,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 2500000, false, now()),
  ('cash_50000', 'Cash reward ₹50,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 5000000, false, now()),
  ('cash_100000', 'Cash reward ₹1,00,000', 'Cash credited to your wallet. Locked until legal approval and funding are verified.', 'CASH', 10000000, false, now());

-- Seed: wheels. Silver (₹999), Gold (₹2,999) and Platinum (₹9,999) members each get three live badge segments
-- and the four cash segments from the request. The cash segments are inactive and do not appear on the wheel.
INSERT INTO "SpinSlot" (id, tier, "rewardId", weight, active, "sortOrder") VALUES
  ('slot_s_silver_spark', 'SILVER', 'badge_silver_spark', 50, true, 1),
  ('slot_s_lucky', 'SILVER', 'badge_lucky_spin', 30, true, 2),
  ('slot_s_star', 'SILVER', 'badge_spin_star', 20, true, 3),
  ('slot_s_cash_500', 'SILVER', 'cash_500', 40, false, 4),
  ('slot_s_cash_1000', 'SILVER', 'cash_1000', 30, false, 5),
  ('slot_s_cash_5000', 'SILVER', 'cash_5000', 20, false, 6),
  ('slot_s_cash_10000', 'SILVER', 'cash_10000', 10, false, 7),
  ('slot_g_gold_glow', 'GOLD', 'badge_gold_glow', 50, true, 1),
  ('slot_g_lucky', 'GOLD', 'badge_lucky_spin', 30, true, 2),
  ('slot_g_star', 'GOLD', 'badge_spin_star', 20, true, 3),
  ('slot_g_cash_5000', 'GOLD', 'cash_5000', 40, false, 4),
  ('slot_g_cash_10000', 'GOLD', 'cash_10000', 30, false, 5),
  ('slot_g_cash_15000', 'GOLD', 'cash_15000', 20, false, 6),
  ('slot_g_cash_20000', 'GOLD', 'cash_20000', 10, false, 7),
  ('slot_p_platinum_crown', 'PLATINUM', 'badge_platinum_crown', 50, true, 1),
  ('slot_p_lucky', 'PLATINUM', 'badge_lucky_spin', 30, true, 2),
  ('slot_p_star', 'PLATINUM', 'badge_spin_star', 20, true, 3),
  ('slot_p_cash_10000', 'PLATINUM', 'cash_10000', 40, false, 4),
  ('slot_p_cash_25000', 'PLATINUM', 'cash_25000', 30, false, 5),
  ('slot_p_cash_50000', 'PLATINUM', 'cash_50000', 20, false, 6),
  ('slot_p_cash_100000', 'PLATINUM', 'cash_100000', 10, false, 7);
