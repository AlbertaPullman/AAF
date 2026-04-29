-- AlterTable
ALTER TABLE "World" ADD COLUMN "themePack" TEXT;
ALTER TABLE "World" ADD COLUMN "themePackForcedByGM" BOOLEAN NOT NULL DEFAULT false;
