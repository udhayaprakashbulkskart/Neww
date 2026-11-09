-- CreateEnum
CREATE TYPE "SpinClaimStatus" AS ENUM ('HELD', 'CLAIMED');

-- CreateTable
CREATE TABLE "SpinClaim" (
    "id" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SpinClaimStatus" NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpinClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpinClaim_spinId_key" ON "SpinClaim"("spinId");

-- CreateIndex
CREATE INDEX "SpinClaim_userId_status_idx" ON "SpinClaim"("userId", "status");

-- AddForeignKey
ALTER TABLE "SpinClaim" ADD CONSTRAINT "SpinClaim_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "SpinSpin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinClaim" ADD CONSTRAINT "SpinClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Every spin made before this change was made by a paid member, so those rewards are already claimed.
INSERT INTO "SpinClaim" (id, "spinId", "userId", status, "claimedAt", "createdAt", "updatedAt")
SELECT 'claim_' || s.id, s.id, s."userId", 'CLAIMED', s."createdAt", s."createdAt", now()
FROM "SpinSpin" s
ON CONFLICT ("spinId") DO NOTHING;
