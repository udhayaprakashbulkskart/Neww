-- Password sign-in replaces mobile OTP. Accounts gain a scrypt password hash; the OTP table is removed.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

DROP TABLE "OtpCode";
DROP TYPE "OtpPurpose";
