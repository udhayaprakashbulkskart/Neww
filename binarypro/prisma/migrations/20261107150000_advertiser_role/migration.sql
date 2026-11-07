-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'ADS_TOPUP';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADVERTISER';

-- AlterTable
ALTER TABLE "AdCampaign" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "AdCampaign_ownerId_idx" ON "AdCampaign"("ownerId");

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

