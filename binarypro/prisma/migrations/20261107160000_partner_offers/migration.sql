-- CreateTable
CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "discountLabel" TEXT NOT NULL,
    "couponCode" TEXT,
    "offerUrl" TEXT NOT NULL,
    "minTier" "Tier" NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT NOT NULL,
    "approvalRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerClick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerOffer_active_validUntil_idx" ON "PartnerOffer"("active", "validUntil");

-- CreateIndex
CREATE INDEX "PartnerOffer_category_idx" ON "PartnerOffer"("category");

-- CreateIndex
CREATE INDEX "PartnerClick_offerId_idx" ON "PartnerClick"("offerId");

-- CreateIndex
CREATE INDEX "PartnerClick_userId_idx" ON "PartnerClick"("userId");

-- AddForeignKey
ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerClick" ADD CONSTRAINT "PartnerClick_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PartnerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

