import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useWorldEntityStore, type EntityRecord, type EntityType } from "../../stores/worldEntityStore";
import {
  AbilityVisualEditor,
  BackgroundVisualEditor,
  DeckVisualEditor,
  FateClockVisualEditor,
  ItemVisualEditor,
  ProfessionVisualEditor,
  RaceVisualEditor,
  RandomTableVisualEditor,
  SPECIAL_ENTITY_FIELDS,
  buildAbilityEditorPayload,
  buildAbilityEditorState,
  buildBackgroundEditorPayload,
  buildBackgroundEditorState,
  buildDeckEditorPayload,
  buildDeckEditorState,
  buildFateClockEditorPayload,
  buildFateClockEditorState,
  buildItemEditorPayload,
  buildItemEditorState,
  buildProfessionEditorPayload,
  buildProfessionEditorState,
  buildRaceEditorPayload,
  buildRaceEditorState,
  buildRandomTableEditorPayload,
  buildRandomTableEditorState,
  type AbilityEditorState,
  type BackgroundEditorState,
  type DeckEditorState,
  type FateClockEditorState,
  type ItemEditorState,
  type ProfessionEditorState,
  type RaceEditorState,
  type RandomTableEditorState,
} from "./EntityVisualEditors";

type EntityManagerProps = {
  worldId: string;
  entityType: EntityType;
  label: string;
  canEdit: boolean;
};

type EntityFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "json";
type EditorPanelKey = "description" | "rules" | "advanced";

type EntityFieldSchema = {
  key: string;
  label: string;
  type: EntityFieldType;
  panel?: EditorPanelKey;
  placeholder?: string;
  rows?: number;
  span?: 1 | 2;
  defaultValue?: string | number | boolean;
  jsonDefault?: Record<string, unknown> | unknown[];
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  transient?: boolean;
  visibleWhen?: (state: FormState) => boolean;
};

type EntitySchema = {
  description: string;
  fields: EntityFieldSchema[];
};

type FormState = Record<string, string | boolean>;

const SYSTEM_KEYS = new Set(["id", "worldId", "createdAt", "updatedAt"]);
const PLAYER_TEXT_KEYS = new Set(["name", "folderPath", "iconUrl", "description", "loreText", "rulesText", "ageDesc"]);
const CHECK_TYPE_ATTACK = "attack";
const CHECK_TYPE_SAVE = "savingThrow";
const CHECK_TYPE_CONTEST = "contest";

const ATTRIBUTE_OPTIONS = [
  { label: "力量", value: "strength" },
  { label: "敏捷", value: "dexterity" },
  { label: "体质", value: "constitution" },
  { label: "智力", value: "intelligence" },
  { label: "感知", value: "wisdom" },
  { label: "魅力", value: "charisma" },
];

const SKILL_OPTIONS = [
  { label: "无，仅属性", value: "" },
  { label: "运动", value: "athletics" },
  { label: "体操", value: "acrobatics" },
  { label: "巧手", value: "sleightOfHand" },
  { label: "隐匿", value: "stealth" },
  { label: "奥秘", value: "arcana" },
  { label: "历史", value: "history" },
  { label: "调查", value: "investigation" },
  { label: "自然", value: "nature" },
  { label: "宗教", value: "religion" },
  { label: "洞悉", value: "insight" },
  { label: "医药", value: "medicine" },
  { label: "察觉", value: "perception" },
  { label: "求生", value: "survival" },
  { label: "欺瞒", value: "deception" },
  { label: "威吓", value: "intimidation" },
  { label: "表演", value: "performance" },
  { label: "游说", value: "persuasion" },
];

const ATTACK_DEFENSE_OPTIONS = [
  { label: "目标 AC", value: "ac" },
  { label: "目标防御值", value: "defense" },
  { label: "自定义结算", value: "custom" },
];

const ENTITY_SCHEMAS: Record<EntityType, EntitySchema> = {
  abilities: {
    description: "模板库只负责检索和组织条目；双击条目打开编辑器，展示文本与后台结算分开配置。",
    fields: [
      { key: "name", label: "名称", type: "text", placeholder: "例如：守护反应", defaultValue: "", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：法术/塑能/冰", defaultValue: "", span: 2, panel: "description" },
      { key: "iconUrl", label: "图标 URL", type: "text", placeholder: "可选，用于玩家阅读界面展示", span: 2, panel: "description" },
      { key: "description", label: "玩家简介", type: "textarea", rows: 5, span: 2, panel: "description" },
      { key: "rulesText", label: "玩家可读规则文本", type: "textarea", rows: 8, span: 2, panel: "description" },
      {
        key: "category",
        label: "能力类型",
        type: "select",
        defaultValue: "custom",
        options: [
          { label: "法术", value: "spell" },
          { label: "战技", value: "combatTechnique" },
          { label: "特性", value: "feature" },
          { label: "种族能力", value: "racial" },
          { label: "物品能力", value: "item" },
          { label: "自定义", value: "custom" },
        ],
      },
      {
        key: "source",
        label: "来源",
        type: "select",
        defaultValue: "custom",
        options: [
          { label: "种族", value: "race" },
          { label: "职业", value: "profession" },
          { label: "天赋", value: "talent" },
          { label: "装备", value: "equipment" },
          { label: "物品", value: "item" },
          { label: "背景", value: "background" },
          { label: "专长", value: "feat" },
          { label: "自定义", value: "custom" },
        ],
      },
      { key: "sourceName", label: "来源名", type: "text", placeholder: "例如：战士 / 圣骑士 / 霜龙血脉" },
      {
        key: "activation",
        label: "激活方式",
        type: "select",
        defaultValue: "active",
        options: [
          { label: "主动", value: "active" },
          { label: "被动", value: "passive" },
          { label: "切换", value: "toggle" },
          { label: "反应", value: "reaction" },
          { label: "触发", value: "triggered" },
        ],
      },
      {
        key: "actionType",
        label: "动作类型",
        type: "select",
        defaultValue: "standard",
        visibleWhen: (state) => state.activation !== "passive",
        options: [
          { label: "标准动作", value: "standard" },
          { label: "快速动作", value: "quick" },
          { label: "机动动作", value: "maneuver" },
          { label: "自由动作", value: "free" },
          { label: "反应动作", value: "reaction" },
          { label: "复合动作", value: "composite" },
          { label: "特殊", value: "special" },
        ],
      },
      {
        key: "checkType",
        label: "检定类型",
        type: "select",
        defaultValue: "none",
        span: 2,
        helperText: "选择检定类型后，下方会只显示当前结算需要的字段。",
        options: [
          { label: "无需检定", value: "none" },
          { label: "攻击检定", value: CHECK_TYPE_ATTACK },
          { label: "豁免检定", value: CHECK_TYPE_SAVE },
          { label: "对抗检定", value: CHECK_TYPE_CONTEST },
        ],
      },
      {
        key: "attackAttr",
        label: "攻击关联属性",
        type: "select",
        defaultValue: "strength",
        visibleWhen: (state) => state.checkType === CHECK_TYPE_ATTACK,
        options: ATTRIBUTE_OPTIONS,
      },
      {
        key: "attackTargetDefense",
        label: "攻击对抗目标",
        type: "select",
        defaultValue: "ac",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_ATTACK,
        options: ATTACK_DEFENSE_OPTIONS,
      },
      {
        key: "saveDCAttribute",
        label: "豁免 DC 属性",
        type: "select",
        defaultValue: "intelligence",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_SAVE,
        options: ATTRIBUTE_OPTIONS,
      },
      {
        key: "saveDCBase",
        label: "豁免基础 DC",
        type: "number",
        defaultValue: "",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_SAVE,
        helperText: "留空时由结算管线按施法者、职业或规则模块推导。",
      },
      {
        key: "contestActorAttribute",
        label: "发起方属性",
        type: "select",
        defaultValue: "strength",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_CONTEST,
        options: ATTRIBUTE_OPTIONS,
      },
      {
        key: "contestActorSkill",
        label: "发起方技能",
        type: "select",
        defaultValue: "",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_CONTEST,
        options: SKILL_OPTIONS,
      },
      {
        key: "contestTargetAttribute",
        label: "目标方属性",
        type: "select",
        defaultValue: "dexterity",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_CONTEST,
        options: ATTRIBUTE_OPTIONS,
      },
      {
        key: "contestTargetSkill",
        label: "目标方技能",
        type: "select",
        defaultValue: "",
        transient: true,
        visibleWhen: (state) => state.checkType === CHECK_TYPE_CONTEST,
        options: SKILL_OPTIONS,
      },
      {
        key: "duration",
        label: "持续时间",
        type: "select",
        defaultValue: "instantaneous",
        options: [
          { label: "瞬时", value: "instantaneous" },
          { label: "轮", value: "rounds" },
          { label: "分钟", value: "minutes" },
          { label: "小时", value: "hours" },
          { label: "需专注", value: "concentration" },
          { label: "短休前", value: "until-rest-short" },
          { label: "长休前", value: "until-rest-long" },
          { label: "永久", value: "permanent" },
          { label: "特殊", value: "special" },
        ],
      },
      {
        key: "durationValue",
        label: "持续值",
        type: "number",
        defaultValue: 0,
        visibleWhen: (state) => ["rounds", "minutes", "hours"].includes(String(state.duration ?? "")),
      },
      { key: "range", label: "距离", type: "text", placeholder: "例如：30 / self / touch / special" },
      { key: "levelReq", label: "等级要求", type: "number", defaultValue: 1 },
      {
        key: "spellLevel",
        label: "法术等级序列",
        type: "number",
        defaultValue: 0,
        visibleWhen: (state) => state.category === "spell",
        helperText: "0=戏法，1=初级，2=中级，3=高级，4=史诗，5=传说，6=禁咒。",
      },
      {
        key: "spellSchool",
        label: "法术学派",
        type: "text",
        placeholder: "例如：塑能 / 防护 / 咒法 / 变化",
        visibleWhen: (state) => state.category === "spell",
      },
      { key: "concentration", label: "需要专注", type: "boolean", defaultValue: false, visibleWhen: (state) => state.category === "spell" || state.duration === "concentration" },
      { key: "sortOrder", label: "排序值", type: "number", defaultValue: 0 },
      { key: "tags", label: "标签 JSON", type: "json", rows: 5, span: 2, jsonDefault: [], helperText: '例如：["反应","防御","姿态"]' },
      { key: "resourceCosts", label: "资源消耗 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
      { key: "damageRolls", label: "伤害骰 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
      { key: "trigger", label: "触发器 JSON", type: "json", rows: 8, span: 2, jsonDefault: {} },
      { key: "effects", label: "效果 JSON", type: "json", rows: 10, span: 2, jsonDefault: [] },
    ],
  },
  races: {
    description: "种族、血脉与子种模板目录。目录页只展示条目，双击打开描述与规则配置。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：种族/人型/混血", span: 2, panel: "description" },
      { key: "iconUrl", label: "图标 URL", type: "text", span: 2, panel: "description" },
      { key: "description", label: "简介", type: "textarea", rows: 4, span: 2, panel: "description" },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 8, span: 2, panel: "description" },
      { key: "ageDesc", label: "年龄描述", type: "textarea", rows: 3, span: 2, panel: "description" },
      { key: "size", label: "体型", type: "select", defaultValue: "medium", options: [
        { label: "超小", value: "tiny" },
        { label: "小型", value: "small" },
        { label: "中型", value: "medium" },
        { label: "大型", value: "large" },
        { label: "超大型", value: "huge" },
      ] },
      { key: "speed", label: "速度", type: "number", defaultValue: 30 },
      { key: "darkvision", label: "黑暗视觉", type: "number", defaultValue: 0 },
      { key: "creatureType", label: "生物类型", type: "text", defaultValue: "humanoid" },
      { key: "attrBonus", label: "属性加值 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
      { key: "languages", label: "语言 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "traits", label: "特质 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
      { key: "subtypes", label: "子种 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  professions: {
    description: "冒险职业与生活职业模板目录。职业阅读文本与后台成长表分开维护。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：职业/冒险/前卫", span: 2, panel: "description" },
      { key: "iconUrl", label: "图标 URL", type: "text", span: 2, panel: "description" },
      { key: "description", label: "简介", type: "textarea", rows: 4, span: 2, panel: "description" },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 8, span: 2, panel: "description" },
      { key: "type", label: "职业类型", type: "select", defaultValue: "combat", options: [
        { label: "冒险职业", value: "combat" },
        { label: "生活职业", value: "life" },
      ] },
      { key: "hitDie", label: "生命骰", type: "text", defaultValue: "1d10" },
      { key: "primaryAttribute", label: "主属性", type: "select", defaultValue: "strength", options: ATTRIBUTE_OPTIONS },
      { key: "spellcastingAttr", label: "施法属性", type: "select", defaultValue: "", options: [{ label: "无", value: "" }, ...ATTRIBUTE_OPTIONS] },
      { key: "furyPerLevel", label: "每级战意", type: "number", defaultValue: 0 },
      { key: "startingWealth", label: "起始财富", type: "text", placeholder: "例如：2d6*10" },
      { key: "saveProficiencies", label: "豁免熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "armorProficiencies", label: "护甲熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "weaponProficiencies", label: "武器熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "toolProficiencies", label: "工具熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "skillChoices", label: "技能选择 JSON", type: "json", rows: 6, span: 2, jsonDefault: {} },
      { key: "startingEquipment", label: "起始装备 JSON", type: "json", rows: 5, span: 2, jsonDefault: [] },
      { key: "levelFeatures", label: "等级特性 JSON", type: "json", rows: 12, span: 2, jsonDefault: [] },
      { key: "talentTreeIds", label: "天赋树 ID JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
    ],
  },
  backgrounds: {
    description: "背景资料模板目录。描述给玩家阅读，规则页维护熟练、装备和背景特性。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：背景/城市/行会", span: 2, panel: "description" },
      { key: "iconUrl", label: "图标 URL", type: "text", span: 2, panel: "description" },
      { key: "description", label: "简介", type: "textarea", rows: 4, span: 2, panel: "description" },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 8, span: 2, panel: "description" },
      { key: "skillPoints", label: "技能点", type: "number", defaultValue: 0 },
      { key: "bonusLanguages", label: "额外语言", type: "number", defaultValue: 0 },
      { key: "toolProficiencies", label: "工具熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "startingEquipment", label: "起始装备 JSON", type: "json", rows: 5, span: 2, jsonDefault: [] },
      { key: "features", label: "背景特性 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  items: {
    description: "装备、道具、素材与造物组件模板目录。物品说明与装备结算规则分离。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：装备/武器/单手剑", span: 2, panel: "description" },
      { key: "iconUrl", label: "图标 URL", type: "text", span: 2, panel: "description" },
      { key: "description", label: "物品说明", type: "textarea", rows: 8, span: 2, panel: "description" },
      { key: "category", label: "物品类型", type: "text", defaultValue: "gear" },
      { key: "subcategory", label: "子类别", type: "text" },
      { key: "rarity", label: "稀有度", type: "text", defaultValue: "common" },
      { key: "weight", label: "重量", type: "number", defaultValue: 0 },
      { key: "price", label: "价格", type: "number", defaultValue: 0 },
      { key: "stackable", label: "可堆叠", type: "boolean", defaultValue: false },
      { key: "maxStack", label: "最大堆叠", type: "number", defaultValue: 0, visibleWhen: (state) => Boolean(state.stackable) },
      { key: "requiresIdent", label: "需要鉴定", type: "boolean", defaultValue: false },
      { key: "requiresAttune", label: "需要同调", type: "boolean", defaultValue: false },
      { key: "enhanceSlots", label: "强化槽", type: "number", defaultValue: 0 },
      { key: "gemSlots", label: "宝石槽", type: "number", defaultValue: 0 },
      { key: "attuneReq", label: "同调条件", type: "text", visibleWhen: (state) => Boolean(state.requiresAttune) },
      { key: "tags", label: "标签 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "weaponProps", label: "武器属性 JSON", type: "json", rows: 7, span: 2, jsonDefault: {} },
      { key: "armorProps", label: "护甲属性 JSON", type: "json", rows: 7, span: 2, jsonDefault: {} },
      { key: "enchantments", label: "附魔 JSON", type: "json", rows: 9, span: 2, jsonDefault: [] },
    ],
  },
  fateClocks: {
    description: "命刻模板目录。目录管理倒计时条目，编辑器拆分公开描述和 GM 推进参数。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：命刻/主线/危机", span: 2, panel: "description" },
      { key: "description", label: "公开描述", type: "textarea", rows: 6, span: 2, panel: "description" },
      { key: "segments", label: "刻度数", type: "number", defaultValue: 6 },
      { key: "filledSegments", label: "已填充", type: "number", defaultValue: 0 },
      { key: "visibleToPlayers", label: "玩家可见", type: "boolean", defaultValue: true },
      { key: "direction", label: "方向", type: "select", defaultValue: "advance", options: [
        { label: "推进", value: "advance" },
        { label: "倒计时", value: "countdown" },
      ] },
      { key: "status", label: "状态", type: "text", defaultValue: "active" },
      { key: "successThreshold", label: "成功阈值", type: "number", defaultValue: 0 },
      { key: "failureThreshold", label: "失败阈值", type: "number", defaultValue: 0 },
      { key: "sceneId", label: "关联场景 ID", type: "text" },
      { key: "history", label: "历史 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  decks: {
    description: "牌组模板目录。牌组说明与卡牌列表分开编辑，便于后续接入抽牌自动化。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：牌组/剧情/遭遇", span: 2, panel: "description" },
      { key: "description", label: "牌组说明", type: "textarea", rows: 6, span: 2, panel: "description" },
      { key: "replacement", label: "抽后放回", type: "boolean", defaultValue: true },
      { key: "cards", label: "卡牌 JSON", type: "json", rows: 12, span: 2, jsonDefault: [] },
      { key: "drawnHistory", label: "已抽记录 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
    ],
  },
  randomTables: {
    description: "随机表模板目录。表说明给玩家或 GM 阅读，结果项在规则页维护。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2, panel: "description" },
      { key: "folderPath", label: "模板目录", type: "text", placeholder: "例如：随机表/掉落/荒野", span: 2, panel: "description" },
      { key: "description", label: "说明", type: "textarea", rows: 6, span: 2, panel: "description" },
      { key: "diceFormula", label: "骰式", type: "text", defaultValue: "1d100" },
      { key: "entries", label: "表项 JSON", type: "json", rows: 14, span: 2, jsonDefault: [] },
    ],
  },
};

function parseJsonInput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function stringifyJson(value: unknown, fallback: unknown) {
  return JSON.stringify(typeof value === "undefined" ? fallback : value, null, 2);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeActionTypeValue(value: unknown) {
  if (value === "move") return "maneuver";
  if (value === "full-round") return "composite";
  return typeof value === "string" ? value : "";
}

function normalizeFolderPath(value: unknown) {
  return String(value ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function getEntityFolderStorageKey(worldId: string, entityType: EntityType) {
  return `aaf-entity-folders:v1:${worldId}:${entityType}`;
}

function loadEntityFolders(worldId: string, entityType: EntityType) {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getEntityFolderStorageKey(worldId, entityType)) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeFolderPath(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveEntityFolders(worldId: string, entityType: EntityType, folders: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getEntityFolderStorageKey(worldId, entityType), JSON.stringify(folders));
}

function expandFolderAncestors(paths: string[]) {
  const result = new Set<string>();
  for (const path of paths) {
    const normalized = normalizeFolderPath(path);
    if (!normalized) continue;
    const parts = normalized.split("/");
    for (let index = 1; index <= parts.length; index += 1) {
      result.add(parts.slice(0, index).join("/"));
    }
  }
  return [...result].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function getFolderLeafName(path: string) {
  return path ? path.split("/").at(-1) ?? path : "全部资源";
}

function isInFolder(item: EntityRecord, folderPath: string) {
  if (!folderPath) {
    return true;
  }
  const itemPath = normalizeFolderPath(item.folderPath);
  return itemPath === folderPath || itemPath.startsWith(`${folderPath}/`);
}

function getActionTypeLabel(value: unknown) {
  const normalized = normalizeActionTypeValue(value);
  const labels: Record<string, string> = {
    standard: "标准动作",
    quick: "快速动作",
    maneuver: "机动动作",
    free: "自由动作",
    reaction: "反应动作",
    composite: "复合动作",
    special: "特殊",
  };
  return labels[normalized] ?? normalized;
}

function getEntityMeta(item: EntityRecord) {
  const candidateKeys = ["category", "type", "rarity", "status", "actionType"];
  const values = candidateKeys
    .map((key) => (key === "actionType" ? getActionTypeLabel(item[key]) : item[key]))
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

  return values.slice(0, 2).join(" · ");
}

function getInitialFieldValue(field: EntityFieldSchema, source?: EntityRecord | null) {
  const saveDC = asObject(source?.saveDC);
  if (field.key === "actionType") return normalizeActionTypeValue(source?.actionType ?? field.defaultValue ?? "");
  if (field.key === "folderPath") return normalizeFolderPath(source?.folderPath ?? field.defaultValue ?? "");
  if (field.key === "attackTargetDefense") return String(saveDC?.targetDefense ?? field.defaultValue ?? "ac");
  if (field.key === "saveDCAttribute") return String(saveDC?.attribute ?? field.defaultValue ?? "intelligence");
  if (field.key === "saveDCBase") return saveDC?.base != null ? String(saveDC.base) : String(field.defaultValue ?? "");
  if (field.key === "contestActorAttribute") return String(asObject(saveDC?.actor)?.attribute ?? saveDC?.actorAttribute ?? field.defaultValue ?? "strength");
  if (field.key === "contestActorSkill") return String(asObject(saveDC?.actor)?.skill ?? saveDC?.actorSkill ?? field.defaultValue ?? "");
  if (field.key === "contestTargetAttribute") return String(asObject(saveDC?.target)?.attribute ?? saveDC?.targetAttribute ?? field.defaultValue ?? "dexterity");
  if (field.key === "contestTargetSkill") return String(asObject(saveDC?.target)?.skill ?? saveDC?.targetSkill ?? field.defaultValue ?? "");
  return source?.[field.key];
}

function buildInitialFormState(schema: EntitySchema, source?: EntityRecord | null): FormState {
  return Object.fromEntries(
    schema.fields.map((field) => {
      const rawValue = getInitialFieldValue(field, source);
      if (field.type === "boolean") {
        return [field.key, Boolean(rawValue ?? field.defaultValue ?? false)];
      }

      if (field.type === "json") {
        return [field.key, stringifyJson(rawValue, field.jsonDefault ?? {})];
      }

      if (field.type === "number") {
        const value = rawValue != null ? String(rawValue) : String(field.defaultValue ?? "");
        return [field.key, value];
      }

      return [field.key, rawValue != null ? String(rawValue) : String(field.defaultValue ?? "")];
    })
  );
}

function buildExtraJsonDraft(schema: EntitySchema, source?: EntityRecord | null) {
  if (!source) {
    return "{}";
  }

  const schemaKeys = new Set(schema.fields.map((field) => field.key));
  const extras = Object.fromEntries(
    Object.entries(source).filter(([key]) => !schemaKeys.has(key) && !SYSTEM_KEYS.has(key))
  );

  return stringifyJson(extras, {});
}

function normalizeFieldValue(field: EntityFieldSchema, rawValue: string | boolean): unknown {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }

  if (field.type === "number") {
    const trimmed = String(rawValue).trim();
    return trimmed ? Number(trimmed) : null;
  }

  if (field.type === "json") {
    const parsed = parseJsonInput(String(rawValue));
    return typeof parsed === "undefined" ? field.jsonDefault ?? {} : parsed;
  }

  if (field.key === "actionType") {
    return normalizeActionTypeValue(rawValue);
  }

  if (field.key === "folderPath") {
    return normalizeFolderPath(rawValue);
  }

  return String(rawValue ?? "");
}

function getFieldPanel(field: EntityFieldSchema): EditorPanelKey {
  if (field.panel) {
    return field.panel;
  }
  if (field.type === "json") {
    return "advanced";
  }
  return PLAYER_TEXT_KEYS.has(field.key) ? "description" : "rules";
}

function isFieldVisible(field: EntityFieldSchema, state: FormState) {
  return field.visibleWhen ? field.visibleWhen(state) : true;
}

function applyCheckTypeDefaults(prev: FormState, nextType: string): FormState {
  const next: FormState = { ...prev, checkType: nextType };
  if (nextType === CHECK_TYPE_ATTACK) {
    next.attackAttr = String(next.attackAttr || "strength");
    next.attackTargetDefense = String(next.attackTargetDefense || "ac");
  }
  if (nextType === CHECK_TYPE_SAVE) {
    next.saveDCAttribute = String(next.saveDCAttribute || "intelligence");
  }
  if (nextType === CHECK_TYPE_CONTEST) {
    next.contestActorAttribute = String(next.contestActorAttribute || "strength");
    next.contestTargetAttribute = String(next.contestTargetAttribute || "dexterity");
  }
  return next;
}

function buildAbilityCheckPayload(state: FormState) {
  const checkType = String(state.checkType ?? "none");
  if (checkType === CHECK_TYPE_ATTACK) {
    return {
      attackAttr: String(state.attackAttr || "strength"),
      saveDC: {
        mode: "attack",
        targetDefense: String(state.attackTargetDefense || "ac"),
      },
    };
  }

  if (checkType === CHECK_TYPE_SAVE) {
    const baseText = String(state.saveDCBase ?? "").trim();
    return {
      attackAttr: null,
      saveDC: {
        mode: "savingThrow",
        attribute: String(state.saveDCAttribute || "intelligence"),
        ...(baseText ? { base: Number(baseText) } : {}),
      },
    };
  }

  if (checkType === CHECK_TYPE_CONTEST) {
    return {
      attackAttr: null,
      saveDC: {
        mode: "contest",
        actor: {
          attribute: String(state.contestActorAttribute || "strength"),
          skill: String(state.contestActorSkill || ""),
        },
        target: {
          attribute: String(state.contestTargetAttribute || "dexterity"),
          skill: String(state.contestTargetSkill || ""),
        },
      },
    };
  }

  return { attackAttr: null, saveDC: null };
}

function getEditorSubtitle(item: EntityRecord | null) {
  if (!item) return "新建模板";
  const folder = normalizeFolderPath(item.folderPath);
  const meta = getEntityMeta(item);
  return [folder || "未分类", meta].filter(Boolean).join(" · ");
}

export function EntityManager({ worldId, entityType, label, canEdit }: EntityManagerProps) {
  const loadEntities = useWorldEntityStore((state) => state.loadEntities);
  const createEntity = useWorldEntityStore((state) => state.createEntity);
  const updateEntity = useWorldEntityStore((state) => state.updateEntity);
  const deleteEntity = useWorldEntityStore((state) => state.deleteEntity);
  const abilityItems = useWorldEntityStore((state) => state.abilities.items);
  const itemItems = useWorldEntityStore((state) => state.items.items);
  const slice = useWorldEntityStore((state) => state[entityType]);
  const schema = ENTITY_SCHEMAS[entityType];
  const specialFieldKeys = SPECIAL_ENTITY_FIELDS[entityType as keyof typeof SPECIAL_ENTITY_FIELDS] ?? new Set<string>();

  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [localFolders, setLocalFolders] = useState<string[]>(() => loadEntityFolders(worldId, entityType));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EntityRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorPanelKey>("description");
  const [formState, setFormState] = useState<FormState>(() => buildInitialFormState(schema, null));
  const [abilityEditorState, setAbilityEditorState] = useState<AbilityEditorState>(() => buildAbilityEditorState(null));
  const [raceEditorState, setRaceEditorState] = useState<RaceEditorState>(() => buildRaceEditorState(null));
  const [backgroundEditorState, setBackgroundEditorState] = useState<BackgroundEditorState>(() => buildBackgroundEditorState(null));
  const [itemEditorState, setItemEditorState] = useState<ItemEditorState>(() => buildItemEditorState(null));
  const [professionEditorState, setProfessionEditorState] = useState<ProfessionEditorState>(() => buildProfessionEditorState(null));
  const [fateClockEditorState, setFateClockEditorState] = useState<FateClockEditorState>(() => buildFateClockEditorState(null));
  const [deckEditorState, setDeckEditorState] = useState<DeckEditorState>(() => buildDeckEditorState(null));
  const [randomTableEditorState, setRandomTableEditorState] = useState<RandomTableEditorState>(() => buildRandomTableEditorState(null));
  const [extraJsonText, setExtraJsonText] = useState("{}");
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    if (!worldId) {
      return;
    }
    void loadEntities(worldId, entityType);
  }, [worldId, entityType, loadEntities]);

  useEffect(() => {
    if (!worldId) {
      return;
    }

    if (["professions", "races", "backgrounds", "items", "randomTables"].includes(entityType)) {
      void loadEntities(worldId, "abilities");
    }

    if (["decks", "randomTables"].includes(entityType)) {
      void loadEntities(worldId, "items");
    }
  }, [entityType, loadEntities, worldId]);

  useEffect(() => {
    setLocalFolders(loadEntityFolders(worldId, entityType));
    setSelectedFolder("");
    setSelectedItemId(null);
    setKeyword("");
  }, [entityType, worldId]);

  useEffect(() => {
    setFormState(buildInitialFormState(schema, editing));
    setAbilityEditorState(buildAbilityEditorState(editing));
    setRaceEditorState(buildRaceEditorState(editing));
    setBackgroundEditorState(buildBackgroundEditorState(editing));
    setItemEditorState(buildItemEditorState(editing));
    setProfessionEditorState(buildProfessionEditorState(editing));
    setFateClockEditorState(buildFateClockEditorState(editing));
    setDeckEditorState(buildDeckEditorState(editing));
    setRandomTableEditorState(buildRandomTableEditorState(editing));
    setExtraJsonText(buildExtraJsonDraft(schema, editing));
    setEditorError(null);
    setEditorTab("description");
  }, [editing, schema]);

  const persistFolders = useCallback(
    (folders: string[]) => {
      const normalized = expandFolderAncestors(folders);
      saveEntityFolders(worldId, entityType, normalized);
      setLocalFolders(normalized);
      return normalized;
    },
    [entityType, worldId]
  );

  const registerFolderPath = useCallback(
    (folderPath: string) => {
      const normalized = normalizeFolderPath(folderPath);
      if (!normalized) return;
      persistFolders([...localFolders, normalized]);
    },
    [localFolders, persistFolders]
  );

  const itemFolderPaths = useMemo(
    () => slice.items.map((item) => normalizeFolderPath(item.folderPath)).filter(Boolean),
    [slice.items]
  );

  const folderRows = useMemo(
    () => ["", ...expandFolderAncestors([...localFolders, ...itemFolderPaths])],
    [itemFolderPaths, localFolders]
  );

  const folderCount = useCallback(
    (folderPath: string) => slice.items.filter((item) => isInFolder(item, folderPath)).length,
    [slice.items]
  );

  const selectedItem = useMemo(
    () => slice.items.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, slice.items]
  );

  const filteredItems = useMemo(() => {
    const key = deferredKeyword.trim().toLowerCase();
    const scoped = slice.items.filter((item) => isInFolder(item, selectedFolder));
    if (!key) return scoped;
    return scoped.filter((item) => {
      const haystack = [item.name, normalizeFolderPath(item.folderPath), getEntityMeta(item), String(item.description ?? "")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(key);
    });
  }, [deferredKeyword, selectedFolder, slice.items]);

  const beginCreate = useCallback(() => {
    setIsCreating(true);
    setEditing({ id: "", worldId, name: "", folderPath: selectedFolder });
  }, [selectedFolder, worldId]);

  const beginEdit = useCallback((item: EntityRecord) => {
    setIsCreating(false);
    setEditing(item);
    setSelectedItemId(item.id);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setIsCreating(false);
    setEditorError(null);
  }, []);

  const createFolder = useCallback(() => {
    const normalized = normalizeFolderPath(folderDraft);
    if (!normalized) return;
    persistFolders([...localFolders, normalized]);
    setSelectedFolder(normalized);
    setFolderDraft("");
  }, [folderDraft, localFolders, persistFolders]);

  const removeSelectedFolder = useCallback(() => {
    if (!selectedFolder || folderCount(selectedFolder) > 0) return;
    const nextFolders = localFolders.filter((folder) => folder !== selectedFolder && !folder.startsWith(`${selectedFolder}/`));
    persistFolders(nextFolders);
    setSelectedFolder("");
  }, [folderCount, localFolders, persistFolders, selectedFolder]);

  const moveSelectedToFolder = useCallback(async () => {
    if (!selectedItem || !canEdit || !worldId) return;
    const nextFolder = normalizeFolderPath(selectedFolder);
    await updateEntity(worldId, entityType, selectedItem.id, { folderPath: nextFolder });
    registerFolderPath(nextFolder);
  }, [canEdit, entityType, registerFolderPath, selectedFolder, selectedItem, updateEntity, worldId]);

  const deleteSelected = useCallback(async () => {
    if (!selectedItem || !canEdit || !worldId) return;
    if (!window.confirm(`确定删除「${selectedItem.name}」吗？`)) return;
    await deleteEntity(worldId, entityType, selectedItem.id);
    setSelectedItemId(null);
  }, [canEdit, deleteEntity, entityType, selectedItem, worldId]);

  const updateField = useCallback((field: EntityFieldSchema, value: string | boolean) => {
    startTransition(() => {
      setFormState((prev) => {
        if (field.key === "checkType") {
          return applyCheckTypeDefaults(prev, String(value));
        }
        return { ...prev, [field.key]: value };
      });
    });
  }, []);

  const submit = useCallback(async () => {
    if (!editing || !worldId) {
      return;
    }

    const nextData: Record<string, unknown> = {};
    for (const field of schema.fields) {
      if (field.transient || specialFieldKeys.has(field.key)) {
        continue;
      }

      const rawValue = formState[field.key];
      if (field.type === "json") {
        const trimmed = String(rawValue ?? "").trim();
        if (trimmed) {
          const parsed = parseJsonInput(trimmed);
          if (typeof parsed === "undefined") {
            setEditorError(`${field.label} 不是合法 JSON。`);
            return;
          }
        }
      }

      nextData[field.key] = normalizeFieldValue(field, rawValue);
    }

    if (entityType === "abilities") {
      Object.assign(nextData, buildAbilityCheckPayload(formState), buildAbilityEditorPayload(abilityEditorState));
    }

    if (entityType === "races") {
      Object.assign(nextData, buildRaceEditorPayload(raceEditorState));
    }

    if (entityType === "backgrounds") {
      Object.assign(nextData, buildBackgroundEditorPayload(backgroundEditorState));
    }

    if (entityType === "items") {
      Object.assign(nextData, buildItemEditorPayload(itemEditorState));
    }

    if (entityType === "professions") {
      Object.assign(nextData, buildProfessionEditorPayload(professionEditorState));
    }

    if (entityType === "fateClocks") {
      Object.assign(nextData, buildFateClockEditorPayload(fateClockEditorState));
    }

    if (entityType === "decks") {
      Object.assign(nextData, buildDeckEditorPayload(deckEditorState));
    }

    if (entityType === "randomTables") {
      Object.assign(nextData, buildRandomTableEditorPayload(randomTableEditorState));
    }

    const extraTrimmed = extraJsonText.trim();
    if (extraTrimmed) {
      const parsedExtra = parseJsonInput(extraTrimmed);
      if (!parsedExtra || typeof parsedExtra !== "object" || Array.isArray(parsedExtra)) {
        setEditorError("高级 JSON 扩展必须是一个对象。");
        return;
      }
      Object.assign(nextData, parsedExtra);
    }

    if (typeof nextData.name !== "string" || !nextData.name.trim()) {
      nextData.name = editing.name || "未命名";
    }

    setEditorError(null);
    const saved = isCreating
      ? await createEntity(worldId, entityType, nextData)
      : await updateEntity(worldId, entityType, editing.id, nextData);
    const savedFolder = normalizeFolderPath(saved.folderPath ?? nextData.folderPath);
    registerFolderPath(savedFolder);
    setSelectedItemId(saved.id);
    closeEditor();
  }, [
    abilityEditorState,
    backgroundEditorState,
    closeEditor,
    createEntity,
    deckEditorState,
    editing,
    entityType,
    extraJsonText,
    fateClockEditorState,
    formState,
    itemEditorState,
    isCreating,
    professionEditorState,
    raceEditorState,
    randomTableEditorState,
    registerFolderPath,
    schema.fields,
    specialFieldKeys,
    updateEntity,
    worldId,
  ]);

  const abilityOptions = useMemo(
    () =>
      abilityItems.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [abilityItems]
  );

  const itemOptions = useMemo(
    () =>
      itemItems.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [itemItems]
  );

  const renderField = (field: EntityFieldSchema) => {
    if (!isFieldVisible(field, formState)) {
      return null;
    }

    const value = formState[field.key];
    const wrapperClass = [
      "entity-form__field",
      field.span === 2 ? "entity-form__field--span-2" : "",
      field.type === "textarea" && getFieldPanel(field) === "description" ? "entity-form__field--wide-text" : "",
    ].filter(Boolean).join(" ");

    if (field.type === "boolean") {
      return (
        <label className={`${wrapperClass} entity-form__field--toggle`.trim()} key={field.key}>
          <span>{field.label}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={!canEdit}
            onChange={(event) => updateField(field, event.target.checked)}
          />
          {field.helperText ? <small>{field.helperText}</small> : null}
        </label>
      );
    }

    if (field.type === "textarea" || field.type === "json") {
      return (
        <label className={wrapperClass} key={field.key}>
          <span>{field.label}</span>
          <textarea
            className="entity-form__textarea"
            rows={field.rows ?? 4}
            value={String(value ?? "")}
            disabled={!canEdit}
            placeholder={field.placeholder}
            onChange={(event) => updateField(field, event.target.value)}
          />
          {field.helperText ? <small>{field.helperText}</small> : null}
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label className={wrapperClass} key={field.key}>
          <span>{field.label}</span>
          <select
            className="entity-form__input"
            value={String(value ?? "")}
            disabled={!canEdit}
            onChange={(event) => updateField(field, event.target.value)}
          >
            {(field.options ?? []).map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.helperText ? <small>{field.helperText}</small> : null}
        </label>
      );
    }

    return (
      <label className={wrapperClass} key={field.key}>
        <span>{field.label}</span>
        <input
          className="entity-form__input"
          type={field.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          disabled={!canEdit}
          placeholder={field.placeholder}
          onChange={(event) => updateField(field, event.target.value)}
        />
        {field.helperText ? <small>{field.helperText}</small> : null}
      </label>
    );
  };

  const renderFieldsForPanel = (panel: EditorPanelKey) => {
    const fields = schema.fields
      .filter((field) => !specialFieldKeys.has(field.key))
      .filter((field) => getFieldPanel(field) === panel);

    if (fields.length === 0) {
      return <div className="entity-mgr__empty">这个页签暂无字段。</div>;
    }

    return (
      <div className={`entity-mgr__form-grid entity-mgr__form-grid--${panel}`}>
        {fields.map((field) => renderField(field))}
      </div>
    );
  };

  const renderSpecialEditor = () => {
    if (entityType === "abilities") {
      return <AbilityVisualEditor value={abilityEditorState} disabled={!canEdit} onChange={setAbilityEditorState} />;
    }
    if (entityType === "races") {
      return <RaceVisualEditor value={raceEditorState} disabled={!canEdit} abilityOptions={abilityOptions} onChange={setRaceEditorState} />;
    }
    if (entityType === "backgrounds") {
      return <BackgroundVisualEditor value={backgroundEditorState} disabled={!canEdit} abilityOptions={abilityOptions} onChange={setBackgroundEditorState} />;
    }
    if (entityType === "items") {
      return <ItemVisualEditor value={itemEditorState} disabled={!canEdit} abilityOptions={abilityOptions} onChange={setItemEditorState} />;
    }
    if (entityType === "professions") {
      return <ProfessionVisualEditor value={professionEditorState} disabled={!canEdit} abilityOptions={abilityOptions} onChange={setProfessionEditorState} />;
    }
    if (entityType === "fateClocks") {
      return <FateClockVisualEditor value={fateClockEditorState} disabled={!canEdit} onChange={setFateClockEditorState} />;
    }
    if (entityType === "decks") {
      return <DeckVisualEditor value={deckEditorState} disabled={!canEdit} itemOptions={itemOptions} onChange={setDeckEditorState} />;
    }
    if (entityType === "randomTables") {
      return <RandomTableVisualEditor value={randomTableEditorState} disabled={!canEdit} abilityOptions={abilityOptions} itemOptions={itemOptions} onChange={setRandomTableEditorState} />;
    }
    return null;
  };

  return (
    <section className="entity-mgr" aria-label={`${label}管理器`} data-world-component="entity-template-library">
      <header className="entity-mgr__header">
        <div className="entity-mgr__title-wrap">
          <h3 className="entity-mgr__title">{label}</h3>
          <p className="entity-mgr__summary">{schema.description}</p>
        </div>
        <div className="entity-mgr__actions">
          <input
            className="entity-mgr__search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={`搜索${label}`}
          />
          {canEdit ? (
            <button type="button" className="entity-mgr__add-btn" onClick={beginCreate}>
              新建条目
            </button>
          ) : null}
        </div>
      </header>

      {slice.loading ? <div className="entity-mgr__loading">加载中...</div> : null}
      {slice.error ? <div className="entity-mgr__error">{slice.error}</div> : null}

      <div className="entity-mgr__body">
        <aside className="entity-mgr__library-tree" aria-label="模板分类">
          <div className="entity-mgr__library-title">
            <strong>分类</strong>
            <span>{folderRows.length - 1} 个目录</span>
          </div>
          <div className="entity-mgr__folder-list">
            {folderRows.map((folderPath) => {
              const depth = folderPath ? folderPath.split("/").length - 1 : 0;
              const count = folderCount(folderPath);
              return (
                <button
                  type="button"
                  className={`entity-mgr__folder-btn ${selectedFolder === folderPath ? "is-active" : ""}`.trim()}
                  style={{ "--folder-depth": depth } as CSSProperties}
                  onClick={() => {
                    setSelectedFolder(folderPath);
                    setSelectedItemId(null);
                  }}
                  key={folderPath || "__root"}
                >
                  <span>{folderPath ? "▸" : "◆"}</span>
                  <strong>{getFolderLeafName(folderPath)}</strong>
                  <em>{count}</em>
                </button>
              );
            })}
          </div>
          {canEdit ? (
            <div className="entity-mgr__folder-tools">
              <input
                className="entity-mgr__search"
                value={folderDraft}
                placeholder="新分类，如 法术/塑能/冰"
                onChange={(event) => setFolderDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createFolder();
                }}
              />
              <div className="entity-mgr__folder-actions">
                <button type="button" className="entity-mgr__add-btn" onClick={createFolder}>创建分类</button>
                <button type="button" className="entity-mgr__cancel-btn" disabled={!selectedFolder || folderCount(selectedFolder) > 0} onClick={removeSelectedFolder}>
                  移除空分类
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        <section className="entity-mgr__library-list" aria-label={`${label}条目`}>
          <div className="entity-mgr__list-head">
            <div>
              <strong>{selectedFolder ? selectedFolder : "全部资源"}</strong>
              <span>{filteredItems.length} / {slice.items.length} 条</span>
            </div>
            <div className="entity-mgr__list-actions">
              {canEdit ? (
                <>
                  <button type="button" className="entity-mgr__edit-btn" disabled={!selectedItem} onClick={() => selectedItem && beginEdit(selectedItem)}>
                    编辑选中
                  </button>
                  <button type="button" className="entity-mgr__edit-btn" disabled={!selectedItem} onClick={() => void moveSelectedToFolder()}>
                    归入当前分类
                  </button>
                  <button type="button" className="entity-mgr__del-btn" disabled={!selectedItem} onClick={() => void deleteSelected()}>
                    删除选中
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="entity-mgr__list">
            {filteredItems.length === 0 && !slice.loading ? <div className="entity-mgr__empty">暂无数据。可以先创建分类，再新建条目。</div> : null}
            {filteredItems.map((item) => {
              const dragType = entityType === "abilities" ? "ability" : entityType === "items" ? "item" : null;
              const meta = getEntityMeta(item);
              const folderPath = normalizeFolderPath(item.folderPath);

              return (
                <button
                  type="button"
                  key={item.id}
                  className={`entity-mgr__item ${selectedItemId === item.id ? "entity-mgr__item--active" : ""} ${dragType ? "entity-mgr__item--draggable" : ""}`.trim()}
                  draggable={Boolean(dragType)}
                  onClick={() => setSelectedItemId(item.id)}
                  onDoubleClick={() => beginEdit(item)}
                  onDragStart={(event) => {
                    if (!dragType) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/json", JSON.stringify({ type: dragType, id: item.id }));
                  }}
                >
                  <span className="entity-mgr__item-main">
                    <strong className="entity-mgr__item-name">{item.name}</strong>
                    <span className="entity-mgr__item-cat">{[folderPath || "未分类", meta].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="entity-mgr__item-open">双击编辑</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {editing ? (
        <div className="entity-mgr__editor-backdrop" role="presentation">
          <div className="entity-mgr__editor entity-mgr__editor--modal" role="dialog" aria-modal="true" aria-label={isCreating ? `新建${label}` : `编辑${editing.name}`}>
            <div className="entity-mgr__editor-header">
              <div className="entity-mgr__editor-identity">
                <div className="entity-mgr__editor-icon">
                  {String(formState.iconUrl ?? "").trim() ? <img src={String(formState.iconUrl)} alt="" /> : <span>{String(formState.name || editing.name || label).slice(0, 1)}</span>}
                </div>
                <div>
                  <h4>{isCreating ? `新建${label}` : String(formState.name || editing.name || "未命名")}</h4>
                  <p>{getEditorSubtitle(editing)}</p>
                </div>
              </div>
              <button type="button" className="entity-mgr__close-btn" onClick={closeEditor}>
                关闭
              </button>
            </div>

            <div className="entity-mgr__editor-tabs" role="tablist">
              {[
                ["description", "展示文本"],
                ["rules", "规则结算"],
                ["advanced", "高级数据"],
              ].map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  className={editorTab === key ? "is-active" : ""}
                  onClick={() => setEditorTab(key as EditorPanelKey)}
                >
                  {text}
                </button>
              ))}
            </div>

            {editorError ? <div className="entity-mgr__error">{editorError}</div> : null}

            <div className="entity-mgr__editor-scroll">
              {editorTab === "description" ? (
                <section className="entity-mgr__editor-panel entity-mgr__editor-panel--read">
                  <div className="entity-mgr__panel-note">
                    <strong>玩家阅读面</strong>
                    <span>这里放玩家会直接阅读的名称、图标、简介、设定和规则文字，不放结算公式。</span>
                  </div>
                  {renderFieldsForPanel("description")}
                </section>
              ) : null}

              {editorTab === "rules" ? (
                <section className="entity-mgr__editor-panel entity-mgr__editor-panel--rules">
                  <div className="entity-mgr__panel-note">
                    <strong>后台结算面</strong>
                    <span>这里配置类型、动作、检定、消耗、触发器、效果和成长表；字段会按选择自动展开。</span>
                  </div>
                  {renderFieldsForPanel("rules")}
                  {renderSpecialEditor()}
                </section>
              ) : null}

              {editorTab === "advanced" ? (
                <section className="entity-mgr__editor-panel entity-mgr__editor-panel--advanced">
                  <div className="entity-mgr__panel-note">
                    <strong>高级扩展</strong>
                    <span>仅用于当前可视化表单尚未覆盖的额外字段。常规能力、效果和目录不要写在这里。</span>
                  </div>
                  {renderFieldsForPanel("advanced")}
                  <label className="entity-form__field entity-form__field--span-2">
                    <span>额外 JSON 扩展</span>
                    <textarea
                      className="entity-form__textarea"
                      rows={12}
                      value={extraJsonText}
                      disabled={!canEdit}
                      onChange={(event) => setExtraJsonText(event.target.value)}
                    />
                    <small>必须是 JSON 对象。这里会与上方字段合并保存。</small>
                  </label>
                </section>
              ) : null}
            </div>

            {canEdit ? (
              <div className="entity-mgr__editor-footer">
                <button type="button" className="entity-mgr__cancel-btn" onClick={closeEditor}>
                  取消
                </button>
                <button type="button" className="entity-mgr__save-btn" onClick={() => void submit()}>
                  保存
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
