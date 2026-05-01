-- Persist directory permissions and manual character ordering.
ALTER TABLE "Folder" ADD COLUMN "permissionMode" TEXT NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "Character" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN "permissionMode" TEXT NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "AbilityDefinition" ADD COLUMN "permissionMode" TEXT NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "ItemDefinition" ADD COLUMN "permissionMode" TEXT NOT NULL DEFAULT 'DEFAULT';
