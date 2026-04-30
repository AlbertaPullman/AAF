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
import {
  attachAbilityWorkflowAfterSnapshots,
  createAbilityWorkflowCharacterSnapshot,
  createAbilityWorkflowRun,
  finalizeAbilityWorkflow,
  normalizeAbilityAutomationMode,
  resolveAbilityAutomationConfig,
  setAbilityWorkflowPhase
} from "../../../shared/rules/ability-workflow";
import { getStatusDefinition, isStatusInCategory } from "../../../shared/rules/ability-registry";
import type {
  AbilityAutomationConfig,
  AbilityAutomationMode,
  AbilityDefinition,
  AbilityWorkflowDamageApplication,
  AbilityWorkflowRun,
  ConditionExpression,
  EffectExpression,
  ResourceCost
} from "../../../shared/types/world-entities";
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
  category?: string;
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
  automationMode?: AbilityAutomationMode;
  automation?: Partial<AbilityAutomationConfig>;
  manualOverrides?: Record<string, unknown>;
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
  workflow: AbilityWorkflowRun;
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
  workflow: AbilityWorkflowRun;
  logEntry: AbilityExecutionLogEntry;
};

const MAX_ABILITY_LOGS = 100;
const ATTRIBUTE_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;

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

function toOptionalPlainRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
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

function getAbilityDcFromSnapshot(snapshot: Record<string, unknown>, key: string, attribute: string) {
  const explicit = Number(snapshot[key]);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  return 8 + getNumericRecordValue(snapshot, "proficiencyBonus", 2) + getAttributeModifier(snapshot, attribute);
}

function resolveAbilitySaveTargetValue(saveDC: Prisma.JsonValue | null | undefined, actorSnapshot: Record<string, unknown>) {
  const record =
    saveDC && typeof saveDC === "object" && !Array.isArray(saveDC)
      ? (saveDC as Record<string, unknown>)
      : {};
  const mode = String(record.dcMode ?? record.mode ?? "actorAbilityDc");
  const attribute = String(record.attribute ?? actorSnapshot.spellcastingAttribute ?? "intelligence");
  const fixed = Number(record.fixed ?? record.base);

  if (mode === "fixed" && Number.isFinite(fixed)) {
    return Math.max(1, fixed);
  }
  if (mode === "actorSpellDc") {
    return Math.max(1, getAbilityDcFromSnapshot(actorSnapshot, "spellDc", attribute));
  }
  if (mode === "actorProfessionDc") {
    return Math.max(1, getAbilityDcFromSnapshot(actorSnapshot, "professionDc", attribute));
  }
  if (Number.isFinite(fixed)) {
    return Math.max(1, fixed);
  }

  return Math.max(
    1,
    8 + getNumericRecordValue(actorSnapshot, "proficiencyBonus", 2) + getAttributeModifier(actorSnapshot, attribute)
  );
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
      category: typeof (item as Record<string, unknown>).category === "string" ? String((item as Record<string, unknown>).category) : undefined,
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

function getStatusImmunityRecord(snapshot: Record<string, unknown>) {
  const raw = snapshot.statusImmunities;
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    statuses: Array.isArray(record.statuses) ? record.statuses.map((item) => String(item)).filter(Boolean) : [],
    categories: Array.isArray(record.categories) ? record.categories.map((item) => String(item)).filter(Boolean) : []
  };
}

function setStatusImmunityRecord(
  snapshot: Record<string, unknown>,
  next: { statuses: string[]; categories: string[] }
) {
  snapshot.statusImmunities = {
    statuses: [...new Set(next.statuses)],
    categories: [...new Set(next.categories)]
  };
}

function isStatusBlockedByImmunity(snapshot: Record<string, unknown>, statusKeyOrLabel: unknown) {
  const immunities = getStatusImmunityRecord(snapshot);
  const normalized = String(statusKeyOrLabel ?? "").trim();
  if (!normalized) {
    return false;
  }
  if (immunities.statuses.includes(normalized)) {
    return true;
  }
  const definition = getStatusDefinition(normalized);
  if (definition && immunities.statuses.includes(definition.key)) {
    return true;
  }
  return immunities.categories.some((category) => isStatusInCategory(normalized, category));
}

function appendStatusImmunity(snapshot: Record<string, unknown>, effect: ResolvedAbilityEffect, categoryMode: boolean) {
  const value = String(effect.value ?? "").trim();
  if (!value) {
    return;
  }
  const immunities = getStatusImmunityRecord(snapshot);
  if (categoryMode) {
    setStatusImmunityRecord(snapshot, {
      ...immunities,
      categories: [...immunities.categories, value]
    });
    return;
  }

  const definition = getStatusDefinition(value);
  setStatusImmunityRecord(snapshot, {
    ...immunities,
    statuses: [...immunities.statuses, definition?.key ?? value]
  });
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
  const attributeMods = Object.fromEntries(
    ATTRIBUTE_KEYS.map((attribute) => [attribute, getAttributeModifier(snapshot, attribute)])
  );
  const spellcastingAttribute =
    typeof snapshot.spellcastingAttribute === "string" ? String(snapshot.spellcastingAttribute) : "intelligence";

  return {
    id: character.id,
    name: character.name,
    userId: character.userId,
    stats,
    snapshot,
    level: getNumericRecordValue(snapshot, "level", 1),
    professionLevel: getNumericRecordValue(snapshot, "professionLevel", getNumericRecordValue(snapshot, "level", 1)),
    proficiencyBonus: getNumericRecordValue(snapshot, "proficiencyBonus", 2),
    spellDc: getNumericRecordValue(
      snapshot,
      "spellDc",
      8 + getNumericRecordValue(snapshot, "proficiencyBonus", 2) + getAttributeModifier(snapshot, spellcastingAttribute)
    ),
    professionDc: getNumericRecordValue(snapshot, "professionDc", 8 + getNumericRecordValue(snapshot, "proficiencyBonus", 2) + getAttributeModifier(snapshot, spellcastingAttribute)),
    ac: getDerivedArmorClass(snapshot),
    hp: getNumericRecordValue(stats, "hp", 0),
    mp: getNumericRecordValue(stats, "mp", 0),
    stamina: getNumericRecordValue(stats, "stamina", 0),
    fury: getNumericRecordValue(stats, "fury", 0),
    tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
    statusEffects: getStatusEffects(snapshot),
    statusImmunities: getStatusImmunityRecord(snapshot),
    attributeMods,
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

function normalizeDamageKey(value: unknown) {
  return toTextValue(value).trim().toLowerCase();
}

function toTextValue(value: unknown) {
  return value == null ? "" : String(value);
}

function isUniversalDamageKey(value: string) {
  return ["*", "all", "any", "所有", "全部", "任意"].includes(value);
}

function matchesDamageType(candidate: unknown, damageType: string) {
  const normalized = normalizeDamageKey(candidate);
  return Boolean(normalized) && (isUniversalDamageKey(normalized) || normalized === damageType);
}

function collectDamageModifierLabels(
  sources: Array<Record<string, unknown>>,
  keys: string[],
  damageType: string,
  fallbackLabel: string
) {
  const labels = new Set<string>();

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && matchesDamageType(value, damageType)) {
        labels.add(fallbackLabel);
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && matchesDamageType(item, damageType)) {
            labels.add(item);
          }
          const record = asPlainObject(item);
          if (record && matchesDamageType(record.damageType ?? record.type ?? record.key ?? record.id ?? record.value ?? record.name, damageType)) {
            labels.add(toTextValue(record.label ?? record.name ?? record.source ?? fallbackLabel));
          }
        }
      }
      const record = asPlainObject(value);
      if (record) {
        for (const [entryKey, entryValue] of Object.entries(record)) {
          if (entryValue && matchesDamageType(entryKey, damageType)) {
            const nested = asPlainObject(entryValue);
            labels.add(toTextValue(nested?.label ?? nested?.name ?? nested?.source ?? entryKey));
          }
        }
      }
    }
  }

  return [...labels].filter(Boolean);
}

function collectDamageReductions(sources: Array<Record<string, unknown>>, keys: string[], damageType: string) {
  const reductions: Array<{ amount: number; label: string }> = [];

  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      const directAmount = Number(value);
      if (Number.isFinite(directAmount)) {
        reductions.push({ amount: Math.max(0, Math.floor(directAmount)), label: key });
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const record = asPlainObject(item);
          if (!record) {
            continue;
          }
          const itemType = record.damageType ?? record.type ?? record.key ?? record.id ?? record.value ?? "all";
          if (!matchesDamageType(itemType, damageType)) {
            continue;
          }
          const amount = Number(record.amount ?? record.value ?? record.reduction);
          if (Number.isFinite(amount)) {
            reductions.push({ amount: Math.max(0, Math.floor(amount)), label: toTextValue(record.label ?? record.name ?? key) });
          }
        }
      }
      const record = asPlainObject(value);
      if (record) {
        const directRecordAmount = Number(record.amount ?? record.value ?? record.reduction);
        if (Number.isFinite(directRecordAmount) && matchesDamageType(record.damageType ?? record.type ?? "all", damageType)) {
          reductions.push({ amount: Math.max(0, Math.floor(directRecordAmount)), label: toTextValue(record.label ?? key) });
        }
        for (const [entryKey, entryValue] of Object.entries(record)) {
          if (!matchesDamageType(entryKey, damageType)) {
            continue;
          }
          const nested = asPlainObject(entryValue);
          const amount = Number(nested?.amount ?? nested?.value ?? nested?.reduction ?? entryValue);
          if (Number.isFinite(amount)) {
            reductions.push({ amount: Math.max(0, Math.floor(amount)), label: toTextValue(nested?.label ?? nested?.name ?? entryKey) });
          }
        }
      }
    }
  }

  return reductions.filter((item) => item.amount > 0);
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function resolveDamageApplication(input: {
  target: Pick<CharacterLike, "id" | "name">;
  stats: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  rawDamage: number;
  damageType?: string;
  applied: boolean;
  canUndo: boolean;
  notes?: string[];
}): AbilityWorkflowDamageApplication {
  const rawDamage = Math.max(0, Math.floor(input.rawDamage));
  const normalizedDamageType = normalizeDamageKey(input.damageType || "all");
  const modifierSources = [input.snapshot, input.stats];
  const immunityLabels = collectDamageModifierLabels(
    modifierSources,
    ["damageImmunities", "damageImmunity", "immunities", "immunity"],
    normalizedDamageType,
    "免疫"
  );
  const resistanceLabels = collectDamageModifierLabels(
    modifierSources,
    ["damageResistances", "damageResistance", "resistances", "resistance"],
    normalizedDamageType,
    "抗性"
  );
  const vulnerabilityLabels = collectDamageModifierLabels(
    modifierSources,
    ["damageVulnerabilities", "damageVulnerability", "vulnerabilities", "vulnerability"],
    normalizedDamageType,
    "易伤"
  );
  const reductions = collectDamageReductions(
    modifierSources,
    ["damageReductions", "damageReduction", "flatDamageReduction", "damageReduce", "reduction"],
    normalizedDamageType
  );

  const immunityApplied = immunityLabels.length > 0;
  const resistanceApplied = !immunityApplied && resistanceLabels.length > 0;
  const vulnerabilityApplied = !immunityApplied && vulnerabilityLabels.length > 0;
  const typeMultiplier = (resistanceApplied ? 0.5 : 1) * (vulnerabilityApplied ? 2 : 1);
  const multipliedDamage = immunityApplied ? 0 : Math.floor(rawDamage * typeMultiplier);
  const typedDamage = !immunityApplied && rawDamage > 0 && typeMultiplier > 0 ? Math.max(1, multipliedDamage) : multipliedDamage;
  const flatReduction = immunityApplied ? 0 : reductions.reduce((sum, item) => sum + item.amount, 0);
  const effectiveDamage = Math.max(0, typedDamage - flatReduction);
  const oldHp = getNumericRecordValue(input.stats, "hp", 0);
  const oldTempHp = getNumericRecordValue(input.stats, "tempHp", 0);
  const tempHpDamage = Math.min(oldTempHp, effectiveDamage);
  const hpDamage = Math.min(oldHp, Math.max(0, effectiveDamage - tempHpDamage));
  const newTempHp = Math.max(0, oldTempHp - tempHpDamage);
  const newHp = Math.max(0, oldHp - hpDamage);

  if (input.applied) {
    input.stats.tempHp = newTempHp;
    input.stats.hp = newHp;
  }

  const notes = [...(input.notes ?? [])];
  if (immunityApplied) {
    notes.push(`目标具有 ${immunityLabels.join("、")} 免疫，本次伤害归零。`);
  } else {
    if (resistanceApplied) {
      notes.push(`目标具有 ${resistanceLabels.join("、")} 抗性，本次伤害减半。`);
    }
    if (vulnerabilityApplied) {
      notes.push(`目标具有 ${vulnerabilityLabels.join("、")} 易伤，本次伤害翻倍。`);
    }
    if (flatReduction > 0) {
      notes.push(`固定减伤 ${flatReduction}（${reductions.map((item) => item.label).join("、")}）。`);
    }
  }

  return {
    targetCharacterId: input.target.id,
    targetName: input.target.name,
    damageType: input.damageType,
    rawDamage,
    effectiveDamage,
    appliedDamage: input.applied ? tempHpDamage + hpDamage : 0,
    tempHpDamage,
    hpDamage,
    oldHp,
    newHp,
    oldTempHp,
    newTempHp,
    resistanceApplied,
    vulnerabilityApplied,
    immunityApplied,
    flatReduction,
    damageTypeModifiers: [
      ...immunityLabels.map((label) => `免疫:${label}`),
      ...resistanceLabels.map((label) => `抗性:${label}`),
      ...vulnerabilityLabels.map((label) => `易伤:${label}`),
      ...reductions.map((item) => `减伤:${item.label} ${item.amount}`),
    ],
    applied: input.applied,
    canUndo: input.applied && input.canUndo,
    notes
  };
}

function applyDamage(stats: Record<string, unknown>, damage: number) {
  const totalDamage = Math.max(0, Math.floor(damage));
  if (totalDamage <= 0) {
    return;
  }

  const currentHp = getNumericRecordValue(stats, "hp", 0);
  const currentTempHp = getNumericRecordValue(stats, "tempHp", 0);
  const tempHpDamage = Math.min(currentTempHp, totalDamage);
  const hpDamage = Math.min(currentHp, Math.max(0, totalDamage - tempHpDamage));
  stats.tempHp = Math.max(0, currentTempHp - tempHpDamage);
  stats.hp = Math.max(0, currentHp - hpDamage);
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
  if (isStatusBlockedByImmunity(snapshot, effect.value || effect.label)) {
    return;
  }

  const statusDefinition = getStatusDefinition(effect.value || effect.label);
  const nextEffects = getStatusEffects(snapshot);
  nextEffects.push({
    id: `${sourceAbility.id}:${effect.index}:${Date.now()}`,
    key: statusDefinition?.key ?? (typeof effect.value === "string" && effect.value ? effect.value : `${sourceAbility.id}:${effect.type}:${effect.index}`),
    label: effect.label ?? statusDefinition?.label ?? sourceAbility.name,
    type: effect.type,
    category: statusDefinition?.category,
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

function removeStatusEffectsByCategory(snapshot: Record<string, unknown>, effect: ResolvedAbilityEffect) {
  const category = String(effect.value ?? "").trim();
  if (!category) {
    return;
  }
  const nextEffects = getStatusEffects(snapshot).filter((item) => {
    if (item.category === category) {
      return false;
    }
    return !isStatusInCategory(item.key || item.label || item.value, category);
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
    case "removeStatusCategory":
      removeStatusEffectsByCategory(snapshot, effect);
      break;
    case "grantStatusImmunity":
      appendStatusImmunity(snapshot, effect, false);
      break;
    case "grantStatusCategoryImmunity":
      appendStatusImmunity(snapshot, effect, true);
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
  const metadata = { ...(input.metadata ?? {}) };
  const automationInput = toOptionalPlainRecord(input.automation);
  const abilityAutomationDefaults = toOptionalPlainRecord(ability.automation) as Partial<AbilityAutomationConfig> | undefined;
  const requestedAutomationMode = automationInput?.mode ?? input.automationMode ?? metadata.automationMode;
  const automationConfig = resolveAbilityAutomationConfig(
    automationInput
      ? ({
          ...automationInput,
          ...(requestedAutomationMode != null ? { mode: normalizeAbilityAutomationMode(requestedAutomationMode) } : {}),
        } as Partial<AbilityAutomationConfig>)
      : requestedAutomationMode != null
        ? normalizeAbilityAutomationMode(requestedAutomationMode)
        : undefined,
    abilityAutomationDefaults
  );
  const manualOverrides = toOptionalPlainRecord(input.manualOverrides);
  const workflow = createAbilityWorkflowRun({
    abilityId: ability.id,
    abilityName: ability.name,
    actor: createAbilityWorkflowCharacterSnapshot({
      characterId: actorCharacter.id,
      name: actorCharacter.name,
      stats: actorStats,
      snapshot: actorSnapshot
    }),
    targets: targetCharacters.map((character) =>
      createAbilityWorkflowCharacterSnapshot({
        characterId: character.id,
        name: character.name,
        stats: character.id === primaryTargetCharacter?.id ? primaryTargetStats : toPlainRecord(character.stats),
        snapshot: character.id === primaryTargetCharacter?.id ? primaryTargetSnapshot : toPlainRecord(character.snapshot)
      })
    ),
    config: automationConfig,
    manualOverrides
  });
  setAbilityWorkflowPhase(workflow, "declare", "resolved", `${ability.name} declared by ${actorCharacter.name}.`);
  setAbilityWorkflowPhase(
    workflow,
    "target-confirmation",
    targetCharacters.length > 0 ? "resolved" : "skipped",
    targetCharacters.length > 0
      ? `${targetCharacters.length} target(s) selected.`
      : "No explicit target was selected."
  );

  const context: AbilityFormulaContext = buildDefaultAbilityFormulaContext({
    actor: actorScope,
    target: targetScope,
    scene: { id: sceneId },
    combat: {},
    world: { id: worldId },
    metadata: { ...metadata, automationMode: automationConfig.mode }
  });

  const triggerCondition = toAbilityTriggerCondition(ability.trigger);
  if (ability.activation === "triggered" && triggerCondition && !evaluateConditionExpression(triggerCondition, context)) {
    throw new Error("ability trigger condition not met");
  }

  const costs = resolveAbilityCosts(toResourceCosts(ability.resourceCosts), context);
  const effects = resolveAbilityEffects(toEffectExpressions(ability.effects), context);
  const shouldConsumeResources = automationConfig.mode !== "manual" && automationConfig.autoConsumeResources;
  const shouldApplyDamage = automationConfig.mode !== "manual" && automationConfig.autoApplyDamage;
  const shouldApplyEffects = automationConfig.mode !== "manual" && automationConfig.autoApplyEffects;
  setAbilityWorkflowPhase(
    workflow,
    "cost-check",
    costs.length === 0 ? "skipped" : shouldConsumeResources ? "resolved" : "waiting",
    costs.length === 0
      ? "No resource cost."
      : shouldConsumeResources
        ? `${costs.length} cost item(s) will be consumed.`
        : "Resource cost is waiting for manual application."
  );
  setAbilityWorkflowPhase(workflow, "reaction-window", "skipped", "Reaction prompts are not wired yet.");

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
            ? resolveAbilitySaveTargetValue(ability.saveDC, actorSnapshot)
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
    setAbilityWorkflowPhase(
      workflow,
      ability.checkType === "savingThrow" ? "save-roll" : "attack-roll",
      "resolved",
      `Check total ${settlement.check.total} vs ${settlement.check.targetValue ?? "-"} (${settlement.check.success ? "success" : "failed"}).`
    );
    setAbilityWorkflowPhase(
      workflow,
      ability.checkType === "savingThrow" ? "attack-roll" : "save-roll",
      "skipped",
      ability.checkType === "savingThrow" ? "No attack roll for saving throw ability." : "No saving throw for attack ability."
    );
    setAbilityWorkflowPhase(
      workflow,
      "damage-roll",
      damageRoll ? "resolved" : "skipped",
      damageRoll ? `Damage total ${settlement.damage.total}.` : "No direct damage roll."
    );
    if (settlement.damage.total > 0 && executionSucceeded) {
      workflow.damageApplications.push(
        resolveDamageApplication({
          target: primaryTargetCharacter,
          stats: primaryTargetStats,
          snapshot: primaryTargetSnapshot,
          rawDamage: settlement.damage.total,
          damageType: settlement.damage.damageType ?? undefined,
          applied: shouldApplyDamage,
          canUndo: automationConfig.createUndoSnapshot,
          notes: shouldApplyDamage ? undefined : ["Damage is waiting for manual application."]
        })
      );
      setAbilityWorkflowPhase(
        workflow,
        "damage-application",
        shouldApplyDamage ? "resolved" : "waiting",
        shouldApplyDamage ? "Damage was applied to the primary target." : "Damage is waiting for manual application."
      );
    } else {
      setAbilityWorkflowPhase(
        workflow,
        "damage-application",
        "skipped",
        settlement.damage.total > 0 ? "Check failed, so damage was not applied." : "No direct damage to apply."
      );
    }
  } else {
    setAbilityWorkflowPhase(workflow, "attack-roll", "skipped", "No attack roll.");
    setAbilityWorkflowPhase(workflow, "save-roll", "skipped", "No saving throw.");
    setAbilityWorkflowPhase(workflow, "damage-roll", "skipped", "No damage roll.");
    setAbilityWorkflowPhase(workflow, "damage-application", "skipped", "No direct damage to apply.");
  }

  if (shouldConsumeResources) {
    costs.forEach((cost) => applyResourceCost(actorStats, cost));
  }

  const updatedTargets = targetCharacters.map((character) => {
    const stats = character.id === primaryTargetCharacter?.id ? primaryTargetStats : toPlainRecord(character.stats);
    const snapshot = character.id === primaryTargetCharacter?.id ? primaryTargetSnapshot : toPlainRecord(character.snapshot);
    return { character, stats, snapshot };
  });

  if (effects.length === 0) {
    setAbilityWorkflowPhase(workflow, "effect-application", "skipped", "No effect expression.");
  } else if (!executionSucceeded) {
    setAbilityWorkflowPhase(workflow, "effect-application", "skipped", "Check failed, so effects were not applied.");
  } else if (!shouldApplyEffects) {
    setAbilityWorkflowPhase(workflow, "effect-application", "waiting", "Effects are waiting for manual application.");
  } else {
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
    setAbilityWorkflowPhase(workflow, "effect-application", "resolved", `${effects.length} effect(s) applied.`);
  }

  setAbilityWorkflowPhase(workflow, "post-apply", "skipped", "Post-apply hooks are not wired yet.");

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

  attachAbilityWorkflowAfterSnapshots(workflow, {
    actor: { stats: actorStats, snapshot: actorSnapshot },
    targets: updatedTargets.map((target) => ({
      characterId: target.character.id,
      stats: target.stats,
      snapshot: target.snapshot
    }))
  });
  setAbilityWorkflowPhase(
    workflow,
    "settle",
    executionSucceeded ? "resolved" : "failed",
    executionSucceeded ? "Workflow settled." : "Workflow failed before application completed."
  );
  finalizeAbilityWorkflow(
    workflow,
    executionSucceeded
      ? workflow.phases.some((phase) => phase.status === "waiting")
        ? "waiting"
        : "completed"
      : "failed"
  );

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
    workflow,
    metadata: { ...metadata, automationMode: automationConfig.mode },
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
    workflow,
    logEntry
  };
}
