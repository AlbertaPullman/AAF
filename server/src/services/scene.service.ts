import { prisma } from "../lib/prisma";
import { WorldRole } from "@prisma/client";

export type SceneSortDirection = "UP" | "DOWN";

export type SceneOrderItem = {
  id: string;
  sortOrder: number;
};

export type SceneTokenState = {
  tokenId: string;
  x: number;
  y: number;
  updatedAt: string;
  updatedBy: string;
  ownerUserId?: string | null;
  characterId?: string | null;
  characterName?: string | null;
};

export type SceneLightSourceState = {
  id: string;
  targetType: "actor" | "object" | "point";
  targetId?: string | null;
  x?: number;
  y?: number;
  brightRadiusFeet: number;
  dimRadiusFeet: number;
  colorHex: string;
  followTarget: boolean;
  durationMode: "rounds" | "battle-end" | "concentration" | "manual";
  durationRounds?: number;
};

export type SceneFogRevealedArea = {
  id: string;
  shape: "circle" | "rect" | "polygon";
  points?: Array<{ x: number; y: number }>;
  radius?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type SceneFogState = {
  enabled: boolean;
  mode: "full" | "hidden";
  revealedAreas: SceneFogRevealedArea[];
};

export type SceneVisualState = {
  sceneId: string;
  grid: {
    enabled: boolean;
    unitFeet: number;
  };
  lights: SceneLightSourceState[];
  fog: SceneFogState;
  updatedAt: string;
};

export type CombatParticipantState = {
  tokenId: string;
  name: string;
  initiative: number;
  rank: number;
};

export type SceneCombatState = {
  sceneId: string;
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason: string | null;
  updatedAt: string;
};

export type SceneCombatInput = {
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason?: string | null;
};

export type SceneVisualInput = {
  grid?: {
    enabled?: boolean;
    unitFeet?: number;
  };
  lights?: SceneLightSourceState[];
  fog?: SceneFogState;
};

type SceneCanvasState = {
  tokens?: SceneTokenState[];
  visual?: Omit<SceneVisualState, "sceneId">;
  combat?: Omit<SceneCombatState, "sceneId">;
};

function toIsoNow() {
  return new Date().toISOString();
}

function getDefaultVisualState(sceneId: string): SceneVisualState {
  return {
    sceneId,
    grid: {
      enabled: true,
      unitFeet: 5
    },
    lights: [],
    fog: {
      enabled: false,
      mode: "hidden",
      revealedAreas: []
    },
    updatedAt: toIsoNow()
  };
}

function getDefaultCombatState(sceneId: string): SceneCombatState {
  return {
    sceneId,
    status: "idle",
    round: 1,
    turnIndex: 0,
    participants: [],
    pauseReason: null,
    updatedAt: toIsoNow()
  };
}

function toStoredVisualState(input: SceneVisualState): Omit<SceneVisualState, "sceneId"> {
  return {
    grid: input.grid,
    lights: input.lights,
    fog: input.fog,
    updatedAt: input.updatedAt
  };
}

function toStoredCombatState(input: SceneCombatState): Omit<SceneCombatState, "sceneId"> {
  return {
    status: input.status,
    round: input.round,
    turnIndex: input.turnIndex,
    participants: input.participants,
    pauseReason: input.pauseReason,
    updatedAt: input.updatedAt
  };
}

function isSceneVisualState(value: unknown): value is Omit<SceneVisualState, "sceneId"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!candidate.grid || typeof candidate.grid !== "object") {
    return false;
  }
  if (!candidate.fog || typeof candidate.fog !== "object") {
    return false;
  }
  if (!Array.isArray(candidate.lights)) {
    return false;
  }

  return true;
}

function isSceneCombatState(value: unknown): value is Omit<SceneCombatState, "sceneId"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.round === "number" &&
    typeof candidate.turnIndex === "number" &&
    Array.isArray(candidate.participants)
  );
}

async function loadSceneCanvasState(worldId: string, sceneId: string): Promise<SceneCanvasState> {
  const scene = await resolveScene(worldId, sceneId);
  if (!scene.canvasState || typeof scene.canvasState !== "object") {
    return {};
  }

  return scene.canvasState as SceneCanvasState;
}

async function saveSceneCanvasState(worldId: string, sceneId: string, patch: Partial<SceneCanvasState>) {
  const current = await loadSceneCanvasState(worldId, sceneId);
  await prisma.scene.update({
    where: { id: sceneId },
    data: {
      canvasState: {
        ...current,
        ...patch
      }
    }
  });
}

export function canManageSceneByRole(role: WorldRole): boolean {
  return role === WorldRole.GM;
}

export function resolveSceneMoveTargetId(scenes: SceneOrderItem[], sceneId: string, direction: SceneSortDirection): string | null {
  const currentIndex = scenes.findIndex((item) => item.id === sceneId);
  if (currentIndex === -1) {
    throw new Error("scene not found in world");
  }

  const targetIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= scenes.length) {
    return null;
  }

  return scenes[targetIndex].id;
}

async function getMembership(worldId: string, userId: string) {
  return prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });
}

async function assertSceneAccess(worldId: string, userId: string, manage = false) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  if (manage && !canManageSceneByRole(membership.role)) {
    throw new Error("only gm can manage scene battle state");
  }
}

function isSceneTokenStateArray(value: unknown): value is SceneTokenState[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.tokenId === "string" &&
      typeof candidate.x === "number" &&
      typeof candidate.y === "number" &&
      typeof candidate.updatedAt === "string" &&
      typeof candidate.updatedBy === "string" &&
      (typeof candidate.ownerUserId === "undefined" || candidate.ownerUserId === null || typeof candidate.ownerUserId === "string") &&
      (typeof candidate.characterId === "undefined" || candidate.characterId === null || typeof candidate.characterId === "string") &&
      (typeof candidate.characterName === "undefined" || candidate.characterName === null || typeof candidate.characterName === "string")
    );
  });
}

async function getDefaultScene(worldId: string) {
  return prisma.scene.findFirst({
    where: { worldId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      canvasState: true
    }
  });
}

export async function resolveScene(worldId: string, sceneId?: string) {
  if (sceneId) {
    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, worldId },
      select: {
        id: true,
        worldId: true,
        name: true,
        sortOrder: true,
        canvasState: true
      }
    });

    if (scene) {
      return scene;
    }
  }

  const fallback = await prisma.scene.findFirst({
    where: { worldId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      worldId: true,
      name: true,
      sortOrder: true,
      canvasState: true
    }
  });

  if (!fallback) {
    throw new Error("scene not found for world");
  }

  return fallback;
}

export async function loadTokenStateForWorld(worldId: string): Promise<SceneTokenState[]> {
  const scene = await resolveScene(worldId);
  if (!scene?.canvasState || typeof scene.canvasState !== "object") {
    return [];
  }

  const canvasState = scene.canvasState as SceneCanvasState;
  if (!isSceneTokenStateArray(canvasState.tokens)) {
    return [];
  }

  return canvasState.tokens;
}

export async function loadTokenStateForScene(worldId: string, sceneId?: string): Promise<{ sceneId: string; tokens: SceneTokenState[] }> {
  const scene = await resolveScene(worldId, sceneId);
  if (!scene.canvasState || typeof scene.canvasState !== "object") {
    return { sceneId: scene.id, tokens: [] };
  }

  const canvasState = scene.canvasState as SceneCanvasState;
  if (!isSceneTokenStateArray(canvasState.tokens)) {
    return { sceneId: scene.id, tokens: [] };
  }

  return { sceneId: scene.id, tokens: canvasState.tokens };
}

export async function saveTokenStateForWorld(worldId: string, tokens: SceneTokenState[]): Promise<void> {
  const scene = await resolveScene(worldId);
  if (!scene) {
    throw new Error("scene not found for world");
  }

  await saveSceneCanvasState(worldId, scene.id, { tokens });
}

export async function saveTokenStateForScene(worldId: string, sceneId: string, tokens: SceneTokenState[]): Promise<void> {
  const scene = await resolveScene(worldId, sceneId);
  await saveSceneCanvasState(worldId, scene.id, { tokens });
}

export async function getSceneVisualState(worldId: string, sceneId: string, userId: string): Promise<SceneVisualState> {
  await assertSceneAccess(worldId, userId, false);
  const scene = await resolveScene(worldId, sceneId);
  const canvasState = await loadSceneCanvasState(worldId, scene.id);
  if (!isSceneVisualState(canvasState.visual)) {
    return getDefaultVisualState(scene.id);
  }

  return {
    sceneId: scene.id,
    ...canvasState.visual
  };
}

export async function patchSceneVisualState(worldId: string, sceneId: string, userId: string, input: SceneVisualInput): Promise<SceneVisualState> {
  await assertSceneAccess(worldId, userId, true);
  const current = await getSceneVisualState(worldId, sceneId, userId);
  const next: SceneVisualState = {
    ...current,
    grid: {
      enabled: input.grid?.enabled ?? current.grid.enabled,
      unitFeet: input.grid?.unitFeet ?? current.grid.unitFeet
    },
    lights: Array.isArray(input.lights) ? input.lights : current.lights,
    fog: input.fog ?? current.fog,
    updatedAt: toIsoNow()
  };

  await saveSceneCanvasState(worldId, sceneId, {
    visual: toStoredVisualState(next)
  });

  return next;
}

export async function getSceneCombatState(worldId: string, sceneId: string, userId: string): Promise<SceneCombatState> {
  await assertSceneAccess(worldId, userId, false);
  const scene = await resolveScene(worldId, sceneId);
  const canvasState = await loadSceneCanvasState(worldId, scene.id);
  if (!isSceneCombatState(canvasState.combat)) {
    return getDefaultCombatState(scene.id);
  }

  return {
    sceneId: scene.id,
    ...canvasState.combat
  };
}

export async function putSceneCombatState(worldId: string, sceneId: string, userId: string, input: SceneCombatInput): Promise<SceneCombatState> {
  await assertSceneAccess(worldId, userId, true);
  const participants = [...input.participants].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return a.tokenId.localeCompare(b.tokenId);
  });

  const normalizedTurnIndex =
    participants.length > 0
      ? Math.min(Math.max(input.turnIndex, 0), participants.length - 1)
      : 0;

  const next: SceneCombatState = {
    sceneId,
    status: input.status,
    round: Math.max(1, input.round),
    turnIndex: normalizedTurnIndex,
    participants: participants.map((item, index) => ({
      ...item,
      rank: index + 1
    })),
    pauseReason: input.pauseReason ?? null,
    updatedAt: toIsoNow()
  };

  await saveSceneCanvasState(worldId, sceneId, {
    combat: toStoredCombatState(next)
  });

  return next;
}

export async function advanceSceneCombatTurn(worldId: string, sceneId: string, userId: string): Promise<SceneCombatState> {
  await assertSceneAccess(worldId, userId, true);
  const current = await getSceneCombatState(worldId, sceneId, userId);
  if (current.participants.length === 0) {
    return current;
  }

  const isLastTurn = current.turnIndex >= current.participants.length - 1;
  const next: SceneCombatState = {
    ...current,
    turnIndex: isLastTurn ? 0 : current.turnIndex + 1,
    round: isLastTurn ? current.round + 1 : current.round,
    updatedAt: toIsoNow()
  };

  await saveSceneCanvasState(worldId, sceneId, {
    combat: toStoredCombatState(next)
  });

  return next;
}

export async function listScenes(worldId: string, userId: string) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  return prisma.scene.findMany({
    where: { worldId },
    select: {
      id: true,
      worldId: true,
      name: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function createScene(worldId: string, userId: string, name: string) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (!canManageSceneByRole(membership.role)) {
    throw new Error("only gm can create scene");
  }

  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("scene name is required");
  }

  const maxSort = await prisma.scene.findFirst({
    where: { worldId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  return prisma.scene.create({
    data: {
      worldId,
      name: normalizedName,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1
    },
    select: {
      id: true,
      worldId: true,
      name: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function renameScene(worldId: string, sceneId: string, userId: string, name: string) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (!canManageSceneByRole(membership.role)) {
    throw new Error("only gm can rename scene");
  }

  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("scene name is required");
  }

  const existing = await prisma.scene.findFirst({
    where: {
      id: sceneId,
      worldId
    },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("scene not found in world");
  }

  return prisma.scene.update({
    where: { id: sceneId },
    data: {
      name: normalizedName
    },
    select: {
      id: true,
      worldId: true,
      name: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function deleteScene(worldId: string, sceneId: string, userId: string) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (!canManageSceneByRole(membership.role)) {
    throw new Error("only gm can delete scene");
  }

  const existing = await prisma.scene.findFirst({
    where: {
      id: sceneId,
      worldId
    },
    select: { id: true }
  });

  if (!existing) {
    throw new Error("scene not found in world");
  }

  const total = await prisma.scene.count({ where: { worldId } });
  if (total <= 1) {
    throw new Error("cannot delete last scene");
  }

  await prisma.scene.delete({ where: { id: sceneId } });
}

export async function moveSceneSort(worldId: string, sceneId: string, userId: string, direction: SceneSortDirection) {
  const membership = await getMembership(worldId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (!canManageSceneByRole(membership.role)) {
    throw new Error("only gm can sort scene");
  }

  return prisma.$transaction(async (tx) => {
    const scenes = await tx.scene.findMany({
      where: { worldId },
      select: {
        id: true,
        worldId: true,
        name: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    const targetId = resolveSceneMoveTargetId(
      scenes.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
      sceneId,
      direction
    );
    if (!targetId) {
      return scenes;
    }

    const current = scenes.find((item) => item.id === sceneId);
    const target = scenes.find((item) => item.id === targetId);
    if (!current || !target) {
      throw new Error("scene not found in world");
    }

    const minSort = scenes.reduce((acc, item) => Math.min(acc, item.sortOrder), scenes[0]?.sortOrder ?? 0);
    const tempSort = minSort - 1;

    await tx.scene.update({ where: { id: target.id }, data: { sortOrder: tempSort } });
    await tx.scene.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } });
    await tx.scene.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } });

    return tx.scene.findMany({
      where: { worldId },
      select: {
        id: true,
        worldId: true,
        name: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });
}
