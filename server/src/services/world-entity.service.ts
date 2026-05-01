import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { FolderType } from "../../../shared/types/world-entities";
import { resolveFolderAssignment } from "./folder.service";
import {
  normalizeResourceIconUrl,
  readResourceIconPackAsset,
  saveResourceIconPackAsset,
  type ResourcePackAsset,
} from "./resource-asset.service";

/* ──── 通用 CRUD 辅助 ──── */

type EntityTable = "abilityDefinition" | "raceDefinition" | "professionDefinition"
  | "backgroundDefinition" | "itemDefinition" | "fateClock"
  | "deckDefinition" | "randomTable";

export type WorldResourceEntityType = "abilities" | "races" | "professions" | "backgrounds" | "items" | "fateClocks" | "decks" | "randomTables";

type SortableDelegate = {
  findMany(args: { where: Record<string, unknown>; select: { id: true } }): Promise<Array<{ id: string }>>;
  update(args: { where: { id: string }; data: { sortOrder: number } }): Promise<unknown>;
};

function asJsonValue(value: unknown, fallback: Prisma.InputJsonValue = []): Prisma.InputJsonValue {
  if (value === undefined || value === null) return fallback;
  return value as Prisma.InputJsonValue;
}

function asNullableJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeActionType(value: unknown) {
  if (value === "move") return "maneuver";
  if (value === "full-round") return "composite";
  return String(value ?? "standard");
}

function normalizeFolderPath(value: unknown) {
  return String(value ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

async function resolveEntityFolderData(
  worldId: string,
  type: FolderType,
  data: Record<string, unknown>,
  mode: "create" | "update",
) {
  if (Object.prototype.hasOwnProperty.call(data, "folderId")) {
    return resolveFolderAssignment(worldId, type, data.folderId);
  }
  if (mode === "create" || Object.prototype.hasOwnProperty.call(data, "folderPath")) {
    return { folderPath: normalizeFolderPath(data.folderPath) };
  }
  return {};
}

function normalizeOrderedIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function buildResourceSortScope(worldId: string, input: { folderId?: unknown; folderPath?: unknown }) {
  const where: Record<string, unknown> = { worldId };
  if (Object.prototype.hasOwnProperty.call(input, "folderId")) {
    const folderId = String(input.folderId ?? "").trim();
    where.folderId = folderId || null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "folderPath")) {
    where.folderPath = normalizeFolderPath(input.folderPath);
  }
  return where;
}

async function reorderSortableRecords(
  delegate: SortableDelegate,
  worldId: string,
  input: { folderId?: unknown; folderPath?: unknown; orderedIds?: unknown },
) {
  const orderedIds = normalizeOrderedIds(input.orderedIds);
  if (orderedIds.length === 0) throw new Error("orderedIds is required");

  const where = buildResourceSortScope(worldId, input);
  const siblings = await delegate.findMany({ where, select: { id: true } });
  const siblingIds = new Set(siblings.map((item) => item.id));
  for (const id of orderedIds) {
    if (!siblingIds.has(id)) throw new Error("resource reorder contains non-sibling resource");
  }

  await Promise.all(orderedIds.map((id, index) => delegate.update({ where: { id }, data: { sortOrder: index } })));
}

export async function ensureWorldGM(worldId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  if (!member || member.role !== "GM") {
    throw new Error("permission denied");
  }
  return member;
}

export async function ensureWorldMember(worldId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  if (!member) throw new Error("not a member of world");
  return member;
}

export async function reorderEntities(
  worldId: string,
  userId: string,
  type: WorldResourceEntityType,
  input: { folderId?: unknown; folderPath?: unknown; orderedIds?: unknown },
) {
  await ensureWorldGM(worldId, userId);
  switch (type) {
    case "abilities":
      await reorderSortableRecords(prisma.abilityDefinition as unknown as SortableDelegate, worldId, input);
      return listAbilities(worldId, userId);
    case "races":
      await reorderSortableRecords(prisma.raceDefinition as unknown as SortableDelegate, worldId, input);
      return listRaces(worldId, userId);
    case "professions":
      await reorderSortableRecords(prisma.professionDefinition as unknown as SortableDelegate, worldId, input);
      return listProfessions(worldId, userId);
    case "backgrounds":
      await reorderSortableRecords(prisma.backgroundDefinition as unknown as SortableDelegate, worldId, input);
      return listBackgrounds(worldId, userId);
    case "items":
      await reorderSortableRecords(prisma.itemDefinition as unknown as SortableDelegate, worldId, input);
      return listItems(worldId, userId);
    case "fateClocks":
      await reorderSortableRecords(prisma.fateClock as unknown as SortableDelegate, worldId, input);
      return listFateClocks(worldId, userId);
    case "decks":
      await reorderSortableRecords(prisma.deckDefinition as unknown as SortableDelegate, worldId, input);
      return listDecks(worldId, userId);
    case "randomTables":
      await reorderSortableRecords(prisma.randomTable as unknown as SortableDelegate, worldId, input);
      return listRandomTables(worldId, userId);
    default:
      throw new Error("unsupported resource type");
  }
}

/* ──── Ability ──── */

export async function listAbilities(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.abilityDefinition.findMany({
    where: { worldId },
    orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { category: "asc" }, { name: "asc" }],
  });
}

export async function getAbility(worldId: string, id: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.abilityDefinition.findFirst({ where: { id, worldId } });
}

export async function createAbility(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const folderData = await resolveEntityFolderData(worldId, "ABILITY", data, "create");
  return prisma.abilityDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      ...folderData,
      category: String(data.category ?? "custom"),
      source: String(data.source ?? "custom"),
      sourceName: String(data.sourceName ?? ""),
      activation: String(data.activation ?? "active"),
      actionType: normalizeActionType(data.actionType),
      description: String(data.description ?? ""),
      rulesText: String(data.rulesText ?? ""),
      iconUrl: data.iconUrl ? String(data.iconUrl) : null,
      tags: asJsonValue(data.tags),
      levelReq: data.levelReq != null ? Number(data.levelReq) : null,
      range: data.range != null ? String(data.range) : null,
      aoeShape: data.aoeShape ? String(data.aoeShape) : null,
      aoeSize: data.aoeSize != null ? Number(data.aoeSize) : null,
      resourceCosts: asJsonValue(data.resourceCosts),
      cooldown: data.cooldown == null ? Prisma.JsonNull : asNullableJsonValue(data.cooldown),
      duration: String(data.duration ?? "instantaneous"),
      durationValue: data.durationValue != null ? Number(data.durationValue) : null,
      concentration: Boolean(data.concentration),
      checkType: data.checkType ? String(data.checkType) : null,
      attackAttr: data.attackAttr ? String(data.attackAttr) : null,
      saveDC: data.saveDC == null ? Prisma.JsonNull : asNullableJsonValue(data.saveDC),
      damageRolls: data.damageRolls == null ? Prisma.JsonNull : asNullableJsonValue(data.damageRolls),
      trigger: data.trigger == null ? Prisma.JsonNull : asNullableJsonValue(data.trigger),
      effects: asJsonValue(data.effects),
      automation: data.automation == null ? Prisma.JsonNull : asNullableJsonValue(data.automation),
      reactionStrat: data.reactionStrat ? String(data.reactionStrat) : null,
      spellLevel: data.spellLevel != null ? Number(data.spellLevel) : null,
      spellSchool: data.spellSchool ? String(data.spellSchool) : null,
      spellComps: data.spellComps == null ? Prisma.JsonNull : asNullableJsonValue(data.spellComps),
      canUpcast: Boolean(data.canUpcast),
      upcastEffect: data.upcastEffect ? String(data.upcastEffect) : null,
      sortOrder: Number(data.sortOrder ?? 0),
      permissionMode: String(data.permissionMode ?? "DEFAULT"),
    },
  });
}

export async function updateAbility(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.abilityDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("ability not found");
  const folderData = await resolveEntityFolderData(worldId, "ABILITY", data, "update");
  return prisma.abilityDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...folderData,
      ...(data.category != null && { category: String(data.category) }),
      ...(data.source != null && { source: String(data.source) }),
      ...(data.sourceName != null && { sourceName: String(data.sourceName) }),
      ...(data.activation != null && { activation: String(data.activation) }),
      ...(data.actionType != null && { actionType: normalizeActionType(data.actionType) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.rulesText != null && { rulesText: String(data.rulesText) }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ? String(data.iconUrl) : null }),
      ...(data.tags != null && { tags: asJsonValue(data.tags) }),
      ...(data.levelReq !== undefined && { levelReq: data.levelReq != null ? Number(data.levelReq) : null }),
      ...(data.range !== undefined && { range: data.range != null ? String(data.range) : null }),
      ...(data.aoeShape !== undefined && { aoeShape: data.aoeShape ? String(data.aoeShape) : null }),
      ...(data.aoeSize !== undefined && { aoeSize: data.aoeSize != null ? Number(data.aoeSize) : null }),
      ...(data.resourceCosts != null && { resourceCosts: asJsonValue(data.resourceCosts) }),
      ...(data.cooldown !== undefined && { cooldown: data.cooldown === null ? Prisma.JsonNull : asNullableJsonValue(data.cooldown) }),
      ...(data.duration != null && { duration: String(data.duration) }),
      ...(data.durationValue !== undefined && { durationValue: data.durationValue != null ? Number(data.durationValue) : null }),
      ...(data.concentration != null && { concentration: Boolean(data.concentration) }),
      ...(data.checkType !== undefined && { checkType: data.checkType ? String(data.checkType) : null }),
      ...(data.attackAttr !== undefined && { attackAttr: data.attackAttr ? String(data.attackAttr) : null }),
      ...(data.saveDC !== undefined && { saveDC: data.saveDC === null ? Prisma.JsonNull : asNullableJsonValue(data.saveDC) }),
      ...(data.damageRolls !== undefined && { damageRolls: data.damageRolls === null ? Prisma.JsonNull : asNullableJsonValue(data.damageRolls) }),
      ...(data.trigger !== undefined && { trigger: data.trigger === null ? Prisma.JsonNull : asNullableJsonValue(data.trigger) }),
      ...(data.effects != null && { effects: asJsonValue(data.effects) }),
      ...(data.automation !== undefined && { automation: data.automation === null ? Prisma.JsonNull : asNullableJsonValue(data.automation) }),
      ...(data.reactionStrat !== undefined && { reactionStrat: data.reactionStrat ? String(data.reactionStrat) : null }),
      ...(data.spellLevel !== undefined && { spellLevel: data.spellLevel != null ? Number(data.spellLevel) : null }),
      ...(data.spellSchool !== undefined && { spellSchool: data.spellSchool ? String(data.spellSchool) : null }),
      ...(data.spellComps !== undefined && { spellComps: data.spellComps === null ? Prisma.JsonNull : asNullableJsonValue(data.spellComps) }),
      ...(data.canUpcast != null && { canUpcast: Boolean(data.canUpcast) }),
      ...(data.upcastEffect !== undefined && { upcastEffect: data.upcastEffect ? String(data.upcastEffect) : null }),
      ...(data.sortOrder != null && { sortOrder: Number(data.sortOrder) }),
      ...(data.permissionMode != null && { permissionMode: String(data.permissionMode) }),
    },
  });
}

export async function deleteAbility(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.abilityDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("ability not found");
  return prisma.abilityDefinition.delete({ where: { id } });
}

/* ──── Race ──── */

export async function listRaces(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.raceDefinition.findMany({ where: { worldId }, orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createRace(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  return prisma.raceDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      loreText: String(data.loreText ?? ""),
      iconUrl: data.iconUrl ? String(data.iconUrl) : null,
      attrBonus: data.attrBonus ?? [],
      size: String(data.size ?? "medium"),
      speed: Number(data.speed ?? 30),
      darkvision: Number(data.darkvision ?? 0),
      creatureType: String(data.creatureType ?? "humanoid"),
      languages: data.languages ?? [],
      ageDesc: String(data.ageDesc ?? ""),
      traits: data.traits ?? [],
      subtypes: data.subtypes ?? [],
      sortOrder: Number(data.sortOrder ?? 0),
    },
  });
}

export async function updateRace(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.raceDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("race not found");
  return prisma.raceDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.loreText != null && { loreText: String(data.loreText) }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ? String(data.iconUrl) : null }),
      ...(data.attrBonus != null && { attrBonus: data.attrBonus }),
      ...(data.size != null && { size: String(data.size) }),
      ...(data.speed != null && { speed: Number(data.speed) }),
      ...(data.darkvision != null && { darkvision: Number(data.darkvision) }),
      ...(data.creatureType != null && { creatureType: String(data.creatureType) }),
      ...(data.languages != null && { languages: data.languages }),
      ...(data.ageDesc != null && { ageDesc: String(data.ageDesc) }),
      ...(data.traits != null && { traits: data.traits }),
      ...(data.subtypes != null && { subtypes: data.subtypes }),
      ...(data.sortOrder != null && { sortOrder: Number(data.sortOrder) }),
    },
  });
}

export async function deleteRace(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.raceDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("race not found");
  return prisma.raceDefinition.delete({ where: { id } });
}

/* ──── Profession ──── */

export async function listProfessions(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.professionDefinition.findMany({ where: { worldId }, orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createProfession(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  return prisma.professionDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      loreText: String(data.loreText ?? ""),
      iconUrl: data.iconUrl ? String(data.iconUrl) : null,
      type: String(data.type ?? "combat"),
      hitDie: String(data.hitDie ?? "1d10"),
      primaryAttribute: String(data.primaryAttribute ?? "strength"),
      saveProficiencies: data.saveProficiencies ?? [],
      armorProficiencies: data.armorProficiencies ?? [],
      weaponProficiencies: data.weaponProficiencies ?? [],
      toolProficiencies: data.toolProficiencies ?? [],
      skillChoices: data.skillChoices ?? {},
      startingEquipment: data.startingEquipment ?? [],
      startingWealth: data.startingWealth ? String(data.startingWealth) : null,
      spellcastingAttr: data.spellcastingAttr ? String(data.spellcastingAttr) : null,
      furyPerLevel: Number(data.furyPerLevel ?? 0),
      levelFeatures: data.levelFeatures ?? [],
      talentTreeIds: data.talentTreeIds ?? [],
      sortOrder: Number(data.sortOrder ?? 0),
    },
  });
}

export async function updateProfession(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.professionDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("profession not found");
  return prisma.professionDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.loreText != null && { loreText: String(data.loreText) }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ? String(data.iconUrl) : null }),
      ...(data.type != null && { type: String(data.type) }),
      ...(data.hitDie != null && { hitDie: String(data.hitDie) }),
      ...(data.primaryAttribute != null && { primaryAttribute: String(data.primaryAttribute) }),
      ...(data.saveProficiencies != null && { saveProficiencies: data.saveProficiencies }),
      ...(data.armorProficiencies != null && { armorProficiencies: data.armorProficiencies }),
      ...(data.weaponProficiencies != null && { weaponProficiencies: data.weaponProficiencies }),
      ...(data.toolProficiencies != null && { toolProficiencies: data.toolProficiencies }),
      ...(data.skillChoices != null && { skillChoices: data.skillChoices }),
      ...(data.startingEquipment != null && { startingEquipment: data.startingEquipment }),
      ...(data.startingWealth !== undefined && { startingWealth: data.startingWealth ? String(data.startingWealth) : null }),
      ...(data.spellcastingAttr !== undefined && { spellcastingAttr: data.spellcastingAttr ? String(data.spellcastingAttr) : null }),
      ...(data.furyPerLevel != null && { furyPerLevel: Number(data.furyPerLevel) }),
      ...(data.levelFeatures != null && { levelFeatures: data.levelFeatures }),
      ...(data.talentTreeIds != null && { talentTreeIds: data.talentTreeIds }),
      ...(data.sortOrder != null && { sortOrder: Number(data.sortOrder) }),
    },
  });
}

export async function deleteProfession(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.professionDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("profession not found");
  return prisma.professionDefinition.delete({ where: { id } });
}

/* ──── Background ──── */

export async function listBackgrounds(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.backgroundDefinition.findMany({ where: { worldId }, orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createBackground(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  return prisma.backgroundDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      loreText: String(data.loreText ?? ""),
      iconUrl: data.iconUrl ? String(data.iconUrl) : null,
      skillPoints: Number(data.skillPoints ?? 0),
      bonusLanguages: Number(data.bonusLanguages ?? 0),
      toolProficiencies: data.toolProficiencies ?? [],
      startingEquipment: data.startingEquipment ?? [],
      features: data.features ?? [],
      sortOrder: Number(data.sortOrder ?? 0),
    },
  });
}

export async function updateBackground(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.backgroundDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("background not found");
  return prisma.backgroundDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.loreText != null && { loreText: String(data.loreText) }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ? String(data.iconUrl) : null }),
      ...(data.skillPoints != null && { skillPoints: Number(data.skillPoints) }),
      ...(data.bonusLanguages != null && { bonusLanguages: Number(data.bonusLanguages) }),
      ...(data.toolProficiencies != null && { toolProficiencies: data.toolProficiencies }),
      ...(data.startingEquipment != null && { startingEquipment: data.startingEquipment }),
      ...(data.features != null && { features: data.features }),
      ...(data.sortOrder != null && { sortOrder: Number(data.sortOrder) }),
    },
  });
}

export async function deleteBackground(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.backgroundDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("background not found");
  return prisma.backgroundDefinition.delete({ where: { id } });
}

/* ──── Item ──── */

export async function listItems(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.itemDefinition.findMany({
    where: { worldId },
    orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { category: "asc" }, { name: "asc" }],
  });
}

export async function createItem(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const folderData = await resolveEntityFolderData(worldId, "ITEM", data, "create");
  return prisma.itemDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      ...folderData,
      description: String(data.description ?? ""),
      category: String(data.category ?? "gear"),
      subcategory: data.subcategory ? String(data.subcategory) : null,
      rarity: String(data.rarity ?? "common"),
      iconUrl: data.iconUrl ? String(data.iconUrl) : null,
      weight: Number(data.weight ?? 0),
      price: Number(data.price ?? 0),
      stackable: Boolean(data.stackable),
      maxStack: data.maxStack != null ? Number(data.maxStack) : null,
      requiresIdent: Boolean(data.requiresIdent),
      requiresAttune: Boolean(data.requiresAttune),
      attuneReq: data.attuneReq ? String(data.attuneReq) : null,
      weaponProps: data.weaponProps == null ? Prisma.JsonNull : asNullableJsonValue(data.weaponProps),
      armorProps: data.armorProps == null ? Prisma.JsonNull : asNullableJsonValue(data.armorProps),
      enchantments: data.enchantments == null ? Prisma.JsonNull : asNullableJsonValue(data.enchantments),
      enhanceSlots: Number(data.enhanceSlots ?? 0),
      gemSlots: Number(data.gemSlots ?? 0),
      tags: asJsonValue(data.tags),
      sortOrder: Number(data.sortOrder ?? 0),
      permissionMode: String(data.permissionMode ?? "DEFAULT"),
    },
  });
}

export async function updateItem(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.itemDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("item not found");
  const folderData = await resolveEntityFolderData(worldId, "ITEM", data, "update");
  return prisma.itemDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...folderData,
      ...(data.description != null && { description: String(data.description) }),
      ...(data.category != null && { category: String(data.category) }),
      ...(data.subcategory !== undefined && { subcategory: data.subcategory ? String(data.subcategory) : null }),
      ...(data.rarity != null && { rarity: String(data.rarity) }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ? String(data.iconUrl) : null }),
      ...(data.weight != null && { weight: Number(data.weight) }),
      ...(data.price != null && { price: Number(data.price) }),
      ...(data.stackable != null && { stackable: Boolean(data.stackable) }),
      ...(data.maxStack !== undefined && { maxStack: data.maxStack != null ? Number(data.maxStack) : null }),
      ...(data.requiresIdent != null && { requiresIdent: Boolean(data.requiresIdent) }),
      ...(data.requiresAttune != null && { requiresAttune: Boolean(data.requiresAttune) }),
      ...(data.attuneReq !== undefined && { attuneReq: data.attuneReq ? String(data.attuneReq) : null }),
      ...(data.weaponProps !== undefined && { weaponProps: data.weaponProps === null ? Prisma.JsonNull : asNullableJsonValue(data.weaponProps) }),
      ...(data.armorProps !== undefined && { armorProps: data.armorProps === null ? Prisma.JsonNull : asNullableJsonValue(data.armorProps) }),
      ...(data.enchantments !== undefined && { enchantments: data.enchantments === null ? Prisma.JsonNull : asNullableJsonValue(data.enchantments) }),
      ...(data.enhanceSlots != null && { enhanceSlots: Number(data.enhanceSlots) }),
      ...(data.gemSlots != null && { gemSlots: Number(data.gemSlots) }),
      ...(data.tags != null && { tags: asJsonValue(data.tags) }),
      ...(data.sortOrder != null && { sortOrder: Number(data.sortOrder) }),
      ...(data.permissionMode != null && { permissionMode: String(data.permissionMode) }),
    },
  });
}

export async function deleteItem(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.itemDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("item not found");
  return prisma.itemDefinition.delete({ where: { id } });
}

/* ──── FateClock ──── */

export async function listFateClocks(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  const isGM = member?.role === "GM";
  const clocks = await prisma.fateClock.findMany({
    where: { worldId },
    orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  if (isGM) return clocks;
  return clocks.filter((c) => c.visibleToPlayers);
}

export async function createFateClock(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const segments = Math.max(4, Math.min(12, Number(data.segments ?? 6)));
  return prisma.fateClock.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      segments,
      filledSegments: 0,
      visibleToPlayers: data.visibleToPlayers !== false,
      direction: String(data.direction ?? "advance"),
      successThreshold: data.successThreshold != null ? Number(data.successThreshold) : null,
      failureThreshold: data.failureThreshold != null ? Number(data.failureThreshold) : null,
      sceneId: data.sceneId ? String(data.sceneId) : null,
      history: [],
    },
  });
}

export async function updateFateClock(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.fateClock.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("fate clock not found");

  const nextSegmentsRaw = data.segments != null ? Number(data.segments) : existing.segments;
  const nextSegments = Math.max(4, Math.min(12, Number.isFinite(nextSegmentsRaw) ? nextSegmentsRaw : existing.segments));
  const filledSource = data.filledSegments != null ? Number(data.filledSegments) : existing.filledSegments;
  const nextFilledSegments = Math.max(0, Math.min(nextSegments, Number.isFinite(filledSource) ? filledSource : existing.filledSegments));

  return prisma.fateClock.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      segments: nextSegments,
      filledSegments: nextFilledSegments,
      ...(data.visibleToPlayers != null && { visibleToPlayers: Boolean(data.visibleToPlayers) }),
      ...(data.direction != null && { direction: String(data.direction) }),
      ...(data.successThreshold !== undefined && {
        successThreshold: data.successThreshold != null ? Number(data.successThreshold) : null,
      }),
      ...(data.failureThreshold !== undefined && {
        failureThreshold: data.failureThreshold != null ? Number(data.failureThreshold) : null,
      }),
      ...(data.status != null && { status: String(data.status) }),
      ...(data.sceneId !== undefined && { sceneId: data.sceneId ? String(data.sceneId) : null }),
      ...(data.history !== undefined && { history: asJsonValue(data.history) }),
    },
  });
}

export async function advanceFateClock(worldId: string, id: string, userId: string, amount: number, reason: string) {
  await ensureWorldGM(worldId, userId);
  const clock = await prisma.fateClock.findFirst({ where: { id, worldId } });
  if (!clock) throw new Error("fate clock not found");
  if (clock.status !== "active") throw new Error("fate clock is not active");

  const newFilled = Math.max(0, Math.min(clock.segments, clock.filledSegments + amount));
  const history = Array.isArray(clock.history) ? clock.history : [];
  const entry = {
    action: amount > 0 ? "advance" : "retreat",
    amount: Math.abs(amount),
    reason,
    timestamp: new Date().toISOString(),
  };

  let status = clock.status;
  if (clock.successThreshold != null && newFilled >= clock.successThreshold) status = "completed";
  if (clock.failureThreshold != null && newFilled >= clock.failureThreshold) status = "failed";

  return prisma.fateClock.update({
    where: { id },
    data: {
      filledSegments: newFilled,
      status,
      history: [...(history as Prisma.JsonValue[]), entry] as Prisma.InputJsonValue,
    },
  });
}

export async function deleteFateClock(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.fateClock.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("fate clock not found");
  return prisma.fateClock.delete({ where: { id } });
}

/* ──── Deck ──── */

export async function listDecks(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.deckDefinition.findMany({ where: { worldId }, orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createDeck(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  return prisma.deckDefinition.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      cards: asJsonValue(data.cards),
      replacement: data.replacement !== false,
      drawnHistory: [],
    },
  });
}

export async function updateDeck(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.deckDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("deck not found");
  return prisma.deckDefinition.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.cards != null && { cards: asJsonValue(data.cards) }),
      ...(data.replacement != null && { replacement: Boolean(data.replacement) }),
      ...(data.drawnHistory !== undefined && { drawnHistory: asJsonValue(data.drawnHistory) }),
    },
  });
}

export async function deleteDeck(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.deckDefinition.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("deck not found");
  return prisma.deckDefinition.delete({ where: { id } });
}

/* ──── RandomTable ──── */

export async function listRandomTables(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.randomTable.findMany({ where: { worldId }, orderBy: [{ folderPath: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
}

export async function createRandomTable(worldId: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  return prisma.randomTable.create({
    data: {
      worldId,
      name: String(data.name ?? ""),
      folderPath: normalizeFolderPath(data.folderPath),
      description: String(data.description ?? ""),
      diceFormula: String(data.diceFormula ?? "1d100"),
      entries: asJsonValue(data.entries),
    },
  });
}

export async function updateRandomTable(worldId: string, id: string, userId: string, data: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.randomTable.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("random table not found");
  return prisma.randomTable.update({
    where: { id },
    data: {
      ...(data.name != null && { name: String(data.name) }),
      ...(data.folderPath !== undefined && { folderPath: normalizeFolderPath(data.folderPath) }),
      ...(data.description != null && { description: String(data.description) }),
      ...(data.diceFormula != null && { diceFormula: String(data.diceFormula) }),
      ...(data.entries != null && { entries: asJsonValue(data.entries) }),
    },
  });
}

export async function deleteRandomTable(worldId: string, id: string, userId: string) {
  await ensureWorldGM(worldId, userId);
  const existing = await prisma.randomTable.findFirst({ where: { id, worldId } });
  if (!existing) throw new Error("random table not found");
  return prisma.randomTable.delete({ where: { id } });
}

/* ──── Collection Pack 导入/导出 ──── */

async function collectResourceIconAssets(entityGroups: Array<Array<{ iconUrl?: unknown }>>) {
  const assetsByUrl = new Map<string, ResourcePackAsset>();
  for (const records of entityGroups) {
    for (const record of records) {
      const asset = await readResourceIconPackAsset(record.iconUrl);
      if (asset && !assetsByUrl.has(asset.url)) {
        assetsByUrl.set(asset.url, asset);
      }
    }
  }
  return [...assetsByUrl.values()];
}

async function importResourceIconAssets(pack: Record<string, unknown>) {
  const urlMap = new Map<string, string>();
  const assets = Array.isArray(pack.assets) ? pack.assets : [];
  for (const rawAsset of assets) {
    const source = rawAsset as Record<string, unknown>;
    const saved = await saveResourceIconPackAsset(source);
    if (!saved) continue;
    const sourceUrl = typeof source.url === "string" ? source.url.trim() : "";
    const normalizedSourceUrl = normalizeResourceIconUrl(sourceUrl);
    if (sourceUrl) urlMap.set(sourceUrl, saved.url);
    if (normalizedSourceUrl) urlMap.set(normalizedSourceUrl, saved.url);
  }
  return urlMap;
}

function withImportedIcon(data: Record<string, unknown>, iconUrlMap: Map<string, string>) {
  const rawIconUrl = typeof data.iconUrl === "string" ? data.iconUrl.trim() : "";
  if (!rawIconUrl) return data;
  const normalizedIconUrl = normalizeResourceIconUrl(rawIconUrl);
  const nextIconUrl = iconUrlMap.get(rawIconUrl) ?? (normalizedIconUrl ? iconUrlMap.get(normalizedIconUrl) : undefined);
  return nextIconUrl ? { ...data, iconUrl: nextIconUrl } : data;
}

export async function exportCollectionPack(worldId: string, userId: string) {
  await ensureWorldGM(worldId, userId);

  const [abilities, races, professions, backgrounds, items, fateClocks, decks, randomTables] =
    await Promise.all([
      prisma.abilityDefinition.findMany({ where: { worldId } }),
      prisma.raceDefinition.findMany({ where: { worldId } }),
      prisma.professionDefinition.findMany({ where: { worldId } }),
      prisma.backgroundDefinition.findMany({ where: { worldId } }),
      prisma.itemDefinition.findMany({ where: { worldId } }),
      prisma.fateClock.findMany({ where: { worldId } }),
      prisma.deckDefinition.findMany({ where: { worldId } }),
      prisma.randomTable.findMany({ where: { worldId } }),
    ]);

  const assets = await collectResourceIconAssets([abilities, races, professions, backgrounds, items]);

  return {
    id: worldId,
    name: `世界合集包-${new Date().toISOString().slice(0, 10)}`,
    description: "",
    version: "1.0.0",
    author: userId,
    assets,
    contents: {
      abilities,
      races,
      professions,
      backgrounds,
      items,
      fateClocks,
      decks,
      randomTables,
      scenes: [],
      talentTrees: [],
    },
    importPolicy: {
      conflictResolution: "skip",
      preserveCustom: true,
    },
    createdAt: new Date().toISOString(),
  };
}

export async function importCollectionPack(worldId: string, userId: string, pack: Record<string, unknown>) {
  await ensureWorldGM(worldId, userId);

  const contents = pack.contents as Record<string, unknown[]> | undefined;
  if (!contents) throw new Error("invalid pack: missing contents");
  const iconUrlMap = await importResourceIconAssets(pack);

  const results: Record<string, number> = {};

  // 按实体类型逐批导入
  if (Array.isArray(contents.races)) {
    let count = 0;
    for (const item of contents.races) {
      const d = withImportedIcon(item as Record<string, unknown>, iconUrlMap);
      await prisma.raceDefinition.create({
        data: {
          worldId,
          name: String(d.name ?? ""),
          folderPath: normalizeFolderPath(d.folderPath),
          description: String(d.description ?? ""),
          loreText: String(d.loreText ?? ""),
          iconUrl: d.iconUrl ? String(d.iconUrl) : null,
          attrBonus: d.attrBonus ?? d.attrBonus ?? [],
          size: String(d.size ?? "medium"),
          speed: Number(d.speed ?? 30),
          darkvision: Number(d.darkvision ?? 0),
          creatureType: String(d.creatureType ?? "humanoid"),
          languages: d.languages ?? [],
          ageDesc: String(d.ageDesc ?? ""),
          traits: d.traits ?? [],
          subtypes: d.subtypes ?? [],
        },
      });
      count++;
    }
    results.races = count;
  }

  if (Array.isArray(contents.professions)) {
    let count = 0;
    for (const item of contents.professions) {
      const d = withImportedIcon(item as Record<string, unknown>, iconUrlMap);
      await createProfession(worldId, userId, d);
      count++;
    }
    results.professions = count;
  }

  if (Array.isArray(contents.backgrounds)) {
    let count = 0;
    for (const item of contents.backgrounds) {
      const d = withImportedIcon(item as Record<string, unknown>, iconUrlMap);
      await createBackground(worldId, userId, d);
      count++;
    }
    results.backgrounds = count;
  }

  if (Array.isArray(contents.abilities)) {
    let count = 0;
    for (const item of contents.abilities) {
      const d = withImportedIcon(item as Record<string, unknown>, iconUrlMap);
      await createAbility(worldId, userId, d);
      count++;
    }
    results.abilities = count;
  }

  if (Array.isArray(contents.items)) {
    let count = 0;
    for (const item of contents.items) {
      const d = withImportedIcon(item as Record<string, unknown>, iconUrlMap);
      await createItem(worldId, userId, d);
      count++;
    }
    results.items = count;
  }

  if (Array.isArray(contents.fateClocks)) {
    let count = 0;
    for (const item of contents.fateClocks) {
      const d = item as Record<string, unknown>;
      const segments = Math.max(4, Math.min(12, Number(d.segments ?? 6)));
      const filledSegments = Math.max(0, Math.min(segments, Number(d.filledSegments ?? 0)));
      await prisma.fateClock.create({
        data: {
          worldId,
          name: String(d.name ?? ""),
          folderPath: normalizeFolderPath(d.folderPath),
          description: String(d.description ?? ""),
          segments,
          filledSegments,
          visibleToPlayers: d.visibleToPlayers !== false,
          direction: String(d.direction ?? "advance"),
          successThreshold: d.successThreshold != null ? Number(d.successThreshold) : null,
          failureThreshold: d.failureThreshold != null ? Number(d.failureThreshold) : null,
          status: String(d.status ?? "active"),
          sceneId: d.sceneId ? String(d.sceneId) : null,
          history: asJsonValue(d.history),
        },
      });
      count++;
    }
    results.fateClocks = count;
  }

  if (Array.isArray(contents.decks)) {
    let count = 0;
    for (const item of contents.decks) {
      const d = item as Record<string, unknown>;
      await prisma.deckDefinition.create({
        data: {
          worldId,
          name: String(d.name ?? ""),
          folderPath: normalizeFolderPath(d.folderPath),
          description: String(d.description ?? ""),
          cards: asJsonValue(d.cards),
          replacement: d.replacement !== false,
          drawnHistory: asJsonValue(d.drawnHistory),
        },
      });
      count++;
    }
    results.decks = count;
  }

  if (Array.isArray(contents.randomTables)) {
    let count = 0;
    for (const item of contents.randomTables) {
      const d = item as Record<string, unknown>;
      await prisma.randomTable.create({
        data: {
          worldId,
          name: String(d.name ?? ""),
          folderPath: normalizeFolderPath(d.folderPath),
          description: String(d.description ?? ""),
          diceFormula: String(d.diceFormula ?? "1d100"),
          entries: asJsonValue(d.entries),
        },
      });
      count++;
    }
    results.randomTables = count;
  }

  return results;
}
