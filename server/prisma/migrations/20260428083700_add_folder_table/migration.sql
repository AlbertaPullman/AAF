-- CP-01: Folder 表 + 跨资源 folderId 字段。
-- folderPath 字段在兼容期保留（3 个版本后由后续迁移删除）。

-- 1. 创建 Folder 表（SQLite 不支持 enum，type 字段以 TEXT 存储 FolderType 枚举值）
CREATE TABLE "Folder" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "worldId"   TEXT NOT NULL,
    "parentId"  TEXT,
    "type"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "color"     TEXT,
    "icon"      TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Folder_worldId_fkey"  FOREIGN KEY ("worldId")  REFERENCES "World" ("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE SET NULL  ON UPDATE CASCADE
);

CREATE INDEX "Folder_worldId_type_idx" ON "Folder"("worldId", "type");
CREATE INDEX "Folder_parentId_idx"     ON "Folder"("parentId");

-- 2. 给 10 个资源表加 folderId（可空，外键 Folder.id）
ALTER TABLE "Scene"                ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "Character"            ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "AbilityDefinition"    ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "ItemDefinition"       ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "ProfessionDefinition" ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "RaceDefinition"       ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "BackgroundDefinition" ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "FateClock"            ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "DeckDefinition"       ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;
ALTER TABLE "RandomTable"          ADD COLUMN "folderId" TEXT REFERENCES "Folder"("id") ON DELETE SET NULL;

-- 3. 各资源表 (worldId, folderId) 复合索引
CREATE INDEX "Scene_worldId_folderId_idx"                ON "Scene"("worldId", "folderId");
CREATE INDEX "Character_worldId_folderId_idx"            ON "Character"("worldId", "folderId");
CREATE INDEX "AbilityDefinition_worldId_folderId_idx"    ON "AbilityDefinition"("worldId", "folderId");
CREATE INDEX "ItemDefinition_worldId_folderId_idx"       ON "ItemDefinition"("worldId", "folderId");
CREATE INDEX "ProfessionDefinition_worldId_folderId_idx" ON "ProfessionDefinition"("worldId", "folderId");
CREATE INDEX "RaceDefinition_worldId_folderId_idx"       ON "RaceDefinition"("worldId", "folderId");
CREATE INDEX "BackgroundDefinition_worldId_folderId_idx" ON "BackgroundDefinition"("worldId", "folderId");
CREATE INDEX "FateClock_worldId_folderId_idx"            ON "FateClock"("worldId", "folderId");
CREATE INDEX "DeckDefinition_worldId_folderId_idx"       ON "DeckDefinition"("worldId", "folderId");
CREATE INDEX "RandomTable_worldId_folderId_idx"          ON "RandomTable"("worldId", "folderId");

-- 4. folderPath → folderId 数据迁移由 service 层延迟做（首次 listFolders 检测到该
--    worldId+type 没有 Folder 但有 folderPath 资源时，自动建树并回写 folderId）。
--    这样避免本迁移阶段大批 UPSERT 拖慢部署，且兼容尚未升级的客户端（仍按
--    folderPath 查询）。详见 server/src/services/folder.service.ts (migrateFolderPaths)。
