-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bankRef" TEXT,
ADD COLUMN     "confirmedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bankRef_key" ON "Payment"("bankRef");

