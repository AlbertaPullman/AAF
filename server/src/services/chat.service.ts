import { MessageType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { resolveWorldChatChannelForUser } from "./world-chat-channel.service";

export type GlobalMessagePayload = {
  id: string;
  worldId?: string;
  channelKey?: string;
  sceneId?: string;
  content: string;
  metadata?: unknown;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export function extractSceneIdFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const candidate = (metadata as { sceneId?: unknown }).sceneId;
  return typeof candidate === "string" && candidate ? candidate : undefined;
}

export function filterMessagesByScene(messages: GlobalMessagePayload[], sceneId?: string, limit = 30): GlobalMessagePayload[] {
  const normalizedSceneId = sceneId?.trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  if (!normalizedSceneId) {
    return messages.slice(-safeLimit);
  }

  return messages.filter((item) => item.sceneId === normalizedSceneId).slice(-safeLimit);
}

async function assertSceneInWorld(worldId: string, sceneId: string) {
  const exists = await prisma.scene.findFirst({
    where: {
      id: sceneId,
      worldId
    },
    select: { id: true }
  });

  if (!exists) {
    throw new Error("scene not found in world");
  }
}

const GLOBAL_CHAT_CHANNELS = new Set(["LOBBY", "SYSTEM", "PRIVATE"]);

function normalizeGlobalChatChannel(channelKey?: string): string {
  const normalized = (channelKey ?? "LOBBY").toUpperCase().trim();
  if (!GLOBAL_CHAT_CHANNELS.has(normalized)) {
    throw new Error("invalid global chat channel");
  }
  return normalized;
}

export function canSendWorldChannel(worldRole: string | undefined, channelKey: string): boolean {
  const normalized = (channelKey ?? "CHAT").toUpperCase().trim();
  if (normalized === "SYSTEM") {
    return worldRole === "GM";
  }

  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskSensitiveWords(content: string, blockedWords: string[]): string {
  return blockedWords.reduce((acc, word) => {
    const safeWord = word.trim();
    if (!safeWord) {
      return acc;
    }

    const pattern = new RegExp(escapeRegExp(safeWord), "gi");
    return acc.replace(pattern, "*".repeat(safeWord.length));
  }, content);
}

export function sanitizeChatContent(content: string): string {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  const escaped = normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return maskSensitiveWords(escaped, env.chatBlockedWords);
}

export async function createGlobalMessage(fromUserId: string, content: string, channelKey?: string): Promise<GlobalMessagePayload> {
  const normalized = sanitizeChatContent(content);
  if (!normalized) {
    throw new Error("message content is required");
  }
  if (normalized.length > 1000) {
    throw new Error("message content is too long");
  }
  const normalizedChannel = normalizeGlobalChatChannel(channelKey);
  if (normalizedChannel !== "LOBBY") {
    throw new Error("global channel permission denied");
  }

  const created = await prisma.message.create({
    data: {
      type: MessageType.GLOBAL,
      channelKey: normalizedChannel,
      fromUserId,
      content: normalized
    },
    include: {
      fromUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    }
  });

  return {
    id: created.id,
    worldId: created.worldId ?? undefined,
    channelKey: created.channelKey ?? undefined,
    sceneId: extractSceneIdFromMetadata(created.metadata),
    content: created.content,
    metadata: created.metadata ?? undefined,
    createdAt: created.createdAt.toISOString(),
    fromUser: created.fromUser
  };
}

export async function listRecentGlobalMessages(userId: string, limit = 30): Promise<GlobalMessagePayload[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { type: MessageType.GLOBAL },
        { type: MessageType.SYSTEM, toUserId: userId }
      ]
    },
    include: {
      fromUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit
  });

  return rows
    .reverse()
    .map((item) => ({
      id: item.id,
      worldId: item.worldId ?? undefined,
      channelKey: item.channelKey ?? (item.type === MessageType.SYSTEM ? "SYSTEM" : "LOBBY"),
      sceneId: extractSceneIdFromMetadata(item.metadata),
      content: item.content,
      metadata: item.metadata ?? undefined,
      createdAt: item.createdAt.toISOString(),
      fromUser: item.fromUser
    }));
}

export async function createWorldMessage(
  fromUserId: string,
  worldId: string,
  content: string,
  channelKey?: string,
  sceneId?: string
): Promise<GlobalMessagePayload> {
  const normalized = sanitizeChatContent(content);
  if (!normalized) {
    throw new Error("message content is required");
  }
  if (normalized.length > 1000) {
    throw new Error("message content is too long");
  }
  const normalizedChannel = await resolveWorldChatChannelForUser(worldId, fromUserId, channelKey ?? "CHAT");

  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId: fromUserId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
  if (!canSendWorldChannel(membership.role, normalizedChannel)) {
    throw new Error("channel permission denied");
  }

  const normalizedSceneId = sceneId?.trim();
  if (normalizedSceneId) {
    await assertSceneInWorld(worldId, normalizedSceneId);
  }

  const created = await prisma.message.create({
    data: {
      type: MessageType.WORLD,
      worldId,
      channelKey: normalizedChannel,
      fromUserId,
      content: normalized,
      metadata: normalizedSceneId ? { sceneId: normalizedSceneId } : undefined
    },
    include: {
      fromUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    }
  });

  return {
    id: created.id,
    worldId: created.worldId ?? undefined,
    channelKey: created.channelKey ?? undefined,
    sceneId: extractSceneIdFromMetadata(created.metadata),
    content: created.content,
    metadata: created.metadata ?? undefined,
    createdAt: created.createdAt.toISOString(),
    fromUser: created.fromUser
  };
}

export async function listRecentWorldMessages(
  worldId: string,
  userId: string,
  limit = 30,
  channelKey?: string,
  sceneId?: string
): Promise<GlobalMessagePayload[]> {
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

  const normalizedChannel = await resolveWorldChatChannelForUser(worldId, userId, channelKey ?? "CHAT");
  const normalizedSceneId = sceneId?.trim();
  if (normalizedSceneId) {
    await assertSceneInWorld(worldId, normalizedSceneId);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const queryTake = normalizedSceneId ? Math.min(Math.max(safeLimit * 5, 100), 500) : safeLimit;
  const rows = await prisma.message.findMany({
    where: {
      type: MessageType.WORLD,
      worldId,
      channelKey: normalizedChannel
    },
    include: {
      fromUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: queryTake
  });

  const mapped = rows
    .reverse()
    .map((item) => ({
      id: item.id,
      worldId: item.worldId ?? undefined,
      channelKey: item.channelKey ?? undefined,
      sceneId: extractSceneIdFromMetadata(item.metadata),
      content: item.content,
      metadata: item.metadata ?? undefined,
      createdAt: item.createdAt.toISOString(),
      fromUser: item.fromUser
    }));

  return filterMessagesByScene(mapped, normalizedSceneId, safeLimit);
}

export async function getWorldMessageById(worldId: string, userId: string, messageId: string): Promise<GlobalMessagePayload> {
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

  const row = await prisma.message.findFirst({
    where: {
      id: messageId,
      type: MessageType.WORLD,
      worldId
    },
    include: {
      fromUser: {
        select: {
          id: true,
          username: true,
          displayName: true
        }
      }
    }
  });

  if (!row) {
    throw new Error("world message not found");
  }

  return {
    id: row.id,
    worldId: row.worldId ?? undefined,
    channelKey: row.channelKey ?? undefined,
    sceneId: extractSceneIdFromMetadata(row.metadata),
    content: row.content,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt.toISOString(),
    fromUser: row.fromUser
  };
}
