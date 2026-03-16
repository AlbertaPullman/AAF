import { WorldRuntimeState, WorldRuntimeStatus } from "./world-runtime.types";

const worldRuntimeStateStore = new Map<string, WorldRuntimeState>();

function normalizeStatus(status?: string): WorldRuntimeStatus {
  const candidate = String(status ?? "").trim().toLowerCase();
  if (candidate === "loading" || candidate === "active" || candidate === "sleeping" || candidate === "error") {
    return candidate;
  }
  throw new Error("invalid world runtime status");
}

function toIsoNow() {
  return new Date().toISOString();
}

function getDefaultState(worldId: string): WorldRuntimeState {
  return {
    worldId,
    status: "sleeping",
    message: null,
    updatedAt: toIsoNow()
  };
}

export function getWorldRuntimeState(worldId: string): WorldRuntimeState {
  const normalizedWorldId = worldId.trim();
  if (!normalizedWorldId) {
    throw new Error("worldId is required");
  }

  const existing = worldRuntimeStateStore.get(normalizedWorldId);
  if (existing) {
    return existing;
  }

  const initialState = getDefaultState(normalizedWorldId);
  worldRuntimeStateStore.set(normalizedWorldId, initialState);
  return initialState;
}

export function setWorldRuntimeState(input: {
  worldId: string;
  status: string;
  message?: string | null;
}): WorldRuntimeState {
  const normalizedWorldId = input.worldId.trim();
  if (!normalizedWorldId) {
    throw new Error("worldId is required");
  }

  const status = normalizeStatus(input.status);
  const message = typeof input.message === "string" ? input.message.trim() || null : null;
  const state: WorldRuntimeState = {
    worldId: normalizedWorldId,
    status,
    message,
    updatedAt: toIsoNow()
  };

  worldRuntimeStateStore.set(normalizedWorldId, state);
  return state;
}

export function listWorldRuntimeStates(): WorldRuntimeState[] {
  return Array.from(worldRuntimeStateStore.values()).sort((a, b) => a.worldId.localeCompare(b.worldId));
}

export function __resetWorldRuntimeStateStoreForTest() {
  worldRuntimeStateStore.clear();
}
