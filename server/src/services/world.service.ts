import { PlatformRole, WorldRole, WorldVisibility } from "@prisma/client";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

type CreateWorldInput = {
  ownerId: string;
  name: string;
  description?: string;
  visibility: WorldVisibility;
  password?: string;
  coverImageDataUrl?: string;
};

const COVER_FILE_PREFIX = "cover.";

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

function extToMime(ext: string) {
  const normalized = ext.toLowerCase();
  if (normalized === "png") {
    return "image/png";
  }
  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }
  if (normalized === "webp") {
    return "image/webp";
  }
  if (normalized === "gif") {
    return "image/gif";
  }
  return null;
}

function mimeToExt(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/jpeg") {
    return "jpg";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }
  return null;
}

function parseCoverDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("invalid cover image format");
  }

  const mime = match[1];
  const ext = mimeToExt(mime);
  if (!ext) {
    throw new Error("unsupported cover image type");
  }

  const buffer = Buffer.from(match[2], "base64");
  return { ext, buffer };
}

async function saveWorldCover(worldId: string, coverImageDataUrl: string) {
  const { ext, buffer } = parseCoverDataUrl(coverImageDataUrl);
  const worldSaveDir = resolveWorldSaveDir(worldId);
  await fsp.mkdir(worldSaveDir, { recursive: true });

  const currentFiles = await fsp.readdir(worldSaveDir).catch(() => [] as string[]);
  await Promise.all(
    currentFiles
      .filter((fileName) => fileName.startsWith(COVER_FILE_PREFIX))
      .map((fileName) => fsp.rm(path.join(worldSaveDir, fileName), { force: true }))
  );

  const filePath = path.join(worldSaveDir, `${COVER_FILE_PREFIX}${ext}`);
  await fsp.writeFile(filePath, buffer);
}

async function loadWorldCoverDataUrl(worldId: string) {
  const worldSaveDir = resolveWorldSaveDir(worldId);
  const files = await fsp.readdir(worldSaveDir).catch(() => [] as string[]);
  const coverFile = files.find((fileName) => fileName.startsWith(COVER_FILE_PREFIX));
  if (!coverFile) {
    return null;
  }

  const ext = coverFile.slice(COVER_FILE_PREFIX.length);
  const mime = extToMime(ext);
  if (!mime) {
    return null;
  }

  const buffer = await fsp.readFile(path.join(worldSaveDir, coverFile)).catch(() => null);
  if (!buffer) {
    return null;
  }

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function removeWorldSaveDir(worldId: string) {
  const worldSaveDir = resolveWorldSaveDir(worldId);
  await fsp.rm(worldSaveDir, { recursive: true, force: true });
}

export async function createWorld(input: CreateWorldInput) {
  const worldName = input.name?.trim();
  if (!worldName) {
    throw new Error("world name is required");
  }

  let passwordHash: string | null = null;
  let inviteCode: string | null = null;
  if (input.visibility === WorldVisibility.PASSWORD) {
    inviteCode = await createUniqueInviteCode();
  }

  const created = await prisma.$transaction(async (tx) => {
    const world = await tx.world.create({
      data: {
        name: worldName,
        description: input.description?.trim() || null,
        ownerId: input.ownerId,
        visibility: input.visibility,
        passwordHash,
        inviteCode
      }
    });

    if (input.coverImageDataUrl) {
      await saveWorldCover(world.id, input.coverImageDataUrl);
    }

    await tx.worldMember.create({
      data: {
        worldId: world.id,
        userId: input.ownerId,
        role: WorldRole.GM
      }
    });

    await tx.scene.create({
      data: {
        worldId: world.id,
        name: "默认场景",
        sortOrder: 0
      }
    });

    return world;
  });

  return {
    ...created,
    coverImageDataUrl: await loadWorldCoverDataUrl(created.id)
  };
}

export async function listPublicWorlds() {
  return listVisibleWorlds("", undefined, "createdAt", "desc", false);
}

export async function listVisibleWorlds(
  userId: string,
  visibility?: WorldVisibility,
  sortBy: "createdAt" | "activeMembers" = "createdAt",
  order: "asc" | "desc" = "desc",
  enforceAccess = true
) {
  const currentUser = userId
    ? await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true }
    })
    : null;

  const isPlatformAdmin =
    currentUser?.platformRole === PlatformRole.MASTER || currentUser?.platformRole === PlatformRole.ADMIN;

  let friendOwnerIds: string[] = [];
  if (userId) {
    const accepted = await prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }]
      },
      select: {
        requesterId: true,
        addresseeId: true
      }
    });

    friendOwnerIds = accepted
      .map((item) => (item.requesterId === userId ? item.addresseeId : item.requesterId))
      .filter(Boolean);
  }

  const where = enforceAccess
    ? {
      OR: [
        { visibility: { in: [WorldVisibility.PUBLIC, WorldVisibility.PASSWORD] } },
        ...(userId ? [{ ownerId: userId }] : []),
        ...(friendOwnerIds.length > 0 ? [{ visibility: WorldVisibility.FRIENDS, ownerId: { in: friendOwnerIds } }] : []),
        ...(isPlatformAdmin ? [{}] : [])
      ]
    }
    : {};

  const worlds = await prisma.world.findMany({
    where: {
      ...where,
      ...(visibility ? { visibility } : {})
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          platformRole: true
        }
      },
      _count: {
        select: {
          members: true,
          scenes: true
        }
      }
    },
    orderBy: {
      createdAt: order
    }
  });

  const activeThreshold = new Date(Date.now() - 1000 * 60 * 15);
  const activeRows = await prisma.worldMember.groupBy({
    by: ["worldId"],
    where: {
      worldId: { in: worlds.map((item) => item.id) },
      status: "ACTIVE",
      updatedAt: { gte: activeThreshold }
    },
    _count: {
      worldId: true
    }
  });

  const activeCountMap = new Map(activeRows.map((item) => [item.worldId, item._count.worldId]));

  const mapped = worlds.map((item) => ({
    ...item,
    activeMemberCount: activeCountMap.get(item.id) ?? 0
  }));

  if (sortBy === "activeMembers") {
    mapped.sort((left, right) => {
      const delta = (left.activeMemberCount ?? 0) - (right.activeMemberCount ?? 0);
      return order === "asc" ? delta : -delta;
    });
  }

  return Promise.all(
    mapped.map(async (item) => ({
      ...item,
      coverImageDataUrl: await loadWorldCoverDataUrl(item.id)
    }))
  );
}

export async function listMyWorlds(userId: string) {
  const memberships = await prisma.worldMember.findMany({
    where: {
      userId,
      status: "ACTIVE"
    },
    include: {
      world: {
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
              platformRole: true
            }
          },
          _count: {
            select: {
              members: true,
              scenes: true
            }
          }
        }
      }
    },
    orderBy: {
      joinedAt: "desc"
    }
  });

  const mapped = memberships.map((item) => ({
    ...item.world,
    myRole: item.role
  }));

  const activeThreshold = new Date(Date.now() - 1000 * 60 * 15);
  const activeRows = await prisma.worldMember.groupBy({
    by: ["worldId"],
    where: {
      worldId: { in: mapped.map((item) => item.id) },
      status: "ACTIVE",
      updatedAt: { gte: activeThreshold }
    },
    _count: {
      worldId: true
    }
  });
  const activeCountMap = new Map(activeRows.map((item) => [item.worldId, item._count.worldId]));

  const withActiveCount = mapped.map((item) => ({
    ...item,
    activeMemberCount: activeCountMap.get(item.id) ?? 0
  }));

  return Promise.all(
    withActiveCount.map(async (item) => ({
      ...item,
      coverImageDataUrl: await loadWorldCoverDataUrl(item.id)
    }))
  );
}

export async function joinWorld(worldId: string, userId: string, inviteCode?: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId }
  });

  if (!world) {
    throw new Error("world not found");
  }

  const existing = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      await prisma.worldMember.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE"
        }
      });
    }

    return {
      worldId,
      userId,
      role: existing.role
    };
  }

  if (world.visibility === WorldVisibility.PRIVATE || world.visibility === WorldVisibility.FRIENDS) {
    throw new Error("this world is not open for direct join yet");
  }

  if (world.visibility === WorldVisibility.PASSWORD) {
    const rawInviteCode = inviteCode?.trim() ?? "";
    if (!world.inviteCode || !rawInviteCode) {
      throw new Error("invite code is required");
    }
    if (rawInviteCode !== world.inviteCode) {
      throw new Error("invalid invite code");
    }
  }

  const created = await prisma.worldMember.create({
    data: {
      worldId,
      userId,
      role: WorldRole.PLAYER,
      status: "ACTIVE"
    }
  });

  return {
    worldId: created.worldId,
    userId: created.userId,
    role: created.role
  };
}

export async function getWorldDetail(worldId: string, userId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          platformRole: true
        }
      },
      _count: {
        select: {
          members: true,
          scenes: true
        }
      }
    }
  });

  if (!world) {
    throw new Error("world not found");
  }

  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  const isOwner = world.ownerId === userId;
  const canView =
    world.visibility === WorldVisibility.PUBLIC ||
    world.visibility === WorldVisibility.PASSWORD ||
    isOwner ||
    !!membership;

  if (!canView) {
    throw new Error("forbidden");
  }

  return {
    ...world,
    coverImageDataUrl: await loadWorldCoverDataUrl(world.id),
    myRole: membership?.role ?? (isOwner ? WorldRole.GM : null),
    canJoin: !membership && world.visibility !== WorldVisibility.PRIVATE && world.visibility !== WorldVisibility.FRIENDS
  };
}

export function getAvailableCreateVisibilities(platformRole: PlatformRole) {
  if (platformRole === PlatformRole.MASTER || platformRole === PlatformRole.ADMIN) {
    return ["PUBLIC", "PASSWORD", "FRIENDS", "PRIVATE"];
  }

  return ["PUBLIC", "PASSWORD", "FRIENDS", "PRIVATE"];
}

export async function deleteWorld(worldId: string, userId: string) {
  const [world, actor, membership] = await Promise.all([
    prisma.world.findUnique({ where: { id: worldId }, select: { id: true, ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } }),
    prisma.worldMember.findUnique({
      where: { worldId_userId: { worldId, userId } },
      select: { role: true }
    })
  ]);

  if (!world) {
    throw new Error("world not found");
  }

  const isPlatformAdmin = actor?.platformRole === PlatformRole.MASTER || actor?.platformRole === PlatformRole.ADMIN;
  const isWorldGm = membership?.role === WorldRole.GM;
  const canDelete = world.ownerId === userId || isPlatformAdmin || isWorldGm;
  if (!canDelete) {
    throw new Error("forbidden");
  }

  await prisma.$transaction(async (tx) => {
    await tx.storyEvent.deleteMany({ where: { worldId } });
    await tx.aiSession.deleteMany({ where: { worldId } });
    await tx.message.deleteMany({ where: { worldId } });
    await tx.character.deleteMany({ where: { worldId } });
    await tx.scene.deleteMany({ where: { worldId } });
    await tx.worldMember.deleteMany({ where: { worldId } });
    await tx.world.delete({ where: { id: worldId } });
  });

  await removeWorldSaveDir(worldId);

  return { worldId };
}

async function createUniqueInviteCode() {
  for (let i = 0; i < 10; i += 1) {
    const candidate = randomInviteCode();
    const exists = await prisma.world.findUnique({ where: { inviteCode: candidate }, select: { id: true } });
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("failed to generate invite code");
}

function randomInviteCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}
