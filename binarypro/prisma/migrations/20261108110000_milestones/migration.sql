-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('QUALIFIED', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateTable
CREATE TABLE "MilestoneRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thresholdMinor" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MilestoneRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" TEXT[],
    "supplierNote" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'QUALIFIED',
    "metricMinor" BIGINT NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prizeId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "MilestoneAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneAward_status_idx" ON "MilestoneAward"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneAward_userId_ruleId_key" ON "MilestoneAward"("userId", "ruleId");

-- AddForeignKey
ALTER TABLE "MilestoneAward" ADD CONSTRAINT "MilestoneAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneAward" ADD CONSTRAINT "MilestoneAward_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "MilestoneRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneAward" ADD CONSTRAINT "MilestoneAward_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Guards: thresholds must be positive, and a dated window must end after it starts.
ALTER TABLE "MilestoneRule" ADD CONSTRAINT "milestone_threshold_positive" CHECK ("thresholdMinor" > 0);
ALTER TABLE "MilestoneRule" ADD CONSTRAINT "milestone_window_valid" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "MilestoneAward" ADD CONSTRAINT "milestone_metric_nonneg" CHECK ("metricMinor" >= 0);

-- Seed: the programme as currently published (₹50,000 personal verified retail sales, counted from the programme start).
INSERT INTO "MilestoneRule" (id, name, "thresholdMinor", "startsAt", "endsAt", active, "updatedAt", "updatedBy")
VALUES ('rule_retail_50k', 'Retail milestone: ₹50,000', 5000000, '2026-01-01T00:00:00Z', NULL, true, now(), 'migration');

-- Seed: the three prizes from the supplier catalogue. Prizes are deactivated, not deleted, so awards keep their history.
INSERT INTO "Prize" (id, name, model, "imageUrl", description, details, "supplierNote", active, "sortOrder", "updatedAt")
VALUES
  ('prize_car', 'Car', 'Maruti Suzuki Swift', '/prizes/car-maruti-suzuki-swift.jpg',
   'A five-door hatchback in red with a black roof, shown with the Swift badge.',
   ARRAY['Five-door hatchback', 'Red body with black roof', 'Variant and fuel type confirmed by supplier'],
   'Variant, colour availability and delivery terms to be confirmed.', true, 1, now()),
  ('prize_bike', 'Bike', 'Bajaj Pulsar', '/prizes/bike-bajaj-pulsar.jpg',
   'A naked street motorcycle in black and red with a Pulsar badge on the tank.',
   ARRAY['Naked street motorcycle', 'Black and red colour', 'Variant and engine size confirmed by supplier'],
   'Variant, registration and delivery terms to be confirmed.', true, 2, now()),
  ('prize_iphone', 'iPhone', 'Apple iPhone Duo', '/prizes/iphone-duo.jpg',
   'A foldable iPhone with a dual-camera system and a large inner display, shown in navy and white.',
   ARRAY['Foldable display', 'Dual camera system', 'Apple A20 Pro chip (as stated in the supplier images)'],
   'Model name, storage and availability to be confirmed before it is offered.', true, 3, now())
ON CONFLICT (id) DO NOTHING;
