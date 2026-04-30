import type {
  AbilityDefinition,
  ConditionExpression,
  EffectExpression,
  FormulaComparableValue,
  ResourceCost,
} from "../types/world-entities";
import { isStatusInCategory } from "./ability-registry";

export type FormulaPrimitive = string | number | boolean | null | undefined;

export type FormulaScope = Record<string, unknown>;

export type AbilityFormulaContext = {
  actor: FormulaScope;
  target: FormulaScope;
  scene: FormulaScope;
  combat: FormulaScope;
  world: FormulaScope;
  metadata: FormulaScope;
};

export type ResolvedAbilityCost = {
  index: number;
  type: ResourceCost["type"];
  label: string;
  rawAmount: string | number;
  amount: number;
};

export type ResolvedAbilityEffect = {
  index: number;
  type: EffectExpression["type"];
  target: EffectExpression["target"];
  stat?: string;
  label?: string;
  duration?: EffectExpression["duration"];
  durationValue?: number;
  value: string | number | boolean | null;
  customExpr?: string;
};

const UNSAFE_FORMULA_TOKENS = [
  "=>",
  "function",
  "constructor",
  "__proto__",
  "prototype",
  "globalThis",
  "window",
  "document",
  "process",
  "require",
  "import",
  "export",
  "class ",
  "while(",
  "for(",
  "try(",
  "catch(",
];

const SAFE_FORMULA_PATTERN = /^[\w\s.+\-*/%(),<>=!&|?:'"]+$/;
const FORMULA_HINT_PATTERN =
  /\b(actor|target|scene|combat|world|metadata)\b|(?:^|[^\w])\d+d\d+|roll\s*\(|if\s*\(|when\s*\(|min\s*\(|max\s*\(|floor\s*\(|ceil\s*\(|round\s*\(|abs\s*\(|pow\s*\(|sqrt\s*\(|clamp\s*\(/i;

function rollDiceExpression(input: string): number {
  const normalized = input.trim();
  const matched = normalized.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!matched) {
    throw new Error(`invalid dice expression: ${input}`);
  }

  const diceCount = Math.max(1, Number(matched[1]));
  const diceSides = Math.max(2, Number(matched[2]));
  const sign = matched[3] === "-" ? -1 : 1;
  const flatBonus = matched[4] ? Number(matched[4]) * sign : 0;

  let total = flatBonus;
  for (let index = 0; index < diceCount; index += 1) {
    total += Math.floor(Math.random() * diceSides) + 1;
  }

  return total;
}

function ifHelper(condition: unknown, truthyValue: unknown, falsyValue: unknown) {
  return condition ? truthyValue : falsyValue;
}

function clampHelper(value: unknown, min: unknown, max: unknown) {
  const numeric = Number(value);
  const minNumeric = Number(min);
  const maxNumeric = Number(max);
  if (!Number.isFinite(numeric) || !Number.isFinite(minNumeric) || !Number.isFinite(maxNumeric)) {
    return 0;
  }
  return Math.min(Math.max(numeric, minNumeric), maxNumeric);
}

function normalizeFormulaExpression(expression: string) {
  return expression
    .replace(/\bif\s*\(/g, "ifFn(")
    .replace(/\bwhen\s*\(/g, "whenFn(");
}

export function getFormulaContextValue(context: AbilityFormulaContext, path: string): unknown {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return undefined;
  }

  const segments = normalizedPath.split(".").filter(Boolean);
  let cursor: unknown = context;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function toFormulaNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric;
}

export function toFormulaBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
    return true;
  }
  return Boolean(value);
}

export function evaluateFormulaExpression(expression: FormulaPrimitive, context: AbilityFormulaContext): unknown {
  if (typeof expression === "number" || typeof expression === "boolean") {
    return expression;
  }

  if (expression === null || typeof expression === "undefined") {
    return 0;
  }

  const normalized = String(expression).trim();
  if (!normalized) {
    return 0;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  const prepared = normalizeFormulaExpression(normalized);
  const compact = prepared.replace(/\s+/g, "");
  if (!SAFE_FORMULA_PATTERN.test(prepared)) {
    if (!FORMULA_HINT_PATTERN.test(normalized)) {
      return normalized;
    }
    throw new Error(`formula contains unsupported characters: ${expression}`);
  }
  if (UNSAFE_FORMULA_TOKENS.some((token) => compact.includes(token.replace(/\s+/g, "")))) {
    throw new Error(`formula contains unsafe token: ${expression}`);
  }

  const evaluator = new Function(
    "actor",
    "target",
    "scene",
    "combat",
    "world",
    "metadata",
    "roll",
    "min",
    "max",
    "floor",
    "ceil",
    "round",
    "abs",
    "pow",
    "sqrt",
    "clamp",
    "ifFn",
    "whenFn",
    `"use strict"; return (${prepared});`
  );

  try {
    return evaluator(
      context.actor,
      context.target,
      context.scene,
      context.combat,
      context.world,
      context.metadata,
      rollDiceExpression,
      Math.min,
      Math.max,
      Math.floor,
      Math.ceil,
      Math.round,
      Math.abs,
      Math.pow,
      Math.sqrt,
      clampHelper,
      ifHelper,
      ifHelper
    );
  } catch (error) {
    if (!FORMULA_HINT_PATTERN.test(normalized)) {
      return normalized;
    }
    throw error;
  }
}

function compareValues(left: unknown, operator: ConditionExpression["operator"], right: unknown) {
  switch (operator) {
    case "!=":
      return left !== right;
    case ">=":
      return toFormulaNumber(left) >= toFormulaNumber(right);
    case "<=":
      return toFormulaNumber(left) <= toFormulaNumber(right);
    case ">":
      return toFormulaNumber(left) > toFormulaNumber(right);
    case "<":
      return toFormulaNumber(left) < toFormulaNumber(right);
    case "includes":
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      if (typeof left === "string") {
        return left.includes(String(right ?? ""));
      }
      return false;
    case "==":
    default:
      return left === right;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getScopedNumber(context: AbilityFormulaContext, path: string, fallback = 0) {
  return toFormulaNumber(getFormulaContextValue(context, path), fallback);
}

function resolveDcReference(value: Record<string, unknown>, context: AbilityFormulaContext) {
  const mode = String(value.mode ?? "fixed");
  const attribute = String(value.attribute ?? "intelligence");
  const fixed = value.fixed ?? value.base;
  if (mode === "fixed") {
    return toFormulaNumber(fixed, 10);
  }
  if (mode === "targetAc") {
    return getScopedNumber(context, "target.ac", 10);
  }

  const source = mode.startsWith("target") ? "target" : "actor";
  const proficiency = getScopedNumber(context, `${source}.proficiencyBonus`, 2);
  const attributeMod = getScopedNumber(context, `${source}.attributeMods.${attribute}`, 0);

  if (mode === "actorSpellDc") {
    const explicit = getScopedNumber(context, "actor.spellDc", Number.NaN);
    if (Number.isFinite(explicit)) {
      return explicit;
    }
  }
  if (mode === "targetSpellDc") {
    const explicit = getScopedNumber(context, "target.spellDc", Number.NaN);
    if (Number.isFinite(explicit)) {
      return explicit;
    }
  }
  if (mode === "actorProfessionDc") {
    const explicit = getScopedNumber(context, "actor.professionDc", Number.NaN);
    if (Number.isFinite(explicit)) {
      return explicit;
    }
  }
  if (mode === "targetPassivePerception") {
    return 10 + getScopedNumber(context, "target.attributeMods.wisdom", 0);
  }

  return 8 + proficiency + attributeMod;
}

function resolveComparableValue(value: FormulaComparableValue | undefined, context: AbilityFormulaContext): unknown {
  if (!isPlainRecord(value)) {
    return value;
  }

  if (value.kind === "valueRef") {
    return getFormulaContextValue(context, String(value.path ?? ""));
  }

  if (value.kind === "dc") {
    return resolveDcReference(value, context);
  }

  return value;
}

function resolveConditionFieldValue(field: string | undefined, context: AbilityFormulaContext) {
  const normalized = String(field ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const direct = getFormulaContextValue(context, normalized);
  if (typeof direct !== "undefined") {
    return direct;
  }

  return evaluateFormulaExpression(normalized, context);
}

export function evaluateConditionExpression(
  expression: ConditionExpression | undefined,
  context: AbilityFormulaContext
): boolean {
  if (!expression) {
    return true;
  }

  switch (expression.type) {
    case "and":
      return (expression.children ?? []).every((item) => evaluateConditionExpression(item, context));
    case "or":
      return (expression.children ?? []).some((item) => evaluateConditionExpression(item, context));
    case "not":
      return !evaluateConditionExpression(expression.children?.[0], context);
    case "hasTag": {
      const list = getFormulaContextValue(context, expression.field ?? "target.tags");
      if (!Array.isArray(list)) {
        return false;
      }
      return list.includes(expression.value);
    }
    case "hasState": {
      const list = getFormulaContextValue(context, expression.field ?? "target.statusEffects");
      if (!Array.isArray(list)) {
        return false;
      }
      return list.some((item) => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const key = (item as Record<string, unknown>).key;
        const label = (item as Record<string, unknown>).label;
        return key === expression.value || label === expression.value;
      });
    }
    case "hasStatusCategory": {
      const list = getFormulaContextValue(context, expression.field ?? "target.statusEffects");
      if (!Array.isArray(list)) {
        return false;
      }
      return list.some((item) => {
        if (typeof item === "string") {
          return isStatusInCategory(item, expression.value);
        }
        if (!item || typeof item !== "object") {
          return false;
        }
        const record = item as Record<string, unknown>;
        return (
          record.category === expression.value ||
          isStatusInCategory(record.key, expression.value) ||
          isStatusInCategory(record.label, expression.value) ||
          isStatusInCategory(record.value, expression.value)
        );
      });
    }
    case "levelCheck":
      return compareValues(
        resolveConditionFieldValue(expression.field ?? "actor.level", context),
        expression.operator ?? ">=",
        resolveComparableValue(expression.value ?? 0, context)
      );
    case "resourceCheck":
      return compareValues(
        resolveConditionFieldValue(expression.field ?? "actor.mp", context),
        expression.operator ?? ">=",
        resolveComparableValue(expression.value ?? 0, context)
      );
    case "custom":
      return toFormulaBoolean(evaluateFormulaExpression(expression.customExpr ?? "", context));
    case "compare":
    default:
      return compareValues(
        resolveConditionFieldValue(expression.field ?? "", context),
        expression.operator ?? "==",
        resolveComparableValue(expression.value, context)
      );
  }
}

export function resolveAbilityCosts(costs: ResourceCost[] | undefined, context: AbilityFormulaContext): ResolvedAbilityCost[] {
  if (!Array.isArray(costs)) {
    return [];
  }

  return costs.map((item, index) => ({
    index,
    type: item.type,
    label: item.label,
    rawAmount: item.amount,
    amount: Math.max(0, Math.floor(toFormulaNumber(evaluateFormulaExpression(item.amount, context), 0))),
  }));
}

export function resolveAbilityEffects(
  effects: EffectExpression[] | undefined,
  context: AbilityFormulaContext
): ResolvedAbilityEffect[] {
  if (!Array.isArray(effects)) {
    return [];
  }

  return effects.map((effect, index) => {
    const resolvedValue =
      typeof effect.customExpr === "string" && effect.customExpr.trim()
        ? evaluateFormulaExpression(effect.customExpr, context)
        : typeof effect.value === "string" || typeof effect.value === "number" || typeof effect.value === "boolean"
          ? evaluateFormulaExpression(effect.value, context)
          : effect.value ?? null;

    return {
      index,
      type: effect.type,
      target: effect.target,
      stat: effect.stat,
      label: effect.label,
      duration: effect.duration,
      durationValue: effect.durationValue,
      value:
        typeof resolvedValue === "string" || typeof resolvedValue === "number" || typeof resolvedValue === "boolean"
          ? resolvedValue
          : resolvedValue === null
            ? null
            : JSON.stringify(resolvedValue),
      customExpr: effect.customExpr,
    };
  });
}

export function buildDefaultAbilityFormulaContext(overrides?: Partial<AbilityFormulaContext>): AbilityFormulaContext {
  return {
    actor: {},
    target: {},
    scene: {},
    combat: {},
    world: {},
    metadata: {},
    ...(overrides ?? {}),
  };
}

export function isAbilityTriggered(ability: Pick<AbilityDefinition, "trigger">, context: AbilityFormulaContext) {
  if (!ability.trigger) {
    return false;
  }
  return evaluateConditionExpression(ability.trigger.condition, context);
}
