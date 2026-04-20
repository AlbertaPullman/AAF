import type { ReactNode } from "react";
import type { EntityRecord, EntityType } from "../../stores/worldEntityStore";

type SelectOption = {
  label: string;
  value: string;
};

type ConditionNodeType =
  | "and"
  | "or"
  | "not"
  | "compare"
  | "hasTag"
  | "hasState"
  | "levelCheck"
  | "resourceCheck"
  | "custom";

type ResourceCostForm = {
  id: string;
  type: string;
  amount: string;
  label: string;
};

type DamageRollForm = {
  id: string;
  dice: string;
  damageType: string;
  scaling: string;
};

type EffectForm = {
  id: string;
  type: string;
  target: string;
  stat: string;
  value: string;
  duration: string;
  durationValue: string;
  label: string;
  customExpr: string;
};

type ConditionNodeForm = {
  id: string;
  type: ConditionNodeType;
  field: string;
  operator: string;
  value: string;
  customExpr: string;
  children: ConditionNodeForm[];
};

type TriggerForm = {
  enabled: boolean;
  timing: string;
  priority: string;
  limitPerRound: string;
  limitPerCombat: string;
  limitPerDay: string;
  condition: ConditionNodeForm;
};

export type AbilityEditorState = {
  resourceCosts: ResourceCostForm[];
  damageRolls: DamageRollForm[];
  trigger: TriggerForm;
  effects: EffectForm[];
};

type SkillChoicesForm = {
  count: string;
  options: string[];
};

type ProfessionSpellSlotForm = {
  id: string;
  slotLevel: string;
  amount: string;
};

type ProfessionLevelFeatureForm = {
  id: string;
  level: string;
  features: string[];
  linkedAbilityIds: string[];
  proficiencyBonus: string;
  attributeIncrease: string;
  talentPointsClass: string;
  talentPointsGeneral: string;
  hpIncrease: string;
  mpIncrease: string;
  furyIncrease: string;
  kiIncrease: string;
  extraAttacks: string;
  spellSlots: ProfessionSpellSlotForm[];
  customNotes: string;
};

export type ProfessionEditorState = {
  saveProficiencies: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillChoices: SkillChoicesForm;
  startingEquipment: string[];
  levelFeatures: ProfessionLevelFeatureForm[];
  talentTreeIds: string[];
};

type RaceAttrBonusForm = {
  id: string;
  type: "fixed" | "choice";
  attribute: string;
  amount: string;
};

type RaceTraitForm = {
  id: string;
  name: string;
  description: string;
  isMixedTrait: boolean;
  linkedAbilityId: string;
  raw: Record<string, unknown>;
};

type RaceSubtypeForm = {
  id: string;
  name: string;
  description: string;
  traits: RaceTraitForm[];
  raw: Record<string, unknown>;
};

export type RaceEditorState = {
  attrBonus: RaceAttrBonusForm[];
  languages: string[];
  traits: RaceTraitForm[];
  subtypes: RaceSubtypeForm[];
};

type BackgroundFeatureForm = {
  id: string;
  name: string;
  description: string;
  linkedAbilityId: string;
};

export type BackgroundEditorState = {
  toolProficiencies: string[];
  startingEquipment: string[];
  features: BackgroundFeatureForm[];
};

type ItemWeaponPropsForm = {
  enabled: boolean;
  attackType: string;
  damageType: string;
  damageDice: string;
  range: string;
  longRange: string;
  properties: string[];
  attackAttribute: string;
};

type ItemArmorPropsForm = {
  enabled: boolean;
  armorType: string;
  baseAC: string;
  maxDexBonus: string;
  strengthRequirement: string;
  stealthDisadvantage: boolean;
};

type ItemEnchantmentForm = {
  id: string;
  name: string;
  description: string;
  linkedAbilityId: string;
  effect: EffectForm;
};

export type ItemEditorState = {
  tags: string[];
  weaponProps: ItemWeaponPropsForm;
  armorProps: ItemArmorPropsForm;
  enchantments: ItemEnchantmentForm[];
};

type DeckCardForm = {
  id: string;
  name: string;
  description: string;
  weight: string;
  imageUrl: string;
  linkedItemId: string;
};

export type DeckEditorState = {
  cards: DeckCardForm[];
  drawnHistory: DeckDrawnHistoryForm[];
};

type DeckDrawnHistoryForm = {
  id: string;
  cardId: string;
  drawnBy: string;
  drawnAt: string;
};

type RandomTableEntryForm = {
  id: string;
  rangeMin: string;
  rangeMax: string;
  result: string;
  linkedItemId: string;
  linkedAbilityId: string;
};

export type RandomTableEditorState = {
  entries: RandomTableEntryForm[];
};

type FateClockHistoryEntryForm = {
  id: string;
  action: "advance" | "retreat";
  amount: string;
  reason: string;
  timestamp: string;
};

export type FateClockEditorState = {
  history: FateClockHistoryEntryForm[];
};

const RESOURCE_TYPE_OPTIONS: SelectOption[] = [
  { label: "魔力值 MP", value: "mp" },
  { label: "战意值", value: "fury" },
  { label: "技力", value: "ki" },
  { label: "生命值 HP", value: "hp" },
  { label: "物语点", value: "story-point" },
  { label: "体力（旧字段）", value: "stamina" },
  { label: "物品消耗", value: "item" },
  { label: "自定义", value: "custom" },
];

const DAMAGE_TYPE_OPTIONS: SelectOption[] = [
  { label: "挥砍", value: "slashing" },
  { label: "穿刺", value: "piercing" },
  { label: "钝击", value: "bludgeoning" },
  { label: "火焰", value: "fire" },
  { label: "寒冷", value: "cold" },
  { label: "闪电", value: "lightning" },
  { label: "雷鸣", value: "thunder" },
  { label: "强酸", value: "acid" },
  { label: "剧毒", value: "poison" },
  { label: "光耀", value: "radiant" },
  { label: "黯蚀", value: "necrotic" },
  { label: "力场", value: "force" },
  { label: "心灵", value: "psychic" },
];

const TRIGGER_TIMING_OPTIONS: SelectOption[] = [
  { label: "攻击命中时", value: "onAttackHit" },
  { label: "攻击未命中时", value: "onAttackMiss" },
  { label: "攻击暴击时", value: "onAttackCritical" },
  { label: "造成伤害后", value: "onDealDamage" },
  { label: "受到伤害后", value: "onTakeDamage" },
  { label: "击杀目标后", value: "onKill" },
  { label: "回合开始", value: "onTurnStart" },
  { label: "回合结束", value: "onTurnEnd" },
  { label: "轮开始", value: "onRoundStart" },
  { label: "轮结束", value: "onRoundEnd" },
  { label: "施法时", value: "onCastSpell" },
  { label: "专注检定时", value: "onConcentrationCheck" },
  { label: "豁免检定时", value: "onSavingThrow" },
  { label: "豁免失败时", value: "onSavingThrowFail" },
  { label: "豁免成功时", value: "onSavingThrowSuccess" },
  { label: "移动时", value: "onMove" },
  { label: "进入区域时", value: "onEnterArea" },
  { label: "离开区域时", value: "onLeaveArea" },
  { label: "生命半血以下", value: "onHpBelowHalf" },
  { label: "生命归零", value: "onHpZero" },
  { label: "受到治疗后", value: "onHeal" },
  { label: "短休后", value: "onShortRest" },
  { label: "长休后", value: "onLongRest" },
  { label: "战斗开始", value: "onCombatStart" },
  { label: "战斗结束", value: "onCombatEnd" },
  { label: "自定义", value: "custom" },
];

const EFFECT_TYPE_OPTIONS: SelectOption[] = [
  { label: "修改数值", value: "modifyStat" },
  { label: "附加标签", value: "addTag" },
  { label: "移除标签", value: "removeTag" },
  { label: "施加状态", value: "applyState" },
  { label: "移除状态", value: "removeState" },
  { label: "造成伤害", value: "dealDamage" },
  { label: "恢复生命", value: "heal" },
  { label: "获得临时生命", value: "grantTempHp" },
  { label: "获得优势", value: "grantAdvantage" },
  { label: "获得劣势", value: "grantDisadvantage" },
  { label: "追加奖励骰", value: "grantBonusDice" },
  { label: "追加惩罚骰", value: "grantPenaltyDice" },
  { label: "修改 AC", value: "modifyAC" },
  { label: "修改速度", value: "modifySpeed" },
  { label: "返还反应", value: "grantReaction" },
  { label: "追加攻击次数", value: "grantExtraAttack" },
  { label: "自定义效果", value: "custom" },
];

const EFFECT_TARGET_OPTIONS: SelectOption[] = [
  { label: "自身", value: "self" },
  { label: "目标", value: "target" },
  { label: "全体友军", value: "allAllies" },
  { label: "全体敌军", value: "allEnemies" },
  { label: "范围区域", value: "aoe" },
];

const DURATION_OPTIONS: SelectOption[] = [
  { label: "瞬时", value: "instantaneous" },
  { label: "轮", value: "rounds" },
  { label: "分钟", value: "minutes" },
  { label: "小时", value: "hours" },
  { label: "需专注", value: "concentration" },
  { label: "短休前", value: "until-rest-short" },
  { label: "长休前", value: "until-rest-long" },
  { label: "永久", value: "permanent" },
  { label: "特殊", value: "special" },
];

const CONDITION_TYPE_OPTIONS: SelectOption[] = [
  { label: "比较", value: "compare" },
  { label: "标签包含", value: "hasTag" },
  { label: "状态包含", value: "hasState" },
  { label: "等级检查", value: "levelCheck" },
  { label: "资源检查", value: "resourceCheck" },
  { label: "且 And", value: "and" },
  { label: "或 Or", value: "or" },
  { label: "非 Not", value: "not" },
  { label: "自定义表达式", value: "custom" },
];

const COMPARE_OPERATOR_OPTIONS: SelectOption[] = [
  { label: "等于 ==", value: "==" },
  { label: "不等于 !=", value: "!=" },
  { label: "大于 >=", value: ">=" },
  { label: "小于 <=", value: "<=" },
  { label: "大于 >", value: ">" },
  { label: "小于 <", value: "<" },
  { label: "包含 includes", value: "includes" },
];

const ATTRIBUTE_OPTIONS: SelectOption[] = [
  { label: "力量", value: "strength" },
  { label: "敏捷", value: "dexterity" },
  { label: "体质", value: "constitution" },
  { label: "智力", value: "intelligence" },
  { label: "感知", value: "wisdom" },
  { label: "魅力", value: "charisma" },
];

const RACE_ATTR_BONUS_TYPE_OPTIONS: SelectOption[] = [
  { label: "固定属性", value: "fixed" },
  { label: "自由选择", value: "choice" },
];

const WEAPON_ATTACK_TYPE_OPTIONS: SelectOption[] = [
  { label: "近战", value: "melee" },
  { label: "远程", value: "ranged" },
  { label: "投掷", value: "thrown" },
];

const ARMOR_TYPE_OPTIONS: SelectOption[] = [
  { label: "轻甲", value: "light" },
  { label: "中甲", value: "medium" },
  { label: "重甲", value: "heavy" },
  { label: "盾牌", value: "shield" },
];

export const SPECIAL_ENTITY_FIELDS: Partial<Record<EntityType, Set<string>>> = {
  abilities: new Set(["resourceCosts", "damageRolls", "trigger", "effects"]),
  professions: new Set([
    "saveProficiencies",
    "armorProficiencies",
    "weaponProficiencies",
    "toolProficiencies",
    "skillChoices",
    "startingEquipment",
    "levelFeatures",
    "talentTreeIds",
  ]),
  races: new Set(["attrBonus", "languages", "traits", "subtypes"]),
  backgrounds: new Set(["toolProficiencies", "startingEquipment", "features"]),
  items: new Set(["tags", "weaponProps", "armorProps", "enchantments"]),
  fateClocks: new Set(["history"]),
  decks: new Set(["cards", "drawnHistory"]),
  randomTables: new Set(["entries"]),
};

function createDraftId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

function toStringArray(value: unknown) {
  return asArray(value)
    .map((item) => toText(item).trim())
    .filter(Boolean);
}

function toOptionalNumberText(value: unknown) {
  if (value == null || value === "") {
    return "";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : "";
}

function toFormulaValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function toPrimitiveValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function ensureCurrentOption(options: SelectOption[], currentValue: string) {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return options;
  }
  return [{ label: `${currentValue}（当前值）`, value: currentValue }, ...options];
}

function buildEffectForm(value: unknown): EffectForm {
  const record = asObject(value);
  return {
    id: createDraftId("effect"),
    type: toText(record?.type || "custom"),
    target: toText(record?.target || "self"),
    stat: toText(record?.stat),
    value: toText(record?.value),
    duration: toText(record?.duration || "instantaneous"),
    durationValue: toOptionalNumberText(record?.durationValue),
    label: toText(record?.label),
    customExpr: toText(record?.customExpr),
  };
}

function isEffectFormEmpty(value: EffectForm) {
  return !value.stat.trim() && !value.value.trim() && !value.label.trim() && !value.customExpr.trim();
}

function buildEffectPayload(value: EffectForm) {
  if (isEffectFormEmpty(value)) {
    return undefined;
  }

  return {
    type: value.type || "custom",
    target: value.target || "self",
    ...(value.stat.trim() ? { stat: value.stat.trim() } : {}),
    ...(value.label.trim() ? { label: value.label.trim() } : {}),
    value: toFormulaValue(value.value),
    ...(value.duration ? { duration: value.duration } : {}),
    ...(typeof toOptionalNumber(value.durationValue) === "number"
      ? { durationValue: toOptionalNumber(value.durationValue) }
      : {}),
    ...(value.customExpr.trim() ? { customExpr: value.customExpr.trim() } : {}),
  };
}

function omitKeys(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
}

function buildRaceTraitForm(value: unknown): RaceTraitForm {
  const record = asObject(value);
  return {
    id: toText(record?.id || createDraftId("racetrait")),
    name: toText(record?.name),
    description: toText(record?.description),
    isMixedTrait: Boolean(record?.isMixedTrait),
    linkedAbilityId: toText(record?.linkedAbilityId),
    raw: omitKeys(record ?? {}, ["id", "name", "description", "isMixedTrait", "linkedAbilityId"]),
  };
}

function buildRaceTraitPayload(value: RaceTraitForm) {
  return {
    ...value.raw,
    id: value.id || createDraftId("racetrait"),
    name: value.name.trim() || "未命名特质",
    description: value.description.trim(),
    isMixedTrait: Boolean(value.isMixedTrait),
    ...(value.linkedAbilityId.trim() ? { linkedAbilityId: value.linkedAbilityId.trim() } : {}),
  };
}

function toRecordNumberMap(entries: ProfessionSpellSlotForm[]) {
  const result: Record<number, number> = {};
  for (const entry of entries) {
    const slotLevel = Number(entry.slotLevel);
    const amount = Number(entry.amount);
    if (!Number.isFinite(slotLevel) || slotLevel < 0 || !Number.isFinite(amount)) {
      continue;
    }
    result[Math.floor(slotLevel)] = Math.floor(amount);
  }
  return result;
}

function buildSpellSlotForms(value: unknown) {
  const record = asObject(value);
  if (!record) {
    return [] as ProfessionSpellSlotForm[];
  }
  return Object.entries(record)
    .map(([slotLevel, amount]) => ({
      id: createDraftId("spellslot"),
      slotLevel: slotLevel,
      amount: toOptionalNumberText(amount),
    }))
    .sort((left, right) => Number(left.slotLevel) - Number(right.slotLevel));
}

function createDefaultConditionNode(type: ConditionNodeType = "compare"): ConditionNodeForm {
  if (type === "hasTag") {
    return {
      id: createDraftId("cond"),
      type,
      field: "target.tags",
      operator: "includes",
      value: "",
      customExpr: "",
      children: [],
    };
  }

  if (type === "hasState") {
    return {
      id: createDraftId("cond"),
      type,
      field: "target.statusEffects",
      operator: "includes",
      value: "",
      customExpr: "",
      children: [],
    };
  }

  if (type === "levelCheck") {
    return {
      id: createDraftId("cond"),
      type,
      field: "actor.level",
      operator: ">=",
      value: "1",
      customExpr: "",
      children: [],
    };
  }

  if (type === "resourceCheck") {
    return {
      id: createDraftId("cond"),
      type,
      field: "actor.mp",
      operator: ">=",
      value: "1",
      customExpr: "",
      children: [],
    };
  }

  if (type === "custom") {
    return {
      id: createDraftId("cond"),
      type,
      field: "",
      operator: "==",
      value: "",
      customExpr: "",
      children: [],
    };
  }

  if (type === "not") {
    return {
      id: createDraftId("cond"),
      type,
      field: "",
      operator: "==",
      value: "",
      customExpr: "",
      children: [createDefaultConditionNode("compare")],
    };
  }

  if (type === "and" || type === "or") {
    return {
      id: createDraftId("cond"),
      type,
      field: "",
      operator: "==",
      value: "",
      customExpr: "",
      children: [createDefaultConditionNode("compare")],
    };
  }

  return {
    id: createDraftId("cond"),
    type: "compare",
    field: "metadata.eventName",
    operator: "==",
    value: "",
    customExpr: "",
    children: [],
  };
}

function normalizeConditionType(type: string): ConditionNodeType {
  const allowed = new Set(CONDITION_TYPE_OPTIONS.map((item) => item.value));
  return allowed.has(type) ? (type as ConditionNodeType) : "compare";
}

function buildConditionNodeForm(value: unknown): ConditionNodeForm {
  const record = asObject(value);
  if (!record) {
    return createDefaultConditionNode("compare");
  }

  const type = normalizeConditionType(toText(record.type));
  const base = createDefaultConditionNode(type);
  const children = asArray(record.children).map((item) => buildConditionNodeForm(item));

  return {
    ...base,
    type,
    field: toText(record.field || base.field),
    operator: toText(record.operator || base.operator),
    value: toText(record.value),
    customExpr: toText(record.customExpr),
    children:
      type === "and" || type === "or"
        ? children.length > 0
          ? children
          : [createDefaultConditionNode("compare")]
        : type === "not"
          ? children.length > 0
            ? [children[0]]
            : [createDefaultConditionNode("compare")]
          : [],
  };
}

function isConditionEmpty(node: ConditionNodeForm): boolean {
  if (node.type === "and" || node.type === "or") {
    return node.children.every((child) => isConditionEmpty(child));
  }
  if (node.type === "not") {
    return node.children.length === 0 || isConditionEmpty(node.children[0]);
  }
  if (node.type === "custom") {
    return !node.customExpr.trim();
  }
  if (node.type === "hasTag" || node.type === "hasState") {
    return !node.value.trim();
  }
  return !node.field.trim() && !node.value.trim();
}

function buildConditionPayload(node: ConditionNodeForm): Record<string, unknown> | undefined {
  if (isConditionEmpty(node)) {
    return undefined;
  }

  if (node.type === "and" || node.type === "or") {
    const children = node.children
      .map((child) => buildConditionPayload(child))
      .filter((child): child is Record<string, unknown> => Boolean(child));
    if (children.length === 0) {
      return undefined;
    }
    return {
      type: node.type,
      children,
    };
  }

  if (node.type === "not") {
    const child = node.children[0] ? buildConditionPayload(node.children[0]) : undefined;
    if (!child) {
      return undefined;
    }
    return {
      type: node.type,
      children: [child],
    };
  }

  if (node.type === "custom") {
    return {
      type: node.type,
      customExpr: node.customExpr.trim(),
    };
  }

  return {
    type: node.type,
    field: node.field.trim(),
    operator: node.operator,
    value: toPrimitiveValue(node.value),
  };
}

function createEmptyResourceCost(): ResourceCostForm {
  return {
    id: createDraftId("cost"),
    type: "mp",
    amount: "1",
    label: "消耗",
  };
}

function createEmptyDamageRoll(): DamageRollForm {
  return {
    id: createDraftId("damage"),
    dice: "1d6",
    damageType: "force",
    scaling: "",
  };
}

function createEmptyEffect(): EffectForm {
  return {
    id: createDraftId("effect"),
    type: "modifyStat",
    target: "target",
    stat: "",
    value: "1",
    duration: "instantaneous",
    durationValue: "",
    label: "",
    customExpr: "",
  };
}

function createEmptyLevelFeature(): ProfessionLevelFeatureForm {
  return {
    id: createDraftId("lvfeat"),
    level: "",
    features: [],
    linkedAbilityIds: [],
    proficiencyBonus: "",
    attributeIncrease: "",
    talentPointsClass: "",
    talentPointsGeneral: "",
    hpIncrease: "",
    mpIncrease: "",
    furyIncrease: "",
    kiIncrease: "",
    extraAttacks: "",
    spellSlots: [],
    customNotes: "",
  };
}

function createEmptyRaceAttrBonus(): RaceAttrBonusForm {
  return {
    id: createDraftId("racebonus"),
    type: "fixed",
    attribute: "strength",
    amount: "1",
  };
}

function createEmptyRaceTrait(): RaceTraitForm {
  return {
    id: createDraftId("racetrait"),
    name: "",
    description: "",
    isMixedTrait: false,
    linkedAbilityId: "",
    raw: {},
  };
}

function createEmptyRaceSubtype(): RaceSubtypeForm {
  return {
    id: createDraftId("racesub"),
    name: "",
    description: "",
    traits: [],
    raw: {},
  };
}

function createEmptyBackgroundFeature(): BackgroundFeatureForm {
  return {
    id: createDraftId("bgfeat"),
    name: "",
    description: "",
    linkedAbilityId: "",
  };
}

function createEmptyItemWeaponProps(): ItemWeaponPropsForm {
  return {
    enabled: false,
    attackType: "melee",
    damageType: "slashing",
    damageDice: "1d6",
    range: "",
    longRange: "",
    properties: [],
    attackAttribute: "strength",
  };
}

function createEmptyItemArmorProps(): ItemArmorPropsForm {
  return {
    enabled: false,
    armorType: "light",
    baseAC: "10",
    maxDexBonus: "",
    strengthRequirement: "",
    stealthDisadvantage: false,
  };
}

function createEmptyItemEnchantment(): ItemEnchantmentForm {
  return {
    id: createDraftId("ench"),
    name: "",
    description: "",
    linkedAbilityId: "",
    effect: buildEffectForm(undefined),
  };
}

function createEmptyDeckCard(): DeckCardForm {
  return {
    id: createDraftId("card"),
    name: "",
    description: "",
    weight: "1",
    imageUrl: "",
    linkedItemId: "",
  };
}

function createEmptyDeckDrawnHistory(): DeckDrawnHistoryForm {
  return {
    id: createDraftId("draw"),
    cardId: "",
    drawnBy: "",
    drawnAt: "",
  };
}

function createEmptyRandomTableEntry(): RandomTableEntryForm {
  return {
    id: createDraftId("rtentry"),
    rangeMin: "",
    rangeMax: "",
    result: "",
    linkedItemId: "",
    linkedAbilityId: "",
  };
}

function createEmptyFateClockHistoryEntry(): FateClockHistoryEntryForm {
  return {
    id: createDraftId("clocklog"),
    action: "advance",
    amount: "1",
    reason: "",
    timestamp: "",
  };
}

export function buildAbilityEditorState(source?: EntityRecord | null): AbilityEditorState {
  const triggerRecord = asObject(source?.trigger);
  const limitRecord = asObject(triggerRecord?.limit);

  return {
    resourceCosts: asArray(source?.resourceCosts).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("cost"),
        type: toText(record?.type || "mp"),
        amount: toText(record?.amount || "1"),
        label: toText(record?.label || "消耗"),
      };
    }),
    damageRolls: asArray(source?.damageRolls).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("damage"),
        dice: toText(record?.dice || "1d6"),
        damageType: toText(record?.damageType || "force"),
        scaling: toText(record?.scaling),
      };
    }),
    trigger: {
      enabled: Boolean(triggerRecord),
      timing: toText(triggerRecord?.timing || "onAttackHit"),
      priority: toOptionalNumberText(triggerRecord?.priority),
      limitPerRound: toOptionalNumberText(limitRecord?.perRound),
      limitPerCombat: toOptionalNumberText(limitRecord?.perCombat),
      limitPerDay: toOptionalNumberText(limitRecord?.perDay),
      condition: buildConditionNodeForm(triggerRecord?.condition),
    },
    effects: asArray(source?.effects).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("effect"),
        type: toText(record?.type || "modifyStat"),
        target: toText(record?.target || "target"),
        stat: toText(record?.stat),
        value: toText(record?.value),
        duration: toText(record?.duration || "instantaneous"),
        durationValue: toOptionalNumberText(record?.durationValue),
        label: toText(record?.label),
        customExpr: toText(record?.customExpr),
      };
    }),
  };
}

export function buildAbilityEditorPayload(state: AbilityEditorState) {
  const resourceCosts = state.resourceCosts
    .filter((row) => row.amount.trim() || row.label.trim())
    .map((row) => ({
      type: row.type || "mp",
      amount: toFormulaValue(row.amount),
      label: row.label.trim() || "消耗",
    }));

  const damageRolls = state.damageRolls
    .filter((row) => row.dice.trim())
    .map((row) => ({
      dice: row.dice.trim(),
      damageType: row.damageType || "force",
      ...(row.scaling.trim() ? { scaling: row.scaling.trim() } : {}),
    }));

  const effects = state.effects
    .filter((row) => row.value.trim() || row.label.trim() || row.customExpr.trim() || row.stat.trim())
    .map((row) => ({
      type: row.type || "modifyStat",
      target: row.target || "target",
      ...(row.stat.trim() ? { stat: row.stat.trim() } : {}),
      ...(row.label.trim() ? { label: row.label.trim() } : {}),
      value: toFormulaValue(row.value),
      ...(row.duration ? { duration: row.duration } : {}),
      ...(typeof toOptionalNumber(row.durationValue) === "number"
        ? { durationValue: toOptionalNumber(row.durationValue) }
        : {}),
      ...(row.customExpr.trim() ? { customExpr: row.customExpr.trim() } : {}),
    }));

  let trigger: Record<string, unknown> | null = null;
  if (state.trigger.enabled) {
    const condition = buildConditionPayload(state.trigger.condition);
    const limit: Record<string, number> = {};
    const perRound = toOptionalNumber(state.trigger.limitPerRound);
    const perCombat = toOptionalNumber(state.trigger.limitPerCombat);
    const perDay = toOptionalNumber(state.trigger.limitPerDay);
    if (typeof perRound === "number") {
      limit.perRound = perRound;
    }
    if (typeof perCombat === "number") {
      limit.perCombat = perCombat;
    }
    if (typeof perDay === "number") {
      limit.perDay = perDay;
    }

    trigger = {
      timing: state.trigger.timing || "onAttackHit",
      ...(condition ? { condition } : {}),
      ...(Object.keys(limit).length > 0 ? { limit } : {}),
      ...(typeof toOptionalNumber(state.trigger.priority) === "number"
        ? { priority: toOptionalNumber(state.trigger.priority) }
        : {}),
    };
  }

  return {
    resourceCosts,
    damageRolls: damageRolls.length > 0 ? damageRolls : null,
    effects,
    trigger,
  };
}

export function buildProfessionEditorState(source?: EntityRecord | null): ProfessionEditorState {
  const skillChoices = asObject(source?.skillChoices);
  return {
    saveProficiencies: toStringArray(source?.saveProficiencies),
    armorProficiencies: toStringArray(source?.armorProficiencies),
    weaponProficiencies: toStringArray(source?.weaponProficiencies),
    toolProficiencies: toStringArray(source?.toolProficiencies),
    skillChoices: {
      count: toOptionalNumberText(skillChoices?.count),
      options: toStringArray(skillChoices?.options),
    },
    startingEquipment: toStringArray(source?.startingEquipment),
    levelFeatures: asArray(source?.levelFeatures).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("lvfeat"),
        level: toOptionalNumberText(record?.level),
        features: toStringArray(record?.features),
        linkedAbilityIds: toStringArray(record?.linkedAbilityIds),
        proficiencyBonus: toOptionalNumberText(record?.proficiencyBonus),
        attributeIncrease: toOptionalNumberText(record?.attributeIncrease),
        talentPointsClass: toOptionalNumberText(record?.talentPointsClass),
        talentPointsGeneral: toOptionalNumberText(record?.talentPointsGeneral),
        hpIncrease: toText(record?.hpIncrease),
        mpIncrease: toOptionalNumberText(record?.mpIncrease),
        furyIncrease: toOptionalNumberText(record?.furyIncrease),
        kiIncrease: toOptionalNumberText(record?.kiIncrease),
        extraAttacks: toOptionalNumberText(record?.extraAttacks),
        spellSlots: buildSpellSlotForms(record?.spellSlotsGained),
        customNotes: toText(record?.customNotes),
      };
    }),
    talentTreeIds: toStringArray(source?.talentTreeIds),
  };
}

export function buildProfessionEditorPayload(state: ProfessionEditorState) {
  const levelFeatures = state.levelFeatures
    .filter((row) => {
      return Boolean(
        row.level.trim() ||
          row.features.length ||
          row.linkedAbilityIds.length ||
          row.customNotes.trim() ||
          row.hpIncrease.trim()
      );
    })
    .map((row) => {
      const spellSlots = toRecordNumberMap(row.spellSlots);
      return {
        level: Number(row.level || 1),
        features: row.features.filter((item) => item.trim()),
        linkedAbilityIds: row.linkedAbilityIds.filter((item) => item.trim()),
        ...(typeof toOptionalNumber(row.proficiencyBonus) === "number"
          ? { proficiencyBonus: toOptionalNumber(row.proficiencyBonus) }
          : {}),
        ...(typeof toOptionalNumber(row.attributeIncrease) === "number"
          ? { attributeIncrease: toOptionalNumber(row.attributeIncrease) }
          : {}),
        ...(typeof toOptionalNumber(row.talentPointsClass) === "number"
          ? { talentPointsClass: toOptionalNumber(row.talentPointsClass) }
          : {}),
        ...(typeof toOptionalNumber(row.talentPointsGeneral) === "number"
          ? { talentPointsGeneral: toOptionalNumber(row.talentPointsGeneral) }
          : {}),
        ...(row.hpIncrease.trim() ? { hpIncrease: row.hpIncrease.trim() } : {}),
        ...(typeof toOptionalNumber(row.mpIncrease) === "number"
          ? { mpIncrease: toOptionalNumber(row.mpIncrease) }
          : {}),
        ...(typeof toOptionalNumber(row.furyIncrease) === "number"
          ? { furyIncrease: toOptionalNumber(row.furyIncrease) }
          : {}),
        ...(typeof toOptionalNumber(row.kiIncrease) === "number"
          ? { kiIncrease: toOptionalNumber(row.kiIncrease) }
          : {}),
        ...(typeof toOptionalNumber(row.extraAttacks) === "number"
          ? { extraAttacks: toOptionalNumber(row.extraAttacks) }
          : {}),
        ...(Object.keys(spellSlots).length > 0 ? { spellSlotsGained: spellSlots } : {}),
        ...(row.customNotes.trim() ? { customNotes: row.customNotes.trim() } : {}),
      };
    })
    .sort((left, right) => Number(left.level) - Number(right.level));

  return {
    saveProficiencies: state.saveProficiencies.filter((item) => item.trim()),
    armorProficiencies: state.armorProficiencies.filter((item) => item.trim()),
    weaponProficiencies: state.weaponProficiencies.filter((item) => item.trim()),
    toolProficiencies: state.toolProficiencies.filter((item) => item.trim()),
    skillChoices: {
      count: Number(state.skillChoices.count || 0),
      options: state.skillChoices.options.filter((item) => item.trim()),
    },
    startingEquipment: state.startingEquipment.filter((item) => item.trim()),
    levelFeatures,
    talentTreeIds: state.talentTreeIds.filter((item) => item.trim()),
  };
}

export function buildRaceEditorState(source?: EntityRecord | null): RaceEditorState {
  return {
    attrBonus: asArray(source?.attrBonus).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("racebonus"),
        type: toText(record?.type || "fixed") === "choice" ? "choice" : "fixed",
        attribute: toText(record?.attribute || "strength"),
        amount: toOptionalNumberText(record?.amount || 1),
      };
    }),
    languages: toStringArray(source?.languages),
    traits: asArray(source?.traits).map((item) => buildRaceTraitForm(item)),
    subtypes: asArray(source?.subtypes).map((item) => {
      const record = asObject(item);
      return {
        id: toText(record?.id || createDraftId("racesub")),
        name: toText(record?.name),
        description: toText(record?.description),
        traits: asArray(record?.traits).map((trait) => buildRaceTraitForm(trait)),
        raw: omitKeys(record ?? {}, ["id", "name", "description", "traits"]),
      };
    }),
  };
}

export function buildRaceEditorPayload(state: RaceEditorState) {
  return {
    attrBonus: state.attrBonus
      .filter((row) => row.amount.trim())
      .map((row) => ({
        type: row.type,
        amount: Number(row.amount || 0),
        ...(row.type === "fixed" && row.attribute ? { attribute: row.attribute } : {}),
      })),
    languages: state.languages.filter((item) => item.trim()),
    traits: state.traits
      .filter((row) => row.name.trim() || row.description.trim() || row.linkedAbilityId.trim() || Object.keys(row.raw).length > 0)
      .map((row) => buildRaceTraitPayload(row)),
    subtypes: state.subtypes
      .filter((row) => row.name.trim() || row.description.trim() || row.traits.length > 0 || Object.keys(row.raw).length > 0)
      .map((row) => ({
        ...row.raw,
        id: row.id || createDraftId("racesub"),
        name: row.name.trim() || "未命名子种",
        description: row.description.trim(),
        traits: row.traits
          .filter(
            (trait) =>
              trait.name.trim() || trait.description.trim() || trait.linkedAbilityId.trim() || Object.keys(trait.raw).length > 0
          )
          .map((trait) => buildRaceTraitPayload(trait)),
      })),
  };
}

export function buildBackgroundEditorState(source?: EntityRecord | null): BackgroundEditorState {
  return {
    toolProficiencies: toStringArray(source?.toolProficiencies),
    startingEquipment: toStringArray(source?.startingEquipment),
    features: asArray(source?.features).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("bgfeat"),
        name: toText(record?.name),
        description: toText(record?.description),
        linkedAbilityId: toText(record?.linkedAbilityId),
      };
    }),
  };
}

export function buildBackgroundEditorPayload(state: BackgroundEditorState) {
  return {
    toolProficiencies: state.toolProficiencies.filter((item) => item.trim()),
    startingEquipment: state.startingEquipment.filter((item) => item.trim()),
    features: state.features
      .filter((row) => row.name.trim() || row.description.trim() || row.linkedAbilityId.trim())
      .map((row) => ({
        name: row.name.trim() || "未命名背景特性",
        description: row.description.trim(),
        ...(row.linkedAbilityId.trim() ? { linkedAbilityId: row.linkedAbilityId.trim() } : {}),
      })),
  };
}

export function buildItemEditorState(source?: EntityRecord | null): ItemEditorState {
  const weaponProps = asObject(source?.weaponProps);
  const armorProps = asObject(source?.armorProps);

  return {
    tags: toStringArray(source?.tags),
    weaponProps: {
      enabled: Boolean(weaponProps),
      attackType: toText(weaponProps?.attackType || "melee"),
      damageType: toText(weaponProps?.damageType || "slashing"),
      damageDice: toText(weaponProps?.damageDice || "1d6"),
      range: toOptionalNumberText(weaponProps?.range),
      longRange: toOptionalNumberText(weaponProps?.longRange),
      properties: toStringArray(weaponProps?.properties),
      attackAttribute: toText(weaponProps?.attackAttribute || "strength"),
    },
    armorProps: {
      enabled: Boolean(armorProps),
      armorType: toText(armorProps?.armorType || "light"),
      baseAC: toOptionalNumberText(armorProps?.baseAC || 10),
      maxDexBonus: toOptionalNumberText(armorProps?.maxDexBonus),
      strengthRequirement: toOptionalNumberText(armorProps?.strengthRequirement),
      stealthDisadvantage: Boolean(armorProps?.stealthDisadvantage),
    },
    enchantments: asArray(source?.enchantments).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("ench"),
        name: toText(record?.name),
        description: toText(record?.description),
        linkedAbilityId: toText(record?.linkedAbilityId),
        effect: buildEffectForm(record?.effect),
      };
    }),
  };
}

export function buildItemEditorPayload(state: ItemEditorState) {
  const weaponProps = state.weaponProps.enabled
    ? {
        attackType: state.weaponProps.attackType || "melee",
        damageType: state.weaponProps.damageType || "slashing",
        damageDice: state.weaponProps.damageDice.trim() || "1d6",
        attackAttribute: state.weaponProps.attackAttribute || "strength",
        properties: state.weaponProps.properties.filter((item) => item.trim()),
        ...(typeof toOptionalNumber(state.weaponProps.range) === "number"
          ? { range: toOptionalNumber(state.weaponProps.range) }
          : {}),
        ...(typeof toOptionalNumber(state.weaponProps.longRange) === "number"
          ? { longRange: toOptionalNumber(state.weaponProps.longRange) }
          : {}),
      }
    : null;

  const armorProps = state.armorProps.enabled
    ? {
        armorType: state.armorProps.armorType || "light",
        baseAC: Number(state.armorProps.baseAC || 10),
        ...(typeof toOptionalNumber(state.armorProps.maxDexBonus) === "number"
          ? { maxDexBonus: toOptionalNumber(state.armorProps.maxDexBonus) }
          : {}),
        ...(typeof toOptionalNumber(state.armorProps.strengthRequirement) === "number"
          ? { strengthRequirement: toOptionalNumber(state.armorProps.strengthRequirement) }
          : {}),
        stealthDisadvantage: Boolean(state.armorProps.stealthDisadvantage),
      }
    : null;

  const enchantments = state.enchantments
    .filter((row) => row.name.trim() || row.description.trim() || row.linkedAbilityId.trim() || !isEffectFormEmpty(row.effect))
    .map((row) => ({
      name: row.name.trim() || "未命名附魔",
      description: row.description.trim(),
      ...(row.linkedAbilityId.trim() ? { linkedAbilityId: row.linkedAbilityId.trim() } : {}),
      ...(buildEffectPayload(row.effect) ? { effect: buildEffectPayload(row.effect) } : {}),
    }));

  return {
    tags: state.tags.filter((item) => item.trim()),
    weaponProps,
    armorProps,
    enchantments: enchantments.length > 0 ? enchantments : null,
  };
}

export function buildDeckEditorState(source?: EntityRecord | null): DeckEditorState {
  return {
    cards: asArray(source?.cards).map((item) => {
      const record = asObject(item);
      return {
        id: toText(record?.id || createDraftId("card")),
        name: toText(record?.name),
        description: toText(record?.description),
        weight: toOptionalNumberText(record?.weight || 1),
        imageUrl: toText(record?.imageUrl),
        linkedItemId: toText(record?.linkedItemId),
      };
    }),
    drawnHistory: asArray(source?.drawnHistory).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("draw"),
        cardId: toText(record?.cardId),
        drawnBy: toText(record?.drawnBy),
        drawnAt: toText(record?.drawnAt),
      };
    }),
  };
}

export function buildDeckEditorPayload(state: DeckEditorState) {
  return {
    cards: state.cards
      .filter((row) => row.name.trim() || row.description.trim() || row.linkedItemId.trim())
      .map((row) => ({
        id: row.id,
        name: row.name.trim() || "未命名卡牌",
        description: row.description.trim(),
        weight: Number(row.weight || 1),
        ...(row.imageUrl.trim() ? { imageUrl: row.imageUrl.trim() } : {}),
        ...(row.linkedItemId.trim() ? { linkedItemId: row.linkedItemId.trim() } : {}),
      })),
    drawnHistory: state.drawnHistory
      .filter((row) => row.cardId.trim() || row.drawnBy.trim() || row.drawnAt.trim())
      .map((row) => ({
        cardId: row.cardId.trim(),
        drawnBy: row.drawnBy.trim(),
        drawnAt: row.drawnAt.trim(),
      })),
  };
}

export function buildFateClockEditorState(source?: EntityRecord | null): FateClockEditorState {
  return {
    history: asArray(source?.history).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("clocklog"),
        action: toText(record?.action) === "retreat" ? "retreat" : "advance",
        amount: toOptionalNumberText(record?.amount || 1),
        reason: toText(record?.reason),
        timestamp: toText(record?.timestamp),
      };
    }),
  };
}

export function buildFateClockEditorPayload(state: FateClockEditorState) {
  return {
    history: state.history
      .filter((row) => row.reason.trim() || row.timestamp.trim() || row.amount.trim())
      .map((row) => ({
        action: row.action,
        amount: Number(row.amount || 1),
        reason: row.reason.trim(),
        timestamp: row.timestamp.trim() || new Date().toISOString(),
      })),
  };
}

export function buildRandomTableEditorState(source?: EntityRecord | null): RandomTableEditorState {
  return {
    entries: asArray(source?.entries).map((item) => {
      const record = asObject(item);
      return {
        id: createDraftId("rtentry"),
        rangeMin: toOptionalNumberText(record?.rangeMin),
        rangeMax: toOptionalNumberText(record?.rangeMax),
        result: toText(record?.result),
        linkedItemId: toText(record?.linkedItemId),
        linkedAbilityId: toText(record?.linkedAbilityId),
      };
    }),
  };
}

export function buildRandomTableEditorPayload(state: RandomTableEditorState) {
  return {
    entries: state.entries
      .filter((row) => row.result.trim() || row.linkedItemId.trim() || row.linkedAbilityId.trim())
      .map((row) => ({
        rangeMin: Number(row.rangeMin || 1),
        rangeMax: Number(row.rangeMax || row.rangeMin || 1),
        result: row.result.trim() || "未命名结果",
        ...(row.linkedItemId.trim() ? { linkedItemId: row.linkedItemId.trim() } : {}),
        ...(row.linkedAbilityId.trim() ? { linkedAbilityId: row.linkedAbilityId.trim() } : {}),
      })),
  };
}

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="entity-form__section">
      <div className="entity-form__section-head">
        <div>
          <h5>{title}</h5>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="entity-form__section-body">{children}</div>
    </section>
  );
}

type FieldShellProps = {
  label: string;
  helperText?: string;
  span?: 1 | 2;
  action?: ReactNode;
  children: ReactNode;
};

function FieldShell({ label, helperText, span = 1, action, children }: FieldShellProps) {
  return (
    <label className={`entity-form__field ${span === 2 ? "entity-form__field--span-2" : ""}`.trim()}>
      <div className="entity-form__label-row">
        <span>{label}</span>
        {action ? <div className="entity-form__label-action">{action}</div> : null}
      </div>
      {children}
      {helperText ? <small>{helperText}</small> : null}
    </label>
  );
}

type StringListEditorProps = {
  label: string;
  items: string[];
  disabled: boolean;
  onChange: (items: string[]) => void;
  placeholder?: string;
  helperText?: string;
  span?: 1 | 2;
  options?: SelectOption[];
  addLabel?: string;
};

function StringListEditor({
  label,
  items,
  disabled,
  onChange,
  placeholder,
  helperText,
  span = 2,
  options,
  addLabel = "新增条目",
}: StringListEditorProps) {
  return (
    <FieldShell
      label={label}
      span={span}
      helperText={helperText}
      action={
        <button
          type="button"
          className="entity-builder-list__add-btn"
          disabled={disabled}
          onClick={() => onChange([...items, options?.[0]?.value ?? ""])}
        >
          {addLabel}
        </button>
      }
    >
      <div className="entity-builder-list">
        {items.length === 0 ? <div className="entity-builder-list__empty">暂无条目</div> : null}
        {items.map((item, index) => {
          const mergedOptions =
            options && !options.some((option) => option.value === item)
              ? [{ label: `${item || "未命名"}（已存在）`, value: item }, ...options]
              : options;

          return (
            <div className="entity-builder-list__row" key={`${label}-${index}-${item}`}>
              {mergedOptions ? (
                <select
                  className="entity-form__input"
                  value={item}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextItems = [...items];
                    nextItems[index] = event.target.value;
                    onChange(nextItems);
                  }}
                >
                  {mergedOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="entity-form__input"
                  value={item}
                  disabled={disabled}
                  placeholder={placeholder}
                  onChange={(event) => {
                    const nextItems = [...items];
                    nextItems[index] = event.target.value;
                    onChange(nextItems);
                  }}
                />
              )}
              <button
                type="button"
                className="entity-builder-list__remove-btn"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              >
                删除
              </button>
            </div>
          );
        })}
      </div>
    </FieldShell>
  );
}

type ConditionBuilderProps = {
  value: ConditionNodeForm;
  onChange: (value: ConditionNodeForm) => void;
  disabled: boolean;
  depth?: number;
  onRemove?: () => void;
};

function ConditionBuilder({ value, onChange, disabled, depth = 0, onRemove }: ConditionBuilderProps) {
  const onTypeChange = (nextType: ConditionNodeType) => {
    const nextNode = createDefaultConditionNode(nextType);
    onChange({
      ...nextNode,
      id: value.id,
      customExpr: nextType === "custom" ? value.customExpr : nextNode.customExpr,
    });
  };

  const childLabel = depth === 0 ? "触发条件" : `子条件 ${depth}`;

  return (
    <div className={`entity-condition entity-condition--depth-${Math.min(depth, 3)}`.trim()}>
      <div className="entity-condition__head">
        <strong>{childLabel}</strong>
        <div className="entity-condition__actions">
          <select
            className="entity-form__input entity-condition__type"
            value={value.type}
            disabled={disabled}
            onChange={(event) => onTypeChange(normalizeConditionType(event.target.value))}
          >
            {CONDITION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {onRemove ? (
            <button
              type="button"
              className="entity-builder-list__remove-btn"
              disabled={disabled}
              onClick={onRemove}
            >
              删除节点
            </button>
          ) : null}
        </div>
      </div>

      {value.type === "and" || value.type === "or" ? (
        <div className="entity-condition__children">
          {value.children.map((child, index) => (
            <ConditionBuilder
              key={child.id}
              value={child}
              disabled={disabled}
              depth={depth + 1}
              onRemove={() => {
                const nextChildren = value.children.filter((_, childIndex) => childIndex !== index);
                onChange({
                  ...value,
                  children: nextChildren.length > 0 ? nextChildren : [createDefaultConditionNode("compare")],
                });
              }}
              onChange={(nextChild) => {
                const nextChildren = [...value.children];
                nextChildren[index] = nextChild;
                onChange({ ...value, children: nextChildren });
              }}
            />
          ))}
          <button
            type="button"
            className="entity-builder-list__add-btn"
            disabled={disabled}
            onClick={() => onChange({ ...value, children: [...value.children, createDefaultConditionNode("compare")] })}
          >
            新增子条件
          </button>
        </div>
      ) : null}

      {value.type === "not" ? (
        <div className="entity-condition__children">
          <ConditionBuilder
            value={value.children[0] ?? createDefaultConditionNode("compare")}
            disabled={disabled}
            depth={depth + 1}
            onChange={(nextChild) => onChange({ ...value, children: [nextChild] })}
          />
        </div>
      ) : null}

      {value.type === "custom" ? (
        <textarea
          className="entity-form__textarea"
          rows={4}
          value={value.customExpr}
          disabled={disabled}
          placeholder="例如：metadata.eventName === 'attack:incoming' && target.hp < target.snapshot.maxHp / 2"
          onChange={(event) => onChange({ ...value, customExpr: event.target.value })}
        />
      ) : null}

      {value.type === "compare" || value.type === "levelCheck" || value.type === "resourceCheck" ? (
        <div className="entity-form__inline-grid">
          <input
            className="entity-form__input"
            value={value.field}
            disabled={disabled}
            placeholder="字段路径，例如 actor.level / metadata.eventName"
            onChange={(event) => onChange({ ...value, field: event.target.value })}
          />
          <select
            className="entity-form__input"
            value={value.operator}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, operator: event.target.value })}
          >
            {COMPARE_OPERATOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="entity-form__input"
            value={value.value}
            disabled={disabled}
            placeholder="比较值，例如 attack:incoming / 10 / true"
            onChange={(event) => onChange({ ...value, value: event.target.value })}
          />
        </div>
      ) : null}

      {value.type === "hasTag" || value.type === "hasState" ? (
        <div className="entity-form__inline-grid">
          <input
            className="entity-form__input"
            value={value.field}
            disabled={disabled}
            placeholder={value.type === "hasTag" ? "字段路径，默认 target.tags" : "字段路径，默认 target.statusEffects"}
            onChange={(event) => onChange({ ...value, field: event.target.value })}
          />
          <input
            className="entity-form__input entity-form__inline-grid-span-2"
            value={value.value}
            disabled={disabled}
            placeholder={value.type === "hasTag" ? "标签名" : "状态 key / label"}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

type SingleEffectEditorProps = {
  value: EffectForm;
  disabled: boolean;
  onChange: (value: EffectForm) => void;
};

function SingleEffectEditor({ value, disabled, onChange }: SingleEffectEditorProps) {
  return (
    <div className="entity-builder-card entity-builder-card--compact">
      <div className="entity-builder-card__grid entity-builder-card__grid--quad">
        <select
          className="entity-form__input"
          value={value.type}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
        >
          {EFFECT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="entity-form__input"
          value={value.target}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, target: event.target.value })}
        >
          {EFFECT_TARGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="entity-form__input"
          value={value.stat}
          disabled={disabled}
          placeholder="字段"
          onChange={(event) => onChange({ ...value, stat: event.target.value })}
        />
        <input
          className="entity-form__input"
          value={value.label}
          disabled={disabled}
          placeholder="标签/状态名"
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
        <input
          className="entity-form__input"
          value={value.value}
          disabled={disabled}
          placeholder="值或公式"
          onChange={(event) => onChange({ ...value, value: event.target.value })}
        />
        <select
          className="entity-form__input"
          value={value.duration}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, duration: event.target.value })}
        >
          {DURATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="entity-form__input"
          type="number"
          value={value.durationValue}
          disabled={disabled}
          placeholder="持续值"
          onChange={(event) => onChange({ ...value, durationValue: event.target.value })}
        />
        <textarea
          className="entity-form__textarea entity-builder-card__wide"
          rows={3}
          value={value.customExpr}
          disabled={disabled}
          placeholder="自定义表达式（可选）"
          onChange={(event) => onChange({ ...value, customExpr: event.target.value })}
        />
      </div>
    </div>
  );
}

type RaceTraitCollectionEditorProps = {
  label: string;
  items: RaceTraitForm[];
  disabled: boolean;
  abilityOptions: SelectOption[];
  onChange: (items: RaceTraitForm[]) => void;
  addLabel?: string;
};

function RaceTraitCollectionEditor({
  label,
  items,
  disabled,
  abilityOptions,
  onChange,
  addLabel = "新增特质",
}: RaceTraitCollectionEditorProps) {
  return (
    <FieldShell
      label={label}
      span={2}
      action={
        <button
          type="button"
          className="entity-builder-list__add-btn"
          disabled={disabled}
          onClick={() => onChange([...items, createEmptyRaceTrait()])}
        >
          {addLabel}
        </button>
      }
    >
      <div className="entity-builder-list">
        {items.length === 0 ? <div className="entity-builder-list__empty">暂无特质</div> : null}
        {items.map((row, index) => (
          <div className="entity-builder-card" key={row.id}>
            <div className="entity-builder-card__grid entity-builder-card__grid--quad">
              <input
                className="entity-form__input"
                value={row.name}
                disabled={disabled}
                placeholder="特质名称"
                onChange={(event) => {
                  const nextRows = [...items];
                  nextRows[index] = { ...row, name: event.target.value };
                  onChange(nextRows);
                }}
              />
              <select
                className="entity-form__input"
                value={row.linkedAbilityId}
                disabled={disabled}
                onChange={(event) => {
                  const nextRows = [...items];
                  nextRows[index] = { ...row, linkedAbilityId: event.target.value };
                  onChange(nextRows);
                }}
              >
                <option value="">不挂接能力</option>
                {ensureCurrentOption(abilityOptions, row.linkedAbilityId).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="entity-form__toggle-box">
                <input
                  type="checkbox"
                  checked={row.isMixedTrait}
                  disabled={disabled}
                  onChange={(event) => {
                    const nextRows = [...items];
                    nextRows[index] = { ...row, isMixedTrait: event.target.checked };
                    onChange(nextRows);
                  }}
                />
                <span>{row.isMixedTrait ? "混血特质" : "普通特质"}</span>
              </label>
              <button
                type="button"
                className="entity-builder-list__remove-btn"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}
              >
                删除
              </button>
              <textarea
                className="entity-form__textarea entity-builder-card__wide"
                rows={4}
                value={row.description}
                disabled={disabled}
                placeholder="特质描述"
                onChange={(event) => {
                  const nextRows = [...items];
                  nextRows[index] = { ...row, description: event.target.value };
                  onChange(nextRows);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </FieldShell>
  );
}

type AbilityVisualEditorProps = {
  value: AbilityEditorState;
  disabled: boolean;
  onChange: (value: AbilityEditorState) => void;
};

export function AbilityVisualEditor({ value, disabled, onChange }: AbilityVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="释放代价" description="把消耗和伤害段拆成多条记录，便于复合动作、咏唱法术和多段打击编排。">
        <div className="entity-form__section-grid">
          <FieldShell
            label="资源消耗"
            span={2}
            helperText="amount 支持固定数值，也支持公式，例如 actor.level * 2。"
            action={
              <button
                type="button"
                className="entity-builder-list__add-btn"
                disabled={disabled}
                onClick={() => onChange({ ...value, resourceCosts: [...value.resourceCosts, createEmptyResourceCost()] })}
              >
                新增资源
              </button>
            }
          >
            <div className="entity-builder-list">
              {value.resourceCosts.length === 0 ? <div className="entity-builder-list__empty">暂无资源消耗</div> : null}
              {value.resourceCosts.map((row, index) => (
                <div className="entity-builder-card" key={row.id}>
                  <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                    <select
                      className="entity-form__input"
                      value={row.type}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextRows = [...value.resourceCosts];
                        nextRows[index] = { ...row, type: event.target.value };
                        onChange({ ...value, resourceCosts: nextRows });
                      }}
                    >
                      {RESOURCE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="entity-form__input"
                      value={row.amount}
                      disabled={disabled}
                      placeholder="数值或公式"
                      onChange={(event) => {
                        const nextRows = [...value.resourceCosts];
                        nextRows[index] = { ...row, amount: event.target.value };
                        onChange({ ...value, resourceCosts: nextRows });
                      }}
                    />
                    <input
                      className="entity-form__input"
                      value={row.label}
                      disabled={disabled}
                      placeholder="展示名"
                      onChange={(event) => {
                        const nextRows = [...value.resourceCosts];
                        nextRows[index] = { ...row, label: event.target.value };
                        onChange({ ...value, resourceCosts: nextRows });
                      }}
                    />
                  </div>
                  <div className="entity-builder-card__actions">
                    <button
                      type="button"
                      className="entity-builder-list__remove-btn"
                      disabled={disabled}
                      onClick={() =>
                        onChange({
                          ...value,
                          resourceCosts: value.resourceCosts.filter((_, rowIndex) => rowIndex !== index),
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </FieldShell>

          <FieldShell
            label="伤害段"
            span={2}
            helperText="多段攻击、多属性伤害都可以在这里追加。scaling 可填职业等级、法术强度 AP 或自定义成长公式。"
            action={
              <button
                type="button"
                className="entity-builder-list__add-btn"
                disabled={disabled}
                onClick={() => onChange({ ...value, damageRolls: [...value.damageRolls, createEmptyDamageRoll()] })}
              >
                新增伤害段
              </button>
            }
          >
            <div className="entity-builder-list">
              {value.damageRolls.length === 0 ? <div className="entity-builder-list__empty">暂无伤害段</div> : null}
              {value.damageRolls.map((row, index) => (
                <div className="entity-builder-card" key={row.id}>
                  <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                    <input
                      className="entity-form__input"
                      value={row.dice}
                      disabled={disabled}
                      placeholder="例如 2d6+4"
                      onChange={(event) => {
                        const nextRows = [...value.damageRolls];
                        nextRows[index] = { ...row, dice: event.target.value };
                        onChange({ ...value, damageRolls: nextRows });
                      }}
                    />
                    <select
                      className="entity-form__input"
                      value={row.damageType}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextRows = [...value.damageRolls];
                        nextRows[index] = { ...row, damageType: event.target.value };
                        onChange({ ...value, damageRolls: nextRows });
                      }}
                    >
                      {DAMAGE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="entity-form__input"
                      value={row.scaling}
                      disabled={disabled}
                      placeholder="升阶/升级公式（可选）"
                      onChange={(event) => {
                        const nextRows = [...value.damageRolls];
                        nextRows[index] = { ...row, scaling: event.target.value };
                        onChange({ ...value, damageRolls: nextRows });
                      }}
                    />
                  </div>
                  <div className="entity-builder-card__actions">
                    <button
                      type="button"
                      className="entity-builder-list__remove-btn"
                      disabled={disabled}
                      onClick={() =>
                        onChange({
                          ...value,
                          damageRolls: value.damageRolls.filter((_, rowIndex) => rowIndex !== index),
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </FieldShell>
        </div>
      </SectionCard>

      <SectionCard title="触发与联动" description="这里负责被动联动、反应动作和自动触发的规则描述。">
        <div className="entity-form__section-grid">
          <FieldShell label="启用触发器" helperText="主动技能可关闭；被动、反应和联动技能建议开启。">
            <label className="entity-form__toggle-box">
              <input
                type="checkbox"
                checked={value.trigger.enabled}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, trigger: { ...value.trigger, enabled: event.target.checked } })}
              />
              <span>{value.trigger.enabled ? "当前已启用" : "当前未启用"}</span>
            </label>
          </FieldShell>

          <FieldShell label="触发时机">
            <select
              className="entity-form__input"
              value={value.trigger.timing}
              disabled={disabled || !value.trigger.enabled}
              onChange={(event) => onChange({ ...value, trigger: { ...value.trigger, timing: event.target.value } })}
            >
              {TRIGGER_TIMING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell label="优先级">
            <input
              className="entity-form__input"
              type="number"
              value={value.trigger.priority}
              disabled={disabled || !value.trigger.enabled}
              placeholder="数值越小越先执行"
              onChange={(event) => onChange({ ...value, trigger: { ...value.trigger, priority: event.target.value } })}
            />
          </FieldShell>

          <FieldShell label="每轮触发上限">
            <input
              className="entity-form__input"
              type="number"
              value={value.trigger.limitPerRound}
              disabled={disabled || !value.trigger.enabled}
              onChange={(event) =>
                onChange({ ...value, trigger: { ...value.trigger, limitPerRound: event.target.value } })
              }
            />
          </FieldShell>

          <FieldShell label="每战斗触发上限">
            <input
              className="entity-form__input"
              type="number"
              value={value.trigger.limitPerCombat}
              disabled={disabled || !value.trigger.enabled}
              onChange={(event) =>
                onChange({ ...value, trigger: { ...value.trigger, limitPerCombat: event.target.value } })
              }
            />
          </FieldShell>

          <FieldShell label="每天触发上限">
            <input
              className="entity-form__input"
              type="number"
              value={value.trigger.limitPerDay}
              disabled={disabled || !value.trigger.enabled}
              onChange={(event) => onChange({ ...value, trigger: { ...value.trigger, limitPerDay: event.target.value } })}
            />
          </FieldShell>

          <FieldShell label="条件树" span={2} helperText="用可视化条件树描述联动前提，避免在特性里硬编码具体技能名。">
            <ConditionBuilder
              value={value.trigger.condition}
              disabled={disabled || !value.trigger.enabled}
              onChange={(nextCondition) => onChange({ ...value, trigger: { ...value.trigger, condition: nextCondition } })}
            />
          </FieldShell>
        </div>
      </SectionCard>

      <SectionCard title="效果编排" description="一次能力可以串多个效果，例如先加 AC、再施加状态、最后返还反应。">
        <FieldShell
          label="效果列表"
          span={2}
          helperText="value 字段支持固定数值、标签名、状态 key，或公式。需要复杂推导时可以填 customExpr。"
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, effects: [...value.effects, createEmptyEffect()] })}
            >
              新增效果
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.effects.length === 0 ? <div className="entity-builder-list__empty">暂无效果</div> : null}
            {value.effects.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--quad">
                  <select
                    className="entity-form__input"
                    value={row.type}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, type: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  >
                    {EFFECT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="entity-form__input"
                    value={row.target}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, target: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  >
                    {EFFECT_TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="entity-form__input"
                    value={row.stat}
                    disabled={disabled}
                    placeholder="数值字段，例如 hp / fury / ac"
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, stat: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.label}
                    disabled={disabled}
                    placeholder="展示名 / 状态名"
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, label: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.value}
                    disabled={disabled}
                    placeholder="数值 / 标签 / 状态 key / 公式"
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, value: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  />
                  <select
                    className="entity-form__input"
                    value={row.duration}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, duration: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.durationValue}
                    disabled={disabled}
                    placeholder="持续值"
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, durationValue: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  />
                  <textarea
                    className="entity-form__textarea entity-builder-card__wide"
                    rows={3}
                    value={row.customExpr}
                    disabled={disabled}
                    placeholder="自定义公式（可选），例如 clamp(actor.level * 2, 1, 10)"
                    onChange={(event) => {
                      const nextRows = [...value.effects];
                      nextRows[index] = { ...row, customExpr: event.target.value };
                      onChange({ ...value, effects: nextRows });
                    }}
                  />
                </div>
                <div className="entity-builder-card__actions">
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        effects: value.effects.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除效果
                  </button>
                </div>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type ProfessionVisualEditorProps = {
  value: ProfessionEditorState;
  disabled: boolean;
  abilityOptions: SelectOption[];
  onChange: (value: ProfessionEditorState) => void;
};

export function ProfessionVisualEditor({
  value,
  disabled,
  abilityOptions,
  onChange,
}: ProfessionVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="熟练与训练" description="把职业起始配置拆成直观的可编辑列表，方便兼职和模组化配置。">
        <div className="entity-form__section-grid">
          <StringListEditor
            label="豁免熟练"
            items={value.saveProficiencies}
            disabled={disabled}
            options={ATTRIBUTE_OPTIONS}
            addLabel="新增属性"
            helperText="建议直接按 DND 风格选择两项基础豁免。"
            onChange={(items) => onChange({ ...value, saveProficiencies: items })}
          />
          <StringListEditor
            label="护甲熟练"
            items={value.armorProficiencies}
            disabled={disabled}
            placeholder="例如 轻甲 / 中甲 / 盾牌"
            onChange={(items) => onChange({ ...value, armorProficiencies: items })}
          />
          <StringListEditor
            label="武器熟练"
            items={value.weaponProficiencies}
            disabled={disabled}
            placeholder="例如 军用武器 / 简易武器 / 剑类"
            onChange={(items) => onChange({ ...value, weaponProficiencies: items })}
          />
          <StringListEditor
            label="工具熟练"
            items={value.toolProficiencies}
            disabled={disabled}
            placeholder="例如 炼金工具 / 工匠工具"
            onChange={(items) => onChange({ ...value, toolProficiencies: items })}
          />

          <FieldShell label="技能熟练可选数量">
            <input
              className="entity-form__input"
              type="number"
              value={value.skillChoices.count}
              disabled={disabled}
              placeholder="例如 2"
              onChange={(event) =>
                onChange({ ...value, skillChoices: { ...value.skillChoices, count: event.target.value } })
              }
            />
          </FieldShell>

          <StringListEditor
            label="可选技能列表"
            items={value.skillChoices.options}
            disabled={disabled}
            placeholder="例如 运动 / 察觉 / 奥秘"
            onChange={(items) => onChange({ ...value, skillChoices: { ...value.skillChoices, options: items } })}
          />

          <StringListEditor
            label="起始装备"
            items={value.startingEquipment}
            disabled={disabled}
            placeholder="例如 长剑 / 旅行者背包 / 治疗药水"
            helperText="后续若要支持装备包模板，这里可以继续挂接资源包引用。"
            onChange={(items) => onChange({ ...value, startingEquipment: items })}
          />

          <StringListEditor
            label="关联天赋树 ID"
            items={value.talentTreeIds}
            disabled={disabled}
            placeholder="填写天赋树资源 ID"
            onChange={(items) => onChange({ ...value, talentTreeIds: items })}
          />
        </div>
      </SectionCard>

      <SectionCard title="等级特性表" description="这里就是职业 1-20 级成长表的骨架，GM 可以直接把特性和能力挂到每一级。">
        <FieldShell
          label="等级成长列表"
          span={2}
          helperText="每一级可以同时定义规则特性文本、关联能力、资源增长和施法学习增长。"
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, levelFeatures: [...value.levelFeatures, createEmptyLevelFeature()] })}
            >
              新增等级
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.levelFeatures.length === 0 ? <div className="entity-builder-list__empty">暂无等级特性</div> : null}
            {value.levelFeatures.map((row, index) => (
              <div className="entity-builder-card entity-builder-card--feature" key={row.id}>
                <div className="entity-builder-card__head">
                  <strong>{row.level ? `Lv.${row.level}` : "未设置等级"}</strong>
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        levelFeatures: value.levelFeatures.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除等级
                  </button>
                </div>

                <div className="entity-builder-card__grid entity-builder-card__grid--feature">
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.level}
                    disabled={disabled}
                    placeholder="等级"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, level: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.proficiencyBonus}
                    disabled={disabled}
                    placeholder="熟练加值"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, proficiencyBonus: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.attributeIncrease}
                    disabled={disabled}
                    placeholder="属性提升点"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, attributeIncrease: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.talentPointsClass}
                    disabled={disabled}
                    placeholder="职业天赋点"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, talentPointsClass: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.talentPointsGeneral}
                    disabled={disabled}
                    placeholder="通用天赋点"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, talentPointsGeneral: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.hpIncrease}
                    disabled={disabled}
                    placeholder="生命增长，例如 1d10+体质"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, hpIncrease: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.mpIncrease}
                    disabled={disabled}
                    placeholder="MP 增长"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, mpIncrease: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.furyIncrease}
                    disabled={disabled}
                    placeholder="战意增长"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, furyIncrease: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.kiIncrease}
                    disabled={disabled}
                    placeholder="技力增长"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, kiIncrease: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.extraAttacks}
                    disabled={disabled}
                    placeholder="额外攻击次数"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, extraAttacks: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                </div>

                <StringListEditor
                  label="特性名称"
                  items={row.features}
                  disabled={disabled}
                  placeholder="例如 战斗风格 / 奥术回路 / 专家工具箱"
                  addLabel="新增特性"
                  onChange={(items) => {
                    const nextRows = [...value.levelFeatures];
                    nextRows[index] = { ...row, features: items };
                    onChange({ ...value, levelFeatures: nextRows });
                  }}
                />

                <StringListEditor
                  label="关联能力 ID"
                  items={row.linkedAbilityIds}
                  disabled={disabled}
                  options={abilityOptions}
                  addLabel="挂接能力"
                  helperText="这里挂接的是已经在“能力库”里建好的能力。"
                  onChange={(items) => {
                    const nextRows = [...value.levelFeatures];
                    nextRows[index] = { ...row, linkedAbilityIds: items };
                    onChange({ ...value, levelFeatures: nextRows });
                  }}
                />

                <FieldShell
                  label="法术学习增长"
                  span={2}
                  action={
                    <button
                      type="button"
                      className="entity-builder-list__add-btn"
                      disabled={disabled}
                      onClick={() => {
                        const nextRows = [...value.levelFeatures];
                        nextRows[index] = {
                          ...row,
                          spellSlots: [...row.spellSlots, { id: createDraftId("spellslot"), slotLevel: "", amount: "" }],
                        };
                        onChange({ ...value, levelFeatures: nextRows });
                      }}
                    >
                      新增学习项
                    </button>
                  }
                >
                  <div className="entity-builder-list">
                    {row.spellSlots.length === 0 ? <div className="entity-builder-list__empty">暂无法术学习增长</div> : null}
                    {row.spellSlots.map((slot, slotIndex) => (
                      <div className="entity-builder-list__row" key={slot.id}>
                        <input
                          className="entity-form__input"
                          type="number"
                          value={slot.slotLevel}
                          disabled={disabled}
                          placeholder="法术等级 0-6"
                          onChange={(event) => {
                            const nextRows = [...value.levelFeatures];
                            const nextSpellSlots = [...row.spellSlots];
                            nextSpellSlots[slotIndex] = { ...slot, slotLevel: event.target.value };
                            nextRows[index] = { ...row, spellSlots: nextSpellSlots };
                            onChange({ ...value, levelFeatures: nextRows });
                          }}
                        />
                        <input
                          className="entity-form__input"
                          type="number"
                          value={slot.amount}
                          disabled={disabled}
                          placeholder="学习/准备数量"
                          onChange={(event) => {
                            const nextRows = [...value.levelFeatures];
                            const nextSpellSlots = [...row.spellSlots];
                            nextSpellSlots[slotIndex] = { ...slot, amount: event.target.value };
                            nextRows[index] = { ...row, spellSlots: nextSpellSlots };
                            onChange({ ...value, levelFeatures: nextRows });
                          }}
                        />
                        <button
                          type="button"
                          className="entity-builder-list__remove-btn"
                          disabled={disabled}
                          onClick={() => {
                            const nextRows = [...value.levelFeatures];
                            nextRows[index] = {
                              ...row,
                              spellSlots: row.spellSlots.filter((_, currentSlotIndex) => currentSlotIndex !== slotIndex),
                            };
                            onChange({ ...value, levelFeatures: nextRows });
                          }}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </FieldShell>

                <FieldShell label="备注" span={2}>
                  <textarea
                    className="entity-form__textarea"
                    rows={4}
                    value={row.customNotes}
                    disabled={disabled}
                    placeholder="记录该等级的特殊处理、主持人提醒或复杂成长描述。"
                    onChange={(event) => {
                      const nextRows = [...value.levelFeatures];
                      nextRows[index] = { ...row, customNotes: event.target.value };
                      onChange({ ...value, levelFeatures: nextRows });
                    }}
                  />
                </FieldShell>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type RaceVisualEditorProps = {
  value: RaceEditorState;
  disabled: boolean;
  abilityOptions: SelectOption[];
  onChange: (value: RaceEditorState) => void;
};

export function RaceVisualEditor({ value, disabled, abilityOptions, onChange }: RaceVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="种族加值" description="把 AAF 种族的属性成长、语言和固有特质拆成直观的拼装组件。">
        <div className="entity-form__section-grid">
          <FieldShell
            label="属性加值"
            span={2}
            action={
              <button
                type="button"
                className="entity-builder-list__add-btn"
                disabled={disabled}
                onClick={() => onChange({ ...value, attrBonus: [...value.attrBonus, createEmptyRaceAttrBonus()] })}
              >
                新增加值
              </button>
            }
          >
            <div className="entity-builder-list">
              {value.attrBonus.length === 0 ? <div className="entity-builder-list__empty">暂无属性加值</div> : null}
              {value.attrBonus.map((row, index) => (
                <div className="entity-builder-list__row entity-builder-list__row--quad" key={row.id}>
                  <select
                    className="entity-form__input"
                    value={row.type}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.attrBonus];
                      nextRows[index] = { ...row, type: event.target.value as "fixed" | "choice" };
                      onChange({ ...value, attrBonus: nextRows });
                    }}
                  >
                    {RACE_ATTR_BONUS_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="entity-form__input"
                    value={row.attribute}
                    disabled={disabled || row.type === "choice"}
                    onChange={(event) => {
                      const nextRows = [...value.attrBonus];
                      nextRows[index] = { ...row, attribute: event.target.value };
                      onChange({ ...value, attrBonus: nextRows });
                    }}
                  >
                    {ATTRIBUTE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.amount}
                    disabled={disabled}
                    placeholder="加值"
                    onChange={(event) => {
                      const nextRows = [...value.attrBonus];
                      nextRows[index] = { ...row, amount: event.target.value };
                      onChange({ ...value, attrBonus: nextRows });
                    }}
                  />
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        attrBonus: value.attrBonus.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </FieldShell>

          <StringListEditor
            label="语言"
            items={value.languages}
            disabled={disabled}
            placeholder="例如 通用语 / 精灵语 / 王国古语"
            onChange={(items) => onChange({ ...value, languages: items })}
          />
        </div>
      </SectionCard>

      <SectionCard title="种族特质" description="种族特质可以单独写描述，也可以挂到已经定义好的能力资源。">
        <RaceTraitCollectionEditor
          label="主种族特质"
          items={value.traits}
          disabled={disabled}
          abilityOptions={abilityOptions}
          onChange={(items) => onChange({ ...value, traits: items })}
        />
      </SectionCard>

      <SectionCard title="子种配置" description="子种可以继承主种族的风格，再追加独立特质，适合半精灵、地域分支和血脉流派。">
        <FieldShell
          label="子种列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, subtypes: [...value.subtypes, createEmptyRaceSubtype()] })}
            >
              新增子种
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.subtypes.length === 0 ? <div className="entity-builder-list__empty">暂无子种</div> : null}
            {value.subtypes.map((subtype, index) => (
              <div className="entity-builder-card entity-builder-card--feature" key={subtype.id}>
                <div className="entity-builder-card__head">
                  <strong>{subtype.name || "未命名子种"}</strong>
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        subtypes: value.subtypes.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除子种
                  </button>
                </div>

                <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                  <input
                    className="entity-form__input"
                    value={subtype.name}
                    disabled={disabled}
                    placeholder="子种名称"
                    onChange={(event) => {
                      const nextRows = [...value.subtypes];
                      nextRows[index] = { ...subtype, name: event.target.value };
                      onChange({ ...value, subtypes: nextRows });
                    }}
                  />
                </div>

                <textarea
                  className="entity-form__textarea"
                  rows={4}
                  value={subtype.description}
                  disabled={disabled}
                  placeholder="子种描述"
                  onChange={(event) => {
                    const nextRows = [...value.subtypes];
                    nextRows[index] = { ...subtype, description: event.target.value };
                    onChange({ ...value, subtypes: nextRows });
                  }}
                />

                <RaceTraitCollectionEditor
                  label="子种特质"
                  items={subtype.traits}
                  disabled={disabled}
                  abilityOptions={abilityOptions}
                  onChange={(items) => {
                    const nextRows = [...value.subtypes];
                    nextRows[index] = { ...subtype, traits: items };
                    onChange({ ...value, subtypes: nextRows });
                  }}
                />
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type BackgroundVisualEditorProps = {
  value: BackgroundEditorState;
  disabled: boolean;
  abilityOptions: SelectOption[];
  onChange: (value: BackgroundEditorState) => void;
};

export function BackgroundVisualEditor({
  value,
  disabled,
  abilityOptions,
  onChange,
}: BackgroundVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="背景授予内容" description="背景主要承担初始技能、工具和装备授予。">
        <div className="entity-form__section-grid">
          <StringListEditor
            label="工具熟练"
            items={value.toolProficiencies}
            disabled={disabled}
            placeholder="例如 炼金工具 / 厨师工具"
            onChange={(items) => onChange({ ...value, toolProficiencies: items })}
          />
          <StringListEditor
            label="起始装备"
            items={value.startingEquipment}
            disabled={disabled}
            placeholder="例如 冒险者背包 / 旧日徽章"
            onChange={(items) => onChange({ ...value, startingEquipment: items })}
          />
        </div>
      </SectionCard>

      <SectionCard title="背景特性" description="背景特性可以单纯写叙事文本，也可以连到能力资源触发自动化结算。">
        <FieldShell
          label="特性列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, features: [...value.features, createEmptyBackgroundFeature()] })}
            >
              新增特性
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.features.length === 0 ? <div className="entity-builder-list__empty">暂无背景特性</div> : null}
            {value.features.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                  <input
                    className="entity-form__input"
                    value={row.name}
                    disabled={disabled}
                    placeholder="特性名称"
                    onChange={(event) => {
                      const nextRows = [...value.features];
                      nextRows[index] = { ...row, name: event.target.value };
                      onChange({ ...value, features: nextRows });
                    }}
                  />
                  <select
                    className="entity-form__input"
                    value={row.linkedAbilityId}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.features];
                      nextRows[index] = { ...row, linkedAbilityId: event.target.value };
                      onChange({ ...value, features: nextRows });
                    }}
                  >
                    <option value="">不挂接能力</option>
                    {ensureCurrentOption(abilityOptions, row.linkedAbilityId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        features: value.features.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
                <textarea
                  className="entity-form__textarea"
                  rows={4}
                  value={row.description}
                  disabled={disabled}
                  placeholder="特性描述"
                  onChange={(event) => {
                    const nextRows = [...value.features];
                    nextRows[index] = { ...row, description: event.target.value };
                    onChange({ ...value, features: nextRows });
                  }}
                />
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type ItemVisualEditorProps = {
  value: ItemEditorState;
  disabled: boolean;
  abilityOptions: SelectOption[];
  onChange: (value: ItemEditorState) => void;
};

export function ItemVisualEditor({ value, disabled, abilityOptions, onChange }: ItemVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="物品标签与基础属性" description="先配标签，再按武器或护甲类别决定是否启用对应属性模块。">
        <div className="entity-form__section-grid">
          <StringListEditor
            label="标签"
            items={value.tags}
            disabled={disabled}
            placeholder="例如 火焰 / 稀有素材 / 炼金"
            onChange={(items) => onChange({ ...value, tags: items })}
          />
        </div>
      </SectionCard>

      <SectionCard title="武器属性" description="若当前物品不是武器，可保持关闭。">
        <div className="entity-form__section-grid">
          <FieldShell label="启用武器属性">
            <label className="entity-form__toggle-box">
              <input
                type="checkbox"
                checked={value.weaponProps.enabled}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, weaponProps: { ...value.weaponProps, enabled: event.target.checked } })
                }
              />
              <span>{value.weaponProps.enabled ? "已启用" : "未启用"}</span>
            </label>
          </FieldShell>
          <FieldShell label="攻击类型">
            <select
              className="entity-form__input"
              value={value.weaponProps.attackType}
              disabled={disabled || !value.weaponProps.enabled}
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, attackType: event.target.value } })
              }
            >
              {WEAPON_ATTACK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="伤害类型">
            <select
              className="entity-form__input"
              value={value.weaponProps.damageType}
              disabled={disabled || !value.weaponProps.enabled}
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, damageType: event.target.value } })
              }
            >
              {DAMAGE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="伤害骰">
            <input
              className="entity-form__input"
              value={value.weaponProps.damageDice}
              disabled={disabled || !value.weaponProps.enabled}
              placeholder="例如 1d8"
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, damageDice: event.target.value } })
              }
            />
          </FieldShell>
          <FieldShell label="攻击属性">
            <select
              className="entity-form__input"
              value={value.weaponProps.attackAttribute}
              disabled={disabled || !value.weaponProps.enabled}
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, attackAttribute: event.target.value } })
              }
            >
              {ATTRIBUTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="正常射程">
            <input
              className="entity-form__input"
              type="number"
              value={value.weaponProps.range}
              disabled={disabled || !value.weaponProps.enabled}
              placeholder="尺"
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, range: event.target.value } })
              }
            />
          </FieldShell>
          <FieldShell label="远射程">
            <input
              className="entity-form__input"
              type="number"
              value={value.weaponProps.longRange}
              disabled={disabled || !value.weaponProps.enabled}
              placeholder="尺"
              onChange={(event) =>
                onChange({ ...value, weaponProps: { ...value.weaponProps, longRange: event.target.value } })
              }
            />
          </FieldShell>
          <StringListEditor
            label="武器关键词"
            items={value.weaponProps.properties}
            disabled={disabled || !value.weaponProps.enabled}
            placeholder="例如 双手 / 精巧 / 轻型"
            onChange={(items) => onChange({ ...value, weaponProps: { ...value.weaponProps, properties: items } })}
          />
        </div>
      </SectionCard>

      <SectionCard title="护甲属性" description="若当前物品不是护甲或盾牌，可保持关闭。">
        <div className="entity-form__section-grid">
          <FieldShell label="启用护甲属性">
            <label className="entity-form__toggle-box">
              <input
                type="checkbox"
                checked={value.armorProps.enabled}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, armorProps: { ...value.armorProps, enabled: event.target.checked } })
                }
              />
              <span>{value.armorProps.enabled ? "已启用" : "未启用"}</span>
            </label>
          </FieldShell>
          <FieldShell label="护甲类型">
            <select
              className="entity-form__input"
              value={value.armorProps.armorType}
              disabled={disabled || !value.armorProps.enabled}
              onChange={(event) =>
                onChange({ ...value, armorProps: { ...value.armorProps, armorType: event.target.value } })
              }
            >
              {ARMOR_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="基础 AC">
            <input
              className="entity-form__input"
              type="number"
              value={value.armorProps.baseAC}
              disabled={disabled || !value.armorProps.enabled}
              onChange={(event) =>
                onChange({ ...value, armorProps: { ...value.armorProps, baseAC: event.target.value } })
              }
            />
          </FieldShell>
          <FieldShell label="敏捷上限">
            <input
              className="entity-form__input"
              type="number"
              value={value.armorProps.maxDexBonus}
              disabled={disabled || !value.armorProps.enabled}
              onChange={(event) =>
                onChange({ ...value, armorProps: { ...value.armorProps, maxDexBonus: event.target.value } })
              }
            />
          </FieldShell>
          <FieldShell label="力量需求">
            <input
              className="entity-form__input"
              type="number"
              value={value.armorProps.strengthRequirement}
              disabled={disabled || !value.armorProps.enabled}
              onChange={(event) =>
                onChange({ ...value, armorProps: { ...value.armorProps, strengthRequirement: event.target.value } })
              }
            />
          </FieldShell>
          <FieldShell label="潜行劣势">
            <label className="entity-form__toggle-box">
              <input
                type="checkbox"
                checked={value.armorProps.stealthDisadvantage}
                disabled={disabled || !value.armorProps.enabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    armorProps: { ...value.armorProps, stealthDisadvantage: event.target.checked },
                  })
                }
              />
              <span>{value.armorProps.stealthDisadvantage ? "会施加劣势" : "不施加劣势"}</span>
            </label>
          </FieldShell>
        </div>
      </SectionCard>

      <SectionCard title="附魔与特殊效果" description="一条附魔既能挂接已有能力，也能在物品本身上写一个独立效果。">
        <FieldShell
          label="附魔列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, enchantments: [...value.enchantments, createEmptyItemEnchantment()] })}
            >
              新增附魔
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.enchantments.length === 0 ? <div className="entity-builder-list__empty">暂无附魔</div> : null}
            {value.enchantments.map((row, index) => (
              <div className="entity-builder-card entity-builder-card--feature" key={row.id}>
                <div className="entity-builder-card__head">
                  <strong>{row.name || "未命名附魔"}</strong>
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        enchantments: value.enchantments.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除附魔
                  </button>
                </div>
                <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                  <input
                    className="entity-form__input"
                    value={row.name}
                    disabled={disabled}
                    placeholder="附魔名称"
                    onChange={(event) => {
                      const nextRows = [...value.enchantments];
                      nextRows[index] = { ...row, name: event.target.value };
                      onChange({ ...value, enchantments: nextRows });
                    }}
                  />
                  <select
                    className="entity-form__input"
                    value={row.linkedAbilityId}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.enchantments];
                      nextRows[index] = { ...row, linkedAbilityId: event.target.value };
                      onChange({ ...value, enchantments: nextRows });
                    }}
                  >
                    <option value="">不挂接能力</option>
                    {ensureCurrentOption(abilityOptions, row.linkedAbilityId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="entity-form__textarea"
                  rows={3}
                  value={row.description}
                  disabled={disabled}
                  placeholder="附魔说明"
                  onChange={(event) => {
                    const nextRows = [...value.enchantments];
                    nextRows[index] = { ...row, description: event.target.value };
                    onChange({ ...value, enchantments: nextRows });
                  }}
                />
                <SingleEffectEditor
                  value={row.effect}
                  disabled={disabled}
                  onChange={(nextEffect) => {
                    const nextRows = [...value.enchantments];
                    nextRows[index] = { ...row, effect: nextEffect };
                    onChange({ ...value, enchantments: nextRows });
                  }}
                />
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type FateClockVisualEditorProps = {
  value: FateClockEditorState;
  disabled: boolean;
  onChange: (value: FateClockEditorState) => void;
};

export function FateClockVisualEditor({ value, disabled, onChange }: FateClockVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="推进记录" description="命刻历史会直接影响主持人回顾节奏变化，建议在这里按条维护，而不是手改 JSON。">
        <FieldShell
          label="历史列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, history: [...value.history, createEmptyFateClockHistoryEntry()] })}
            >
              新增记录
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.history.length === 0 ? <div className="entity-builder-list__empty">暂无推进记录</div> : null}
            {value.history.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--quad">
                  <select
                    className="entity-form__input"
                    value={row.action}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.history];
                      nextRows[index] = { ...row, action: event.target.value as "advance" | "retreat" };
                      onChange({ ...value, history: nextRows });
                    }}
                  >
                    <option value="advance">推进</option>
                    <option value="retreat">回退</option>
                  </select>
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.amount}
                    disabled={disabled}
                    placeholder="变化量"
                    onChange={(event) => {
                      const nextRows = [...value.history];
                      nextRows[index] = { ...row, amount: event.target.value };
                      onChange({ ...value, history: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.timestamp}
                    disabled={disabled}
                    placeholder="ISO 时间戳，留空则保存时自动补当前时间"
                    onChange={(event) => {
                      const nextRows = [...value.history];
                      nextRows[index] = { ...row, timestamp: event.target.value };
                      onChange({ ...value, history: nextRows });
                    }}
                  />
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        history: value.history.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除
                  </button>
                  <textarea
                    className="entity-form__textarea entity-builder-card__wide"
                    rows={3}
                    value={row.reason}
                    disabled={disabled}
                    placeholder="推进原因，例如 玩家调查失败 / 祭坛净化成功"
                    onChange={(event) => {
                      const nextRows = [...value.history];
                      nextRows[index] = { ...row, reason: event.target.value };
                      onChange({ ...value, history: nextRows });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type DeckVisualEditorProps = {
  value: DeckEditorState;
  disabled: boolean;
  itemOptions: SelectOption[];
  onChange: (value: DeckEditorState) => void;
};

export function DeckVisualEditor({ value, disabled, itemOptions, onChange }: DeckVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="卡牌定义" description="每张牌都可以写展示文本，并绑定一个现成的物品资源。">
        <FieldShell
          label="卡牌列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, cards: [...value.cards, createEmptyDeckCard()] })}
            >
              新增卡牌
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.cards.length === 0 ? <div className="entity-builder-list__empty">暂无卡牌</div> : null}
            {value.cards.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--quad">
                  <input
                    className="entity-form__input"
                    value={row.name}
                    disabled={disabled}
                    placeholder="卡牌名称"
                    onChange={(event) => {
                      const nextRows = [...value.cards];
                      nextRows[index] = { ...row, name: event.target.value };
                      onChange({ ...value, cards: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.weight}
                    disabled={disabled}
                    placeholder="权重"
                    onChange={(event) => {
                      const nextRows = [...value.cards];
                      nextRows[index] = { ...row, weight: event.target.value };
                      onChange({ ...value, cards: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.imageUrl}
                    disabled={disabled}
                    placeholder="图片 URL（可选）"
                    onChange={(event) => {
                      const nextRows = [...value.cards];
                      nextRows[index] = { ...row, imageUrl: event.target.value };
                      onChange({ ...value, cards: nextRows });
                    }}
                  />
                  <select
                    className="entity-form__input"
                    value={row.linkedItemId}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.cards];
                      nextRows[index] = { ...row, linkedItemId: event.target.value };
                      onChange({ ...value, cards: nextRows });
                    }}
                  >
                    <option value="">不绑定物品</option>
                    {ensureCurrentOption(itemOptions, row.linkedItemId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="entity-form__textarea entity-builder-card__wide"
                    rows={3}
                    value={row.description}
                    disabled={disabled}
                    placeholder="卡牌描述"
                    onChange={(event) => {
                      const nextRows = [...value.cards];
                      nextRows[index] = { ...row, description: event.target.value };
                      onChange({ ...value, cards: nextRows });
                    }}
                  />
                </div>
                <div className="entity-builder-card__actions">
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        cards: value.cards.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除卡牌
                  </button>
                </div>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>

      <SectionCard title="抽牌记录" description="这里记录牌堆已经抽出的牌，便于主持人在剧本推进中回顾事件流。">
        <FieldShell
          label="已抽记录"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, drawnHistory: [...value.drawnHistory, createEmptyDeckDrawnHistory()] })}
            >
              新增记录
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.drawnHistory.length === 0 ? <div className="entity-builder-list__empty">暂无抽牌记录</div> : null}
            {value.drawnHistory.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--triple">
                  <input
                    className="entity-form__input"
                    value={row.cardId}
                    disabled={disabled}
                    placeholder="卡牌 ID 或名称"
                    onChange={(event) => {
                      const nextRows = [...value.drawnHistory];
                      nextRows[index] = { ...row, cardId: event.target.value };
                      onChange({ ...value, drawnHistory: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.drawnBy}
                    disabled={disabled}
                    placeholder="抽取者"
                    onChange={(event) => {
                      const nextRows = [...value.drawnHistory];
                      nextRows[index] = { ...row, drawnBy: event.target.value };
                      onChange({ ...value, drawnHistory: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    value={row.drawnAt}
                    disabled={disabled}
                    placeholder="抽取时间"
                    onChange={(event) => {
                      const nextRows = [...value.drawnHistory];
                      nextRows[index] = { ...row, drawnAt: event.target.value };
                      onChange({ ...value, drawnHistory: nextRows });
                    }}
                  />
                </div>
                <div className="entity-builder-card__actions">
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        drawnHistory: value.drawnHistory.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除记录
                  </button>
                </div>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}

type RandomTableVisualEditorProps = {
  value: RandomTableEditorState;
  disabled: boolean;
  abilityOptions: SelectOption[];
  itemOptions: SelectOption[];
  onChange: (value: RandomTableEditorState) => void;
};

export function RandomTableVisualEditor({
  value,
  disabled,
  abilityOptions,
  itemOptions,
  onChange,
}: RandomTableVisualEditorProps) {
  return (
    <div className="entity-form__special-layout">
      <SectionCard title="随机表条目" description="每一项都可以绑定能力或物品，方便掉落表和剧情奖励直接接入系统资源。">
        <FieldShell
          label="表项列表"
          span={2}
          action={
            <button
              type="button"
              className="entity-builder-list__add-btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, entries: [...value.entries, createEmptyRandomTableEntry()] })}
            >
              新增表项
            </button>
          }
        >
          <div className="entity-builder-list">
            {value.entries.length === 0 ? <div className="entity-builder-list__empty">暂无表项</div> : null}
            {value.entries.map((row, index) => (
              <div className="entity-builder-card" key={row.id}>
                <div className="entity-builder-card__grid entity-builder-card__grid--quad">
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.rangeMin}
                    disabled={disabled}
                    placeholder="最小值"
                    onChange={(event) => {
                      const nextRows = [...value.entries];
                      nextRows[index] = { ...row, rangeMin: event.target.value };
                      onChange({ ...value, entries: nextRows });
                    }}
                  />
                  <input
                    className="entity-form__input"
                    type="number"
                    value={row.rangeMax}
                    disabled={disabled}
                    placeholder="最大值"
                    onChange={(event) => {
                      const nextRows = [...value.entries];
                      nextRows[index] = { ...row, rangeMax: event.target.value };
                      onChange({ ...value, entries: nextRows });
                    }}
                  />
                  <select
                    className="entity-form__input"
                    value={row.linkedItemId}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.entries];
                      nextRows[index] = { ...row, linkedItemId: event.target.value };
                      onChange({ ...value, entries: nextRows });
                    }}
                  >
                    <option value="">不绑定物品</option>
                    {ensureCurrentOption(itemOptions, row.linkedItemId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="entity-form__input"
                    value={row.linkedAbilityId}
                    disabled={disabled}
                    onChange={(event) => {
                      const nextRows = [...value.entries];
                      nextRows[index] = { ...row, linkedAbilityId: event.target.value };
                      onChange({ ...value, entries: nextRows });
                    }}
                  >
                    <option value="">不绑定能力</option>
                    {ensureCurrentOption(abilityOptions, row.linkedAbilityId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    className="entity-form__textarea entity-builder-card__wide"
                    rows={3}
                    value={row.result}
                    disabled={disabled}
                    placeholder="结果文本"
                    onChange={(event) => {
                      const nextRows = [...value.entries];
                      nextRows[index] = { ...row, result: event.target.value };
                      onChange({ ...value, entries: nextRows });
                    }}
                  />
                </div>
                <div className="entity-builder-card__actions">
                  <button
                    type="button"
                    className="entity-builder-list__remove-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        entries: value.entries.filter((_, rowIndex) => rowIndex !== index),
                      })
                    }
                  >
                    删除表项
                  </button>
                </div>
              </div>
            ))}
          </div>
        </FieldShell>
      </SectionCard>
    </div>
  );
}
