-- Remove the last OTP remnants (verification type and notification type).
DELETE FROM "Verification" WHERE "type"::text = 'MOBILE_OTP';
DELETE FROM "Notification" WHERE "type"::text = 'OTP';

ALTER TYPE "VerificationType" RENAME TO "VerificationType_old";
CREATE TYPE "VerificationType" AS ENUM ('IDENTITY', 'ADDRESS', 'BANK_ACCOUNT', 'FINANCIAL_DOCUMENTS', 'LOAN_DOCUMENTS');
ALTER TABLE "Verification" ALTER COLUMN "type" TYPE "VerificationType" USING ("type"::text::"VerificationType");
DROP TYPE "VerificationType_old";

ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
CREATE TYPE "NotificationType" AS ENUM ('CAMPAIGN_STATUS', 'DOCUMENT_REVIEW', 'DONATION_RECEIVED', 'PAYMENT_CONFIRMATION', 'REFUND_UPDATE', 'VERIFICATION_UPDATE', 'COMPLAINT_UPDATE', 'SYSTEM');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING ("type"::text::"NotificationType");
DROP TYPE "NotificationType_old";

-- Per-post fee (paid credit per campaign post).
CREATE TYPE "PostFeeStatus" AS ENUM ('CREATED', 'PAID', 'FAILED');

CREATE TABLE "PostFee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "PostFeeStatus" NOT NULL DEFAULT 'CREATED',
    "provider" "PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "campaignId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostFee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostFee_providerOrderId_key" ON "PostFee"("providerOrderId");
CREATE UNIQUE INDEX "PostFee_providerPaymentId_key" ON "PostFee"("providerPaymentId");
CREATE INDEX "PostFee_userId_status_idx" ON "PostFee"("userId", "status");

ALTER TABLE "PostFee" ADD CONSTRAINT "PostFee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
