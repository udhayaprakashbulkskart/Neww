-- Global locale and currency display. Display-only: no transaction amounts or ledger rows change.

-- FX rates: allow display-only currency codes (for example JPY) and record where the rate came from.
ALTER TABLE "FxRate" ALTER COLUMN "currency" TYPE TEXT USING "currency"::text;
ALTER TABLE "FxRate" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "FxRate" ADD COLUMN "fetchedAt" TIMESTAMP(3);

-- User language and whether the user has chosen their region settings manually.
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN "regionChosen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "displayCurrency" TEXT;

CREATE TABLE "PlatformSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "TranslationOverride" (
  "id" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TranslationOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TranslationOverride_locale_key_key" ON "TranslationOverride"("locale", "key");
