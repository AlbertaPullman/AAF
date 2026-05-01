import { CharacterType, Prisma, WorldRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveFolderAssignment } from "./folder.service";

type CreateCharacterInput = {
  worldId: string;
  requesterId: string;
  name: string;
  type?: CharacterType;
  userId?: string | null;
  folderId?: string | null;
  sortOrder?: number;
};

type UpdateCharacterInput = {
  worldId: string;
  characterId: string;
  requesterId: string;
  name?: string;
  stats?: unknown;
  snapshot?: unknown;
  folderId?: string | null;
  sortOrder?: number;
  permissionMode?: string;
};

const characterSelect = {
  id: true,
  worldId: true,
  userId: true,
  name: true,
  type: true,
  avatarUrl: true,
  folderId: true,
  sortOrder: true,
  permissionMode: true,
  stats: true,
  snapshot: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    select: characterSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
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

  const folderData = input.folderId !== undefined
    ? await resolveFolderAssignment(input.worldId, "CHARACTER", input.folderId)
    : { folderId: null };

  if (membership.role !== WorldRole.GM) {

    return prisma.character.create({
      data: {
        worldId: input.worldId,
        userId: input.requesterId,
        name: normalizedName,
        type,
        folderId: folderData.folderId,
        sortOrder: input.sortOrder ?? 0,
      },
      select: characterSelect
    });
  }

  return prisma.character.create({
    data: {
      worldId: input.worldId,
      userId: input.userId ?? null,
      name: normalizedName,
      type,
      folderId: folderData.folderId,
      sortOrder: input.sortOrder ?? 0,
    },
    select: characterSelect
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
    folderId?: string | null;
    sortOrder?: number;
    permissionMode?: string;
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
  if (typeof input.folderId !== "undefined") {
    const folderData = await resolveFolderAssignment(input.worldId, "CHARACTER", input.folderId);
    data.folderId = folderData.folderId;
  }
  if (typeof input.sortOrder !== "undefined") {
    data.sortOrder = Number(input.sortOrder);
  }
  if (typeof input.permissionMode !== "undefined") {
    data.permissionMode = input.permissionMode;
  }

  return prisma.character.update({
    where: { id: input.characterId },
    data,
    select: characterSelect
  });
}

export async function reorderCharacters(input: {
  worldId: string;
  requesterId: string;
  folderId?: string | null;
  orderedIds: string[];
}) {
  const membership = await getMembership(input.worldId, input.requesterId);
  if (!membership || membership.status !== "ACTIVE") throw new Error("not a member of world");
  if (membership.role !== WorldRole.GM) throw new Error("permission denied");

  const folderData = input.folderId !== undefined
    ? await resolveFolderAssignment(input.worldId, "CHARACTER", input.folderId)
    : { folderId: null };
  const orderedIds = Array.from(new Set(input.orderedIds.map((item) => String(item ?? "").trim()).filter(Boolean)));
  if (orderedIds.length === 0) throw new Error("orderedIds is required");

  const siblings = await prisma.character.findMany({
    where: { worldId: input.worldId, folderId: folderData.folderId },
    select: { id: true },
  });
  const siblingIds = new Set(siblings.map((item) => item.id));
  for (const id of orderedIds) {
    if (!siblingIds.has(id)) throw new Error("character reorder contains non-sibling character");
  }

  await prisma.$transaction(orderedIds.map((id, index) => prisma.character.update({ where: { id }, data: { sortOrder: index } })));
  return listCharacters(input.worldId, input.requesterId);
}
