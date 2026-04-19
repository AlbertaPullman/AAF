/**
 * 世界实体类型定义 - 能力系统核心
 *
 * 覆盖: 种族、职业、背景、特性(Feature)、法术、战技、物品、装备等
 * 遵循规则书定义的数据结构
 */

/* ──────────── 基础通用 ──────────── */

/** 属性类型 */
export type AttributeKey = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";

/** 属性中文映射 */
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  strength: "力量",
  dexterity: "敏捷",
  constitution: "体质",
  intelligence: "智力",
  wisdom: "感知",
  charisma: "魅力",
};

/** 伤害类型 */
export type DamageType =
  | "slashing" | "piercing" | "bludgeoning"
  | "fire" | "cold" | "lightning" | "thunder" | "acid" | "poison"
  | "radiant" | "necrotic" | "force" | "psychic";

/** 伤害类型中文 */
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  slashing: "挥砍", piercing: "穿刺", bludgeoning: "钝击",
  fire: "火焰", cold: "寒冷", lightning: "闪电", thunder: "雷鸣",
  acid: "强酸", poison: "剧毒", radiant: "光耀", necrotic: "黯蚀",
  force: "力场", psychic: "心灵",
};

/** 动作经济类型 */
export type ActionEconomy = "standard" | "quick" | "move" | "free" | "reaction" | "full-round" | "special";

export const ACTION_ECONOMY_LABELS: Record<ActionEconomy, string> = {
  standard: "标准动作",
  quick: "快速动作",
  move: "机动动作",
  free: "自由动作",
  reaction: "反应动作",
  "full-round": "复合动作",
  special: "特殊",
};

/** 持续时间类型 */
export type DurationType =
  | "instantaneous" | "rounds" | "minutes" | "hours" | "concentration"
  | "until-rest-short" | "until-rest-long" | "permanent" | "special";

/** 资源消耗定义 */
export interface ResourceCost {
  type: "mp" | "stamina" | "fury" | "ki" | "hp" | "item" | "spell-slot" | "custom";
  amount: number | string; // 可以是固定数字或公式如 "level*2"
  label: string;
}

/** 骰子表达式 (如 "2d6+3") */
export type DiceExpression = string;

/** 条件表达式 */
export interface ConditionExpression {
  type: "and" | "or" | "not" | "compare" | "hasTag" | "hasState" | "levelCheck" | "resourceCheck" | "custom";
  field?: string;
  operator?: "==" | "!=" | ">=" | "<=" | ">" | "<" | "includes";
  value?: string | number | boolean;
  children?: ConditionExpression[];
  customExpr?: string;
}

/** 效果表达式 */
export interface EffectExpression {
  type: "modifyStat" | "addTag" | "removeTag" | "applyState" | "removeState" |
    "dealDamage" | "heal" | "grantTempHp" | "grantAdvantage" | "grantDisadvantage" |
    "grantBonusDice" | "grantPenaltyDice" | "modifyAC" | "modifySpeed" |
    "grantReaction" | "grantExtraAttack" | "custom";
  target: "self" | "target" | "allAllies" | "allEnemies" | "aoe";
  stat?: string;
  value?: string | number;
  duration?: DurationType;
  durationValue?: number;
  customExpr?: string;
  label?: string;
}

/** 触发时机 */
export type TriggerTiming =
  | "onAttackHit" | "onAttackMiss" | "onAttackCritical"
  | "onDealDamage" | "onTakeDamage" | "onKill"
  | "onTurnStart" | "onTurnEnd" | "onRoundStart" | "onRoundEnd"
  | "onCastSpell" | "onConcentrationCheck"
  | "onSavingThrow" | "onSavingThrowFail" | "onSavingThrowSuccess"
  | "onMove" | "onEnterArea" | "onLeaveArea"
  | "onHpBelowHalf" | "onHpZero" | "onHeal"
  | "onShortRest" | "onLongRest"
  | "onCombatStart" | "onCombatEnd"
  | "custom";

/* ──────────── 能力定义(Ability) ──────────── */

/** 能力来源 */
export type AbilitySource = "race" | "profession" | "talent" | "equipment" | "item" | "background" | "feat" | "custom";

/** 能力激活类型 */
export type AbilityActivation = "active" | "passive" | "toggle" | "reaction" | "triggered";

/** 能力标签 */
export type AbilityTag = string; // 自由标签，如 "武器攻击", "法术", "治疗", "控制"

/** 能力定义 - 核心结构 (对应世界需求清单16大字段) */
export interface AbilityDefinition {
  id: string;
  worldId: string;
  /** 能力名称 */
  name: string;
  /** 能力分类: spell(法术) / combatTechnique(战技) / feature(特性) / racial(种族能力) / custom(自定义) */
  category: "spell" | "combatTechnique" | "feature" | "racial" | "item" | "custom";
  /** 能力来源 */
  source: AbilitySource;
  /** 来源名称(如 "战士3级", "火焰法杖") */
  sourceName: string;
  /** 激活类型 */
  activation: AbilityActivation;
  /** 动作消耗 */
  actionType: ActionEconomy;
  /** 描述 */
  description: string;
  /** 规则文本(精确规则描述) */
  rulesText: string;
  /** 图标URL */
  iconUrl?: string;
  /** 标签 */
  tags: AbilityTag[];
  /** 等级需求 */
  levelRequirement?: number;
  /** 职业等级需求 */
  professionLevelRequirement?: { professionId: string; level: number }[];
  /** 射程(尺) */
  range?: number | "self" | "touch" | "special";
  /** 区域效果 */
  aoeShape?: "none" | "sphere" | "cube" | "cone" | "line" | "cylinder";
  aoeSize?: number;
  /** 资源消耗 */
  resourceCosts: ResourceCost[];
  /** 冷却 */
  cooldown?: {
    type: "perRound" | "perCombat" | "perShortRest" | "perLongRest" | "perDay" | "charges";
    value: number;
    maxCharges?: number;
  };
  /** 持续时间 */
  duration: DurationType;
  durationValue?: number;
  /** 是否需要专注 */
  concentration?: boolean;
  /** 检定类型 */
  checkType?: "attack" | "savingThrow" | "none" | "contest";
  /** 攻击检定属性 */
  attackAttribute?: AttributeKey;
  /** 豁免DC属性 */
  saveDC?: { attribute: AttributeKey; base?: number };
  /** 伤害表达式 */
  damageRolls?: {
    dice: DiceExpression;
    damageType: DamageType;
    scaling?: string; // 升级增长公式
  }[];
  /** 触发条件(被动能力) */
  trigger?: {
    timing: TriggerTiming;
    condition?: ConditionExpression;
    limit?: { perRound?: number; perCombat?: number; perDay?: number };
    priority?: number;
  };
  /** 效果列表 */
  effects: EffectExpression[];
  /** 反应触发策略 */
  reactionStrategy?: "always-ask" | "smart-ask" | "auto";
  /** 法术环位(仅法术) */
  spellLevel?: number;
  /** 法术学派(仅法术) */
  spellSchool?: string;
  /** 法术材料(仅法术) */
  spellComponents?: { verbal?: boolean; somatic?: boolean; material?: string };
  /** 是否可升环施放 */
  canUpcast?: boolean;
  /** 升环效果描述 */
  upcastEffect?: string;
  /** 排序 */
  sortOrder: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/* ──────────── 种族 ──────────── */

/** 种族特质 */
export interface RacialTrait {
  id: string;
  name: string;
  description: string;
  isMixedTrait: boolean; // 混血特质标识
  mechanicalEffect?: EffectExpression[];
  linkedAbilityId?: string;
}

/** 种族亚种 */
export interface RaceSubtype {
  id: string;
  name: string;
  description: string;
  traits: RacialTrait[];
}

/** 种族定义 */
export interface RaceDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  loreText: string; // 背景故事
  iconUrl?: string;
  /** 属性加成: 自选+2, 自选+1 */
  attributeBonus: { type: "fixed" | "choice"; attribute?: AttributeKey; amount: number }[];
  /** 体型 */
  size: "tiny" | "small" | "medium" | "large" | "huge";
  /** 基础步行速度 */
  speed: number;
  /** 黑暗视觉(尺) */
  darkvision: number;
  /** 生物类型 */
  creatureType: string;
  /** 语言 */
  languages: string[];
  /** 年龄描述 */
  ageDescription: string;
  /** 种族特质 */
  traits: RacialTrait[];
  /** 亚种 */
  subtypes: RaceSubtype[];
  /** 创建时间 */
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 职业 ──────────── */

/** 职业等级特性 */
export interface ProfessionLevelFeature {
  level: number;
  features: string[]; // 特性名称列表
  linkedAbilityIds: string[]; // 关联的能力ID
  proficiencyBonus?: number;
  attributeIncrease?: number; // 属性值提升点数
  talentPointsClass?: number; // 获得的职业天赋点
  talentPointsGeneral?: number; // 获得的通用天赋点
  hpIncrease?: DiceExpression; // 生命值增长(如"1d10+体质")
  mpIncrease?: number;
  furyIncrease?: number; // 战意值增长
  kiIncrease?: number; // 技力增长
  extraAttacks?: number;
  spellSlotsGained?: Record<number, number>; // 法术位增加
  customNotes?: string;
}

/** 职业定义 */
export interface ProfessionDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  loreText: string;
  iconUrl?: string;
  /** 职业类型 */
  type: "combat" | "life"; // 冒险职业 / 生活职业
  /** 生命骰 */
  hitDie: DiceExpression;
  /** 关键属性 */
  primaryAttribute: AttributeKey;
  /** 豁免熟练 */
  savingThrowProficiencies: AttributeKey[];
  /** 护甲熟练 */
  armorProficiencies: string[];
  /** 武器熟练 */
  weaponProficiencies: string[];
  /** 工具熟练 */
  toolProficiencies: string[];
  /** 技能熟练(可选数量) */
  skillChoices: { count: number; options: string[] };
  /** 初始装备 */
  startingEquipment: string[];
  /** 初始财富(可选替代) */
  startingWealth?: DiceExpression;
  /** 施法属性(如果是施法职业) */
  spellcastingAttribute?: AttributeKey;
  /** 战意值增长(每级) */
  furyPerLevel?: number; // 0 = 无, 1 = 每级1点, 0.5 = 每2级1点, 0.33 = 每3级1点
  /** 等级特性表 */
  levelFeatures: ProfessionLevelFeature[];
  /** 关联天赋树ID列表 */
  talentTreeIds: string[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 背景 ──────────── */

export interface BackgroundDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  loreText: string;
  iconUrl?: string;
  /** 提供的技能点数量 */
  skillPoints: number;
  /** 提供的语言数量 */
  bonusLanguages: number;
  /** 提供的工具熟练 */
  toolProficiencies: string[];
  /** 初始装备 */
  startingEquipment: string[];
  /** 特殊特性 */
  features: { name: string; description: string; linkedAbilityId?: string }[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 物品 ──────────── */

export type ItemRarity = "common" | "uncommon" | "rare" | "veryRare" | "legendary" | "artifact";
export type ItemCategory = "weapon" | "armor" | "shield" | "potion" | "scroll" | "wand" | "ring"
  | "wondrous" | "ammunition" | "tool" | "gear" | "consumable" | "material" | "treasure" | "custom";

export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  common: "普通",
  uncommon: "非凡",
  rare: "稀有",
  veryRare: "极稀有",
  legendary: "传说",
  artifact: "神器",
};

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "武器",
  armor: "护甲",
  shield: "盾牌",
  potion: "药水",
  scroll: "卷轴",
  wand: "法杖/魔杖",
  ring: "戒指",
  wondrous: "奇物",
  ammunition: "弹药",
  tool: "工具",
  gear: "冒险装备",
  consumable: "消耗品",
  material: "素材",
  treasure: "财宝",
  custom: "自定义",
};

/** 武器属性 */
export interface WeaponProperties {
  attackType: "melee" | "ranged" | "thrown";
  damageType: DamageType;
  damageDice: DiceExpression;
  range?: number;
  longRange?: number;
  properties: string[]; // 如 "双手", "轻型", "精巧" 等
  attackAttribute: AttributeKey;
}

/** 护甲属性 */
export interface ArmorProperties {
  armorType: "light" | "medium" | "heavy" | "shield";
  baseAC: number;
  maxDexBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
}

/** 物品定义 */
export interface ItemDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  category: ItemCategory;
  subcategory?: string; // 二级分类
  rarity: ItemRarity;
  iconUrl?: string;
  /** 重量(磅) */
  weight: number;
  /** 价格(金币) */
  price: number;
  /** 是否可堆叠 */
  stackable: boolean;
  /** 最大堆叠 */
  maxStack?: number;
  /** 是否需要鉴定 */
  requiresIdentification?: boolean;
  /** 是否需要调谐 */
  requiresAttunement?: boolean;
  /** 调谐条件 */
  attunementRequirement?: string;
  /** 武器属性(如果是武器) */
  weaponProps?: WeaponProperties;
  /** 护甲属性(如果是护甲/盾牌) */
  armorProps?: ArmorProperties;
  /** 附魔/效果 */
  enchantments?: {
    name: string;
    description: string;
    linkedAbilityId?: string;
    effect?: EffectExpression;
  }[];
  /** 强化槽位数 */
  enhancementSlots?: number;
  /** 宝石插槽数 */
  gemSlots?: number;
  /** 标签 */
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 命刻(Fate Clock) ──────────── */

export interface FateClockDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  /** 刻度总数(4-12) */
  segments: number;
  /** 当前已推进刻度 */
  filledSegments: number;
  /** 是否可见(对玩家) */
  visibleToPlayers: boolean;
  /** 推进方向: advance(推进=有利) / countdown(推进=威胁) */
  direction: "advance" | "countdown";
  /** 成功阈值(可选) */
  successThreshold?: number;
  /** 失败阈值(可选) */
  failureThreshold?: number;
  /** 状态 */
  status: "active" | "completed" | "failed" | "paused";
  /** 关联场景ID */
  sceneId?: string;
  /** 历史记录 */
  history: { action: "advance" | "retreat"; amount: number; reason: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 场景(增强) ──────────── */

export type ScenePreset = "battle" | "exploration" | "rest" | "dungeon" | "city" | "wilderness" | "custom";

export const SCENE_PRESET_LABELS: Record<ScenePreset, string> = {
  battle: "战斗场景",
  exploration: "探索场景",
  rest: "休整场景",
  dungeon: "地下城",
  city: "城镇场景",
  wilderness: "野外场景",
  custom: "自定义场景",
};

export interface SceneConfig {
  /** 预设类型 */
  preset: ScenePreset;
  /** 背景图 */
  backgroundImage?: string;
  /** 背景音乐 */
  backgroundMusic?: string;
  /** 网格配置 */
  grid: {
    enabled: boolean;
    type: "square" | "hex";
    size: number; // 像素
    unitFeet: number; // 每格代表的尺数
    color: string;
    opacity: number;
    snapToGrid: boolean;
  };
  /** 光源系统 */
  lighting: {
    globalIllumination: "bright" | "dim" | "dark";
    ambientColor: string;
    ambientIntensity: number;
    lights: LightSource[];
  };
  /** 战争迷雾 */
  fog: {
    enabled: boolean;
    exploredColor: string;
    unexploredColor: string;
    mode: "auto" | "manual";
    revealedAreas: FogRevealArea[];
  };
  /** 高度层 */
  elevation: {
    enabled: boolean;
    layers: { id: string; name: string; height: number; opacity: number }[];
  };
  /** 墙壁/阻碍 */
  walls: WallSegment[];
  /** 环境效果 */
  environmentEffects: string[];
  /** 场景笔记(GM专用) */
  gmNotes: string;
  /** 玩家笔记 */
  playerNotes: string;
}

export interface LightSource {
  id: string;
  name: string;
  x: number;
  y: number;
  brightRadius: number; // 尺
  dimRadius: number; // 尺
  color: string;
  intensity: number;
  castShadows: boolean;
  animated: boolean;
  attachedToTokenId?: string;
  durationMode: "permanent" | "rounds" | "concentration" | "manual";
  durationRounds?: number;
}

export interface FogRevealArea {
  id: string;
  shape: "circle" | "rect" | "polygon";
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
}

export interface WallSegment {
  id: string;
  type: "normal" | "door" | "secret" | "ethereal" | "terrain";
  points: { x: number; y: number }[];
  blocksVision: boolean;
  blocksMovement: boolean;
  isOpen?: boolean; // 门
}

/* ──────────── 牌堆 ──────────── */

export interface DeckDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  cards: {
    id: string;
    name: string;
    description: string;
    weight: number; // 权重(影响抽取概率)
    imageUrl?: string;
    linkedItemId?: string;
  }[];
  /** 是否放回 */
  replacement: boolean;
  /** 已抽取记录 */
  drawnHistory: { cardId: string; drawnBy: string; drawnAt: string }[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── 随机表 ──────────── */

export interface RandomTableDefinition {
  id: string;
  worldId: string;
  name: string;
  description: string;
  diceFormula: DiceExpression; // 如 "1d100"
  entries: {
    rangeMin: number;
    rangeMax: number;
    result: string;
    linkedItemId?: string;
    linkedAbilityId?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────── HUD面板配置 ──────────── */

export interface HUDSlot {
  index: number;
  type: "ability" | "item" | "empty";
  linkedId?: string; // ability ID or item ID
  customLabel?: string;
  customIconUrl?: string;
}

export interface HUDConfig {
  /** 面板模式 */
  mode: "combat" | "general";
  /** 战斗面板快捷栏 */
  combatSlots: HUDSlot[];
  /** 常规面板选项卡 */
  generalTabs: {
    id: string;
    label: string;
    type: "character" | "inventory" | "spellbook" | "abilities" | "journal" | "custom";
    visible: boolean;
  }[];
}

/* ──────────── 合集包 ──────────── */

export interface CollectionPackManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  /** 包含的数据 */
  contents: {
    races: RaceDefinition[];
    professions: ProfessionDefinition[];
    backgrounds: BackgroundDefinition[];
    abilities: AbilityDefinition[];
    items: ItemDefinition[];
    fateClocks: FateClockDefinition[];
    decks: DeckDefinition[];
    randomTables: RandomTableDefinition[];
    scenes: SceneConfig[];
    talentTrees: unknown[]; // 复用已有天赋树结构
  };
  /** 导入策略 */
  importPolicy: {
    /** 冲突时: skip(跳过) / overwrite(覆盖) / merge(合并) */
    conflictResolution: "skip" | "overwrite" | "merge";
    /** 是否保留GM已有数据 */
    preserveCustom: boolean;
  };
  createdAt: string;
}

/* ──────────── 快捷键 ──────────── */

export interface KeyBinding {
  action: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  label: string;
  category: string;
}

export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  // 通用
  { action: "toggleSystemPanel", key: "Tab", label: "开关系统面板", category: "通用" },
  { action: "toggleHUD", key: "h", label: "开关HUD面板", category: "通用" },
  { action: "toggleChat", key: "Enter", label: "打开聊天", category: "通用" },
  { action: "escape", key: "Escape", label: "关闭当前窗口/取消", category: "通用" },
  { action: "toggleFullscreen", key: "F11", label: "全屏切换", category: "通用" },
  { action: "quickSave", key: "s", ctrl: true, label: "快速保存", category: "通用" },

  // 场景
  { action: "zoomIn", key: "+", label: "放大", category: "场景" },
  { action: "zoomOut", key: "-", label: "缩小", category: "场景" },
  { action: "resetZoom", key: "0", label: "重置缩放", category: "场景" },
  { action: "panUp", key: "w", label: "向上平移", category: "场景" },
  { action: "panDown", key: "s", label: "向下平移", category: "场景" },
  { action: "panLeft", key: "a", label: "向左平移", category: "场景" },
  { action: "panRight", key: "d", label: "向右平移", category: "场景" },
  { action: "centerOnToken", key: "c", label: "定位到我的棋子", category: "场景" },

  // 战斗
  { action: "endTurn", key: "e", label: "结束回合", category: "战斗" },
  { action: "rollInitiative", key: "i", label: "投掷先攻", category: "战斗" },
  { action: "toggleBattleBar", key: "b", label: "开关战斗序列栏", category: "战斗" },

  // 快捷栏
  { action: "slot1", key: "1", label: "快捷栏位1", category: "快捷栏" },
  { action: "slot2", key: "2", label: "快捷栏位2", category: "快捷栏" },
  { action: "slot3", key: "3", label: "快捷栏位3", category: "快捷栏" },
  { action: "slot4", key: "4", label: "快捷栏位4", category: "快捷栏" },
  { action: "slot5", key: "5", label: "快捷栏位5", category: "快捷栏" },
  { action: "slot6", key: "6", label: "快捷栏位6", category: "快捷栏" },
  { action: "slot7", key: "7", label: "快捷栏位7", category: "快捷栏" },
  { action: "slot8", key: "8", label: "快捷栏位8", category: "快捷栏" },
  { action: "slot9", key: "9", label: "快捷栏位9", category: "快捷栏" },
  { action: "slot0", key: "0", label: "快捷栏位10", category: "快捷栏" },

  // 命刻
  { action: "advanceFateClock", key: "f", label: "推进命刻", category: "命刻" },
  { action: "retreatFateClock", key: "f", shift: true, label: "回退命刻", category: "命刻" },
];

/* ──────────── 右键菜单 ──────────── */

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  children?: ContextMenuItem[];
  action?: string;
  /** 权限要求 */
  requiredPermission?: string;
  /** 分隔线 */
  divider?: boolean;
}

/** 上下文菜单区域 */
export type ContextMenuArea =
  | "canvas" | "token" | "scene-list" | "character-card"
  | "ability-slot" | "item" | "chat-message"
  | "initiative-entry" | "fate-clock";
