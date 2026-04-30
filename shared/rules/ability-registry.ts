import type { AttributeKey } from "../types/world-entities";

export type RegistryOption = {
  label: string;
  value: string;
  group?: string;
  description?: string;
};

export type StatusCategoryKey = "immobilizing" | "interference" | "other" | "effectMarker";

export type AafStatusKey =
  | "incapacitated"
  | "paralyzed"
  | "petrified"
  | "stunned"
  | "unconscious"
  | "blinded"
  | "deafened"
  | "charmed"
  | "frightened"
  | "grappled"
  | "prone"
  | "restrained"
  | "dazed"
  | "slowed"
  | "suppressed"
  | "noHealing"
  | "invisible"
  | "exhaustion"
  | "bloodied"
  | "hasted"
  | "burning"
  | "chilled"
  | "frozen"
  | "sticky"
  | "electrified"
  | "bleeding"
  | "bloodLoss";

export type StatusDefinition = {
  key: AafStatusKey;
  label: string;
  category: StatusCategoryKey;
  aliases?: string[];
  stackable?: boolean;
};

export const STATUS_CATEGORY_OPTIONS = [
  { label: "定身", value: "immobilizing", description: "无法行动、无法移动或失去反应的强控制状态。" },
  { label: "干扰", value: "interference", description: "限制行动、移动、检定、恢复或攻击表现的异常状态。" },
  { label: "其他状态", value: "other", description: "不属于定身/干扰，但仍会被能力引用的状态。" },
  { label: "效果/标记", value: "effectMarker", description: "燃烧、寒冷、流血等可叠层或衰减的效果。" },
] as const satisfies readonly RegistryOption[];

export const STATUS_DEFINITIONS = [
  { key: "incapacitated", label: "失能", category: "immobilizing" },
  { key: "paralyzed", label: "麻痹", category: "immobilizing" },
  { key: "petrified", label: "石化", category: "immobilizing" },
  { key: "stunned", label: "震慑", category: "immobilizing" },
  { key: "unconscious", label: "昏迷", category: "immobilizing" },

  { key: "blinded", label: "目盲", category: "interference" },
  { key: "deafened", label: "耳聋", category: "interference" },
  { key: "charmed", label: "魅惑", category: "interference" },
  { key: "frightened", label: "恐慌", category: "interference" },
  { key: "grappled", label: "受擒", category: "interference" },
  { key: "prone", label: "倒地", category: "interference" },
  { key: "restrained", label: "束缚", category: "interference" },
  { key: "dazed", label: "晕眩", category: "interference" },
  { key: "slowed", label: "缓慢", category: "interference" },
  { key: "suppressed", label: "压制", category: "interference" },
  { key: "noHealing", label: "禁疗", category: "interference" },

  { key: "invisible", label: "隐形", category: "other" },
  { key: "exhaustion", label: "力竭", category: "other", stackable: true },
  { key: "bloodied", label: "浴血", category: "other" },
  { key: "hasted", label: "急速", category: "other", aliases: ["haste"] },

  { key: "burning", label: "燃烧", category: "effectMarker", stackable: true },
  { key: "chilled", label: "寒冷", category: "effectMarker", stackable: true },
  { key: "frozen", label: "冰冻", category: "effectMarker" },
  { key: "sticky", label: "粘滞", category: "effectMarker", stackable: true },
  { key: "electrified", label: "触电", category: "effectMarker", stackable: true },
  { key: "bleeding", label: "流血", category: "effectMarker", stackable: true },
  { key: "bloodLoss", label: "失血", category: "effectMarker", stackable: true },
] as const satisfies readonly StatusDefinition[];

export const STATUS_OPTIONS = STATUS_DEFINITIONS.map((item) => ({
  label: item.label,
  value: item.key,
  group: STATUS_CATEGORY_OPTIONS.find((category) => category.value === item.category)?.label,
})) satisfies RegistryOption[];

export function getStatusCategoryLabel(category: string) {
  return STATUS_CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? category;
}

export function getStatusDefinition(statusKeyOrLabel: unknown) {
  const normalized = String(statusKeyOrLabel ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  return STATUS_DEFINITIONS.find(
    (item) =>
      item.key === normalized ||
      item.label === normalized ||
      ((item as StatusDefinition).aliases ?? []).includes(normalized)
  );
}

export function isStatusInCategory(statusKeyOrLabel: unknown, category: unknown) {
  const definition = getStatusDefinition(statusKeyOrLabel);
  return Boolean(definition && definition.category === category);
}

const ATTRIBUTE_FORMULA_OPTIONS = [
  { label: "力量调整值", attribute: "strength" },
  { label: "敏捷调整值", attribute: "dexterity" },
  { label: "体质调整值", attribute: "constitution" },
  { label: "智力调整值", attribute: "intelligence" },
  { label: "感知调整值", attribute: "wisdom" },
  { label: "魅力调整值", attribute: "charisma" },
] as const satisfies readonly { label: string; attribute: AttributeKey }[];

export const FORMULA_VALUE_OPTIONS = [
  ...ATTRIBUTE_FORMULA_OPTIONS.map((item) => ({
    label: `行动者：${item.label}`,
    value: `actor.attributeMods.${item.attribute}`,
    group: "行动者属性",
  })),
  ...ATTRIBUTE_FORMULA_OPTIONS.map((item) => ({
    label: `目标：${item.label}`,
    value: `target.attributeMods.${item.attribute}`,
    group: "目标属性",
  })),
  { label: "行动者：熟练加值", value: "actor.proficiencyBonus", group: "行动者基础" },
  { label: "行动者：角色等级", value: "actor.level", group: "行动者基础" },
  { label: "行动者：职业等级", value: "actor.professionLevel", group: "行动者基础" },
  { label: "行动者：生命值", value: "actor.hp", group: "行动者资源" },
  { label: "行动者：魔力值 MP", value: "actor.mp", group: "行动者资源" },
  { label: "行动者：战意值", value: "actor.fury", group: "行动者资源" },
  { label: "行动者：技力", value: "actor.stamina", group: "行动者资源" },
  { label: "行动者：AC", value: "actor.ac", group: "行动者防御" },
  { label: "目标：熟练加值", value: "target.proficiencyBonus", group: "目标基础" },
  { label: "目标：角色等级", value: "target.level", group: "目标基础" },
  { label: "目标：生命值", value: "target.hp", group: "目标资源" },
  { label: "目标：魔力值 MP", value: "target.mp", group: "目标资源" },
  { label: "目标：AC", value: "target.ac", group: "目标防御" },
  { label: "事件：检定总值", value: "metadata.check.total", group: "事件结果" },
  { label: "事件：伤害总值", value: "metadata.damage.total", group: "事件结果" },
  { label: "事件：固定 DC", value: "metadata.dc", group: "事件结果" },
] as const satisfies readonly RegistryOption[];

export const CONDITION_RIGHT_VALUE_MODE_OPTIONS = [
  { label: "固定值 / 固定 DC", value: "fixed" },
  { label: "引用另一个数值", value: "valueRef" },
  { label: "使用 DC 预设", value: "dc" },
] as const satisfies readonly RegistryOption[];

export const DC_TARGET_OPTIONS = [
  { label: "固定 DC", value: "fixed", description: "直接填写一个固定目标值，例如 15。" },
  { label: "行动者：能力 DC", value: "actorAbilityDc", description: "8 + 行动者熟练加值 + 指定属性调整值。" },
  { label: "行动者：法术 DC", value: "actorSpellDc", description: "优先读取角色快照 spellDc；没有时按 8 + 熟练 + 指定属性。" },
  { label: "行动者：职业 DC", value: "actorProfessionDc", description: "职业/特性专属 DC；没有时按 8 + 熟练 + 指定属性。" },
  { label: "行动者：属性 DC", value: "actorAttributeDc", description: "8 + 行动者熟练加值 + 指定属性调整值。" },
  { label: "目标：AC", value: "targetAc", description: "对抗目标护甲等级。" },
  { label: "目标：法术 DC", value: "targetSpellDc", description: "读取目标法术 DC，或按目标属性推导。" },
  { label: "目标：属性 DC", value: "targetAttributeDc", description: "8 + 目标熟练加值 + 指定属性调整值。" },
  { label: "目标：被动察觉", value: "targetPassivePerception", description: "10 + 目标感知调整值，可后续接入技能熟练。" },
] as const satisfies readonly RegistryOption[];

export const ABILITY_AUTOMATION_MODE_OPTIONS = [
  { label: "手动预览", value: "manual", description: "生成结算流程和预览，不真实扣资源、扣血或应用效果。" },
  { label: "半自动", value: "assisted", description: "内部测试默认；自动执行当前可处理的结算，并保留人工修正与撤销快照。" },
  { label: "全自动", value: "full", description: "确认目标后自动完成掷骰、判定、伤害和效果应用。" },
] as const satisfies readonly RegistryOption[];

export const ABILITY_WORKFLOW_PHASE_OPTIONS = [
  { label: "声明能力", value: "declare", group: "流程" },
  { label: "确认目标", value: "target-confirmation", group: "流程" },
  { label: "资源检查", value: "cost-check", group: "资源" },
  { label: "反应窗口", value: "reaction-window", group: "反应" },
  { label: "攻击检定", value: "attack-roll", group: "检定" },
  { label: "豁免/对抗", value: "save-roll", group: "检定" },
  { label: "伤害掷骰", value: "damage-roll", group: "伤害" },
  { label: "应用伤害", value: "damage-application", group: "伤害" },
  { label: "应用效果", value: "effect-application", group: "效果" },
  { label: "后处理", value: "post-apply", group: "流程" },
  { label: "完成结算", value: "settle", group: "流程" },
] as const satisfies readonly RegistryOption[];

export const COMPARE_OPERATOR_OPTIONS = [
  { label: "等于 ==", value: "==" },
  { label: "不等于 !=", value: "!=" },
  { label: "大于等于 >=", value: ">=" },
  { label: "小于等于 <=", value: "<=" },
  { label: "大于 >", value: ">" },
  { label: "小于 <", value: "<" },
  { label: "包含 includes", value: "includes" },
] as const satisfies readonly RegistryOption[];

export const ABILITY_TRIGGER_TIMING_OPTIONS = [
  { label: "主动使用时", value: "onAbilityUse", group: "通用" },
  { label: "攻击前", value: "onBeforeAttack", group: "攻击" },
  { label: "攻击命中时", value: "onAttackHit", group: "攻击" },
  { label: "攻击未命中时", value: "onAttackMiss", group: "攻击" },
  { label: "攻击暴击时", value: "onAttackCritical", group: "攻击" },
  { label: "造成伤害后", value: "onDealDamage", group: "伤害" },
  { label: "受到伤害后", value: "onTakeDamage", group: "伤害" },
  { label: "击杀目标后", value: "onKill", group: "伤害" },
  { label: "回合开始", value: "onTurnStart", group: "回合" },
  { label: "回合结束", value: "onTurnEnd", group: "回合" },
  { label: "轮开始", value: "onRoundStart", group: "回合" },
  { label: "轮结束", value: "onRoundEnd", group: "回合" },
  { label: "施法时", value: "onCastSpell", group: "法术" },
  { label: "专注检定时", value: "onConcentrationCheck", group: "法术" },
  { label: "豁免检定时", value: "onSavingThrow", group: "检定" },
  { label: "豁免失败时", value: "onSavingThrowFail", group: "检定" },
  { label: "豁免成功时", value: "onSavingThrowSuccess", group: "检定" },
  { label: "移动时", value: "onMove", group: "移动" },
  { label: "进入区域时", value: "onEnterArea", group: "移动" },
  { label: "离开区域时", value: "onLeaveArea", group: "移动" },
  { label: "状态被施加时", value: "onStatusApply", group: "状态" },
  { label: "状态被移除时", value: "onStatusRemove", group: "状态" },
  { label: "生命半血以下", value: "onHpBelowHalf", group: "资源" },
  { label: "生命归零", value: "onHpZero", group: "资源" },
  { label: "受到治疗后", value: "onHeal", group: "资源" },
  { label: "短休后", value: "onShortRest", group: "休息" },
  { label: "长休后", value: "onLongRest", group: "休息" },
  { label: "战斗开始", value: "onCombatStart", group: "战斗" },
  { label: "战斗结束", value: "onCombatEnd", group: "战斗" },
  { label: "自定义", value: "custom", group: "通用" },
] as const satisfies readonly RegistryOption[];

export const ABILITY_EFFECT_TYPE_OPTIONS = [
  { label: "修改数值", value: "modifyStat" },
  { label: "附加标签", value: "addTag" },
  { label: "移除标签", value: "removeTag" },
  { label: "施加状态", value: "applyState" },
  { label: "移除状态", value: "removeState" },
  { label: "移除状态分类", value: "removeStatusCategory" },
  { label: "免疫指定状态", value: "grantStatusImmunity" },
  { label: "免疫状态分类", value: "grantStatusCategoryImmunity" },
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
] as const satisfies readonly RegistryOption[];
