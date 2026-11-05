-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "fundingPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Campaign_status_fundingPercent_idx" ON "Campaign"("status", "fundingPercent");
