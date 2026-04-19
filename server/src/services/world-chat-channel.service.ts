import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { PlatformRole, WorldRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type WorldChatChannelAccess = "ALL" | "MEMBERS";

export type WorldChatChannelItem = {
  key: string;
  name: string;
  access: WorldChatChannelAccess;
  isDefault: boolean;
  memberUserIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type WorldChatChannelMember = {
  userId: string;
  username: string;
  displayName: string | null;
  worldDisplayName: string | null;
  boundCharacterName: string | null;
  worldRole: WorldRole;
};

type WorldChatChannelStore = {
  channels: WorldChatChannelItem[];
};

const CHANNEL_FILE_NAME = "chat-channels.json";

function resolveDataSqliteDir() {
  const candidates = [
    path.resolve(process.cwd(), "data/sqlite"),
    path.resolve(process.cwd(), "../data/sqlite")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveWorldSaveDir(worldId: string) {
  return path.join(resolveDataSqliteDir(), "worlds", worldId);
}

function resolveChannelFilePath(worldId: string) {
  return path.join(resolveWorldSaveDir(worldId), CHANNEL_FILE_NAME);
}

function nowIso() {
  return new Date().toISOString();
}

function createDefaultChannels(ownerId: string): WorldChatChannelItem[] {
  const now = nowIso();
  return [
    {
      key: "CHAT",
      name: "聊天频道",
      access: "ALL",
      isDefault: true,
      memberUserIds: [],
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now
    },
    {
      key: "BATTLE",
      name: "战斗信息频道",
      access: "ALL",
      isDefault: true,
      memberUserIds: [],
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function normalizeStore(raw: unknown, ownerId: string): WorldChatChannelStore {
  if (!raw || typeof raw !== "object") {
    return { channels: createDefaultChannels(ownerId) };
  }

  const source = (raw as { channels?: unknown }).channels;
  if (!Array.isArray(source)) {
    return { channels: createDefaultChannels(ownerId) };
  }

  const mapped = source
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<WorldChatChannelItem>;
      const key = typeof row.key === "string" ? row.key.toUpperCase().trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const access = row.access === "MEMBERS" ? "MEMBERS" : "ALL";

      if (!key || !name) {
        return null;
      }

      return {
        key,
        name,
        access,
        isDefault: !!row.isDefault,
        memberUserIds: Array.isArray(row.memberUserIds)
          ? row.memberUserIds.filter((id): id is string => typeof id === "string" && !!id)
          : [],
        createdBy: typeof row.createdBy === "string" && row.createdBy ? row.createdBy : ownerId,
        createdAt: typeof row.createdAt === "string" && row.createdAt ? row.createdAt : nowIso(),
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : nowIso()
      } as WorldChatChannelItem;
    })
    .filter((item): item is WorldChatChannelItem => !!item);

  const dedup = new Map<string, WorldChatChannelItem>();
  for (const item of mapped) {
    dedup.set(item.key, item);
  }

  if (!dedup.has("CHAT") || !dedup.has("BATTLE")) {
    for (const channel of createDefaultChannels(ownerId)) {
      if (!dedup.has(channel.key)) {
        dedup.set(channel.key, channel);
      }
    }
  }

  return { channels: Array.from(dedup.values()) };
}

async function readStore(worldId: string, ownerId: string): Promise<WorldChatChannelStore> {
  const filePath = resolveChannelFilePath(worldId);
  const raw = await fsp.readFile(filePath, "utf8").catch(() => "");
  if (!raw) {
    const initial = { channels: createDefaultChannels(ownerId) };
    await writeStore(worldId, initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed, ownerId);
    await writeStore(worldId, normalized);
    return normalized;
  } catch {
    const fallback = { channels: createDefaultChannels(ownerId) };
    await writeStore(worldId, fallback);
    return fallback;
  }
}

async function writeStore(worldId: string, store: WorldChatChannelStore) {
  const worldDir = resolveWorldSaveDir(worldId);
  await fsp.mkdir(worldDir, { recursive: true });
  const filePath = resolveChannelFilePath(worldId);
  await fsp.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

async function getWorldAndMembership(worldId: string, userId: string) {
  const [world, membership, actor] = await Promise.all([
    prisma.world.findUnique({ where: { id: worldId }, select: { id: true, ownerId: true } }),
    prisma.worldMember.findUnique({
      where: { worldId_userId: { worldId, userId } },
      select: { role: true, status: true }
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } })
  ]);

  if (!world) {
    throw new Error("world not found");
  }
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  const isPlatformAdmin = actor?.platformRole === PlatformRole.MASTER || actor?.platformRole === PlatformRole.ADMIN;
  const canManageChannels = membership.role === WorldRole.GM || isPlatformAdmin;

  return { world, membership, canManageChannels };
}

function canUserAccessChannel(channel: WorldChatChannelItem, userId: string) {
  if (channel.access === "ALL") {
    return true;
  }
  return channel.memberUserIds.includes(userId);
}

function createChannelKey(name: string, existingKeys: Set<string>) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\u4E00-\u9FA5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  const prefix = base || "CHANNEL";
  let candidate = prefix;
  let index = 2;
  while (existingKeys.has(candidate)) {
    candidate = `${prefix}_${index}`.slice(0, 32);
    index += 1;
  }

  return candidate;
}

async function listWorldActiveMembers(worldId: string): Promise<WorldChatChannelMember[]> {
  const rows = await prisma.worldMember.findMany({
    where: { worldId, status: "ACTIVE" },
    select: {
      userId: true,
      role: true,
      displayName: true,
      user: {
        select: {
          username: true,
          displayName: true
        }
      }
    },
    orderBy: { joinedAt: "asc" }
  });

  const memberUserIds = rows.map((item) => item.userId);
  const characterRows = memberUserIds.length
    ? await prisma.character.findMany({
      where: {
        worldId,
        userId: { in: memberUserIds }
      },
      select: {
        userId: true,
        name: true,
        type: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" }
    })
    : [];

  const boundCharacterByUserId = new Map<string, { name: string; type: "PC" | "NPC" }>();
  for (const row of characterRows) {
    const userId = row.userId?.trim();
    if (!userId) {
      continue;
    }

    const current = boundCharacterByUserId.get(userId);
    if (!current || (current.type === "NPC" && row.type === "PC")) {
      boundCharacterByUserId.set(userId, {
        name: row.name,
        type: row.type
      });
    }
  }

  return rows.map((item) => ({
    userId: item.userId,
    username: item.user.username,
    displayName: item.user.displayName,
    worldDisplayName: item.displayName,
    boundCharacterName: boundCharacterByUserId.get(item.userId)?.name ?? null,
    worldRole: item.role
  }));
}

export async function listWorldChatChannels(worldId: string, userId: string) {
  const { world, canManageChannels } = await getWorldAndMembership(worldId, userId);
  const store = await readStore(worldId, world.ownerId);
  const visibleChannels = store.channels.filter((item) => canUserAccessChannel(item, userId));
  const members = await listWorldActiveMembers(worldId);

  return {
    channels: visibleChannels,
    members,
    canManageChannels
  };
}

export async function createWorldChatChannel(worldId: string, actorId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("channel name is required");
  }
  if (trimmed.length > 40) {
    throw new Error("channel name too long");
  }

  const { world, canManageChannels } = await getWorldAndMembership(worldId, actorId);
  if (!canManageChannels) {
    throw new Error("forbidden");
  }

  const store = await readStore(worldId, world.ownerId);
  const key = createChannelKey(trimmed, new Set(store.channels.map((item) => item.key)));
  const now = nowIso();

  const channel: WorldChatChannelItem = {
    key,
    name: trimmed,
    access: "MEMBERS",
    isDefault: false,
    memberUserIds: [actorId],
    createdBy: actorId,
    createdAt: now,
    updatedAt: now
  };

  store.channels.push(channel);
  await writeStore(worldId, store);
  return channel;
}

export async function inviteWorldChatChannelMember(worldId: string, actorId: string, channelKey: string, targetUserId: string) {
  const normalizedKey = channelKey.toUpperCase().trim();
  if (!normalizedKey) {
    throw new Error("channel key is required");
  }

  const { world, canManageChannels } = await getWorldAndMembership(worldId, actorId);
  if (!canManageChannels) {
    throw new Error("forbidden");
  }

  const targetMembership = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId: targetUserId } },
    select: { status: true }
  });
  if (!targetMembership || targetMembership.status !== "ACTIVE") {
    throw new Error("target user is not an active world member");
  }

  const store = await readStore(worldId, world.ownerId);
  const index = store.channels.findIndex((item) => item.key === normalizedKey);
  if (index < 0) {
    throw new Error("channel not found");
  }

  const channel = store.channels[index];
  if (channel.access === "ALL") {
    return channel;
  }

  if (!channel.memberUserIds.includes(targetUserId)) {
    channel.memberUserIds.push(targetUserId);
    channel.updatedAt = nowIso();
    store.channels[index] = channel;
    await writeStore(worldId, store);
  }

  return channel;
}

export async function resolveWorldChatChannelForUser(worldId: string, userId: string, channelKey?: string) {
  const requested = (channelKey ?? "CHAT").toUpperCase().trim();
  const { world } = await getWorldAndMembership(worldId, userId);
  const store = await readStore(worldId, world.ownerId);

  const legacyChannels = new Set(["OOC", "IC", "SYSTEM"]);
  if (legacyChannels.has(requested)) {
    return requested;
  }

  const channel = store.channels.find((item) => item.key === requested);
  if (!channel) {
    throw new Error("invalid world chat channel");
  }
  if (!canUserAccessChannel(channel, userId)) {
    throw new Error("channel permission denied");
  }

  return channel.key;
}
