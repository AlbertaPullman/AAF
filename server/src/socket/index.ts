import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { SOCKET_EVENTS } from "./events";
import { createGlobalMessage, createWorldMessage } from "../services/chat.service";
import { prisma } from "../lib/prisma";
import { loadTokenStateForScene, saveTokenStateForScene, type SceneTokenState } from "../services/scene.service";

type AuthClaims = {
  userId: string;
};

type RateLimitState = {
  windowStart: number;
  count: number;
};

type WorldLatencyEntry = {
  latencyMs: number;
  updatedAt: number;
};

const chatRateLimitByUser = new Map<string, RateLimitState>();
const worldPresenceByWorld = new Map<string, Map<string, number>>();
const sceneTokenStateCache = new Map<string, Map<string, SceneTokenState>>();
const worldLatencyByWorld = new Map<string, Map<string, WorldLatencyEntry>>();
const worldLatencyEmitTimerByWorld = new Map<string, ReturnType<typeof setTimeout>>();

const WORLD_LATENCY_STALE_MS = 30_000;
const WORLD_LATENCY_EMIT_DELAY_MS = 220;

function getSceneCacheKey(worldId: string, sceneId: string) {
  return `${worldId}:${sceneId}`;
}

function isChatRateLimited(userId: string): { limited: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowMs = Math.max(env.chatRateLimitWindowMs, 1000);
  const maxMessages = Math.max(env.chatRateLimitMaxMessages, 1);
  const current = chatRateLimitByUser.get(userId);

  if (!current || now - current.windowStart >= windowMs) {
    chatRateLimitByUser.set(userId, { windowStart: now, count: 1 });
    return { limited: false };
  }

  if (current.count >= maxMessages) {
    return { limited: true, retryAfterMs: windowMs - (now - current.windowStart) };
  }

  current.count += 1;
  chatRateLimitByUser.set(userId, current);
  return { limited: false };
}

function updateWorldPresence(worldId: string, userId: string, delta: 1 | -1) {
  const userCounters = worldPresenceByWorld.get(worldId) ?? new Map<string, number>();
  const nextCount = (userCounters.get(userId) ?? 0) + delta;

  if (nextCount <= 0) {
    userCounters.delete(userId);
  } else {
    userCounters.set(userId, nextCount);
  }

  if (userCounters.size === 0) {
    worldPresenceByWorld.delete(worldId);
    return [];
  }

  worldPresenceByWorld.set(worldId, userCounters);
  return Array.from(userCounters.keys());
}

function emitWorldPresence(io: Server, worldId: string, memberUserIds: string[]) {
  io.to(`world:${worldId}`).emit(SOCKET_EVENTS.worldMembersUpdate, {
    worldId,
    memberUserIds,
    onlineCount: memberUserIds.length,
    updatedAt: new Date().toISOString()
  });
}

function sanitizeLatencyMs(input: unknown): number | null {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const normalized = Math.trunc(numeric);
  if (normalized < 0 || normalized > 120_000) {
    return null;
  }

  return normalized;
}

function clearWorldLatencyEmitTimer(worldId: string) {
  const timer = worldLatencyEmitTimerByWorld.get(worldId);
  if (timer) {
    clearTimeout(timer);
    worldLatencyEmitTimerByWorld.delete(worldId);
  }
}

function upsertWorldLatency(worldId: string, userId: string, latencyMs: number): boolean {
  const byUser = worldLatencyByWorld.get(worldId) ?? new Map<string, WorldLatencyEntry>();
  const current = byUser.get(userId) ?? null;
  const now = Date.now();

  byUser.set(userId, {
    latencyMs,
    updatedAt: now
  });
  worldLatencyByWorld.set(worldId, byUser);

  return !current || current.latencyMs !== latencyMs;
}

function removeWorldLatency(worldId: string, userId: string): boolean {
  const byUser = worldLatencyByWorld.get(worldId);
  if (!byUser) {
    return false;
  }

  const deleted = byUser.delete(userId);
  if (!deleted) {
    return false;
  }

  if (byUser.size === 0) {
    worldLatencyByWorld.delete(worldId);
  } else {
    worldLatencyByWorld.set(worldId, byUser);
  }

  return true;
}

function emitWorldLatency(io: Server, worldId: string) {
  const byUser = worldLatencyByWorld.get(worldId) ?? new Map<string, WorldLatencyEntry>();
  const now = Date.now();

  const latencies: Array<{ userId: string; latencyMs: number; updatedAt: string }> = [];
  for (const [userId, entry] of byUser.entries()) {
    if (now - entry.updatedAt > WORLD_LATENCY_STALE_MS) {
      byUser.delete(userId);
      continue;
    }

    latencies.push({
      userId,
      latencyMs: entry.latencyMs,
      updatedAt: new Date(entry.updatedAt).toISOString()
    });
  }

  if (byUser.size === 0) {
    worldLatencyByWorld.delete(worldId);
  } else {
    worldLatencyByWorld.set(worldId, byUser);
  }

  io.to(`world:${worldId}`).emit(SOCKET_EVENTS.worldLatencyUpdate, {
    worldId,
    latencies,
    updatedAt: new Date().toISOString()
  });
}

function scheduleWorldLatencyEmit(io: Server, worldId: string, immediate = false) {
  if (!worldId) {
    return;
  }

  const existing = worldLatencyEmitTimerByWorld.get(worldId);
  if (existing && !immediate) {
    return;
  }

  clearWorldLatencyEmitTimer(worldId);
  const timer = setTimeout(() => {
    worldLatencyEmitTimerByWorld.delete(worldId);
    emitWorldLatency(io, worldId);
  }, immediate ? 0 : WORLD_LATENCY_EMIT_DELAY_MS);

  worldLatencyEmitTimerByWorld.set(worldId, timer);
}

function upsertTokenState(cacheKey: string, token: SceneTokenState): SceneTokenState {
  const worldTokens = sceneTokenStateCache.get(cacheKey) ?? new Map<string, SceneTokenState>();
  worldTokens.set(token.tokenId, token);
  sceneTokenStateCache.set(cacheKey, worldTokens);
  return token;
}

async function ensureSceneTokenStateLoaded(worldId: string, sceneId?: string): Promise<{ sceneId: string; tokens: Map<string, SceneTokenState> }> {
  const loaded = await loadTokenStateForScene(worldId, sceneId);
  const cacheKey = getSceneCacheKey(worldId, loaded.sceneId);

  const existing = sceneTokenStateCache.get(cacheKey);
  if (existing) {
    return { sceneId: loaded.sceneId, tokens: existing };
  }

  const sceneMap = new Map<string, SceneTokenState>();
  for (const item of loaded.tokens) {
    sceneMap.set(item.tokenId, item);
  }

  sceneTokenStateCache.set(cacheKey, sceneMap);
  return { sceneId: loaded.sceneId, tokens: sceneMap };
}

export function initSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.corsOrigin
    }
  });

  io.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const headerToken = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
      const token = typeof authToken === "string" && authToken ? authToken : headerToken;

      if (!token) {
        next(new Error("unauthorized"));
        return;
      }

      const decoded = jwt.verify(token, env.jwtSecret) as AuthClaims;
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    const joinedWorldIds = new Set<string>();
    const selectedSceneByWorld = new Map<string, string>();
    logger.info(`socket connected: ${socket.id}, userId=${userId}`);
    socket.emit(SOCKET_EVENTS.connectionAck, { ok: true, socketId: socket.id, userId });

    socket.on(
      SOCKET_EVENTS.globalMessageSend,
      async (payload: { content?: string; channelKey?: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const rateLimitState = isChatRateLimited(userId);
        if (rateLimitState.limited) {
          throw new Error(`rate limit exceeded, retry in ${Math.ceil((rateLimitState.retryAfterMs ?? 0) / 1000)}s`);
        }

        const message = await createGlobalMessage(userId, payload?.content ?? "", payload?.channelKey);
        io.emit(SOCKET_EVENTS.globalMessageNew, message);
        if (ack) {
          ack({ ok: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "message send failed";
        if (ack) {
          ack({ ok: false, error: message });
        }
      }
      }
    );

    socket.on(SOCKET_EVENTS.worldJoin, async (payload: { worldId?: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const worldId = payload?.worldId?.trim();
        if (!worldId) {
          throw new Error("worldId is required");
        }

        const membership = await prisma.worldMember.findUnique({
          where: {
            worldId_userId: {
              worldId,
              userId
            }
          }
        });

        if (!membership || membership.status !== "ACTIVE") {
          throw new Error("not a member of world");
        }

        socket.join(`world:${worldId}`);
        joinedWorldIds.add(worldId);
        const memberUserIds = updateWorldPresence(worldId, userId, 1);
        emitWorldPresence(io, worldId, memberUserIds);
        scheduleWorldLatencyEmit(io, worldId, true);

        const { sceneId, tokens } = await ensureSceneTokenStateLoaded(worldId);
        selectedSceneByWorld.set(worldId, sceneId);
        if (tokens.size > 0) {
          socket.emit(SOCKET_EVENTS.sceneTokenMoved, {
            worldId,
            sceneId,
            tokens: Array.from(tokens.values())
          });
        }

        if (ack) {
          ack({ ok: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "world join failed";
        if (ack) {
          ack({ ok: false, error: message });
        }
      }
    });

    socket.on(SOCKET_EVENTS.worldLeave, (payload: { worldId?: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const worldId = payload?.worldId?.trim();
        if (!worldId) {
          throw new Error("worldId is required");
        }

        if (joinedWorldIds.has(worldId)) {
          joinedWorldIds.delete(worldId);
          selectedSceneByWorld.delete(worldId);
          socket.leave(`world:${worldId}`);
          const memberUserIds = updateWorldPresence(worldId, userId, -1);
          emitWorldPresence(io, worldId, memberUserIds);

          const latencyRemoved = removeWorldLatency(worldId, userId);
          if (latencyRemoved) {
            scheduleWorldLatencyEmit(io, worldId, true);
          }
        }

        if (ack) {
          ack({ ok: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "world leave failed";
        if (ack) {
          ack({ ok: false, error: message });
        }
      }
    });

    socket.on(
      SOCKET_EVENTS.worldLatencyProbe,
      (
        payload: { worldId?: string; latencyMs?: number },
        ack?: (result: { ok: boolean; error?: string; serverAt?: string }) => void
      ) => {
        try {
          const worldId = payload?.worldId?.trim();
          if (!worldId) {
            throw new Error("worldId is required");
          }
          if (!joinedWorldIds.has(worldId)) {
            throw new Error("must join world before reporting latency");
          }

          const latencyMs = sanitizeLatencyMs(payload?.latencyMs);
          if (latencyMs !== null) {
            const changed = upsertWorldLatency(worldId, userId, latencyMs);
            if (changed) {
              scheduleWorldLatencyEmit(io, worldId);
            }
          }

          if (ack) {
            ack({ ok: true, serverAt: new Date().toISOString() });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "latency probe failed";
          if (ack) {
            ack({ ok: false, error: message });
          }
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.worldMessageSend,
      async (
        payload: { worldId?: string; content?: string; channelKey?: string; sceneId?: string },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const worldId = payload?.worldId?.trim();
          if (!worldId) {
            throw new Error("worldId is required");
          }
          if (!joinedWorldIds.has(worldId)) {
            throw new Error("must join world before sending world message");
          }

          const activeSceneId = selectedSceneByWorld.get(worldId);
          if (!activeSceneId) {
            throw new Error("must select scene before sending world message");
          }
          if (payload?.sceneId?.trim() && payload.sceneId.trim() !== activeSceneId) {
            throw new Error("scene mismatch");
          }

          const membership = await prisma.worldMember.findUnique({
            where: {
              worldId_userId: {
                worldId,
                userId
              }
            },
            select: {
              role: true,
              status: true
            }
          });

          if (!membership || membership.status !== "ACTIVE") {
            throw new Error("not a member of world");
          }
          if (membership.role === "OBSERVER") {
            throw new Error("observer cannot send world message");
          }

          const message = await createWorldMessage(userId, worldId, payload?.content ?? "", payload?.channelKey, activeSceneId);
          logger.info(
            `world chat sent: worldId=${worldId}, channel=${message.channelKey ?? "OOC"}, userId=${userId}, messageId=${message.id}`
          );
          io.to(`world:${worldId}`).emit(SOCKET_EVENTS.worldMessageNew, message);
          if (ack) {
            ack({ ok: true });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "world message send failed";
          if (ack) {
            ack({ ok: false, error: message });
          }
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.sceneSelect,
      async (payload: { worldId?: string; sceneId?: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
        try {
          const worldId = payload?.worldId?.trim();
          if (!worldId) {
            throw new Error("worldId is required");
          }
          if (!joinedWorldIds.has(worldId)) {
            throw new Error("must join world before selecting scene");
          }

          const { sceneId, tokens } = await ensureSceneTokenStateLoaded(worldId, payload?.sceneId?.trim());
          selectedSceneByWorld.set(worldId, sceneId);

          socket.emit(SOCKET_EVENTS.sceneTokenMoved, {
            worldId,
            sceneId,
            tokens: Array.from(tokens.values())
          });

          if (ack) {
            ack({ ok: true });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "scene select failed";
          if (ack) {
            ack({ ok: false, error: message });
          }
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.sceneTokenMove,
      async (
        payload: { worldId?: string; sceneId?: string; tokenId?: string; x?: number; y?: number; ownerUserId?: string | null; characterId?: string | null },
        ack?: (result: { ok: boolean; error?: string }) => void
      ) => {
        try {
          const worldId = payload?.worldId?.trim();
          const tokenId = payload?.tokenId?.trim();
          const characterId = payload?.characterId?.trim() || null;
          const requestedSceneId = payload?.sceneId?.trim();
          const x = Number(payload?.x);
          const y = Number(payload?.y);

          if (!worldId) {
            throw new Error("worldId is required");
          }
          if (!tokenId) {
            throw new Error("tokenId is required");
          }
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error("token position is invalid");
          }
          if (!joinedWorldIds.has(worldId)) {
            throw new Error("must join world before moving token");
          }

          const activeSceneId = selectedSceneByWorld.get(worldId);
          if (!activeSceneId) {
            throw new Error("must select scene before moving token");
          }
          if (requestedSceneId && requestedSceneId !== activeSceneId) {
            throw new Error("scene mismatch");
          }

          const membership = await prisma.worldMember.findUnique({
            where: {
              worldId_userId: {
                worldId,
                userId
              }
            }
          });

          if (!membership || membership.status !== "ACTIVE") {
            throw new Error("not a member of world");
          }

          if (membership.role === "OBSERVER") {
            throw new Error("observer cannot move token");
          }

          const canMoveAnyToken = membership.role === "GM" || membership.role === "ASSISTANT";
          const canAssignOwner = membership.role === "GM";

          const cacheKey = getSceneCacheKey(worldId, activeSceneId);
          const { tokens } = await ensureSceneTokenStateLoaded(worldId, activeSceneId);
          const existingToken = tokens.get(tokenId);

          let characterName: string | null = existingToken?.characterName ?? null;
          let characterOwnerUserId: string | null = existingToken?.ownerUserId ?? null;
          if (characterId) {
            const character = await prisma.character.findUnique({
              where: { id: characterId },
              select: {
                id: true,
                worldId: true,
                name: true,
                userId: true
              }
            });

            if (!character || character.worldId !== worldId) {
              throw new Error("character not found in world");
            }
            if (!canMoveAnyToken && character.userId !== userId) {
              throw new Error("permission denied for character");
            }

            characterName = character.name;
            characterOwnerUserId = character.userId ?? null;
          }

          if (!canMoveAnyToken) {
            if (existingToken?.ownerUserId && existingToken.ownerUserId !== userId) {
              throw new Error("permission denied for token");
            }
          }

          if (!canAssignOwner) {
            if (payload.ownerUserId && payload.ownerUserId !== userId) {
              throw new Error("cannot assign token owner to another user");
            }
          }

          const requestedOwner = payload.ownerUserId?.trim() || null;
          const ownerUserId =
            characterOwnerUserId ??
            existingToken?.ownerUserId ??
            (canAssignOwner ? requestedOwner : userId);

          const tokenState = upsertTokenState(cacheKey, {
            tokenId,
            x,
            y,
            updatedAt: new Date().toISOString(),
            updatedBy: userId,
            ownerUserId,
            characterId: characterId ?? existingToken?.characterId ?? null,
            characterName
          });

          const persistedTokens = sceneTokenStateCache.get(cacheKey);
          if (!persistedTokens) {
            throw new Error("scene token cache not initialized");
          }

          await saveTokenStateForScene(worldId, activeSceneId, Array.from(persistedTokens.values()));

          io.to(`world:${worldId}`).emit(SOCKET_EVENTS.sceneTokenMoved, {
            worldId,
            sceneId: activeSceneId,
            tokens: [tokenState]
          });

          if (ack) {
            ack({ ok: true });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "token move failed";
          if (ack) {
            ack({ ok: false, error: message });
          }
        }
      }
    );

    socket.on("disconnect", () => {
      joinedWorldIds.forEach((worldId) => {
        const memberUserIds = updateWorldPresence(worldId, userId, -1);
        emitWorldPresence(io, worldId, memberUserIds);

        const latencyRemoved = removeWorldLatency(worldId, userId);
        if (latencyRemoved) {
          scheduleWorldLatencyEmit(io, worldId, true);
        }
      });
      joinedWorldIds.clear();
      logger.info(`socket disconnected: ${socket.id}, userId=${userId}`);
    });
  });

  return io;
}
