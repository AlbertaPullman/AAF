import { WorldRole, type Prisma } from "@prisma/client";
import {
  buildDefaultAbilityFormulaContext,
  evaluateConditionExpression,
  resolveAbilityCosts,
  resolveAbilityEffects,
  toFormulaNumber,
  type AbilityFormulaContext,
  type ResolvedAbilityCost,
  type ResolvedAbilityEffect
} from "../../../shared/rules/ability-engine";
import type { AbilityDefinition, ConditionExpression, EffectExpression, ResourceCost } from "../../../shared/types/world-entities";
import { prisma } from "../lib/prisma";
import { resolveSettlementAction, type SettlementResolveInput, type SettlementResolveResult } from "./settlement.service";
import { resolveScene } from "./scene.service";

type CharacterLike = {
  id: string;
  worldId: string;
  name: string;
  userId: string | null;
  stats: Prisma.JsonValue | null;
  snapshot: Prisma.JsonValue | null;
};

type CharacterStatusEffect = {
  id: string;
  key: string;
  label: string;
  type: string;
  stat?: string;
  value?: string | number | boolean | null;
  duration?: string;
  durationValue?: number;
  sourceAbilityId?: string;
  sourceAbilityName?: string;
  createdAt: string;
};

export type ExecuteWorldAbilityInput = {
  actorCharacterId?: string;
  actorTokenId?: string;
  targetCharacterIds?: string[];
  targetTokenIds?: string[];
  metadata?: Record<string, unknown>;
  fixedRolls?: SettlementResolveInput["fixedRolls"];
};

export type AbilityExecutionLogEntry = {
  id: string;
  worldId: string;
  sceneId: string;
  abilityId: string;
  abilityName: string;
  actorCharacterId: string;
  actorName: string;
  targetCharacterIds: string[];
  targetNames: string[];
  success: boolean;
  costs: ResolvedAbilityCost[];
  effects: ResolvedAbilityEffect[];
  settlement: SettlementResolveResult | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ExecuteWorldAbilityResult = {
  ability: {
    id: string;
    name: string;
    activation: string;
    actionType: string;
  };
  actor: {
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  };
  targets: Array<{
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  }>;
  settlement: SettlementResolveResult | null;
  costs: ResolvedAbilityCost[];
  effects: ResolvedAbilityEffect[];
  logEntry: AbilityExecutionLogEntry;
};

const MAX_ABILITY_LOGS = 100;

function createAbilityLogId() {
  return `abl_${Math.random().toString(36).slice(2, 10)}`;
}

function toIsoNow() {
  return new Date().toISOString();
}

function toPlainRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function toJsonObjectInput(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toResourceCosts(value: Prisma.JsonValue | null | undefined): ResourceCost[] {
  return Array.isArray(value) ? (value as unknown as ResourceCost[]) : [];
}

function toEffectExpressions(value: Prisma.JsonValue | null | undefined): EffectExpression[] {
  return Array.isArray(value) ? (value as unknown as EffectExpression[]) : [];
}

function toDamageRolls(value: Prisma.JsonValue | null | undefined): NonNullable<AbilityDefinition["damageRolls"]> {
  return Array.isArray(value) ? (value as NonNullable<AbilityDefinition["damageRolls"]>) : [];
}

function toAbilityTriggerCondition(value: Prisma.JsonValue | null | undefined): ConditionExpression | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const condition = (value as Record<string, unknown>).condition;
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return undefined;
  }

  return condition as ConditionExpression;
}

function getNumericRecordValue(record: Record<string, unknown>, key: string, fallback = 0) {
  const numeric = Number(record[key]);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getAttributeModifier(snapshot: Record<string, unknown>, attributeKey: string | null | undefined) {
  if (!attributeKey) {
    return 0;
  }

  const attributes = snapshot.attributes;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return 0;
  }

  const attributeValue = Number((attributes as Record<string, unknown>)[attributeKey]);
  if (!Number.isFinite(attributeValue)) {
    return 0;
  }

  return Math.floor((attributeValue - 10) / 2);
}

function getStatusEffects(snapshot: Record<string, unknown>): CharacterStatusEffect[] {
  const raw = snapshot.statusEffects;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item) => !!item && typeof item === "object")
    .map((item) => ({
      id: String((item as Record<string, unknown>).id ?? ""),
      key: String((item as Record<string, unknown>).key ?? ""),
      label: String((item as Record<string, unknown>).label ?? ""),
      type: String((item as Record<string, unknown>).type ?? ""),
      stat: typeof (item as Record<string, unknown>).stat === "string" ? String((item as Record<string, unknown>).stat) : undefined,
      value: (item as Record<string, unknown>).value as string | number | boolean | null | undefined,
      duration: typeof (item as Record<string, unknown>).duration === "string" ? String((item as Record<string, unknown>).duration) : undefined,
      durationValue: Number.isFinite(Number((item as Record<string, unknown>).durationValue))
        ? Number((item as Record<string, unknown>).durationValue)
        : undefined,
      sourceAbilityId:
        typeof (item as Record<string, unknown>).sourceAbilityId === "string"
          ? String((item as Record<string, unknown>).sourceAbilityId)
          : undefined,
      sourceAbilityName:
        typeof (item as Record<string, unknown>).sourceAbilityName === "string"
          ? String((item as Record<string, unknown>).sourceAbilityName)
          : undefined,
      createdAt: typeof (item as Record<string, unknown>).createdAt === "string" ? String((item as Record<string, unknown>).createdAt) : toIsoNow()
    }))
    .filter((item) => item.id || item.key || item.label);
}

function setStatusEffects(snapshot: Record<string, unknown>, nextEffects: CharacterStatusEffect[]) {
  snapshot.statusEffects = nextEffects;
}

function getDerivedArmorClass(snapshot: Record<string, unknown>) {
  const baseAc = getNumericRecordValue(snapshot, "ac", 10);
  const statusEffects = getStatusEffects(snapshot);
  const bonus = statusEffects.reduce((sum, item) => {
    if (item.type !== "modifyAC") {
      return sum;
    }
    return sum + toFormulaNumber(item.value, 0);
  }, 0);
  return baseAc + bonus;
}

function getDerivedBonusDiceCount(snapshot: Record<string, unknown>) {
  return getStatusEffects(snapshot).reduce((sum, item) => {
    if (item.type !== "grantBonusDice") {
      return sum;
    }
    return sum + Math.max(0, Math.floor(toFormulaNumber(item.value, 0)));
  }, 0);
}

function getDerivedPenaltyDiceCount(snapshot: Record<string, unknown>) {
  return getStatusEffects(snapshot).reduce((sum, item) => {
    if (item.type !== "grantPenaltyDice") {
      return sum;
    }
    return sum + Math.max(0, Math.floor(toFormulaNumber(item.value, 0)));
  }, 0);
}

function createCharacterFormulaScope(character: CharacterLike, stats: Record<string, unknown>, snapshot: Record<string, unknown>) {
  return {
    id: character.id,
    name: character.name,
    userId: character.userId,
    stats,
    snapshot,
    level: getNumericRecordValue(snapshot, "level", 1),
    proficiencyBonus: getNumericRecordValue(snapshot, "proficiencyBonus", 2),
    ac: getDerivedArmorClass(snapshot),
    hp: getNumericRecordValue(stats, "hp", 0),
    mp: getNumericRecordValue(stats, "mp", 0),
    stamina: getNumericRecordValue(stats, "stamina", 0),
    fury: getNumericRecordValue(stats, "fury", 0),
    tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
    statusEffects: getStatusEffects(snapshot),
    attributes: snapshot.attributes && typeof snapshot.attributes === "object" && !Array.isArray(snapshot.attributes)
      ? snapshot.attributes
      : {}
  };
}

function applyResourceCost(stats: Record<string, unknown>, cost: ResolvedAbilityCost) {
  const amount = Math.max(0, Math.floor(cost.amount));
  if (amount <= 0) {
    return;
  }

  const field =
    cost.type === "spell-slot"
      // 旧模板兼容：AAF 使用 MP 与法术等级，历史 spell-slot 消耗统一按 MP 结算。
      ? "mp"
      : cost.type === "item"
        ? null
        : cost.type;

  if (!field) {
    return;
  }

  const current = getNumericRecordValue(stats, field, 0);
  stats[field] = Math.max(0, current - amount);
}

function applyDamage(stats: Record<string, unknown>, damage: number) {
  const totalDamage = Math.max(0, Math.floor(damage));
  if (totalDamage <= 0) {
    return;
  }

  const currentTempHp = getNumericRecordValue(stats, "tempHp", 0);
  if (currentTempHp > 0) {
    const nextTempHp = Math.max(0, currentTempHp - totalDamage);
    stats.tempHp = nextTempHp;
    const remainingDamage = Math.max(0, totalDamage - currentTempHp);
    if (remainingDamage > 0) {
      stats.hp = Math.max(0, getNumericRecordValue(stats, "hp", 0) - remainingDamage);
    }
    return;
  }

  stats.hp = Math.max(0, getNumericRecordValue(stats, "hp", 0) - totalDamage);
}

function applyHeal(stats: Record<string, unknown>, snapshot: Record<string, unknown>, amount: number) {
  const healValue = Math.max(0, Math.floor(amount));
  if (healValue <= 0) {
    return;
  }

  const maxHp = getNumericRecordValue(snapshot, "maxHp", Math.max(1, getNumericRecordValue(stats, "hp", 0)));
  stats.hp = Math.min(maxHp, getNumericRecordValue(stats, "hp", 0) + healValue);
}

function applyStatDelta(stats: Record<string, unknown>, stat: string | undefined, value: number) {
  if (!stat) {
    return;
  }

  const normalizedValue = Math.floor(value);
  const current = getNumericRecordValue(stats, stat, 0);
  stats[stat] = current + normalizedValue;
}

function appendStatusEffect(
  snapshot: Record<string, unknown>,
  sourceAbility: Pick<AbilityDefinition, "id" | "name">,
  effect: ResolvedAbilityEffect
) {
  const nextEffects = getStatusEffects(snapshot);
  nextEffects.push({
    id: `${sourceAbility.id}:${effect.index}:${Date.now()}`,
    key: typeof effect.value === "string" && effect.value ? effect.value : `${sourceAbility.id}:${effect.type}:${effect.index}`,
    label: effect.label ?? sourceAbility.name,
    type: effect.type,
    stat: effect.stat,
    value: effect.value,
    duration: effect.duration,
    durationValue: effect.durationValue,
    sourceAbilityId: sourceAbility.id,
    sourceAbilityName: sourceAbility.name,
    createdAt: toIsoNow()
  });
  setStatusEffects(snapshot, nextEffects);
}

function removeStatusEffect(snapshot: Record<string, unknown>, effect: ResolvedAbilityEffect) {
  const valueKey = typeof effect.value === "string" ? effect.value : "";
  const nextEffects = getStatusEffects(snapshot).filter((item) => {
    if (effect.label && item.label === effect.label) {
      return false;
    }
    if (valueKey && (item.key === valueKey || item.label === valueKey)) {
      return false;
    }
    return true;
  });
  setStatusEffects(snapshot, nextEffects);
}

function applyResolvedEffectToCharacter(
  character: CharacterLike,
  stats: Record<string, unknown>,
  snapshot: Record<string, unknown>,
  sourceAbility: Pick<AbilityDefinition, "id" | "name">,
  effect: ResolvedAbilityEffect
) {
  switch (effect.type) {
    case "dealDamage":
      applyDamage(stats, toFormulaNumber(effect.value, 0));
      break;
    case "heal":
      applyHeal(stats, snapshot, toFormulaNumber(effect.value, 0));
      break;
    case "grantTempHp":
      stats.tempHp = getNumericRecordValue(stats, "tempHp", 0) + Math.max(0, Math.floor(toFormulaNumber(effect.value, 0)));
      break;
    case "modifyStat":
      if (effect.duration && effect.duration !== "instantaneous") {
        appendStatusEffect(snapshot, sourceAbility, effect);
      } else {
        applyStatDelta(stats, effect.stat, toFormulaNumber(effect.value, 0));
      }
      break;
    case "modifyAC":
    case "modifySpeed":
    case "grantBonusDice":
    case "grantPenaltyDice":
    case "grantAdvantage":
    case "grantDisadvantage":
    case "grantReaction":
    case "grantExtraAttack":
    case "applyState":
      appendStatusEffect(snapshot, sourceAbility, effect);
      break;
    case "removeState":
      removeStatusEffect(snapshot, effect);
      break;
    case "addTag": {
      const tags = Array.isArray(snapshot.tags) ? [...snapshot.tags] : [];
      const tag = String(effect.value ?? "").trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
      snapshot.tags = tags;
      break;
    }
    case "removeTag": {
      const tag = String(effect.value ?? "").trim();
      const tags = Array.isArray(snapshot.tags) ? [...snapshot.tags] : [];
      snapshot.tags = tags.filter((item) => item !== tag);
      break;
    }
    case "custom":
    default:
      break;
  }

  return {
    id: character.id,
    name: character.name,
    stats,
    snapshot
  };
}

async function assertAbilityExecutionAccess(worldId: string, userId: string) {
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

  if (membership.role === WorldRole.OBSERVER) {
    throw new Error("permission denied");
  }
}

async function resolveCharacterById(worldId: string, characterId: string) {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId) {
    return null;
  }

  return prisma.character.findFirst({
    where: {
      id: normalizedCharacterId,
      worldId
    },
    select: {
      id: true,
      worldId: true,
      name: true,
      userId: true,
      stats: true,
      snapshot: true
    }
  });
}

async function resolveCharacterIdFromToken(worldId: string, sceneId: string, tokenId: string) {
  const scene = await resolveScene(worldId, sceneId);
  const canvasState =
    scene.canvasState && typeof scene.canvasState === "object" && !Array.isArray(scene.canvasState)
      ? (scene.canvasState as Record<string, unknown>)
      : {};
  const tokens = Array.isArray(canvasState.tokens) ? canvasState.tokens : [];
  const matched = tokens.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return (item as Record<string, unknown>).tokenId === tokenId;
  });
  if (!matched || typeof (matched as Record<string, unknown>).characterId !== "string") {
    return null;
  }
  return String((matched as Record<string, unknown>).characterId);
}

async function appendSceneAbilityLog(worldId: string, sceneId: string, entry: AbilityExecutionLogEntry) {
  const scene = await resolveScene(worldId, sceneId);
  const canvasState =
    scene.canvasState && typeof scene.canvasState === "object" && !Array.isArray(scene.canvasState)
      ? (scene.canvasState as Record<string, unknown>)
      : {};

  const currentLogs = Array.isArray(canvasState.abilityLogs)
    ? canvasState.abilityLogs.filter((item) => !!item && typeof item === "object")
    : [];

  await prisma.scene.update({
    where: { id: scene.id },
    data: {
      canvasState: toJsonObjectInput({
        ...canvasState,
        abilityLogs: [...currentLogs, entry].slice(-MAX_ABILITY_LOGS)
      } as Record<string, unknown>)
    }
  });
}

export async function executeWorldAbility(
  worldId: string,
  sceneId: string,
  abilityId: string,
  userId: string,
  input: ExecuteWorldAbilityInput
): Promise<ExecuteWorldAbilityResult> {
  await assertAbilityExecutionAccess(worldId, userId);

  const ability = await prisma.abilityDefinition.findFirst({
    where: {
      id: abilityId,
      worldId
    }
  });
  if (!ability) {
    throw new Error("ability not found");
  }

  const actorCharacterId =
    input.actorCharacterId?.trim() ||
    (input.actorTokenId ? await resolveCharacterIdFromToken(worldId, sceneId, input.actorTokenId) : null);
  if (!actorCharacterId) {
    throw new Error("actor character is required");
  }

  const actorCharacter = await resolveCharacterById(worldId, actorCharacterId);
  if (!actorCharacter) {
    throw new Error("actor character not found");
  }

  const targetCharacterIds = [
    ...(input.targetCharacterIds ?? []).map((item) => item.trim()).filter(Boolean)
  ];

  for (const tokenId of input.targetTokenIds ?? []) {
    const resolvedCharacterId = await resolveCharacterIdFromToken(worldId, sceneId, tokenId);
    if (resolvedCharacterId) {
      targetCharacterIds.push(resolvedCharacterId);
    }
  }

  const uniqueTargetIds = [...new Set(targetCharacterIds)];
  const targetCharacters = (
    await Promise.all(uniqueTargetIds.map((characterId) => resolveCharacterById(worldId, characterId)))
  ).filter((item): item is CharacterLike => Boolean(item));

  const actorStats = toPlainRecord(actorCharacter.stats);
  const actorSnapshot = toPlainRecord(actorCharacter.snapshot);
  const actorScope = createCharacterFormulaScope(actorCharacter, actorStats, actorSnapshot);

  const primaryTargetCharacter = targetCharacters[0] ?? null;
  const primaryTargetStats = primaryTargetCharacter ? toPlainRecord(primaryTargetCharacter.stats) : {};
  const primaryTargetSnapshot = primaryTargetCharacter ? toPlainRecord(primaryTargetCharacter.snapshot) : {};
  const targetScope = primaryTargetCharacter
    ? createCharacterFormulaScope(primaryTargetCharacter, primaryTargetStats, primaryTargetSnapshot)
    : {};

  const context: AbilityFormulaContext = buildDefaultAbilityFormulaContext({
    actor: actorScope,
    target: targetScope,
    scene: { id: sceneId },
    combat: {},
    world: { id: worldId },
    metadata: { ...(input.metadata ?? {}) }
  });

  const triggerCondition = toAbilityTriggerCondition(ability.trigger);
  if (ability.activation === "triggered" && triggerCondition && !evaluateConditionExpression(triggerCondition, context)) {
    throw new Error("ability trigger condition not met");
  }

  const costs = resolveAbilityCosts(toResourceCosts(ability.resourceCosts), context);
  const effects = resolveAbilityEffects(toEffectExpressions(ability.effects), context);

  let settlement: SettlementResolveResult | null = null;
  let executionSucceeded = true;

  if ((ability.checkType === "attack" || ability.checkType === "savingThrow" || Array.isArray(ability.damageRolls)) && primaryTargetCharacter) {
    const damageRoll = toDamageRolls(ability.damageRolls)[0] ?? null;
    settlement = resolveSettlementAction({
      actionId: ability.id,
      actorTokenId: input.actorTokenId?.trim() || actorCharacter.id,
      actorName: actorCharacter.name,
      targetTokenId: input.targetTokenIds?.[0]?.trim() || primaryTargetCharacter.id,
      targetName: primaryTargetCharacter.name,
      check: {
        targetType: ability.checkType === "attack" ? "AC" : ability.checkType === "savingThrow" ? "DC" : undefined,
        targetValue: ability.checkType === "attack"
          ? getDerivedArmorClass(primaryTargetSnapshot)
          : ability.checkType === "savingThrow"
            ? Math.max(
              1,
              8 +
              getNumericRecordValue(actorSnapshot, "proficiencyBonus", 2) +
              getAttributeModifier(actorSnapshot, ability.attackAttr)
            )
            : undefined,
        attributeMod: getAttributeModifier(actorSnapshot, ability.attackAttr),
        proficiency: getNumericRecordValue(actorSnapshot, "proficiencyBonus", 2),
        bonusDiceCount: getDerivedBonusDiceCount(actorSnapshot),
        penaltyDiceCount: getDerivedPenaltyDiceCount(actorSnapshot),
        criticalRangeStart: getNumericRecordValue(actorSnapshot, "criticalRangeStart", 20)
      },
      damage: damageRoll
        ? {
          formula: String(damageRoll.dice),
          damageType: String(damageRoll.damageType)
        }
        : undefined,
      fixedRolls: input.fixedRolls
    });

    executionSucceeded = settlement.success && settlement.check.success;
    if (settlement.damage.total > 0 && executionSucceeded) {
      applyDamage(primaryTargetStats, settlement.damage.total);
    }
  }

  costs.forEach((cost) => applyResourceCost(actorStats, cost));

  const updatedTargets = targetCharacters.map((character) => {
    const stats = character.id === primaryTargetCharacter?.id ? primaryTargetStats : toPlainRecord(character.stats);
    const snapshot = character.id === primaryTargetCharacter?.id ? primaryTargetSnapshot : toPlainRecord(character.snapshot);
    return { character, stats, snapshot };
  });

  if (executionSucceeded) {
    for (const effect of effects) {
      const effectTargets =
        effect.target === "self"
          ? [{ character: actorCharacter, stats: actorStats, snapshot: actorSnapshot }]
          : effect.target === "target" || effect.target === "aoe" || effect.target === "allEnemies"
            ? updatedTargets
            : [{ character: actorCharacter, stats: actorStats, snapshot: actorSnapshot }, ...updatedTargets];

      for (const target of effectTargets) {
        applyResolvedEffectToCharacter(target.character, target.stats, target.snapshot, ability, effect);
      }
    }
  }

  await prisma.character.update({
    where: { id: actorCharacter.id },
    data: {
      stats: toJsonObjectInput(actorStats),
      snapshot: toJsonObjectInput(actorSnapshot)
    }
  });

  for (const target of updatedTargets) {
    await prisma.character.update({
      where: { id: target.character.id },
      data: {
        stats: toJsonObjectInput(target.stats),
        snapshot: toJsonObjectInput(target.snapshot)
      }
    });
  }

  const logEntry: AbilityExecutionLogEntry = {
    id: createAbilityLogId(),
    worldId,
    sceneId,
    abilityId: ability.id,
    abilityName: ability.name,
    actorCharacterId: actorCharacter.id,
    actorName: actorCharacter.name,
    targetCharacterIds: updatedTargets.map((item) => item.character.id),
    targetNames: updatedTargets.map((item) => item.character.name),
    success: executionSucceeded,
    costs,
    effects,
    settlement,
    metadata: { ...(input.metadata ?? {}) },
    createdAt: toIsoNow()
  };

  await appendSceneAbilityLog(worldId, sceneId, logEntry);

  return {
    ability: {
      id: ability.id,
      name: ability.name,
      activation: ability.activation,
      actionType: ability.actionType
    },
    actor: {
      id: actorCharacter.id,
      name: actorCharacter.name,
      stats: actorStats,
      snapshot: actorSnapshot
    },
    targets: updatedTargets.map((item) => ({
      id: item.character.id,
      name: item.character.name,
      stats: item.stats,
      snapshot: item.snapshot
    })),
    settlement,
    costs,
    effects,
    logEntry
  };
}
