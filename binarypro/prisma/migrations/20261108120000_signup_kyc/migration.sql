-- CreateEnum
CREATE TYPE "KycDocKind" AS ENUM ('AADHAAR', 'PAN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kycNote" TEXT,
ADD COLUMN     "kycReviewedAt" TIMESTAMP(3),
ADD COLUMN     "kycReviewedBy" TEXT,
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "KycDocKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "accountCipher" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycDocument_userId_kind_key" ON "KycDocument"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_key" ON "BankAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing members get a referral number so they can invite others. Derived from their id: unique and stable.
UPDATE "User" SET "referralCode" = 'BP' || upper(substr(md5("id"), 1, 10)) WHERE "referralCode" IS NULL;

-- Guards: a document must not be empty, and a bank account must have a 4-digit tail.
ALTER TABLE "KycDocument" ADD CONSTRAINT "kyc_doc_size_positive" CHECK ("sizeBytes" > 0);
ALTER TABLE "BankAccount" ADD CONSTRAINT "bank_last4_format" CHECK ("accountLast4" ~ '^[0-9]{4}$');
