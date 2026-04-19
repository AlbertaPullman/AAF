import { WorldRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveScene } from "./scene.service";

export type SettlementAdvantageState = "normal" | "advantage" | "disadvantage";
export type SettlementResourceTiming = "declare" | "hit" | "resolve";

export type SettlementCheckInput = {
  targetType?: "AC" | "DC";
  targetValue?: number;
  attributeMod?: number;
  proficiency?: number;
  expertise?: number;
  bonusDiceCount?: number;
  penaltyDiceCount?: number;
  advantageState?: SettlementAdvantageState;
  extraModifiers?: number[];
  criticalRangeStart?: number;
};

export type SettlementDamageInput = {
  formula: string;
  damageType?: string;
};

export type SettlementResolveInput = {
  actionId: string;
  actorTokenId: string;
  actorName?: string;
  targetTokenId?: string;
  targetName?: string;
  check: SettlementCheckInput;
  damage?: SettlementDamageInput;
  resourceCost?: number;
  resourceTiming?: SettlementResourceTiming;
  fixedRolls?: {
    d20?: number[];
    bonusDice?: number[];
    penaltyDice?: number[];
    damageDice?: number[];
  };
};

export type SettlementStageLog = {
  stage:
    | "declare"
    | "validate"
    | "reserve-resource"
    | "roll"
    | "judge"
    | "damage"
    | "effects"
    | "trigger"
    | "finalize"
    | "rollback"
    | "error";
  status: "ok" | "skipped" | "error";
  message: string;
};

export type SettlementCheckResult = {
  targetType: "AC" | "DC" | null;
  targetValue: number | null;
  advantageState: SettlementAdvantageState;
  d20Rolls: number[];
  selectedD20: number;
  bonusDiceRolls: number[];
  penaltyDiceRolls: number[];
  bonusDiceValue: number;
  penaltyDiceValue: number;
  attributeMod: number;
  proficiency: number;
  expertise: number;
  extraModifiers: number[];
  total: number;
  success: boolean;
  critical: boolean;
};

export type SettlementDamageResult = {
  formula: string | null;
  resolvedFormula: string | null;
  damageType: string | null;
  diceRolls: number[];
  flatBonus: number;
  total: number;
};

export type SettlementResourceResult = {
  timing: SettlementResourceTiming;
  cost: number;
  consumed: number;
  rolledBack: number;
};

export type SettlementResolveResult = {
  success: boolean;
  actionId: string;
  actorTokenId: string;
  actorName: string | null;
  targetTokenId: string | null;
  targetName: string | null;
  check: SettlementCheckResult;
  damage: SettlementDamageResult;
  resource: SettlementResourceResult;
  stages: SettlementStageLog[];
  error: string | null;
  createdAt: string;
};

export type SceneSettlementLogEntry = {
  id: string;
  worldId: string;
  sceneId: string;
  actionId: string;
  actorTokenId: string;
  targetTokenId: string | null;
  createdAt: string;
  summary: {
    success: boolean;
    hit: boolean;
    critical: boolean;
    total: number;
    damage: number;
    resourceConsumed: number;
  };
  result: SettlementResolveResult;
};

export type SceneSettlementResolveResponse = {
  result: SettlementResolveResult;
  logEntry: SceneSettlementLogEntry;
};

type ParsedDamageFormula = {
  diceCount: number;
  diceSides: number;
  flatBonus: number;
};

const MAX_LOG_ENTRIES = 100;

function toIsoNow() {
  return new Date().toISOString();
}

function createLogId() {
  return `stl_${Math.random().toString(36).slice(2, 10)}`;
}

function asInteger(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.trunc(numeric);
}

function toNonNegativeInteger(value: unknown, fallback = 0): number {
  const next = asInteger(value, fallback);
  return next < 0 ? 0 : next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function randomIntInclusive(min: number, max: number): number {
  const floorMin = Math.ceil(min);
  const floorMax = Math.floor(max);
  return Math.floor(Math.random() * (floorMax - floorMin + 1)) + floorMin;
}

function getRollFromQueue(queue: number[], sides: number): number {
  const candidate = queue.shift();
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const normalized = Math.trunc(candidate);
    if (normalized >= 1 && normalized <= sides) {
      return normalized;
    }
  }
  return randomIntInclusive(1, sides);
}

function normalizeAdvantageState(input: unknown): SettlementAdvantageState {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (normalized === "advantage" || normalized === "disadvantage") {
    return normalized;
  }
  return "normal";
}

function normalizeResourceTiming(input: unknown): SettlementResourceTiming {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (normalized === "hit" || normalized === "resolve") {
    return normalized;
  }
  return "declare";
}

function parseDamageFormula(formula: string): ParsedDamageFormula {
  const normalized = formula.trim();
  const match = normalized.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) {
    throw new Error("invalid damage formula, expected format like 2d6+3");
  }

  const diceCount = asInteger(match[1], 0);
  const diceSides = asInteger(match[2], 0);
  const sign = match[3] ?? "+";
  const rawBonus = asInteger(match[4] ?? 0, 0);
  const flatBonus = sign === "-" ? -rawBonus : rawBonus;

  if (diceCount <= 0 || diceCount > 200) {
    throw new Error("damage dice count must be between 1 and 200");
  }
  if (diceSides <= 1 || diceSides > 1000) {
    throw new Error("damage dice sides must be between 2 and 1000");
  }

  return { diceCount, diceSides, flatBonus };
}

function buildDamageFormulaText(parsed: ParsedDamageFormula): string {
  if (parsed.flatBonus === 0) {
    return `${parsed.diceCount}d${parsed.diceSides}`;
  }

  if (parsed.flatBonus > 0) {
    return `${parsed.diceCount}d${parsed.diceSides}+${parsed.flatBonus}`;
  }

  return `${parsed.diceCount}d${parsed.diceSides}${parsed.flatBonus}`;
}

function isSceneSettlementLogEntry(value: unknown): value is SceneSettlementLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.worldId === "string" &&
    typeof candidate.sceneId === "string" &&
    typeof candidate.actionId === "string" &&
    typeof candidate.actorTokenId === "string" &&
    typeof candidate.createdAt === "string" &&
    !!candidate.summary &&
    typeof candidate.summary === "object" &&
    !!candidate.result &&
    typeof candidate.result === "object"
  );
}

function normalizeSceneSettlementLogs(input: unknown): SceneSettlementLogEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter(isSceneSettlementLogEntry);
}

function assertRequiredId(input: unknown, field: string): string {
  const normalized = String(input ?? "").trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function createDefaultCheckResult(advantageState: SettlementAdvantageState): SettlementCheckResult {
  return {
    targetType: null,
    targetValue: null,
    advantageState,
    d20Rolls: [],
    selectedD20: 0,
    bonusDiceRolls: [],
    penaltyDiceRolls: [],
    bonusDiceValue: 0,
    penaltyDiceValue: 0,
    attributeMod: 0,
    proficiency: 0,
    expertise: 0,
    extraModifiers: [],
    total: 0,
    success: false,
    critical: false
  };
}

function createDefaultDamageResult(): SettlementDamageResult {
  return {
    formula: null,
    resolvedFormula: null,
    damageType: null,
    diceRolls: [],
    flatBonus: 0,
    total: 0
  };
}

export function resolveSettlementAction(input: SettlementResolveInput): SettlementResolveResult {
  const createdAt = toIsoNow();
  const stages: SettlementStageLog[] = [];

  const actionId = String(input.actionId ?? "").trim();
  const actorTokenId = String(input.actorTokenId ?? "").trim();
  const actorName = typeof input.actorName === "string" && input.actorName.trim() ? input.actorName.trim() : null;
  const targetTokenId = typeof input.targetTokenId === "string" && input.targetTokenId.trim() ? input.targetTokenId.trim() : null;
  const targetName = typeof input.targetName === "string" && input.targetName.trim() ? input.targetName.trim() : null;

  const resourceTiming = normalizeResourceTiming(input.resourceTiming);
  const resourceCost = toNonNegativeInteger(input.resourceCost);

  const fixedRolls = {
    d20: [...(input.fixedRolls?.d20 ?? [])],
    bonusDice: [...(input.fixedRolls?.bonusDice ?? [])],
    penaltyDice: [...(input.fixedRolls?.penaltyDice ?? [])],
    damageDice: [...(input.fixedRolls?.damageDice ?? [])]
  };

  let consumedResource = 0;
  let rolledBackResource = 0;

  let checkResult = createDefaultCheckResult(normalizeAdvantageState(input.check?.advantageState));
  let damageResult = createDefaultDamageResult();

  try {
    stages.push({ stage: "declare", status: "ok", message: "action declared" });

    if (!actionId) {
      throw new Error("actionId is required");
    }
    if (!actorTokenId) {
      throw new Error("actorTokenId is required");
    }

    if (!input.check || typeof input.check !== "object") {
      throw new Error("check config is required");
    }

    stages.push({ stage: "validate", status: "ok", message: "input validated" });

    if (resourceTiming === "declare" && resourceCost > 0) {
      consumedResource = resourceCost;
      stages.push({ stage: "reserve-resource", status: "ok", message: `resource consumed at declare: ${resourceCost}` });
    } else {
      stages.push({ stage: "reserve-resource", status: "skipped", message: "resource not consumed at declare stage" });
    }

    const targetType = input.check.targetType === "AC" || input.check.targetType === "DC" ? input.check.targetType : null;
    const targetValue = Number.isFinite(input.check.targetValue) ? Math.max(0, Number(input.check.targetValue)) : null;

    const attributeMod = asInteger(input.check.attributeMod, 0);
    const proficiency = asInteger(input.check.proficiency, 0);
    const expertise = asInteger(input.check.expertise, 0);
    const advantageState = normalizeAdvantageState(input.check.advantageState);

    const rawExtraModifiers = Array.isArray(input.check.extraModifiers)
      ? input.check.extraModifiers.filter((item) => Number.isFinite(item)).map((item) => asInteger(item, 0))
      : [];

    const rawBonusDiceCount = toNonNegativeInteger(input.check.bonusDiceCount, 0);
    const rawPenaltyDiceCount = toNonNegativeInteger(input.check.penaltyDiceCount, 0);

    const limitedBonusDiceCount = Math.min(rawBonusDiceCount, 3);
    const limitedPenaltyDiceCount = Math.min(rawPenaltyDiceCount, 3);
    const canceledDiceCount = Math.min(limitedBonusDiceCount, limitedPenaltyDiceCount);
    const resolvedBonusDiceCount = limitedBonusDiceCount - canceledDiceCount;
    const resolvedPenaltyDiceCount = limitedPenaltyDiceCount - canceledDiceCount;

    const d20RollCount = advantageState === "normal" ? 1 : 2;
    const d20Rolls = Array.from({ length: d20RollCount }, () => getRollFromQueue(fixedRolls.d20, 20));

    const selectedD20 =
      advantageState === "advantage"
        ? Math.max(...d20Rolls)
        : advantageState === "disadvantage"
          ? Math.min(...d20Rolls)
          : d20Rolls[0];

    const bonusDiceRolls = Array.from({ length: resolvedBonusDiceCount }, () => getRollFromQueue(fixedRolls.bonusDice, 6));
    const penaltyDiceRolls = Array.from({ length: resolvedPenaltyDiceCount }, () => getRollFromQueue(fixedRolls.penaltyDice, 6));

    const bonusDiceValue = bonusDiceRolls.length > 0 ? Math.max(...bonusDiceRolls) : 0;
    const penaltyDiceValue = penaltyDiceRolls.length > 0 ? Math.max(...penaltyDiceRolls) : 0;

    const totalWithModifiers =
      selectedD20 +
      attributeMod +
      proficiency +
      expertise +
      bonusDiceValue -
      penaltyDiceValue +
      rawExtraModifiers.reduce((sum, item) => sum + item, 0);

    const finalTotal = Math.max(1, Math.floor(totalWithModifiers));
    const success = targetValue === null ? true : finalTotal >= targetValue;

    const criticalRangeStart = clamp(asInteger(input.check.criticalRangeStart, 20), 2, 20);
    const critical = success && selectedD20 >= criticalRangeStart;

    checkResult = {
      targetType,
      targetValue,
      advantageState,
      d20Rolls,
      selectedD20,
      bonusDiceRolls,
      penaltyDiceRolls,
      bonusDiceValue,
      penaltyDiceValue,
      attributeMod,
      proficiency,
      expertise,
      extraModifiers: rawExtraModifiers,
      total: finalTotal,
      success,
      critical
    };

    stages.push({ stage: "roll", status: "ok", message: "dice rolled and modifiers resolved" });
    stages.push({ stage: "judge", status: "ok", message: success ? "check success" : "check failed" });

    if (resourceTiming === "hit" && success && resourceCost > 0) {
      consumedResource = resourceCost;
      stages.push({ stage: "reserve-resource", status: "ok", message: `resource consumed at hit: ${resourceCost}` });
    }

    if (input.damage && success) {
      const parsed = parseDamageFormula(input.damage.formula);
      const effectiveDiceCount = critical ? parsed.diceCount * 2 : parsed.diceCount;
      const diceRolls = Array.from({ length: effectiveDiceCount }, () => getRollFromQueue(fixedRolls.damageDice, parsed.diceSides));
      const damageTotal = Math.max(1, Math.floor(diceRolls.reduce((sum, item) => sum + item, 0) + parsed.flatBonus));

      damageResult = {
        formula: input.damage.formula,
        resolvedFormula: buildDamageFormulaText({ ...parsed, diceCount: effectiveDiceCount }),
        damageType: typeof input.damage.damageType === "string" && input.damage.damageType.trim() ? input.damage.damageType.trim() : null,
        diceRolls,
        flatBonus: parsed.flatBonus,
        total: damageTotal
      };

      stages.push({ stage: "damage", status: "ok", message: "damage resolved" });
    } else {
      stages.push({ stage: "damage", status: "skipped", message: success ? "no damage config" : "attack/check missed" });
    }

    stages.push({ stage: "effects", status: "ok", message: "effects stage completed" });
    stages.push({ stage: "trigger", status: "ok", message: "trigger stage completed" });

    if (resourceTiming === "resolve" && resourceCost > 0) {
      consumedResource = resourceCost;
      stages.push({ stage: "reserve-resource", status: "ok", message: `resource consumed at resolve: ${resourceCost}` });
    }

    stages.push({ stage: "finalize", status: "ok", message: "settlement finished" });

    return {
      success: true,
      actionId,
      actorTokenId,
      actorName,
      targetTokenId,
      targetName,
      check: checkResult,
      damage: damageResult,
      resource: {
        timing: resourceTiming,
        cost: resourceCost,
        consumed: consumedResource,
        rolledBack: 0
      },
      stages,
      error: null,
      createdAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown settlement error";

    if (consumedResource > 0) {
      rolledBackResource = consumedResource;
      consumedResource = 0;
      stages.push({ stage: "rollback", status: "ok", message: `resource rollback: ${rolledBackResource}` });
    }

    stages.push({ stage: "error", status: "error", message });

    return {
      success: false,
      actionId,
      actorTokenId,
      actorName,
      targetTokenId,
      targetName,
      check: checkResult,
      damage: damageResult,
      resource: {
        timing: resourceTiming,
        cost: resourceCost,
        consumed: consumedResource,
        rolledBack: rolledBackResource
      },
      stages,
      error: message,
      createdAt
    };
  }
}

function canUseSettlement(role: WorldRole): boolean {
  return role === "GM" || role === "ASSISTANT" || role === "PLAYER";
}

async function assertSettlementAccess(worldId: string, userId: string) {
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

  if (!canUseSettlement(membership.role)) {
    throw new Error("permission denied");
  }
}

function extractCanvasState(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as Record<string, unknown>;
}

export async function listSceneSettlementLogs(worldId: string, sceneId: string, userId: string): Promise<SceneSettlementLogEntry[]> {
  const normalizedWorldId = assertRequiredId(worldId, "worldId");
  const normalizedSceneId = assertRequiredId(sceneId, "sceneId");
  const normalizedUserId = assertRequiredId(userId, "userId");

  await assertSettlementAccess(normalizedWorldId, normalizedUserId);
  const scene = await resolveScene(normalizedWorldId, normalizedSceneId);

  const canvasState = extractCanvasState(scene.canvasState);
  const logs = normalizeSceneSettlementLogs(canvasState.settlementLogs);
  return logs;
}

export async function resolveSceneSettlementAction(
  worldId: string,
  sceneId: string,
  userId: string,
  input: SettlementResolveInput
): Promise<SceneSettlementResolveResponse> {
  const normalizedWorldId = assertRequiredId(worldId, "worldId");
  const normalizedSceneId = assertRequiredId(sceneId, "sceneId");
  const normalizedUserId = assertRequiredId(userId, "userId");

  await assertSettlementAccess(normalizedWorldId, normalizedUserId);
  const scene = await resolveScene(normalizedWorldId, normalizedSceneId);

  const result = resolveSettlementAction(input);

  const canvasState = extractCanvasState(scene.canvasState);
  const currentLogs = normalizeSceneSettlementLogs(canvasState.settlementLogs);

  const logEntry: SceneSettlementLogEntry = {
    id: createLogId(),
    worldId: normalizedWorldId,
    sceneId: scene.id,
    actionId: result.actionId,
    actorTokenId: result.actorTokenId,
    targetTokenId: result.targetTokenId,
    createdAt: result.createdAt,
    summary: {
      success: result.success,
      hit: result.check.success,
      critical: result.check.critical,
      total: result.check.total,
      damage: result.damage.total,
      resourceConsumed: result.resource.consumed
    },
    result
  };

  const nextLogs = [...currentLogs, logEntry].slice(-MAX_LOG_ENTRIES);

  await prisma.scene.update({
    where: { id: scene.id },
    data: {
      canvasState: {
        ...canvasState,
        settlementLogs: nextLogs
      }
    }
  });

  return { result, logEntry };
}
