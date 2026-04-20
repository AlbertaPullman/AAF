import { useCallback, useEffect, useMemo, useState } from "react";
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

type EntityFieldSchema = {
  key: string;
  label: string;
  type: EntityFieldType;
  placeholder?: string;
  rows?: number;
  span?: 1 | 2;
  defaultValue?: string | number | boolean;
  jsonDefault?: Record<string, unknown> | unknown[];
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
};

type EntitySchema = {
  description: string;
  fields: EntityFieldSchema[];
};

type FormState = Record<string, string | boolean>;

const SYSTEM_KEYS = new Set(["id", "worldId", "createdAt", "updatedAt"]);

const ENTITY_SCHEMAS: Record<EntityType, EntitySchema> = {
  abilities: {
    description: "用于配置职业特性、种族能力、法术与战技的基础字段；复杂触发器与效果仍可在高级 JSON 中细调。",
    fields: [
      { key: "name", label: "名称", type: "text", placeholder: "例如：守护反应", defaultValue: "", span: 2 },
      {
        key: "category",
        label: "分类",
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
        options: [
          { label: "无需检定", value: "none" },
          { label: "攻击检定", value: "attack" },
          { label: "豁免检定", value: "savingThrow" },
          { label: "对抗检定", value: "contest" },
        ],
      },
      { key: "attackAttr", label: "攻击属性", type: "text", placeholder: "strength / intelligence" },
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
      { key: "durationValue", label: "持续值", type: "number", defaultValue: 0 },
      { key: "range", label: "距离", type: "text", placeholder: "例如：30 / self / touch / special" },
      { key: "levelReq", label: "等级要求", type: "number", defaultValue: 1 },
      {
        key: "spellLevel",
        label: "法术等级序列",
        type: "number",
        defaultValue: 0,
        helperText: "AAF 使用法术等级与 MP。0=戏法，1=初级，2=中级，3=高级，4=史诗，5=传说，6=禁咒。",
      },
      { key: "spellSchool", label: "法术学派", type: "text", placeholder: "例如：塑能 / 防护 / 咒法 / 变化" },
      { key: "concentration", label: "需要专注", type: "boolean", defaultValue: false },
      { key: "sortOrder", label: "排序值", type: "number", defaultValue: 0 },
      { key: "description", label: "描述", type: "textarea", rows: 3, span: 2 },
      { key: "rulesText", label: "规则文本", type: "textarea", rows: 3, span: 2 },
      {
        key: "tags",
        label: "标签 JSON",
        type: "json",
        rows: 5,
        span: 2,
        jsonDefault: [],
        helperText: '例如：["反应","防御","姿态"]',
      },
      {
        key: "resourceCosts",
        label: "资源消耗 JSON",
        type: "json",
        rows: 6,
        span: 2,
        jsonDefault: [],
        helperText: '例如：[{"type":"mp","amount":2,"label":"魔力值"}]',
      },
      {
        key: "damageRolls",
        label: "伤害骰 JSON",
        type: "json",
        rows: 6,
        span: 2,
        jsonDefault: [],
        helperText: '例如：[{"dice":"1d8","damageType":"force"}]',
      },
      {
        key: "trigger",
        label: "触发器 JSON",
        type: "json",
        rows: 8,
        span: 2,
        jsonDefault: {},
        helperText: '例如：{"timing":"onAttackHit","condition":{"type":"compare","field":"metadata.eventName","operator":"==","value":"attack:incoming"}}',
      },
      {
        key: "effects",
        label: "效果 JSON",
        type: "json",
        rows: 10,
        span: 2,
        jsonDefault: [],
        helperText: '例如：[{"type":"modifyAC","target":"self","value":10,"duration":"special"}]',
      },
    ],
  },
  races: {
    description: "配置种族基础体型、移动、语言与固有特质；复杂混血或子种时用 JSON 补充。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
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
      { key: "ageDesc", label: "年龄描述", type: "textarea", rows: 3, span: 2 },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 4, span: 2 },
      { key: "attrBonus", label: "属性加值 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
      { key: "languages", label: "语言 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "traits", label: "特质 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
      { key: "subtypes", label: "子种 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  professions: {
    description: "配置职业成长、熟练项和 1-20 级特性表；天赋树、施法成长与复杂成长都能放进 JSON。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      {
        key: "type",
        label: "职业类型",
        type: "select",
        defaultValue: "combat",
        options: [
          { label: "冒险职业", value: "combat" },
          { label: "生活职业", value: "life" },
        ],
      },
      { key: "hitDie", label: "生命骰", type: "text", defaultValue: "1d10" },
      { key: "primaryAttribute", label: "主属性", type: "text", defaultValue: "strength" },
      { key: "spellcastingAttr", label: "施法属性", type: "text" },
      { key: "furyPerLevel", label: "每级战意", type: "number", defaultValue: 0 },
      { key: "startingWealth", label: "起始财富", type: "text", placeholder: "例如：2d6*10" },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 4, span: 2 },
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
    description: "配置背景提供的技能点、语言、工具熟练与初始特性。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      { key: "skillPoints", label: "技能点", type: "number", defaultValue: 0 },
      { key: "bonusLanguages", label: "额外语言", type: "number", defaultValue: 0 },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "loreText", label: "设定文本", type: "textarea", rows: 4, span: 2 },
      { key: "toolProficiencies", label: "工具熟练 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "startingEquipment", label: "起始装备 JSON", type: "json", rows: 5, span: 2, jsonDefault: [] },
      { key: "features", label: "背景特性 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  items: {
    description: "配置装备、道具、素材与消耗品的基础属性；武器伤害、附魔和镶嵌都能继续往下配。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      { key: "category", label: "类别", type: "text", defaultValue: "gear" },
      { key: "subcategory", label: "子类别", type: "text" },
      { key: "rarity", label: "稀有度", type: "text", defaultValue: "common" },
      { key: "weight", label: "重量", type: "number", defaultValue: 0 },
      { key: "price", label: "价格", type: "number", defaultValue: 0 },
      { key: "stackable", label: "可堆叠", type: "boolean", defaultValue: false },
      { key: "maxStack", label: "最大堆叠", type: "number", defaultValue: 0 },
      { key: "requiresIdent", label: "需要鉴定", type: "boolean", defaultValue: false },
      { key: "requiresAttune", label: "需要同调", type: "boolean", defaultValue: false },
      { key: "enhanceSlots", label: "强化槽", type: "number", defaultValue: 0 },
      { key: "gemSlots", label: "宝石槽", type: "number", defaultValue: 0 },
      { key: "attuneReq", label: "同调条件", type: "text" },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "tags", label: "标签 JSON", type: "json", rows: 4, span: 2, jsonDefault: [] },
      { key: "weaponProps", label: "武器属性 JSON", type: "json", rows: 7, span: 2, jsonDefault: {} },
      { key: "armorProps", label: "护甲属性 JSON", type: "json", rows: 7, span: 2, jsonDefault: {} },
      { key: "enchantments", label: "附魔 JSON", type: "json", rows: 9, span: 2, jsonDefault: [] },
    ],
  },
  fateClocks: {
    description: "配置命刻倒计时、可见性和推进方向，便于主持人在世界内持续驱动事件。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      { key: "segments", label: "刻度数", type: "number", defaultValue: 6 },
      { key: "filledSegments", label: "已填充", type: "number", defaultValue: 0 },
      { key: "visibleToPlayers", label: "玩家可见", type: "boolean", defaultValue: true },
      {
        key: "direction",
        label: "方向",
        type: "select",
        defaultValue: "advance",
        options: [
          { label: "推进", value: "advance" },
          { label: "倒计时", value: "countdown" },
        ],
      },
      { key: "status", label: "状态", type: "text", defaultValue: "active" },
      { key: "successThreshold", label: "成功阈值", type: "number", defaultValue: 0 },
      { key: "failureThreshold", label: "失败阈值", type: "number", defaultValue: 0 },
      { key: "sceneId", label: "关联场景 ID", type: "text" },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "history", label: "历史 JSON", type: "json", rows: 8, span: 2, jsonDefault: [] },
    ],
  },
  decks: {
    description: "配置事件牌堆与抽牌历史，用于预制合集包或轻量随机事件流。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      { key: "replacement", label: "抽后放回", type: "boolean", defaultValue: true },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
      { key: "cards", label: "卡牌 JSON", type: "json", rows: 12, span: 2, jsonDefault: [] },
      { key: "drawnHistory", label: "已抽记录 JSON", type: "json", rows: 6, span: 2, jsonDefault: [] },
    ],
  },
  randomTables: {
    description: "配置骰式与随机结果表项，可用来做掉落、探索、剧情、造物素材等快速抽取。",
    fields: [
      { key: "name", label: "名称", type: "text", span: 2 },
      { key: "diceFormula", label: "骰式", type: "text", defaultValue: "1d100" },
      { key: "description", label: "简介", type: "textarea", rows: 3, span: 2 },
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

function normalizeActionTypeValue(value: unknown) {
  if (value === "move") return "maneuver";
  if (value === "full-round") return "composite";
  return typeof value === "string" ? value : "";
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

function buildInitialFormState(schema: EntitySchema, source?: EntityRecord | null): FormState {
  return Object.fromEntries(
    schema.fields.map((field) => {
      const rawValue = source?.[field.key];
      if (field.key === "actionType") {
        return [field.key, normalizeActionTypeValue(rawValue ?? field.defaultValue ?? "")];
      }
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

function getEntityMeta(item: EntityRecord) {
  const candidateKeys = ["category", "type", "rarity", "status", "actionType"];
  const values = candidateKeys
    .map((key) => (key === "actionType" ? getActionTypeLabel(item[key]) : item[key]))
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

  return values.slice(0, 2).join(" · ");
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

  return String(rawValue ?? "");
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
  const [editing, setEditing] = useState<EntityRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
  }, [editing, schema]);

  const filteredItems = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    if (!key) {
      return slice.items;
    }
    return slice.items.filter((item) => item.name.toLowerCase().includes(key));
  }, [slice.items, keyword]);

  const beginCreate = useCallback(() => {
    setIsCreating(true);
    setEditing({ id: "", worldId, name: "" });
  }, [worldId]);

  const beginEdit = useCallback((item: EntityRecord) => {
    setIsCreating(false);
    setEditing(item);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setIsCreating(false);
    setEditorError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!editing || !worldId) {
      return;
    }

    const nextData: Record<string, unknown> = {};
    for (const field of schema.fields) {
      if (specialFieldKeys.has(field.key)) {
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
      Object.assign(nextData, buildAbilityEditorPayload(abilityEditorState));
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
    if (isCreating) {
      await createEntity(worldId, entityType, nextData);
    } else {
      await updateEntity(worldId, entityType, editing.id, nextData);
    }
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

  return (
    <section className="entity-mgr" aria-label={`${label}管理器`}>
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
              新建
            </button>
          ) : null}
        </div>
      </header>

      {slice.loading ? <div className="entity-mgr__loading">加载中...</div> : null}
      {slice.error ? <div className="entity-mgr__error">{slice.error}</div> : null}

      <div className="entity-mgr__body">
        <div className="entity-mgr__list">
          {filteredItems.length === 0 && !slice.loading ? <div className="entity-mgr__empty">暂无数据</div> : null}
          {filteredItems.map((item) => {
            const dragType = entityType === "abilities" ? "ability" : entityType === "items" ? "item" : null;
            const meta = getEntityMeta(item);

            return (
              <div
                key={item.id}
                className={`entity-mgr__item ${editing?.id === item.id ? "entity-mgr__item--active" : ""} ${dragType ? "entity-mgr__item--draggable" : ""}`.trim()}
                draggable={Boolean(dragType)}
                onDragStart={(event) => {
                  if (!dragType) {
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      type: dragType,
                      id: item.id,
                    })
                  );
                }}
              >
                <button type="button" className="entity-mgr__item-info" onClick={() => beginEdit(item)}>
                  <span className="entity-mgr__item-name">{item.name}</span>
                  {meta ? <span className="entity-mgr__item-cat">{meta}</span> : null}
                </button>
                {canEdit ? (
                  <div className="entity-mgr__item-actions">
                    <button type="button" className="entity-mgr__edit-btn" onClick={() => beginEdit(item)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="entity-mgr__del-btn"
                      onClick={() => {
                        void deleteEntity(worldId, entityType, item.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {editing ? (
          <div className="entity-mgr__editor">
            <div className="entity-mgr__editor-header">
              <div>
                <h4>{isCreating ? `新建${label}` : `编辑 ${editing.name}`}</h4>
                <p>可视化字段负责高频内容，高级 JSON 区保留给复杂条件、表项与触发器。</p>
              </div>
              <button type="button" className="entity-mgr__close-btn" onClick={closeEditor}>
                关闭
              </button>
            </div>

            {editorError ? <div className="entity-mgr__error">{editorError}</div> : null}

            <div className="entity-mgr__editor-scroll">
              <div className="entity-mgr__form-grid">
                {schema.fields
                  .filter((field) => !specialFieldKeys.has(field.key))
                  .map((field) => {
                  const value = formState[field.key];
                  const wrapperClass = `entity-form__field ${field.span === 2 ? "entity-form__field--span-2" : ""}`.trim();

                  if (field.type === "boolean") {
                    return (
                      <label className={`${wrapperClass} entity-form__field--toggle`.trim()} key={field.key}>
                        <span>{field.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={!canEdit}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setFormState((prev) => ({ ...prev, [field.key]: checked }));
                          }}
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
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setFormState((prev) => ({ ...prev, [field.key]: nextValue }));
                          }}
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
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setFormState((prev) => ({ ...prev, [field.key]: nextValue }));
                          }}
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
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setFormState((prev) => ({ ...prev, [field.key]: nextValue }));
                        }}
                      />
                      {field.helperText ? <small>{field.helperText}</small> : null}
                    </label>
                  );
                })}
              </div>

              {entityType === "abilities" ? (
                <AbilityVisualEditor
                  value={abilityEditorState}
                  disabled={!canEdit}
                  onChange={setAbilityEditorState}
                />
              ) : null}

              {entityType === "races" ? (
                <RaceVisualEditor
                  value={raceEditorState}
                  disabled={!canEdit}
                  abilityOptions={abilityOptions}
                  onChange={setRaceEditorState}
                />
              ) : null}

              {entityType === "backgrounds" ? (
                <BackgroundVisualEditor
                  value={backgroundEditorState}
                  disabled={!canEdit}
                  abilityOptions={abilityOptions}
                  onChange={setBackgroundEditorState}
                />
              ) : null}

              {entityType === "items" ? (
                <ItemVisualEditor
                  value={itemEditorState}
                  disabled={!canEdit}
                  abilityOptions={abilityOptions}
                  onChange={setItemEditorState}
                />
              ) : null}

              {entityType === "professions" ? (
                <ProfessionVisualEditor
                  value={professionEditorState}
                  disabled={!canEdit}
                  abilityOptions={abilityOptions}
                  onChange={setProfessionEditorState}
                />
              ) : null}

              {entityType === "fateClocks" ? (
                <FateClockVisualEditor
                  value={fateClockEditorState}
                  disabled={!canEdit}
                  onChange={setFateClockEditorState}
                />
              ) : null}

              {entityType === "decks" ? (
                <DeckVisualEditor
                  value={deckEditorState}
                  disabled={!canEdit}
                  itemOptions={itemOptions}
                  onChange={setDeckEditorState}
                />
              ) : null}

              {entityType === "randomTables" ? (
                <RandomTableVisualEditor
                  value={randomTableEditorState}
                  disabled={!canEdit}
                  abilityOptions={abilityOptions}
                  itemOptions={itemOptions}
                  onChange={setRandomTableEditorState}
                />
              ) : null}

              <label className="entity-form__field entity-form__field--span-2">
                <span>高级 JSON 扩展</span>
                <textarea
                  className="entity-form__textarea"
                  rows={10}
                  value={extraJsonText}
                  disabled={!canEdit}
                  onChange={(event) => setExtraJsonText(event.target.value)}
                />
                <small>这里用于放置当前实体未被表单覆盖的额外字段，例如图标、冷却、复杂嵌套数据等。</small>
              </label>
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
        ) : (
          <div className="entity-mgr__placeholder">
            <strong>{label}</strong>
            <p>从左侧选择一条资源开始查看或编辑。拖拽能力和物品到 HUD 快捷栏后，世界内就能直接调用。</p>
          </div>
        )}
      </div>
    </section>
  );
}
