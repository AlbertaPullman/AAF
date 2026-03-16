-- CreateTable
CREATE TABLE "StoryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "targetUserId" TEXT,
    "sceneId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "options" JSONB NOT NULL,
    "summary" TEXT,
    "finalOutcome" TEXT,
    "processTimeline" JSONB,
    "createdBy" TEXT NOT NULL,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryEvent_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoryEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StoryEvent_worldId_createdAt_idx" ON "StoryEvent"("worldId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryEvent_worldId_status_idx" ON "StoryEvent"("worldId", "status");

-- CreateIndex
CREATE INDEX "StoryEvent_targetUserId_idx" ON "StoryEvent"("targetUserId");
