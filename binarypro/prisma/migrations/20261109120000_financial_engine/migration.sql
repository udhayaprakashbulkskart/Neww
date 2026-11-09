-- CreateEnum
CREATE TYPE "CommissionKind" AS ENUM ('PRODUCT', 'SERVICE', 'DIRECT_SPONSOR', 'BINARY');

-- CreateEnum
CREATE TYPE "CommissionEventType" AS ENUM ('RELEASE', 'REVERSE');

-- CreateEnum
CREATE TYPE "VolumeKind" AS ENUM ('ACCRUE', 'REVERSE');

-- CreateTable
CREATE TABLE "DailyCapSetting" (
    "id" TEXT NOT NULL,
    "capMinor" BIGINT,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DailyCapSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPolicy" (
    "id" TEXT NOT NULL,
    "kind" "CommissionKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "legalApprovalRef" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "VolumeKind" NOT NULL,
    "pvMinor" BIGINT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolumeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "CommissionKind" NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEvent" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" "CommissionEventType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCommissionSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "eligibleMinor" BIGINT NOT NULL,
    "carriedInMinor" BIGINT NOT NULL,
    "payableMinor" BIGINT NOT NULL,
    "carriedOutMinor" BIGINT NOT NULL,
    "capMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCommissionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPolicy_kind_version_key" ON "CommissionPolicy"("kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_orderId_key" ON "Refund"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_reference_key" ON "Refund"("reference");

-- CreateIndex
CREATE INDEX "VolumeEntry_userId_idx" ON "VolumeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VolumeEntry_orderId_userId_kind_key" ON "VolumeEntry"("orderId", "userId", "kind");

-- CreateIndex
CREATE INDEX "CommissionEntry_userId_dayKey_idx" ON "CommissionEntry"("userId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_orderId_userId_kind_key" ON "CommissionEntry"("orderId", "userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEvent_reference_key" ON "CommissionEvent"("reference");

-- CreateIndex
CREATE INDEX "CommissionEvent_entryId_idx" ON "CommissionEvent"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCommissionSummary_userId_dayKey_key" ON "DailyCommissionSummary"("userId", "dayKey");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "VolumeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "VolumeEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEvent" ADD CONSTRAINT "CommissionEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CommissionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCommissionSummary" ADD CONSTRAINT "DailyCommissionSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------- Financial engine guards ----------

-- Immutable financial records: rows may be added, never changed or removed.
CREATE OR REPLACE FUNCTION financial_record_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volume_entry_append_only BEFORE UPDATE OR DELETE ON "VolumeEntry" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER commission_entry_append_only BEFORE UPDATE OR DELETE ON "CommissionEntry" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER commission_event_append_only BEFORE UPDATE OR DELETE ON "CommissionEvent" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER daily_summary_append_only BEFORE UPDATE OR DELETE ON "DailyCommissionSummary" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER refund_append_only BEFORE UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER policy_append_only BEFORE UPDATE OR DELETE ON "CommissionPolicy" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();
CREATE TRIGGER reconciliation_append_only BEFORE UPDATE OR DELETE ON "ReconciliationReport" FOR EACH ROW EXECUTE FUNCTION financial_record_append_only();

-- Amounts and day keys must be sensible.
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "volume_pv_positive" CHECK ("pvMinor" > 0);
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "commission_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "CommissionEvent" ADD CONSTRAINT "commission_event_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "DailyCommissionSummary" ADD CONSTRAINT "summary_nonneg" CHECK ("eligibleMinor" >= 0 AND "carriedInMinor" >= 0 AND "payableMinor" >= 0 AND "carriedOutMinor" >= 0 AND "capMinor" > 0);
ALTER TABLE "DailyCommissionSummary" ADD CONSTRAINT "summary_balances" CHECK ("payableMinor" <= "capMinor" AND "carriedOutMinor" = "carriedInMinor" + "eligibleMinor" - "payableMinor");
ALTER TABLE "DailyCapSetting" ADD CONSTRAINT "cap_positive_when_set" CHECK ("capMinor" IS NULL OR "capMinor" > 0);
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "policy_rate_range" CHECK ("rateBps" BETWEEN 0 AND 10000);
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "policy_active_needs_approval" CHECK ("active" = false OR "legalApprovalRef" IS NOT NULL);
-- Direct sponsor and binary commission can never be active in this system.
ALTER TABLE "CommissionPolicy" ADD CONSTRAINT "policy_sponsor_binary_disabled" CHECK ("kind" NOT IN ('DIRECT_SPONSOR', 'BINARY') OR "active" = false);

-- Business day keys are Asia/Kolkata calendar dates, YYYY-MM-DD.
ALTER TABLE "VolumeEntry" ADD CONSTRAINT "volume_day_format" CHECK ("dayKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "commission_day_format" CHECK ("dayKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "CommissionEvent" ADD CONSTRAINT "event_day_format" CHECK ("dayKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
ALTER TABLE "DailyCommissionSummary" ADD CONSTRAINT "summary_day_format" CHECK ("dayKey" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Seed: the daily cap is NOT configured. Settlement refuses to run until an administrator sets it.
INSERT INTO "DailyCapSetting" (id, "capMinor", reason, "updatedAt", "updatedBy")
VALUES ('default', NULL, 'Not configured. Set by an administrator before any commission can be released.', now(), 'migration');

-- Seed: every commission kind starts at version 1, inactive, with rate zero.
INSERT INTO "CommissionPolicy" (id, kind, version, "rateBps", active, "legalApprovalRef", reason, "createdBy", "createdAt") VALUES
  ('policy_product_v1', 'PRODUCT', 1, 0, false, NULL, 'Initial version. Inactive until a rate and legal approval are recorded.', 'migration', now()),
  ('policy_service_v1', 'SERVICE', 1, 0, false, NULL, 'Initial version. Inactive until a rate and legal approval are recorded.', 'migration', now()),
  ('policy_direct_v1', 'DIRECT_SPONSOR', 1, 0, false, NULL, 'Disabled. Sponsor-linked commission awaits documented legal approval.', 'migration', now()),
  ('policy_binary_v1', 'BINARY', 1, 0, false, NULL, 'Disabled. Binary team commission awaits documented legal approval.', 'migration', now());
