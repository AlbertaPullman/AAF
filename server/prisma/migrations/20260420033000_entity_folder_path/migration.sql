-- Add lightweight folder paths for the visual template library.
ALTER TABLE "AbilityDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RaceDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProfessionDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BackgroundDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ItemDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FateClock" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeckDefinition" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';
ALTER TABLE "RandomTable" ADD COLUMN "folderPath" TEXT NOT NULL DEFAULT '';

CREATE INDEX "AbilityDefinition_worldId_folderPath_idx" ON "AbilityDefinition"("worldId", "folderPath");
CREATE INDEX "RaceDefinition_worldId_folderPath_idx" ON "RaceDefinition"("worldId", "folderPath");
CREATE INDEX "ProfessionDefinition_worldId_folderPath_idx" ON "ProfessionDefinition"("worldId", "folderPath");
CREATE INDEX "BackgroundDefinition_worldId_folderPath_idx" ON "BackgroundDefinition"("worldId", "folderPath");
CREATE INDEX "ItemDefinition_worldId_folderPath_idx" ON "ItemDefinition"("worldId", "folderPath");
CREATE INDEX "FateClock_worldId_folderPath_idx" ON "FateClock"("worldId", "folderPath");
CREATE INDEX "DeckDefinition_worldId_folderPath_idx" ON "DeckDefinition"("worldId", "folderPath");
CREATE INDEX "RandomTable_worldId_folderPath_idx" ON "RandomTable"("worldId", "folderPath");
