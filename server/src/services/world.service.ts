import bcrypt from "bcrypt";
import { PlatformRole, WorldRole, WorldVisibility } from "@prisma/client";
import { prisma } from "../lib/prisma";

type CreateWorldInput = {
  ownerId: string;
  name: string;
  description?: string;
  visibility: WorldVisibility;
  password?: string;
};

export async function createWorld(input: CreateWorldInput) {
  const worldName = input.name?.trim();
  if (!worldName) {
    throw new Error("world name is required");
  }

  let passwordHash: string | null = null;
  if (input.visibility === WorldVisibility.PASSWORD) {
    const rawPassword = input.password?.trim() ?? "";
    if (rawPassword.length < 4) {
      throw new Error("password world requires password length >= 4");
    }
    const salt = await bcrypt.genSalt(10);
    passwordHash = await bcrypt.hash(rawPassword, salt);
  }

  const created = await prisma.$transaction(async (tx) => {
    const world = await tx.world.create({
      data: {
        name: worldName,
        description: input.description?.trim() || null,
        ownerId: input.ownerId,
        visibility: input.visibility,
        passwordHash
      }
    });

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

  return created;
}

export async function listPublicWorlds() {
  const worlds = await prisma.world.findMany({
    where: {
      visibility: {
        in: [WorldVisibility.PUBLIC, WorldVisibility.PASSWORD]
      }
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
      createdAt: "desc"
    }
  });

  return worlds;
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

  return memberships.map((item) => ({
    ...item.world,
    myRole: item.role
  }));
}

export async function joinWorld(worldId: string, userId: string, password?: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId }
  });

  if (!world) {
    throw new Error("world not found");
  }

  if (world.visibility === WorldVisibility.PRIVATE || world.visibility === WorldVisibility.FRIENDS) {
    throw new Error("this world is not open for direct join yet");
  }

  if (world.visibility === WorldVisibility.PASSWORD) {
    const rawPassword = password?.trim() ?? "";
    if (!world.passwordHash || !rawPassword) {
      throw new Error("password is required");
    }
    const ok = await bcrypt.compare(rawPassword, world.passwordHash);
    if (!ok) {
      throw new Error("invalid world password");
    }
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
    myRole: membership?.role ?? (isOwner ? WorldRole.GM : null),
    canJoin: !membership && world.visibility !== WorldVisibility.PRIVATE && world.visibility !== WorldVisibility.FRIENDS
  };
}

export function getAvailableCreateVisibilities(platformRole: PlatformRole) {
  if (platformRole === PlatformRole.MASTER || platformRole === PlatformRole.ADMIN) {
    return ["PUBLIC", "PASSWORD", "FRIENDS", "PRIVATE"];
  }

  return ["PUBLIC", "PASSWORD"];
}
