import { CharacterType, Prisma, WorldRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

type CreateCharacterInput = {
  worldId: string;
  requesterId: string;
  name: string;
  type?: CharacterType;
  userId?: string | null;
};

type UpdateCharacterInput = {
  worldId: string;
  characterId: string;
  requesterId: string;
  name?: string;
  stats?: unknown;
  snapshot?: unknown;
};

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

export function canCreateCharacterByRole(worldRole: WorldRole, characterType: CharacterType): boolean {
  if (worldRole === WorldRole.GM) {
    return true;
  }

  return characterType === CharacterType.PC;
}

export function canEditCharacterByRole(worldRole: WorldRole, characterOwnerUserId: string | null, requesterId: string): boolean {
  if (worldRole === WorldRole.GM) {
    return true;
  }

  return characterOwnerUserId === requesterId;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function listCharacters(worldId: string, requesterId: string) {
  const membership = await getMembership(worldId, requesterId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  return prisma.character.findMany({
    where: { worldId },
    select: {
      id: true,
      worldId: true,
      userId: true,
      name: true,
      type: true,
      avatarUrl: true,
      stats: true,
      snapshot: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function createCharacter(input: CreateCharacterInput) {
  const membership = await getMembership(input.worldId, input.requesterId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("character name is required");
  }

  const type = input.type ?? CharacterType.PC;

  if (!canCreateCharacterByRole(membership.role, type)) {
    throw new Error("only gm can create npc");
  }

  if (membership.role !== WorldRole.GM) {

    return prisma.character.create({
      data: {
        worldId: input.worldId,
        userId: input.requesterId,
        name: normalizedName,
        type
      },
      select: {
        id: true,
        worldId: true,
        userId: true,
        name: true,
        type: true,
        avatarUrl: true,
        stats: true,
        snapshot: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  return prisma.character.create({
    data: {
      worldId: input.worldId,
      userId: input.userId ?? null,
      name: normalizedName,
      type
    },
    select: {
      id: true,
      worldId: true,
      userId: true,
      name: true,
      type: true,
      avatarUrl: true,
      stats: true,
      snapshot: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function updateCharacter(input: UpdateCharacterInput) {
  const membership = await getMembership(input.worldId, input.requesterId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }

  const existing = await prisma.character.findUnique({
    where: { id: input.characterId },
    select: {
      id: true,
      worldId: true,
      userId: true
    }
  });

  if (!existing || existing.worldId !== input.worldId) {
    throw new Error("character not found");
  }

  if (!canEditCharacterByRole(membership.role, existing.userId, input.requesterId)) {
    throw new Error("permission denied for character");
  }

  const data: {
    name?: string;
    stats?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    snapshot?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  } = {};

  if (typeof input.name === "string") {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new Error("character name is required");
    }
    data.name = normalizedName;
  }

  if (typeof input.stats !== "undefined") {
    data.stats = toPrismaJson(input.stats);
  }
  if (typeof input.snapshot !== "undefined") {
    data.snapshot = toPrismaJson(input.snapshot);
  }

  return prisma.character.update({
    where: { id: input.characterId },
    data,
    select: {
      id: true,
      worldId: true,
      userId: true,
      name: true,
      type: true,
      avatarUrl: true,
      stats: true,
      snapshot: true,
      createdAt: true,
      updatedAt: true
    }
  });
}
