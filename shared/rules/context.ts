export type RuleContext = {
  worldId: string;
  sceneId: string | null;
  actorId: string | null;
  targetIds: string[];
  timeTick: number;
  // Reserved extension data for later iterations (battle, task, weather, etc.)
  metadata?: Record<string, unknown>;
};

export function createRuleContext(input: {
  worldId: string;
  sceneId?: string | null;
  actorId?: string | null;
  targetIds?: string[];
  timeTick?: number;
  metadata?: Record<string, unknown>;
}): RuleContext {
  const worldId = String(input.worldId ?? "").trim();
  if (!worldId) {
    throw new Error("worldId is required");
  }

  return {
    worldId,
    sceneId: input.sceneId ?? null,
    actorId: input.actorId ?? null,
    targetIds: Array.isArray(input.targetIds)
      ? input.targetIds.map((item) => String(item).trim()).filter(Boolean)
      : [],
    timeTick: Number.isFinite(input.timeTick) ? Number(input.timeTick) : 0,
    metadata: input.metadata
  };
}
