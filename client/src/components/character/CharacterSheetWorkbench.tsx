import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CharacterSheetTabKey =
  | "DETAIL"
  | "CLASS"
  | "EQUIPMENT"
  | "ITEMS"
  | "TRAITS"
  | "SPELLS"
  | "TECHNIQUES"
  | "STATUS"
  | "TALENTS"
  | "SUBCLASS"
  | "BIOGRAPHY";

type CharacterSheetWorkbenchProps = {
  characterId?: string;
  characterName?: string;
  playerName?: string;
  characterLevel?: number;
  characterTokenDataUrl?: string | null;
  onClose: () => void;
  onTokenConfig?: () => void;
  onTokenUpload?: (tokenDataUrl: string) => void;
  onExport?: () => void;
  onImport?: () => void;
};

type CharacterSheetTabItem = {
  key: CharacterSheetTabKey;
  label: string;
  iconText: string;
  iconImageUrl?: string;
  placeholder: string;
};

const CHARACTER_SHEET_TABS: CharacterSheetTabItem[] = [
  { key: "DETAIL", label: "详情", iconText: "DT", placeholder: "角色详情页骨架（基础信息、外观、阵营、背景标签）。" },
  { key: "CLASS", label: "职业", iconText: "CL", placeholder: "职业页骨架（职业等级与多职业分布）。" },
  { key: "EQUIPMENT", label: "装备", iconText: "EQ", placeholder: "装备页骨架（武器、防具、道具栏、负重统计）。" },
  { key: "ITEMS", label: "物品", iconText: "IT", placeholder: "物品页骨架（背包/仓库存放、整理与检索）。" },
  { key: "TRAITS", label: "特性", iconText: "TR", placeholder: "特性页骨架（种族特性、被动、触发式能力）。" },
  { key: "SPELLS", label: "法术", iconText: "SP", placeholder: "法术页骨架（MP 费用、已知/准备法术、法术强度 AP、施法检定）。" },
  { key: "TECHNIQUES", label: "战技", iconText: "TK", placeholder: "战技页骨架（近战/远程动作、消耗、命中流程）。" },
  { key: "STATUS", label: "状态", iconText: "ST", placeholder: "状态页骨架（增益/减益、持续回合、来源）。" },
  { key: "TALENTS", label: "天赋", iconText: "TL", placeholder: "天赋页骨架（复用天赋树分配规则和状态映射）。" },
  { key: "SUBCLASS", label: "副职", iconText: "SC", placeholder: "副职页骨架（副职业进度与解锁节点）。" },
  { key: "BIOGRAPHY", label: "传记", iconText: "BG", placeholder: "传记页骨架（经历、关系、里程碑记录）。" }
];

type CharacterClassLevelItem = {
  id: string;
  name: string;
  level: number;
};

const CHARACTER_CLASS_LEVEL_ITEMS: CharacterClassLevelItem[] = [
  { id: "class_warrior", name: "战士", level: 0 },
  { id: "class_berserker", name: "狂怒斗士", level: 0 },
  { id: "class_shadow_blade", name: "影刃", level: 0 },
  { id: "class_arcane_blade", name: "秘武者", level: 0 },
  { id: "class_knight", name: "骑士", level: 0 },
  { id: "class_priest", name: "祭司", level: 0 },
  { id: "class_demon_hunter", name: "猎魔人", level: 0 },
  { id: "class_spirit_speaker", name: "灵语者", level: 0 },
  { id: "class_bard", name: "吟游诗人", level: 0 },
  { id: "class_mage", name: "魔法师", level: 0 },
  { id: "class_mana_channeler", name: "魔能使", level: 0 },
  { id: "class_mechanist", name: "机兵士", level: 0 }
];

type SkillAttributeKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

type PrimaryAttributeItem = {
  key: SkillAttributeKey;
  label: string;
  value: number;
};

const PRIMARY_ATTRIBUTES: PrimaryAttributeItem[] = [
  { key: "STR", label: "力量", value: 10 },
  { key: "DEX", label: "敏捷", value: 10 },
  { key: "CON", label: "体质", value: 10 },
  { key: "INT", label: "智力", value: 10 },
  { key: "WIS", label: "感知", value: 10 },
  { key: "CHA", label: "魅力", value: 10 }
];

const PRIMARY_ATTRIBUTE_LABEL_MAP: Record<SkillAttributeKey, string> = {
  STR: "力量",
  DEX: "敏捷",
  CON: "体质",
  INT: "智力",
  WIS: "感知",
  CHA: "魅力"
};

const SKILL_ATTRIBUTE_OPTIONS: Array<{ key: SkillAttributeKey; label: string }> = PRIMARY_ATTRIBUTES.map((attr) => ({
  key: attr.key,
  label: attr.label
}));

const DEFAULT_PROFICIENCY_BONUS = 2;
const CHARACTER_SHEET_EXPORT_SCHEMA_VERSION = "1.0.0";
const CHARACTER_SHEET_EXPORT_SOURCE = "AAF_CHARACTER_SHEET";
const CHARACTER_SHEET_WORKBENCH_STORAGE_PREFIX = "aaf-character-sheet-workbench";

const SECONDARY_METRICS = [
  { key: "AC", label: "AC", value: "10" },
  { key: "INIT", label: "先攻", value: "+0" },
  { key: "MORALE", label: "战意值", value: "8" },
  { key: "TECH", label: "技力", value: "12" },
  { key: "SPELL", label: "法术强度", value: "15" },
  { key: "STORY", label: "物语点", value: "3" }
] as const;

type SkillProficiencyLevel = "NONE" | "PROFICIENT" | "EXPERTISE";

type DetailSkillCategory = "CORE" | "PROFESSION";

type DetailSkillSeedItem = {
  key: string;
  name: string;
  defaultAttributeKey: SkillAttributeKey;
  description: string;
  category: DetailSkillCategory;
};

type DetailSkillItem = {
  key: string;
  name: string;
  defaultAttributeKey: SkillAttributeKey;
  linkedAttributeKey: SkillAttributeKey | null;
  proficiency: SkillProficiencyLevel;
  permanentCustomAdjustmentText: string;
  temporaryCustomAdjustmentText: string;
  category: DetailSkillCategory;
  description: string;
};

const DETAIL_CORE_SKILL_ITEMS: DetailSkillSeedItem[] = [
  { key: "athletics", name: "运动", defaultAttributeKey: "STR", category: "CORE", description: "高体力运动时（如游泳，狂奔，攀岩，跳跃等）需要进行的检定。" },
  { key: "break", name: "破坏", defaultAttributeKey: "STR", category: "CORE", description: "用于撞开门扉、踹倒栅栏、掀翻重物、撬断锁链，或是以纯粹的力量摧毁器物结构。" },
  { key: "stealth", name: "隐匿", defaultAttributeKey: "DEX", category: "CORE", description: "用于在敌人视线、听觉或其他感知中避开侦测，常见于潜行、埋伏、掩藏气息、或在阴影与掩体中移动。" },
  { key: "sleight", name: "巧手", defaultAttributeKey: "DEX", category: "CORE", description: "用于偷窃、藏匿物品、调包、投掷小物、暗中布置机关等行动。" },
  { key: "lockpick", name: "撬锁", defaultAttributeKey: "DEX", category: "CORE", description: "用于开锁、拆除简单机关、解除封印等行为，前提是你手中有合适的工具，且目标未被复杂的魔法保护。" },
  { key: "acrobatics", name: "特技", defaultAttributeKey: "DEX", category: "CORE", description: "用于翻滚、疾跑穿越危险地形、攀爬时保持平衡，或在被推撞、绊倒时维持站姿。" },
  { key: "awareness", name: "察觉", defaultAttributeKey: "WIS", category: "CORE", description: "用于发现隐藏的敌人、陷阱、异动、声音或气味，也用于对抗他人的隐匿和潜行行为。" },
  { key: "insight", name: "洞悉", defaultAttributeKey: "WIS", category: "CORE", description: "用于判断某人是否在说谎、是否隐瞒真相，或读出对方的情绪、意图与内心冲突。" },
  { key: "nature", name: "自然", defaultAttributeKey: "INT", category: "CORE", description: "用于识别野生动植物、预估天气、理解自然现象或辨认天然毒物。" },
  { key: "survival", name: "生存", defaultAttributeKey: "WIS", category: "CORE", description: "用于追踪野兽与敌人、寻找食物与水源、导航地形、建立营地，或在恶劣环境中抵御自然威胁。" },
  { key: "medicine", name: "医疗", defaultAttributeKey: "WIS", category: "CORE", description: "用于治疗同伴、识别疾病与毒素、解除部分生理异常或实施应急包扎。" },
  { key: "animal", name: "驯兽", defaultAttributeKey: "WIS", category: "CORE", description: "用于控制坐骑、安抚狂暴野兽、训练特定行为，或与动物进行简易交流。" },
  { key: "investigation", name: "调查", defaultAttributeKey: "INT", category: "CORE", description: "用于解谜、寻找隐藏物品或通路，分析现场情形，推断事件真相。" },
  { key: "arcana", name: "奥秘", defaultAttributeKey: "INT", category: "CORE", description: "用于回忆关于法术、奥秘符文、魔法学派、位面、位面住民等相关知识的能力。" },
  { key: "lore", name: "通识", defaultAttributeKey: "INT", category: "CORE", description: "用于了解古代文明、名人轶事、重要事件和流行文化。" },
  { key: "appraisal", name: "鉴定", defaultAttributeKey: "INT", category: "CORE", description: "用于估价宝物、识别假货。" },
  { key: "religion", name: "宗教", defaultAttributeKey: "INT", category: "CORE", description: "用于辨识圣物、诵念仪轨、识别教派符号或与神力有关的事件。" },
  { key: "persuasion", name: "说服", defaultAttributeKey: "CHA", category: "CORE", description: "用于谈判、请求帮忙、调解冲突或影响他人决策。" },
  { key: "deception", name: "欺瞒", defaultAttributeKey: "CHA", category: "CORE", description: "用于骗取情报、隐藏意图或掩盖事实。" },
  { key: "intimidation", name: "威吓", defaultAttributeKey: "CHA", category: "CORE", description: "用于恐吓敌人、逼迫妥协或控制局势。" },
  { key: "performance", name: "表演", defaultAttributeKey: "CHA", category: "CORE", description: "用于唱歌、跳舞、戏剧或其他艺术展示。" },
  { key: "charm", name: "魅惑", defaultAttributeKey: "CHA", category: "CORE", description: "用于吸引或分散目标的注意力。" },
  { key: "disguise", name: "伪装", defaultAttributeKey: "CHA", category: "CORE", description: "用于掩藏耳目、易容换装、伪装声音等。" }
];

const DETAIL_PROFESSION_SKILL_ITEMS: DetailSkillSeedItem[] = [
  { key: "smithing", name: "锻造", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—锻造的制造魔法物品检定。" },
  { key: "enchanting", name: "附魔", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—附魔的制造魔法物品检定。" },
  { key: "inscription", name: "铭文", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—铭文的制造魔法物品检定。" },
  { key: "jewelry", name: "珠宝", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—珠宝的制造魔法物品检定。" },
  { key: "tanning", name: "鞣织", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—鞣织的制造魔法物品检定。" },
  { key: "alchemy", name: "炼金", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—炼金的制造魔法物品检定。" },
  { key: "engineering", name: "工程学", defaultAttributeKey: "INT", category: "PROFESSION", description: "用于生活职业—工程学的制造魔法物品检定。" }
];

const INITIAL_DETAIL_SKILL_ITEMS: DetailSkillItem[] = [...DETAIL_CORE_SKILL_ITEMS, ...DETAIL_PROFESSION_SKILL_ITEMS].map((skill) => ({
  key: skill.key,
  name: skill.name,
  category: skill.category,
  defaultAttributeKey: skill.defaultAttributeKey,
  linkedAttributeKey: null,
  proficiency: "NONE",
  permanentCustomAdjustmentText: "",
  temporaryCustomAdjustmentText: "",
  description: skill.description
}));

type CharacterSheetExportPayload = {
  source: typeof CHARACTER_SHEET_EXPORT_SOURCE;
  schemaVersion: string;
  exportedAt: string;
  characterId: string | null;
  characterName: string;
  characterLevel: number;
  playerName: string;
  proficiencyBonus: number;
  tokenDataUrl: string | null;
  skills: Array<{
    key: string;
    linkedAttributeKey: SkillAttributeKey | null;
    proficiency: SkillProficiencyLevel;
    permanentCustomAdjustmentText: string;
    temporaryCustomAdjustmentText: string;
  }>;
};

type EquipmentSlotItem = {
  key: string;
  label: string;
  positionClass: string;
  hint: string;
};

const EQUIPMENT_RING_SLOTS: EquipmentSlotItem[] = [
  { key: "left-head", label: "头部", positionClass: "pos-left-1", hint: "帽子 / 头盔（1）" },
  { key: "left-neck", label: "颈部", positionClass: "pos-left-2", hint: "项链 / 护符（1）" },
  { key: "left-shoulder", label: "披肩", positionClass: "pos-left-3", hint: "披肩（1）" },
  { key: "left-robe", label: "衣袍", positionClass: "pos-left-4", hint: "内甲 / 衣物（1）" },
  { key: "left-armor", label: "盔甲", positionClass: "pos-left-5", hint: "金属外甲（1）" },
  { key: "left-belt", label: "腰带", positionClass: "pos-left-6", hint: "腰带（1）" },
  { key: "right-wrist", label: "护腕", positionClass: "pos-right-1", hint: "护腕（1）" },
  { key: "right-feet", label: "脚部", positionClass: "pos-right-2", hint: "靴子 / 鞋子（1）" },
  { key: "right-ring-1", label: "戒指①", positionClass: "pos-right-3", hint: "戒指槽（2）" },
  { key: "right-ring-2", label: "戒指②", positionClass: "pos-right-4", hint: "戒指槽（2）" },
  { key: "right-accessory-1", label: "饰品①", positionClass: "pos-right-5", hint: "耳环 / 吊坠 / 护符" },
  { key: "right-accessory-2", label: "饰品②", positionClass: "pos-right-6", hint: "耳环 / 吊坠 / 护符" }
];

const DEFAULT_TREASURE_SLOT_COUNT = 2;

type EquipmentQuickSectionKey = "WEAPON" | "FOCUS" | "GEAR";

type EquipmentQuickEquippedHand = "LEFT" | "RIGHT" | "BOTH";

type EquipmentQuickViewItem = {
  id: string;
  name: string;
  damage: string;
  usage: string;
  count: number;
  equipped: boolean;
  equippedHand?: EquipmentQuickEquippedHand;
};

const EQUIPMENT_QUICK_SECTION_ORDER: EquipmentQuickSectionKey[] = ["WEAPON", "FOCUS", "GEAR"];

const EQUIPMENT_QUICK_SECTION_LABELS: Record<EquipmentQuickSectionKey, string> = {
  WEAPON: "武器",
  FOCUS: "法器",
  GEAR: "装备"
};

const EQUIPMENT_QUICK_VIEW_POOLS: Record<EquipmentQuickSectionKey, EquipmentQuickViewItem[]> = {
  WEAPON: [
    { id: "wp_blood_spike", name: "血刺", damage: "2 伤", usage: "1 动作", count: 1, equipped: true, equippedHand: "RIGHT" },
    { id: "wp_frost_split", name: "寒潮&裂空", damage: "0 伤", usage: "动作", count: 1, equipped: false },
    { id: "wp_vigil_spear", name: "警觉之锋", damage: "0 伤", usage: "1 动作", count: 1, equipped: true, equippedHand: "LEFT" },
    { id: "wp_moon_blade", name: "逐月战刃", damage: "3 伤", usage: "1 动作", count: 1, equipped: false }
  ],
  FOCUS: [
    { id: "fc_mana_pearl", name: "法力再生珍珠", damage: "-", usage: "常驻", count: 1, equipped: true },
    { id: "fc_ancient_thorn", name: "远古棘枝", damage: "1 伤", usage: "1 动作", count: 1, equipped: false },
    { id: "fc_crystal_codex", name: "晶序书", damage: "-", usage: "1 动作", count: 1, equipped: false },
    { id: "fc_law_disk", name: "律令圆盘", damage: "-", usage: "反应", count: 1, equipped: false }
  ],
  GEAR: [
    { id: "gr_storm_cloak", name: "风暴斗篷", damage: "-", usage: "被动", count: 1, equipped: true },
    { id: "gr_shadow_boots", name: "渡影长靴", damage: "-", usage: "被动", count: 1, equipped: true },
    { id: "gr_travel_pouch", name: "远行腰包", damage: "-", usage: "被动", count: 1, equipped: false },
    { id: "gr_tide_pendant", name: "听潮挂坠", damage: "-", usage: "反应", count: 1, equipped: false }
  ]
};

const DEFAULT_EQUIPMENT_QUICK_WATCHLIST: Record<EquipmentQuickSectionKey, string[]> = {
  WEAPON: ["wp_blood_spike", "wp_vigil_spear"],
  FOCUS: ["fc_mana_pearl"],
  GEAR: ["gr_storm_cloak"]
};

const DEFAULT_EQUIPMENT_QUICK_EXPANDED: Record<EquipmentQuickSectionKey, boolean> = {
  WEAPON: true,
  FOCUS: false,
  GEAR: false
};

type ItemCategoryKey = "WEAPON" | "CASTING" | "CONSUMABLE" | "MAGIC" | "ADVENTURE";

type TraitCategoryKey = "RACE" | "CLASS" | "BACKGROUND" | "DESTINY" | "SKILL";

type SpellCategoryKey = "CANTRIP" | "NOVICE" | "INTERMEDIATE" | "ADVANCED" | "EPIC" | "LEGENDARY" | "RITUAL";

type TechniqueCategoryKey = "ENTRY" | "ADVANCED" | "TRANSCENDENT" | "PEAK" | "FORMLESS";

type CollectionPageTabKey = "ITEMS" | "TRAITS" | "SPELLS" | "TECHNIQUES";

type CharacterItemEntry = {
  id: string;
  name: string;
  info: string;
  usage: string;
  count: number;
};

type CollectionPageConfig<CategoryKey extends string = string> = {
  categories: Array<{ key: CategoryKey; label: string }>;
  entryPools: Record<CategoryKey, CharacterItemEntry[]>;
};

const ITEM_CATEGORY_TABS: Array<{ key: ItemCategoryKey; label: string }> = [
  { key: "WEAPON", label: "武器" },
  { key: "CASTING", label: "施法" },
  { key: "CONSUMABLE", label: "消耗品" },
  { key: "MAGIC", label: "魔法物品" },
  { key: "ADVENTURE", label: "冒险装备" }
];

const ITEM_ENTRY_POOLS: Record<ItemCategoryKey, CharacterItemEntry[]> = {
  WEAPON: [
    { id: "item_wp_1", name: "短剑", info: "轻型近战", usage: "1 动作", count: 1 },
    { id: "item_wp_2", name: "长弓", info: "远程武器", usage: "1 动作", count: 1 },
    { id: "item_wp_3", name: "匕首", info: "可投掷", usage: "1 动作", count: 2 },
    { id: "item_wp_4", name: "战锤", info: "重型近战", usage: "1 动作", count: 1 },
    { id: "item_wp_5", name: "投矛", info: "中距投掷", usage: "1 动作", count: 3 }
  ],
  CASTING: [
    { id: "item_cast_1", name: "奥术焦点", info: "施法媒介", usage: "常驻", count: 1 },
    { id: "item_cast_2", name: "法术书", info: "法术记录", usage: "10 分钟", count: 1 },
    { id: "item_cast_3", name: "仪式粉笔", info: "仪式材料", usage: "1 动作", count: 5 },
    { id: "item_cast_4", name: "符咒卷轴", info: "一次性施放", usage: "1 动作", count: 2 }
  ],
  CONSUMABLE: [
    { id: "item_cons_1", name: "治疗药水", info: "恢复生命", usage: "1 动作", count: 6 },
    { id: "item_cons_2", name: "法力药水", info: "恢复魔力", usage: "1 动作", count: 4 },
    { id: "item_cons_3", name: "止血绷带", info: "急救道具", usage: "1 动作", count: 3 },
    { id: "item_cons_4", name: "口粮包", info: "长休补给", usage: "短休", count: 8 },
    { id: "item_cons_5", name: "火油瓶", info: "环境投掷", usage: "1 动作", count: 2 }
  ],
  MAGIC: [
    { id: "item_magic_1", name: "护身戒", info: "防护增益", usage: "被动", count: 1 },
    { id: "item_magic_2", name: "迷光斗篷", info: "潜行强化", usage: "被动", count: 1 },
    { id: "item_magic_3", name: "位移徽章", info: "短距位移", usage: "反应", count: 1 },
    { id: "item_magic_4", name: "寒焰提灯", info: "照明/威慑", usage: "1 动作", count: 1 }
  ],
  ADVENTURE: [
    { id: "item_adv_1", name: "登山绳", info: "地形探索", usage: "1 动作", count: 2 },
    { id: "item_adv_2", name: "盗贼工具", info: "开锁拆陷阱", usage: "1 动作", count: 1 },
    { id: "item_adv_3", name: "工兵铲", info: "掘穴挖掘", usage: "1 分钟", count: 1 },
    { id: "item_adv_4", name: "便携帐篷", info: "营地搭建", usage: "10 分钟", count: 1 },
    { id: "item_adv_5", name: "防水地图筒", info: "地图存放", usage: "常驻", count: 1 }
  ]
};

const TRAIT_CATEGORY_TABS: Array<{ key: TraitCategoryKey; label: string }> = [
  { key: "RACE", label: "种族" },
  { key: "CLASS", label: "职业" },
  { key: "BACKGROUND", label: "背景" },
  { key: "DESTINY", label: "命途" },
  { key: "SKILL", label: "技能" }
];

const TRAIT_ENTRY_POOLS: Record<TraitCategoryKey, CharacterItemEntry[]> = {
  RACE: [
    { id: "trait_race_1", name: "人类适应性", info: "全属性微调", usage: "被动", count: 1 },
    { id: "trait_race_2", name: "夜视", info: "黑暗视距", usage: "常驻", count: 1 },
    { id: "trait_race_3", name: "血脉专长", info: "种族特长", usage: "被动", count: 1 }
  ],
  CLASS: [
    { id: "trait_class_1", name: "职业专精", info: "核心机制强化", usage: "被动", count: 1 },
    { id: "trait_class_2", name: "战斗姿态", info: "切换增益", usage: "附赠动作", count: 1 },
    { id: "trait_class_3", name: "职业突破", info: "成长里程碑", usage: "被动", count: 1 }
  ],
  BACKGROUND: [
    { id: "trait_bg_1", name: "旧日见闻", info: "情报优势", usage: "被动", count: 1 },
    { id: "trait_bg_2", name: "工坊门路", info: "交易折扣", usage: "常驻", count: 1 },
    { id: "trait_bg_3", name: "社交名片", info: "交涉优势", usage: "场景触发", count: 1 }
  ],
  DESTINY: [
    { id: "trait_destiny_1", name: "命途刻印", info: "关键判定加成", usage: "被动", count: 1 },
    { id: "trait_destiny_2", name: "逆命回响", info: "失败补偿", usage: "反应", count: 1 },
    { id: "trait_destiny_3", name: "终局指引", info: "剧情导向", usage: "场景触发", count: 1 }
  ],
  SKILL: [
    { id: "trait_skill_1", name: "调查专长", info: "检定优势", usage: "被动", count: 1 },
    { id: "trait_skill_2", name: "生存直觉", info: "野外增益", usage: "被动", count: 1 },
    { id: "trait_skill_3", name: "谈判老手", info: "说服强化", usage: "被动", count: 1 }
  ]
};

const SPELL_CATEGORY_TABS: Array<{ key: SpellCategoryKey; label: string }> = [
  { key: "CANTRIP", label: "戏法" },
  { key: "NOVICE", label: "初级" },
  { key: "INTERMEDIATE", label: "中级" },
  { key: "ADVANCED", label: "高级" },
  { key: "EPIC", label: "史诗" },
  { key: "LEGENDARY", label: "传说" },
  { key: "RITUAL", label: "仪式" }
];

const SPELL_ENTRY_POOLS: Record<SpellCategoryKey, CharacterItemEntry[]> = {
  CANTRIP: [
    { id: "spell_cantrip_1", name: "火花术", info: "微量火焰伤害", usage: "1 动作", count: 1 },
    { id: "spell_cantrip_2", name: "寒息", info: "减速附着", usage: "1 动作", count: 1 },
    { id: "spell_cantrip_3", name: "光亮术", info: "照明", usage: "1 动作", count: 1 }
  ],
  NOVICE: [
    { id: "spell_novice_1", name: "魔弹", info: "稳定命中", usage: "1 动作", count: 1 },
    { id: "spell_novice_2", name: "护盾", info: "临时防护", usage: "反应", count: 1 },
    { id: "spell_novice_3", name: "疗愈祷言", info: "单体恢复", usage: "1 动作", count: 1 }
  ],
  INTERMEDIATE: [
    { id: "spell_mid_1", name: "雷霆链", info: "弹射伤害", usage: "1 动作", count: 1 },
    { id: "spell_mid_2", name: "冰障", info: "区域阻挡", usage: "1 动作", count: 1 },
    { id: "spell_mid_3", name: "群体愈合", info: "范围治疗", usage: "1 动作", count: 1 }
  ],
  ADVANCED: [
    { id: "spell_high_1", name: "陨火坠落", info: "范围爆发", usage: "1 动作", count: 1 },
    { id: "spell_high_2", name: "虚空折跃", info: "位移", usage: "1 动作", count: 1 },
    { id: "spell_high_3", name: "圣辉壁垒", info: "团队护盾", usage: "1 动作", count: 1 }
  ],
  EPIC: [
    { id: "spell_epic_1", name: "天穹裂隙", info: "持续区域", usage: "1 动作", count: 1 },
    { id: "spell_epic_2", name: "命运逆转", info: "重投判定", usage: "反应", count: 1 },
    { id: "spell_epic_3", name: "群星灌注", info: "团队增益", usage: "1 动作", count: 1 }
  ],
  LEGENDARY: [
    { id: "spell_legend_1", name: "世界回响", info: "战场改写", usage: "1 动作", count: 1 },
    { id: "spell_legend_2", name: "永恒结界", info: "终极防护", usage: "1 动作", count: 1 },
    { id: "spell_legend_3", name: "审判之门", info: "高额爆发", usage: "1 动作", count: 1 }
  ],
  RITUAL: [
    { id: "spell_ritual_1", name: "召唤法阵", info: "仪式召唤", usage: "10 分钟", count: 1 },
    { id: "spell_ritual_2", name: "群体祝祷", info: "长期增益", usage: "10 分钟", count: 1 },
    { id: "spell_ritual_3", name: "追迹术", info: "线索追踪", usage: "10 分钟", count: 1 }
  ]
};

const TECHNIQUE_CATEGORY_TABS: Array<{ key: TechniqueCategoryKey; label: string }> = [
  { key: "ENTRY", label: "初传" },
  { key: "ADVANCED", label: "进阶" },
  { key: "TRANSCENDENT", label: "化境" },
  { key: "PEAK", label: "登峰" },
  { key: "FORMLESS", label: "无相" }
];

const TECHNIQUE_ENTRY_POOLS: Record<TechniqueCategoryKey, CharacterItemEntry[]> = {
  ENTRY: [
    { id: "tech_entry_1", name: "裂步斩", info: "位移斩击", usage: "1 动作", count: 1 },
    { id: "tech_entry_2", name: "回身格挡", info: "基础防反", usage: "反应", count: 1 },
    { id: "tech_entry_3", name: "冲拳", info: "突进打击", usage: "1 动作", count: 1 }
  ],
  ADVANCED: [
    { id: "tech_adv_1", name: "连环破", info: "连续追击", usage: "1 动作", count: 1 },
    { id: "tech_adv_2", name: "封喉步", info: "削弱目标", usage: "1 动作", count: 1 },
    { id: "tech_adv_3", name: "铁壁式", info: "防御提升", usage: "附赠动作", count: 1 }
  ],
  TRANSCENDENT: [
    { id: "tech_trans_1", name: "破军", info: "破甲高伤", usage: "1 动作", count: 1 },
    { id: "tech_trans_2", name: "流影", info: "多段位移", usage: "附赠动作", count: 1 },
    { id: "tech_trans_3", name: "回天", info: "反制恢复", usage: "反应", count: 1 }
  ],
  PEAK: [
    { id: "tech_peak_1", name: "断岳", info: "重击终结", usage: "1 动作", count: 1 },
    { id: "tech_peak_2", name: "逐日", info: "高速连携", usage: "1 动作", count: 1 },
    { id: "tech_peak_3", name: "龙脉护体", info: "强韧护体", usage: "附赠动作", count: 1 }
  ],
  FORMLESS: [
    { id: "tech_formless_1", name: "无相步", info: "无法锁定", usage: "反应", count: 1 },
    { id: "tech_formless_2", name: "寂灭", info: "压制领域", usage: "1 动作", count: 1 },
    { id: "tech_formless_3", name: "归一", info: "终极收束", usage: "1 动作", count: 1 }
  ]
};

const COLLECTION_PAGE_CONFIGS: Record<CollectionPageTabKey, CollectionPageConfig> = {
  ITEMS: {
    categories: ITEM_CATEGORY_TABS,
    entryPools: ITEM_ENTRY_POOLS
  },
  TRAITS: {
    categories: TRAIT_CATEGORY_TABS,
    entryPools: TRAIT_ENTRY_POOLS
  },
  SPELLS: {
    categories: SPELL_CATEGORY_TABS,
    entryPools: SPELL_ENTRY_POOLS
  },
  TECHNIQUES: {
    categories: TECHNIQUE_CATEGORY_TABS,
    entryPools: TECHNIQUE_ENTRY_POOLS
  }
};

const DEFAULT_COLLECTION_ACTIVE_CATEGORY: Record<CollectionPageTabKey, string> = {
  ITEMS: ITEM_CATEGORY_TABS[0].key,
  TRAITS: TRAIT_CATEGORY_TABS[0].key,
  SPELLS: SPELL_CATEGORY_TABS[0].key,
  TECHNIQUES: TECHNIQUE_CATEGORY_TABS[0].key
};

type StatusSectionKey = "BUFF" | "DEBUFF" | "EFFECT" | "STATE";

type StatusSectionConfig = {
  key: StatusSectionKey;
  label: string;
  hint: string;
  isFixed: boolean;
};

const STATUS_SECTIONS: StatusSectionConfig[] = [
  { key: "BUFF", label: "增益", hint: "战场临时增益（来源随能力变化）", isFixed: false },
  { key: "DEBUFF", label: "减益", hint: "战场临时减益（来源随能力变化）", isFixed: false },
  { key: "EFFECT", label: "效果", hint: "固定效果分类（后续填充固定条目）", isFixed: true },
  { key: "STATE", label: "状态", hint: "固定状态分类（后续填充固定条目）", isFixed: true }
];

type TalentColumnKey = "GENERAL" | "CLASS" | "SKILL";

type TalentTreeTemplate = {
  id: string;
  name: string;
  totalNodes: number;
};

type LearnedTalentTree = {
  id: string;
  name: string;
  spentPoints: number;
  unlockedNodes: number;
  totalNodes: number;
};

type TalentColumnConfig = {
  key: TalentColumnKey;
  title: string;
  pointLabel: string;
  totalPoints: number;
  addLabel: string;
};

const TALENT_COLUMN_ORDER: TalentColumnKey[] = ["GENERAL", "CLASS", "SKILL"];

const TALENT_COLUMN_CONFIGS: Record<TalentColumnKey, TalentColumnConfig> = {
  GENERAL: {
    key: "GENERAL",
    title: "通用天赋树",
    pointLabel: "通用天赋点",
    totalPoints: 12,
    addLabel: "学习新天赋"
  },
  CLASS: {
    key: "CLASS",
    title: "职业天赋树",
    pointLabel: "职业天赋点",
    totalPoints: 10,
    addLabel: "学习新天赋"
  },
  SKILL: {
    key: "SKILL",
    title: "技能点",
    pointLabel: "技能点",
    totalPoints: 14,
    addLabel: "升级技能"
  }
};

const TALENT_TREE_LIBRARY: Record<TalentColumnKey, TalentTreeTemplate[]> = {
  GENERAL: [
    { id: "talent_general_survive", name: "生存本能", totalNodes: 12 },
    { id: "talent_general_armor", name: "护甲训练", totalNodes: 10 },
    { id: "talent_general_arcane", name: "奥术亲和", totalNodes: 14 },
    { id: "talent_general_command", name: "战术指挥", totalNodes: 11 }
  ],
  CLASS: [
    { id: "talent_class_sword", name: "剑术专精", totalNodes: 13 },
    { id: "talent_class_guard", name: "守护意志", totalNodes: 10 },
    { id: "talent_class_element", name: "元素通路", totalNodes: 15 },
    { id: "talent_class_assassin", name: "潜影刺杀", totalNodes: 12 }
  ],
  SKILL: [
    { id: "talent_skill_athletics", name: "运动强化", totalNodes: 8 },
    { id: "talent_skill_awareness", name: "察觉强化", totalNodes: 8 },
    { id: "talent_skill_persuasion", name: "说服强化", totalNodes: 8 },
    { id: "talent_skill_arcana", name: "奥秘强化", totalNodes: 8 }
  ]
};

const DEFAULT_LEARNED_TALENT_TREES: Record<TalentColumnKey, LearnedTalentTree[]> = {
  GENERAL: [],
  CLASS: [],
  SKILL: []
};

type DragPosition = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatSignedValue(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function getAttributeAdjustment(value: number) {
  return Math.floor((value - 10) / 2);
}

function getPassiveCheckValue(adjustment: number) {
  return 10 + adjustment;
}

function getSkillProficiencyLabel(level: SkillProficiencyLevel) {
  if (level === "PROFICIENT") {
    return "拥有熟练";
  }
  if (level === "EXPERTISE") {
    return "拥有熟练与专精";
  }
  return "未拥有熟练";
}

function getSkillProficiencyText(level: SkillProficiencyLevel) {
  if (level === "PROFICIENT") {
    return "熟练";
  }
  if (level === "EXPERTISE") {
    return "专精";
  }
  return "无";
}

function splitExpressionTerms(expression: string) {
  const compact = expression.replace(/\s+/g, "");
  if (!compact) {
    return [] as string[];
  }
  return compact.match(/[+-]?[^+-]+/g) ?? [];
}

function normalizeExpression(expression: string) {
  const terms = splitExpressionTerms(expression).filter((term) => term.trim().length > 0);
  if (terms.length === 0) {
    return "";
  }

  return terms
    .map((term, index) => {
      const normalized = term.trim();
      if (index === 0 && !normalized.startsWith("+") && !normalized.startsWith("-")) {
        return `+${normalized}`;
      }
      return normalized;
    })
    .join("");
}

function composeExpression(terms: string[]) {
  return terms
    .map((term) => normalizeExpression(term))
    .filter(Boolean)
    .join("");
}

function evaluateAdjustmentExpression(
  expression: string,
  attributeModifiers: Record<SkillAttributeKey, number>,
  proficiencyBonus: number
) {
  const terms = splitExpressionTerms(expression);
  let total = 0;
  const sources: string[] = [];

  terms.forEach((rawTerm) => {
    const term = rawTerm.trim();
    if (!term) {
      return;
    }

    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "").toLowerCase();

    if (!body) {
      return;
    }

    if (/^\d+$/.test(body)) {
      const amount = Number(body) * sign;
      total += amount;
      sources.push(`无来源输入：${formatSignedValue(amount)}`);
      return;
    }

    if (body === "pb") {
      const amount = proficiencyBonus * sign;
      total += amount;
      sources.push(`无来源输入（pb）：${formatSignedValue(amount)}`);
      return;
    }

    const multiPbMatch = body.match(/^(\d+)pb$/);
    if (multiPbMatch) {
      const multiplier = Number(multiPbMatch[1]);
      const amount = proficiencyBonus * multiplier * sign;
      total += amount;
      sources.push(`无来源输入（${multiplier}pb）：${formatSignedValue(amount)}`);
      return;
    }

    const attrAliasMap: Record<string, SkillAttributeKey> = {
      str: "STR",
      dex: "DEX",
      con: "CON",
      int: "INT",
      wis: "WIS",
      cha: "CHA"
    };

    const attributeKey = attrAliasMap[body];
    if (attributeKey) {
      const amount = attributeModifiers[attributeKey] * sign;
      total += amount;
      sources.push(`无来源输入（${body}）：${formatSignedValue(amount)}`);
      return;
    }

    sources.push(`无来源输入（${term}）：+0`);
  });

  return {
    total,
    sources
  };
}

function getSkillAutoAdjustment(skill: DetailSkillItem, attributeModifiers: Record<SkillAttributeKey, number>, proficiencyBonus: number) {
  const sources: string[] = [];
  const tokens: string[] = [];
  let total = 0;

  if (skill.linkedAttributeKey) {
    const attrAmount = attributeModifiers[skill.linkedAttributeKey];
    total += attrAmount;
    sources.push(`来自${PRIMARY_ATTRIBUTE_LABEL_MAP[skill.linkedAttributeKey]}调整值：${formatSignedValue(attrAmount)}`);
    tokens.push(skill.linkedAttributeKey.toLowerCase());
  }

  if (skill.proficiency === "PROFICIENT") {
    total += proficiencyBonus;
    sources.push(`来自熟练加值：${formatSignedValue(proficiencyBonus)}`);
    tokens.push("pb");
  }

  if (skill.proficiency === "EXPERTISE") {
    const expertiseAmount = proficiencyBonus * 2;
    total += expertiseAmount;
    sources.push(`来自熟练加值（专精双倍）：${formatSignedValue(expertiseAmount)}`);
    tokens.push("2pb");
  }

  return {
    total,
    sources,
    tokenExpression: composeExpression(tokens)
  };
}

function sanitizeFileNameSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "")
    .slice(0, 40) || "未命名";
}

function formatExportDateStamp(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}年${month}月${day}日_${hour}${minute}${second}`;
}

function isCharacterSheetExportPayload(value: unknown): value is CharacterSheetExportPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CharacterSheetExportPayload>;
  if (
    candidate.source !== CHARACTER_SHEET_EXPORT_SOURCE
    || typeof candidate.schemaVersion !== "string"
    || typeof candidate.exportedAt !== "string"
    || typeof candidate.characterName !== "string"
    || typeof candidate.characterLevel !== "number"
    || typeof candidate.playerName !== "string"
    || typeof candidate.proficiencyBonus !== "number"
    || !Array.isArray(candidate.skills)
  ) {
    return false;
  }

  return candidate.skills.every((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const skill = item as CharacterSheetExportPayload["skills"][number];
    const linkedAttrValid = skill.linkedAttributeKey == null || Object.keys(PRIMARY_ATTRIBUTE_LABEL_MAP).includes(skill.linkedAttributeKey);
    return (
      typeof skill.key === "string"
      && linkedAttrValid
      && (skill.proficiency === "NONE" || skill.proficiency === "PROFICIENT" || skill.proficiency === "EXPERTISE")
      && typeof skill.permanentCustomAdjustmentText === "string"
      && typeof skill.temporaryCustomAdjustmentText === "string"
    );
  });
}

function getEquipmentHandLabel(hand: EquipmentQuickEquippedHand) {
  if (hand === "LEFT") {
    return "左手";
  }
  if (hand === "RIGHT") {
    return "右手";
  }
  return "双手";
}

function isCollectionPageTab(tab: CharacterSheetTabKey): tab is CollectionPageTabKey {
  return tab === "ITEMS" || tab === "TRAITS" || tab === "SPELLS" || tab === "TECHNIQUES";
}

function splitItemsIntoColumns(items: CharacterItemEntry[]) {
  const left: CharacterItemEntry[] = [];
  const right: CharacterItemEntry[] = [];

  // 按“左 -> 右”顺序依次落位：第1个进左栏，第2个进右栏。
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      left.push(item);
      return;
    }
    right.push(item);
  });

  return { left, right };
}

export function CharacterSheetWorkbench(props: CharacterSheetWorkbenchProps) {
  const {
    characterId,
    characterName,
    playerName,
    characterLevel,
    characterTokenDataUrl,
    onClose,
    onTokenConfig,
    onTokenUpload,
    onExport,
    onImport
  } = props;
  const panelRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<CharacterSheetTabKey>("DETAIL");
  const [position, setPosition] = useState<DragPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isSkillPointListOpen, setIsSkillPointListOpen] = useState(false);
  const [isProfessionSkillGroupExpanded, setIsProfessionSkillGroupExpanded] = useState(false);
  const [detailSkills, setDetailSkills] = useState<DetailSkillItem[]>(INITIAL_DETAIL_SKILL_ITEMS);
  const [activeSkillConfigKey, setActiveSkillConfigKey] = useState<string | null>(null);
  const [sheetCharacterName, setSheetCharacterName] = useState((characterName?.trim() || "未命名角色"));
  const [sheetCharacterLevel, setSheetCharacterLevel] = useState(characterLevel ?? 1);
  const [proficiencyBonus] = useState(DEFAULT_PROFICIENCY_BONUS);
  const [tokenPreviewUrl, setTokenPreviewUrl] = useState<string | null>(characterTokenDataUrl ?? null);
  const [equipmentQuickExpanded, setEquipmentQuickExpanded] = useState<Record<EquipmentQuickSectionKey, boolean>>(
    DEFAULT_EQUIPMENT_QUICK_EXPANDED
  );
  const [equipmentQuickWatchlist, setEquipmentQuickWatchlist] = useState<Record<EquipmentQuickSectionKey, string[]>>(
    DEFAULT_EQUIPMENT_QUICK_WATCHLIST
  );
  const [activeCollectionCategory, setActiveCollectionCategory] = useState<Record<CollectionPageTabKey, string>>(
    DEFAULT_COLLECTION_ACTIVE_CATEGORY
  );
  const [learnedTalentTrees, setLearnedTalentTrees] = useState<Record<TalentColumnKey, LearnedTalentTree[]>>(
    DEFAULT_LEARNED_TALENT_TREES
  );
  const [activeTalentListColumn, setActiveTalentListColumn] = useState<TalentColumnKey | null>(null);
  const [pendingTalentSelection, setPendingTalentSelection] = useState<{
    columnKey: TalentColumnKey;
    template: TalentTreeTemplate;
  } | null>(null);

  const activeTabConfig = useMemo(
    () => CHARACTER_SHEET_TABS.find((item) => item.key === activeTab) ?? CHARACTER_SHEET_TABS[0],
    [activeTab]
  );
  const displayCharacterName = sheetCharacterName.trim() || "未命名角色";
  const attributeModifierMap = useMemo(() => {
    return PRIMARY_ATTRIBUTES.reduce((acc, attr) => {
      acc[attr.key] = getAttributeAdjustment(attr.value);
      return acc;
    }, {} as Record<SkillAttributeKey, number>);
  }, []);
  const coreDetailSkills = useMemo(
    () => detailSkills.filter((skill) => skill.category === "CORE"),
    [detailSkills]
  );
  const professionDetailSkills = useMemo(
    () => detailSkills.filter((skill) => skill.category === "PROFESSION"),
    [detailSkills]
  );
  const activeSkillConfig = useMemo(
    () => detailSkills.find((skill) => skill.key === activeSkillConfigKey) ?? null,
    [activeSkillConfigKey, detailSkills]
  );
  const skillComputedMap = useMemo(() => {
    return detailSkills.reduce((acc, skill) => {
      const auto = getSkillAutoAdjustment(skill, attributeModifierMap, proficiencyBonus);
      const permanent = evaluateAdjustmentExpression(skill.permanentCustomAdjustmentText, attributeModifierMap, proficiencyBonus);
      const temporary = evaluateAdjustmentExpression(skill.temporaryCustomAdjustmentText, attributeModifierMap, proficiencyBonus);
      const adjustment = auto.total + permanent.total + temporary.total;
      const passive = getPassiveCheckValue(adjustment);
      const autoExpression = auto.tokenExpression;
      const permanentExpression = composeExpression([autoExpression, skill.permanentCustomAdjustmentText]);
      const totalExpression = composeExpression([autoExpression, skill.permanentCustomAdjustmentText, skill.temporaryCustomAdjustmentText]);

      acc[skill.key] = {
        adjustment,
        passive,
        tooltip: [...auto.sources, ...permanent.sources, ...temporary.sources].join("\n") || "暂无来源",
        passiveTooltip: `10 + 技能加值(${formatSignedValue(adjustment)}) = ${passive}`,
        permanentExpression,
        totalExpression,
        autoExpression,
        autoSourceText: auto.sources.join("；") || "暂无来源"
      };
      return acc;
    }, {} as Record<string, {
      adjustment: number;
      passive: number;
      tooltip: string;
      passiveTooltip: string;
      permanentExpression: string;
      totalExpression: string;
      autoExpression: string;
      autoSourceText: string;
    }>);
  }, [attributeModifierMap, detailSkills, proficiencyBonus]);
  const activeCollectionTabKey = isCollectionPageTab(activeTab) ? activeTab : null;
  const activeCollectionConfig = activeCollectionTabKey ? COLLECTION_PAGE_CONFIGS[activeCollectionTabKey] : null;
  const activeCollectionCategoryKey = activeCollectionTabKey ? activeCollectionCategory[activeCollectionTabKey] : "";
  const activeCollectionEntries = activeCollectionConfig
    ? activeCollectionConfig.entryPools[activeCollectionCategoryKey] ?? []
    : [];
  const activeCollectionColumns = useMemo(() => splitItemsIntoColumns(activeCollectionEntries), [activeCollectionEntries]);
  const activeTalentTreeList = activeTalentListColumn ? TALENT_TREE_LIBRARY[activeTalentListColumn] : [];
  const workbenchStorageKey = useMemo(
    () => `${CHARACTER_SHEET_WORKBENCH_STORAGE_PREFIX}:${characterId ?? (characterName?.trim() || "draft")}`,
    [characterId, characterName]
  );

  const updateSkill = useCallback((skillKey: string, updater: (skill: DetailSkillItem) => DetailSkillItem) => {
    setDetailSkills((prev) => prev.map((skill) => (skill.key === skillKey ? updater(skill) : skill)));
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || position) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const centerX = Math.max(8, Math.round((window.innerWidth - rect.width) / 2));
    const centerY = Math.max(8, Math.round((window.innerHeight - rect.height) / 2));
    setPosition({ x: centerX, y: centerY });
  }, [position]);

  useEffect(() => {
    const onWindowResize = () => {
      setPosition((prev) => {
        const panel = panelRef.current;
        if (!panel || !prev) {
          return prev;
        }

        const rect = panel.getBoundingClientRect();
        const maxX = Math.max(8, window.innerWidth - rect.width - 8);
        const maxY = Math.max(8, window.innerHeight - rect.height - 8);
        return {
          x: clamp(prev.x, 8, maxX),
          y: clamp(prev.y, 8, maxY)
        };
      });
    };

    window.addEventListener("resize", onWindowResize);
    return () => {
      window.removeEventListener("resize", onWindowResize);
    };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!dragOffsetRef.current) {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      const maxX = Math.max(8, window.innerWidth - rect.width - 8);
      const maxY = Math.max(8, window.innerHeight - rect.height - 8);

      const nextX = clamp(event.clientX - dragOffsetRef.current.x, 8, maxX);
      const nextY = clamp(event.clientY - dragOffsetRef.current.y, 8, maxY);
      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      dragOffsetRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (activeTab !== "DETAIL" && isSkillPointListOpen) {
      setIsSkillPointListOpen(false);
    }
    if (activeTab !== "DETAIL" && isProfessionSkillGroupExpanded) {
      setIsProfessionSkillGroupExpanded(false);
    }
    if (activeTab !== "DETAIL" && activeSkillConfigKey) {
      setActiveSkillConfigKey(null);
    }
  }, [activeTab, isSkillPointListOpen, isProfessionSkillGroupExpanded, activeSkillConfigKey]);

  useEffect(() => {
    if (!isEditMode && activeSkillConfigKey) {
      setActiveSkillConfigKey(null);
    }
  }, [isEditMode, activeSkillConfigKey]);

  useEffect(() => {
    if (activeTab !== "TALENTS") {
      setActiveTalentListColumn(null);
      setPendingTalentSelection(null);
    }
  }, [activeTab]);

  useEffect(() => {
    setTokenPreviewUrl(characterTokenDataUrl ?? null);
  }, [characterTokenDataUrl]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(workbenchStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!isCharacterSheetExportPayload(parsed)) {
        return;
      }

      setSheetCharacterName(parsed.characterName || "未命名角色");
      setSheetCharacterLevel(parsed.characterLevel || 1);
      setTokenPreviewUrl(parsed.tokenDataUrl ?? null);
      setDetailSkills((prev) => {
        const skillMap = new Map(parsed.skills.map((item) => [item.key, item]));
        return prev.map((skill) => {
          const stored = skillMap.get(skill.key);
          if (!stored) {
            return skill;
          }
          return {
            ...skill,
            linkedAttributeKey: stored.linkedAttributeKey,
            proficiency: stored.proficiency,
            permanentCustomAdjustmentText: stored.permanentCustomAdjustmentText,
            temporaryCustomAdjustmentText: stored.temporaryCustomAdjustmentText
          };
        });
      });
    } catch {
      // ignore malformed cache and continue with defaults
    }
  }, [workbenchStorageKey]);

  useEffect(() => {
    const cachePayload: CharacterSheetExportPayload = {
      source: CHARACTER_SHEET_EXPORT_SOURCE,
      schemaVersion: CHARACTER_SHEET_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      characterId: characterId ?? null,
      characterName: displayCharacterName,
      characterLevel: sheetCharacterLevel,
      playerName: playerName?.trim() || "未知玩家",
      proficiencyBonus,
      tokenDataUrl: tokenPreviewUrl,
      skills: detailSkills.map((skill) => ({
        key: skill.key,
        linkedAttributeKey: skill.linkedAttributeKey,
        proficiency: skill.proficiency,
        permanentCustomAdjustmentText: normalizeExpression(skill.permanentCustomAdjustmentText),
        temporaryCustomAdjustmentText: normalizeExpression(skill.temporaryCustomAdjustmentText)
      }))
    };

    window.localStorage.setItem(workbenchStorageKey, JSON.stringify(cachePayload));
  }, [
    characterId,
    detailSkills,
    displayCharacterName,
    playerName,
    proficiencyBonus,
    sheetCharacterLevel,
    tokenPreviewUrl,
    workbenchStorageKey
  ]);

  useEffect(() => {
    const hasCache = Boolean(window.localStorage.getItem(workbenchStorageKey));
    if (hasCache) {
      return;
    }
    setSheetCharacterName(characterName?.trim() || "未命名角色");
  }, [characterName, workbenchStorageKey]);

  useEffect(() => {
    const hasCache = Boolean(window.localStorage.getItem(workbenchStorageKey));
    if (hasCache) {
      return;
    }
    if (typeof characterLevel === "number" && Number.isFinite(characterLevel)) {
      setSheetCharacterLevel(characterLevel);
    }
  }, [characterLevel, workbenchStorageKey]);

  useEffect(() => {
    if (!isSettingsMenuOpen) {
      return;
    }

    const handleWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (settingsButtonRef.current?.contains(target)) {
        return;
      }
      if (settingsMenuRef.current?.contains(target)) {
        return;
      }
      setIsSettingsMenuOpen(false);
    };

    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => {
      window.removeEventListener("mousedown", handleWindowMouseDown);
    };
  }, [isSettingsMenuOpen]);

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(".character-sheet-dock__action-btn") || target.closest(".character-sheet-dock__settings-menu")) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top
    };

    setIsDragging(true);
  };

  const handleTokenUploadClick = () => {
    if (!isEditMode) {
      window.alert("请先在设置中开启编辑模式，再上传 Token。");
      return;
    }
    tokenInputRef.current?.click();
  };

  const handleTokenFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        return;
      }

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }

        context.clearRect(0, 0, 512, 512);
        context.drawImage(image, 0, 0, 512, 512);
        const normalizedToken = canvas.toDataURL("image/png");
        setTokenPreviewUrl(normalizedToken);
        onTokenUpload?.(normalizedToken);
      };
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleToggleEditMode = () => {
    setIsEditMode((prev) => {
      const next = !prev;
      if (!next) {
        setActiveSkillConfigKey(null);
      }
      return next;
    });
  };

  const handleOpenSettingsMenu = () => {
    setIsSettingsMenuOpen((prev) => !prev);
  };

  const handleSettingsTokenConfig = () => {
    onTokenConfig?.();
    setIsSettingsMenuOpen(false);
  };

  const handleExportSheet = () => {
    const exportPayload: CharacterSheetExportPayload = {
      source: CHARACTER_SHEET_EXPORT_SOURCE,
      schemaVersion: CHARACTER_SHEET_EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      characterId: characterId ?? null,
      characterName: displayCharacterName,
      characterLevel: sheetCharacterLevel,
      playerName: (playerName?.trim() || "未知玩家"),
      proficiencyBonus,
      tokenDataUrl: tokenPreviewUrl,
      skills: detailSkills.map((skill) => ({
        key: skill.key,
        linkedAttributeKey: skill.linkedAttributeKey,
        proficiency: skill.proficiency,
        permanentCustomAdjustmentText: normalizeExpression(skill.permanentCustomAdjustmentText),
        temporaryCustomAdjustmentText: normalizeExpression(skill.temporaryCustomAdjustmentText)
      }))
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const dateStamp = formatExportDateStamp(new Date());
    const fileName = `${sanitizeFileNameSegment(displayCharacterName)}_${sanitizeFileNameSegment(String(sheetCharacterLevel))}_${sanitizeFileNameSegment(exportPayload.playerName)}_${dateStamp}.json`;

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);

    onExport?.();
  };

  const handleImportSheetClick = () => {
    if (!isEditMode) {
      window.alert("请先在设置中开启编辑模式，再导入角色卡。\n导入会覆盖当前角色卡字段。");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(raw) as unknown;
        if (!isCharacterSheetExportPayload(parsed)) {
          throw new Error("导入文件格式不正确");
        }

        setSheetCharacterName(parsed.characterName || "未命名角色");
        setSheetCharacterLevel(parsed.characterLevel || 1);
        setTokenPreviewUrl(parsed.tokenDataUrl ?? null);
        if (parsed.tokenDataUrl) {
          onTokenUpload?.(parsed.tokenDataUrl);
        }

        setDetailSkills((prev) => {
          const skillMap = new Map(parsed.skills.map((skill) => [skill.key, skill]));
          return prev.map((skill) => {
            const imported = skillMap.get(skill.key);
            if (!imported) {
              return skill;
            }
            return {
              ...skill,
              linkedAttributeKey: imported.linkedAttributeKey,
              proficiency: imported.proficiency,
              permanentCustomAdjustmentText: normalizeExpression(imported.permanentCustomAdjustmentText),
              temporaryCustomAdjustmentText: normalizeExpression(imported.temporaryCustomAdjustmentText)
            };
          });
        });

        onImport?.();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "导入失败，请检查 JSON 内容。");
      }
    };

    reader.readAsText(file, "utf-8");
    event.currentTarget.value = "";
  };

  const handleOpenSkillConfig = (skillKey: string) => {
    if (!isEditMode) {
      return;
    }
    setActiveSkillConfigKey(skillKey);
  };

  const handleCloseSkillConfig = () => {
    setActiveSkillConfigKey(null);
  };

  const handleSkillLinkedAttributeChange = (skillKey: string, nextValue: string) => {
    updateSkill(skillKey, (skill) => ({
      ...skill,
      linkedAttributeKey: nextValue ? (nextValue as SkillAttributeKey) : null
    }));
  };

  const handleSkillProficiencyChange = (skillKey: string, nextValue: SkillProficiencyLevel) => {
    updateSkill(skillKey, (skill) => ({
      ...skill,
      proficiency: nextValue
    }));
  };

  const handleSkillPermanentCustomChange = (skillKey: string, value: string) => {
    updateSkill(skillKey, (skill) => ({
      ...skill,
      permanentCustomAdjustmentText: value
    }));
  };

  const handleSkillTemporaryCustomChange = (skillKey: string, value: string) => {
    updateSkill(skillKey, (skill) => ({
      ...skill,
      temporaryCustomAdjustmentText: value
    }));
  };

  const toggleEquipmentQuickSection = (sectionKey: EquipmentQuickSectionKey) => {
    setEquipmentQuickExpanded((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleAddEquipmentQuickItem = (sectionKey: EquipmentQuickSectionKey, itemId: string) => {
    setEquipmentQuickWatchlist((prev) => {
      const currentIds = prev[sectionKey];
      if (currentIds.includes(itemId)) {
        return prev;
      }
      return {
        ...prev,
        [sectionKey]: [...currentIds, itemId]
      };
    });
  };

  const handleRemoveEquipmentQuickItem = (sectionKey: EquipmentQuickSectionKey, itemId: string) => {
    setEquipmentQuickWatchlist((prev) => {
      const currentIds = prev[sectionKey];
      const nextIds = currentIds.filter((id) => id !== itemId);
      if (nextIds.length === currentIds.length) {
        return prev;
      }
      return {
        ...prev,
        [sectionKey]: nextIds
      };
    });
  };

  const handleCollectionCategoryChange = (tabKey: CollectionPageTabKey, categoryKey: string) => {
    setActiveCollectionCategory((prev) => ({
      ...prev,
      [tabKey]: categoryKey
    }));
  };

  const handleOpenTalentList = (columnKey: TalentColumnKey) => {
    setPendingTalentSelection(null);
    setActiveTalentListColumn(columnKey);
  };

  const handleCloseTalentList = () => {
    setActiveTalentListColumn(null);
  };

  const handleSelectTalentTemplate = (columnKey: TalentColumnKey, template: TalentTreeTemplate) => {
    setActiveTalentListColumn(null);
    setPendingTalentSelection({ columnKey, template });
  };

  const handleCloseTalentLearning = () => {
    setPendingTalentSelection(null);
  };

  const handleConfirmTalentLearning = () => {
    if (!pendingTalentSelection) {
      return;
    }

    setLearnedTalentTrees((prev) => {
      const currentTrees = prev[pendingTalentSelection.columnKey];
      if (currentTrees.some((tree) => tree.id === pendingTalentSelection.template.id)) {
        return prev;
      }

      const nextTree: LearnedTalentTree = {
        id: pendingTalentSelection.template.id,
        name: pendingTalentSelection.template.name,
        spentPoints: 0,
        unlockedNodes: 0,
        totalNodes: pendingTalentSelection.template.totalNodes
      };

      return {
        ...prev,
        [pendingTalentSelection.columnKey]: [...currentTrees, nextTree]
      };
    });

    setPendingTalentSelection(null);
  };

  const handleEditableFieldClick = (_fieldKey: string) => {
    if (!isEditMode) {
      return;
    }
    // 占位：后续在此处挂载字段编辑弹窗。
  };

  return (
    <section
      ref={panelRef}
      className={`character-sheet-dock ${isEditMode ? "is-edit-mode" : ""}`}
      data-character-id={characterId ?? undefined}
      style={position ? { left: position.x, top: position.y, transform: "none" } : undefined}
      aria-label="角色卡预创建"
    >
      <header
        className={`character-sheet-dock__header ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="character-sheet-dock__header-left">
          <h3>{displayCharacterName}</h3>
          <span className={`character-sheet-dock__mode-tag ${isEditMode ? "is-edit" : "is-readonly"}`}>
            {isEditMode ? "编辑模式" : "只读模式"}
          </span>
        </div>
        <div className="character-sheet-dock__header-actions" role="toolbar" aria-label="角色卡操作">
          <button type="button" className="character-sheet-dock__action-btn" onClick={handleImportSheetClick} title="导入角色卡" aria-label="导入角色卡">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L3.72 7.03a.75.75 0 0 1 1.06-1.06l2.47 2.47V1.75A.75.75 0 0 1 8 1Z" />
              <path d="M2.5 11.5a.75.75 0 0 1 .75.75v.25h9.5v-.25a.75.75 0 0 1 1.5 0v.75a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-.75a.75.75 0 0 1 .75-.75Z" />
            </svg>
          </button>
          <button type="button" className="character-sheet-dock__action-btn" onClick={handleExportSheet} title="导出角色卡" aria-label="导出角色卡">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 15a.75.75 0 0 1-.75-.75V7.56l-2.47 2.47a.75.75 0 0 1-1.06-1.06l3.75-3.75a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 0 1-1.06 1.06L8.75 7.56v6.69A.75.75 0 0 1 8 15Z" />
              <path d="M2.5 1.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v2a.75.75 0 0 1-1.5 0V2h-8v1.5a.75.75 0 0 1-1.5 0v-2Z" />
            </svg>
          </button>
          <div className="character-sheet-dock__settings-wrap">
            <button
              ref={settingsButtonRef}
              type="button"
              className={`character-sheet-dock__action-btn ${isSettingsMenuOpen ? "is-active" : ""}`}
              onClick={handleOpenSettingsMenu}
              title="设置"
              aria-label="设置"
              aria-expanded={isSettingsMenuOpen}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6.5 1.25a.75.75 0 0 1 .75.75v.54a5.5 5.5 0 0 1 1.5 0V2a.75.75 0 0 1 1.5 0v.77a5.55 5.55 0 0 1 1.35.78l.55-.56a.75.75 0 0 1 1.06 1.06l-.56.55a5.55 5.55 0 0 1 .78 1.35H14a.75.75 0 0 1 0 1.5h-.54a5.5 5.5 0 0 1 0 1.5H14a.75.75 0 0 1 0 1.5h-.77a5.55 5.55 0 0 1-.78 1.35l.56.55a.75.75 0 1 1-1.06 1.06l-.55-.56a5.55 5.55 0 0 1-1.35.78V14a.75.75 0 0 1-1.5 0v-.54a5.5 5.5 0 0 1-1.5 0V14a.75.75 0 0 1-1.5 0v-.77a5.55 5.55 0 0 1-1.35-.78l-.55.56a.75.75 0 0 1-1.06-1.06l.56-.55a5.55 5.55 0 0 1-.78-1.35H2a.75.75 0 0 1 0-1.5h.54a5.5 5.5 0 0 1 0-1.5H2a.75.75 0 0 1 0-1.5h.77a5.55 5.55 0 0 1 .78-1.35l-.56-.55A.75.75 0 1 1 4.05 3l.55.56a5.55 5.55 0 0 1 1.35-.78V2a.75.75 0 0 1 .75-.75Zm1.5 4A2.75 2.75 0 1 0 8 10.75a2.75 2.75 0 0 0 0-5.5Z" />
              </svg>
            </button>

            {isSettingsMenuOpen ? (
              <div ref={settingsMenuRef} className="character-sheet-dock__settings-menu" role="menu" aria-label="角色卡设置">
                <button type="button" role="menuitem" onClick={handleToggleEditMode} className="character-sheet-dock__settings-item">
                  <span>编辑模式</span>
                  <strong>{isEditMode ? "开启" : "关闭"}</strong>
                </button>
                <button type="button" role="menuitem" onClick={handleSettingsTokenConfig} className="character-sheet-dock__settings-item">
                  <span>Token 设置</span>
                  <strong>配置</strong>
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className="character-sheet-dock__action-btn is-danger" onClick={onClose} title="关闭角色卡" aria-label="关闭角色卡">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.22 3.22a.75.75 0 0 1 1.06 0L8 6.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>
      </header>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="character-sheet-dock__token-input"
        onChange={handleImportFileChange}
        aria-label="导入角色卡JSON文件"
      />

      <section className="character-sheet-dock__body">
        <section className="character-sheet-dock__primary" aria-label="主要数据区域">
          <div className="character-sheet-dock__major-layout">
            <aside className="character-sheet-dock__token-panel" aria-label="角色Token上传区域">
              <button
                type="button"
                className={`character-sheet-dock__token-upload ${tokenPreviewUrl ? "has-image" : ""}`}
                onClick={handleTokenUploadClick}
                aria-label="上传角色Token"
                title="单击上传角色Token（将缩放为 512x512）"
              >
                {tokenPreviewUrl ? <img src={tokenPreviewUrl} alt="角色Token预览" /> : <span>单击上传 Token</span>}
              </button>
              <p className="character-sheet-dock__token-hint">自动缩放为 512 × 512</p>
              <input
                ref={tokenInputRef}
                type="file"
                accept="image/*"
                className="character-sheet-dock__token-input"
                onChange={handleTokenFileChange}
                aria-label="选择角色Token图片"
              />
            </aside>

            <section className="character-sheet-dock__major-main">
              <div className="character-sheet-dock__major-line1">
                <h4>{displayCharacterName}</h4>
                <p>经验值 1300 / 2700</p>
                <p>等级 {sheetCharacterLevel}</p>
              </div>

              <div className="character-sheet-dock__vitals-inline" aria-label="生命与魔力">
                <article className="character-sheet-dock__vitals-inline-card is-hp">
                  <p>生命值</p>
                  <div className="character-sheet-dock__vitals-inline-bar" role="presentation">
                    <span style={{ width: "96%" }} />
                  </div>
                  <strong>100/100</strong>
                </article>

                <article className="character-sheet-dock__vitals-inline-card is-mp">
                  <p>魔力值</p>
                  <div className="character-sheet-dock__vitals-inline-bar" role="presentation">
                    <span style={{ width: "67%" }} />
                  </div>
                  <strong>120/180</strong>
                </article>

                <article className="character-sheet-dock__vitals-inline-card is-temp">
                  <p>临时生命值</p>
                  <strong>0</strong>
                </article>
              </div>

              <div className="character-sheet-dock__major-stats">
                <div className="character-sheet-dock__resource-row" aria-label="次级资源数值">
                  {SECONDARY_METRICS.map((metric) => (
                    <article key={metric.key} className="character-sheet-dock__resource-card">
                      <p>{metric.label}</p>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="character-sheet-dock__secondary-row">
          <section className={`character-sheet-dock__secondary ${activeTab === "DETAIL" ? "is-detail" : ""}`} aria-label="次要数据区域">
            {activeTab !== "DETAIL" && activeTab !== "CLASS" && activeTab !== "EQUIPMENT" && activeTab !== "STATUS" && activeTab !== "TALENTS" && !activeCollectionTabKey ? (
              <div className="character-sheet-dock__panel-title-row">
                <div className="character-sheet-dock__panel-title">{activeTabConfig.label}</div>
              </div>
            ) : null}
            {activeTab === "DETAIL" ? (
              <div className="character-sheet-dock__detail-layout">
                <section className="character-sheet-dock__skill-panel" aria-label="技能栏">
                  <header className="character-sheet-dock__skill-panel-header">
                    <strong>技能</strong>
                    <button
                      type="button"
                      className="character-sheet-dock__skill-list-btn"
                      aria-label="打开技能点列表"
                      title="技能点列表"
                      onClick={() => setIsSkillPointListOpen((prev) => !prev)}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M2 3.5h12v1H2zm0 4h12v1H2zm0 4h12v1H2z" />
                      </svg>
                    </button>
                    {isSkillPointListOpen ? (
                      <div className="character-sheet-dock__skill-point-popover" role="dialog" aria-label="技能点列表">
                        <p>技能点列表</p>
                        <span>当前阶段留空，后续接入技能点分配与来源统计。</span>
                      </div>
                    ) : null}
                  </header>

                  <div className="character-sheet-dock__skill-list" role="list" aria-label="角色技能项列表">
                    <div className="character-sheet-dock__skill-columns-head" aria-hidden="true">
                      <span>熟练项</span>
                      <span>技能</span>
                      <span>技能加值</span>
                      <span>被动检定</span>
                    </div>

                    {coreDetailSkills.map((skill) => {
                      const computed = skillComputedMap[skill.key];
                      const adjustment = computed?.adjustment ?? 0;
                      const passive = computed?.passive ?? getPassiveCheckValue(adjustment);
                      return (
                        <article key={skill.key} className="character-sheet-dock__skill-row" role="listitem">
                          <span
                            className={`character-sheet-dock__skill-proficiency is-${skill.proficiency.toLowerCase()}`}
                            aria-label={getSkillProficiencyLabel(skill.proficiency)}
                            title={`熟练项：${getSkillProficiencyText(skill.proficiency)}`}
                          >
                            {skill.proficiency === "EXPERTISE" ? "★" : ""}
                          </span>
                          <button
                            type="button"
                            className={`character-sheet-dock__skill-name-btn ${isEditMode ? "is-editable" : "is-readonly"}`}
                            title={isEditMode ? `点击配置技能：${skill.name}` : `${skill.description}\n只读模式：请先开启编辑模式`}
                            onClick={() => handleOpenSkillConfig(skill.key)}
                            disabled={!isEditMode}
                          >
                            <span className="character-sheet-dock__skill-name">{skill.name}</span>
                          </button>
                          <span
                            className={`character-sheet-dock__skill-adjust ${adjustment >= 0 ? "is-positive" : "is-negative"}`}
                            title={computed?.tooltip}
                          >
                            {formatSignedValue(adjustment)}
                          </span>
                          <span className="character-sheet-dock__skill-passive" title={computed?.passiveTooltip}>
                            {passive}
                          </span>
                        </article>
                      );
                    })}

                    <section className={`character-sheet-dock__skill-profession-section ${isProfessionSkillGroupExpanded ? "is-expanded" : ""}`}>
                      <button
                        type="button"
                        className="character-sheet-dock__skill-profession-toggle"
                        onClick={() => setIsProfessionSkillGroupExpanded((prev) => !prev)}
                        aria-expanded={isProfessionSkillGroupExpanded}
                        aria-label="切换生活职业检定列表"
                      >
                        <span>生活职业检定</span>
                        <i>▾</i>
                      </button>

                      <div
                        className="character-sheet-dock__skill-profession-group"
                        role="list"
                        aria-label="生活职业检定列表"
                        aria-hidden={!isProfessionSkillGroupExpanded}
                      >
                        {professionDetailSkills.map((skill) => {
                          const computed = skillComputedMap[skill.key];
                          const adjustment = computed?.adjustment ?? 0;
                          const passive = computed?.passive ?? getPassiveCheckValue(adjustment);
                          return (
                            <article key={skill.key} className="character-sheet-dock__skill-row is-profession" role="listitem">
                              <span
                                className={`character-sheet-dock__skill-proficiency is-${skill.proficiency.toLowerCase()}`}
                                aria-label={getSkillProficiencyLabel(skill.proficiency)}
                                title={`熟练项：${getSkillProficiencyText(skill.proficiency)}`}
                              >
                                {skill.proficiency === "EXPERTISE" ? "★" : ""}
                              </span>
                              <button
                                type="button"
                                className={`character-sheet-dock__skill-name-btn ${isEditMode ? "is-editable" : "is-readonly"}`}
                                title={isEditMode ? `点击配置技能：${skill.name}` : `${skill.description}\n只读模式：请先开启编辑模式`}
                                onClick={() => handleOpenSkillConfig(skill.key)}
                                disabled={!isEditMode}
                              >
                                <span className="character-sheet-dock__skill-name">{skill.name}</span>
                              </button>
                              <span
                                className={`character-sheet-dock__skill-adjust ${adjustment >= 0 ? "is-positive" : "is-negative"}`}
                                title={computed?.tooltip}
                              >
                                {formatSignedValue(adjustment)}
                              </span>
                              <span className="character-sheet-dock__skill-passive" title={computed?.passiveTooltip}>
                                {passive}
                              </span>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </section>

                <section className="character-sheet-dock__detail-summary" aria-label="详情页属性与基础信息">
                  <div className="character-sheet-dock__detail-attribute-grid" aria-label="六大属性">
                    {PRIMARY_ATTRIBUTES.map((attr) => (
                      <article key={`detail-${attr.key}`} className="character-sheet-dock__combat-card is-attribute">
                        <button
                          type="button"
                          className="character-sheet-dock__editable-label"
                          onClick={() => handleEditableFieldClick(attr.key)}
                          title={isEditMode ? `点击编辑${attr.label}（功能待接入）` : `${attr.label}当前只读`}
                          aria-label={`编辑${attr.label}`}
                        >
                          {attr.label}
                        </button>
                        <div className="character-sheet-dock__attribute-value-row">
                          <div className="character-sheet-dock__attribute-badge is-adjustment" title={`来自${attr.label}属性值：(${attr.value}-10)/2`}>
                            <span>调整</span>
                            <b>{formatSignedValue(getAttributeAdjustment(attr.value))}</b>
                          </div>
                          <strong>{attr.value}</strong>
                          <div className="character-sheet-dock__attribute-badge is-save" title={`来自${attr.label}豁免：沿用${attr.label}调整值`}>
                            <span>豁免</span>
                            <b>{formatSignedValue(getAttributeAdjustment(attr.value))}</b>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="character-sheet-dock__detail-meta-grid">
                    <div className="character-sheet-dock__detail-meta-column">
                      <article className="character-sheet-dock__detail-mini-card">
                        <p>熟练加值</p>
                        <strong title={`来自角色等级：当前熟练加值为${formatSignedValue(proficiencyBonus)}`}>{formatSignedValue(proficiencyBonus)}</strong>
                      </article>
                      <article className="character-sheet-dock__detail-mini-card">
                        <p>专注</p>
                        <strong>+0</strong>
                      </article>
                    </div>

                    <div className="character-sheet-dock__detail-meta-column">
                      <article className="character-sheet-dock__detail-mini-card">
                        <p>种族</p>
                        <strong>人类</strong>
                      </article>
                      <article className="character-sheet-dock__detail-mini-card">
                        <p>体型 / 生物类型</p>
                        <strong>中型 · 类人生物</strong>
                      </article>
                    </div>
                  </div>

                  <article className="character-sheet-dock__detail-move-card">
                    <p>移动与跳跃</p>
                    <div className="character-sheet-dock__detail-move-grid" role="list" aria-label="移动速度与跳跃占位">
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>步行速度</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>飞行速度</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>游泳速度</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>掘穴速度</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>攀爬速度</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>跳远</span>
                        <strong>占位</strong>
                      </div>
                      <div className="character-sheet-dock__detail-move-item" role="listitem">
                        <span>跳高</span>
                        <strong>占位</strong>
                      </div>
                    </div>
                  </article>
                </section>

                {activeSkillConfig ? (
                  <div className="character-sheet-dock__skill-config-mask" role="presentation" onClick={handleCloseSkillConfig}>
                    <article className="character-sheet-dock__skill-config-modal" role="dialog" aria-label={`配置技能 ${activeSkillConfig.name}`} onClick={(event) => event.stopPropagation()}>
                      <header className="character-sheet-dock__skill-config-header">
                        <strong>{activeSkillConfig.name} 配置</strong>
                        <button type="button" onClick={handleCloseSkillConfig} aria-label="关闭技能配置弹窗">关闭</button>
                      </header>

                      <div className="character-sheet-dock__skill-config-body">
                        <label className="character-sheet-dock__skill-config-field">
                          <span>关联属性</span>
                          <select
                            value={activeSkillConfig.linkedAttributeKey ?? ""}
                            disabled={!isEditMode}
                            onChange={(event) => handleSkillLinkedAttributeChange(activeSkillConfig.key, event.target.value)}
                          >
                            <option value="">无</option>
                            {SKILL_ATTRIBUTE_OPTIONS.map((item) => (
                              <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                          </select>
                        </label>

                        <div className="character-sheet-dock__skill-config-field">
                          <span>熟练项（三选一）</span>
                          <div className="character-sheet-dock__skill-proficiency-options">
                            <label>
                              <input
                                type="checkbox"
                                checked={activeSkillConfig.proficiency === "NONE"}
                                disabled={!isEditMode}
                                onChange={() => handleSkillProficiencyChange(activeSkillConfig.key, "NONE")}
                              />
                              <span>无</span>
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={activeSkillConfig.proficiency === "PROFICIENT"}
                                disabled={!isEditMode}
                                onChange={() => handleSkillProficiencyChange(activeSkillConfig.key, "PROFICIENT")}
                              />
                              <span>熟练</span>
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={activeSkillConfig.proficiency === "EXPERTISE"}
                                disabled={!isEditMode}
                                onChange={() => handleSkillProficiencyChange(activeSkillConfig.key, "EXPERTISE")}
                              />
                              <span>专精</span>
                            </label>
                          </div>
                        </div>

                        <label className="character-sheet-dock__skill-config-field">
                          <span>常驻调整值（可输入）</span>
                          <input
                            type="text"
                            value={activeSkillConfig.permanentCustomAdjustmentText}
                            placeholder="例如：+pb+3"
                            disabled={!isEditMode}
                            onChange={(event) => handleSkillPermanentCustomChange(activeSkillConfig.key, event.target.value)}
                          />
                          <small>当前常驻合并：{skillComputedMap[activeSkillConfig.key]?.permanentExpression || "无"}</small>
                        </label>

                        <label className="character-sheet-dock__skill-config-field">
                          <span>临时调整值（可输入）</span>
                          <input
                            type="text"
                            value={activeSkillConfig.temporaryCustomAdjustmentText}
                            placeholder="例如：+2"
                            disabled={!isEditMode}
                            onChange={(event) => handleSkillTemporaryCustomChange(activeSkillConfig.key, event.target.value)}
                          />
                          <small>当前总合并：{skillComputedMap[activeSkillConfig.key]?.totalExpression || "无"}</small>
                        </label>

                        <p className="character-sheet-dock__skill-config-hint">
                          来源预览：{skillComputedMap[activeSkillConfig.key]?.autoSourceText || "暂无来源"}
                        </p>
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            ) : activeTab === "CLASS" ? (
              <div className="character-sheet-dock__class-layout" aria-label="职业等级页面">
                <div className="character-sheet-dock__class-grid" role="list" aria-label="职业等级列表">
                  {CHARACTER_CLASS_LEVEL_ITEMS.map((classItem) => (
                    <article key={classItem.id} className="character-sheet-dock__class-card" role="listitem">
                      <strong>{classItem.name}</strong>
                      <span>{classItem.level}级</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : activeTab === "EQUIPMENT" ? (
              <div className="character-sheet-dock__equipment-layout">
                <section className="character-sheet-dock__equipment-left" aria-label="装备栏与角色展示">
                  <div className="character-sheet-dock__equipment-ring" role="group" aria-label="装备槽环绕区">
                    <div className="character-sheet-dock__equipment-ring-grid">
                      {EQUIPMENT_RING_SLOTS.map((slot) => (
                        <button
                          key={slot.key}
                          type="button"
                          className={`character-sheet-dock__equipment-slot ${slot.positionClass}`}
                          title={slot.hint}
                          aria-label={`${slot.label}槽：${slot.hint}`}
                        >
                          <span>{slot.label}</span>
                          <i>空槽</i>
                        </button>
                      ))}

                      <article className="character-sheet-dock__equipment-avatar" aria-label="人物展示区域">
                        <strong>人物展示</strong>
                      </article>
                    </div>
                  </div>

                  <div className="character-sheet-dock__equipment-hand-row" role="group" aria-label="双手槽位">
                    <button
                      type="button"
                      className="character-sheet-dock__hand-slot"
                      title="左手槽位"
                      aria-label="左手槽位"
                    >
                      <span>左手</span>
                      <i>空槽</i>
                    </button>
                    <button
                      type="button"
                      className="character-sheet-dock__hand-slot"
                      title="右手槽位"
                      aria-label="右手槽位"
                    >
                      <span>右手</span>
                      <i>空槽</i>
                    </button>
                  </div>

                  <div className="character-sheet-dock__treasure-inline" aria-label="宝物槽区域">
                    <div className="character-sheet-dock__treasure-grid" role="list">
                      {Array.from({ length: DEFAULT_TREASURE_SLOT_COUNT }).map((_, index) => (
                        <button
                          key={`treasure-${index + 1}`}
                          type="button"
                          className="character-sheet-dock__treasure-slot"
                          role="listitem"
                          aria-label={`宝物槽${index + 1}`}
                        >
                          <span>宝物 {index + 1}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="character-sheet-dock__treasure-slot is-expand"
                        role="listitem"
                        aria-label="扩展宝物槽占位"
                        title="扩展宝物槽"
                      >
                        <span>+ 扩展位</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section className="character-sheet-dock__equipment-right" aria-label="装备数据详解区">
                  {EQUIPMENT_QUICK_SECTION_ORDER.map((sectionKey) => {
                    const sectionLabel = EQUIPMENT_QUICK_SECTION_LABELS[sectionKey];
                    const sectionPool = EQUIPMENT_QUICK_VIEW_POOLS[sectionKey];
                    const watchIds = equipmentQuickWatchlist[sectionKey];
                    const watchedItems = watchIds
                      .map((watchId) => sectionPool.find((item) => item.id === watchId))
                      .filter((item): item is EquipmentQuickViewItem => Boolean(item));
                    const availableItems = sectionPool.filter((item) => !watchIds.includes(item.id));
                    const isExpanded = equipmentQuickExpanded[sectionKey];

                    return (
                      <article
                        key={sectionKey}
                        className={`character-sheet-dock__equipment-quick-section ${isExpanded ? "is-expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="character-sheet-dock__equipment-quick-header"
                          onClick={() => toggleEquipmentQuickSection(sectionKey)}
                          aria-expanded={isExpanded}
                          aria-label={`切换${sectionLabel}快速查看列表`}
                        >
                          <strong>{sectionLabel}</strong>
                          <span className="character-sheet-dock__equipment-quick-count">{watchedItems.length}</span>
                          <i aria-hidden="true">▾</i>
                        </button>

                        {isExpanded ? (
                          <div className="character-sheet-dock__equipment-quick-body">
                            <div className="character-sheet-dock__equipment-quick-list" role="list" aria-label={`${sectionLabel}关注列表`}>
                              {watchedItems.length > 0 ? (
                                watchedItems.map((item) => (
                                  <article key={item.id} className="character-sheet-dock__equipment-quick-item" role="listitem">
                                    <div className="character-sheet-dock__equipment-quick-item-head">
                                      <strong className="character-sheet-dock__equipment-quick-item-name">{item.name}</strong>
                                      <button
                                        type="button"
                                        className="character-sheet-dock__equipment-quick-remove-btn"
                                        onClick={() => handleRemoveEquipmentQuickItem(sectionKey, item.id)}
                                        aria-label={`从${sectionLabel}关注区移除${item.name}`}
                                      >
                                        移除
                                      </button>
                                    </div>
                                    <div className="character-sheet-dock__equipment-quick-item-meta">
                                      <span>{item.damage}</span>
                                      <span>{item.usage}</span>
                                      <span>x{item.count}</span>
                                      {item.equipped ? (
                                        <span className="character-sheet-dock__equipment-quick-tag is-equipped">已装备</span>
                                      ) : null}
                                      {item.equipped && item.equippedHand ? (
                                        <span className="character-sheet-dock__equipment-quick-tag is-hand">
                                          {getEquipmentHandLabel(item.equippedHand)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </article>
                                ))
                              ) : (
                                <p className="character-sheet-dock__equipment-quick-empty">暂无关注条目</p>
                              )}
                            </div>

                            <div className="character-sheet-dock__equipment-quick-add-row" aria-label={`${sectionLabel}可添加条目`}>
                              {availableItems.length > 0 ? (
                                availableItems.map((item) => (
                                  <button
                                    key={`add-${item.id}`}
                                    type="button"
                                    className="character-sheet-dock__equipment-quick-add-btn"
                                    onClick={() => handleAddEquipmentQuickItem(sectionKey, item.id)}
                                    aria-label={`添加${item.name}到${sectionLabel}关注区`}
                                  >
                                    + {item.name}
                                  </button>
                                ))
                              ) : (
                                <span className="character-sheet-dock__equipment-quick-empty is-compact">已全部添加</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              </div>
            ) : activeTab === "STATUS" ? (
              <div className="character-sheet-dock__status-layout" aria-label="状态页面四分区">
                {STATUS_SECTIONS.map((section) => (
                  <section
                    key={section.key}
                    className={`character-sheet-dock__status-section ${section.isFixed ? "is-fixed" : "is-runtime"}`}
                    aria-label={`${section.label}区域`}
                  >
                    <header className="character-sheet-dock__status-section-header">
                      <strong>{section.label}</strong>
                      <span>{section.isFixed ? "固定" : "临时"}</span>
                    </header>
                    <div className="character-sheet-dock__status-section-body">
                      <p>{section.hint}</p>
                    </div>
                  </section>
                ))}
              </div>
            ) : activeTab === "TALENTS" ? (
              <div className="character-sheet-dock__talent-layout" aria-label="天赋页面三栏">
                <div className="character-sheet-dock__talent-columns">
                  {TALENT_COLUMN_ORDER.map((columnKey) => {
                    const config = TALENT_COLUMN_CONFIGS[columnKey];
                    const trees = learnedTalentTrees[columnKey];
                    const occupiedPoints = trees.reduce((sum, tree) => sum + tree.spentPoints, 0);

                    return (
                      <section key={columnKey} className="character-sheet-dock__talent-column" aria-label={`${config.title}区域`}>
                        <header className="character-sheet-dock__talent-column-header">
                          <strong>{config.title}</strong>
                          <p>{config.pointLabel}</p>
                          <span>已占用 {occupiedPoints} / 总点数 {config.totalPoints}</span>
                        </header>

                        <div className="character-sheet-dock__talent-slot-list" role="list" aria-label={`${config.title}槽位列表`}>
                          {trees.map((tree) => (
                            <article key={tree.id} className="character-sheet-dock__talent-slot" role="listitem">
                              <strong>{tree.name}</strong>
                              <p>已消耗：{tree.spentPoints}点</p>
                              <p>解锁节点：{tree.unlockedNodes}/{tree.totalNodes}</p>
                            </article>
                          ))}

                          <button
                            type="button"
                            className="character-sheet-dock__talent-add-slot"
                            onClick={() => handleOpenTalentList(columnKey)}
                            aria-label={config.addLabel}
                          >
                            + {config.addLabel}
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>

                {activeTalentListColumn ? (
                  <div className="character-sheet-dock__talent-modal-backdrop" role="presentation">
                    <article className="character-sheet-dock__talent-modal" role="dialog" aria-label="选择天赋树">
                      <header className="character-sheet-dock__talent-modal-header">
                        <strong>{TALENT_COLUMN_CONFIGS[activeTalentListColumn].title}列表</strong>
                        <button type="button" onClick={handleCloseTalentList} aria-label="关闭天赋树列表">关闭</button>
                      </header>

                      <div className="character-sheet-dock__talent-modal-list" role="list" aria-label="可学习天赋树列表">
                        {activeTalentTreeList.map((tree) => (
                          <button
                            key={tree.id}
                            type="button"
                            role="listitem"
                            className="character-sheet-dock__talent-modal-item"
                            onClick={() => handleSelectTalentTemplate(activeTalentListColumn, tree)}
                            aria-label={`选择${tree.name}`}
                          >
                            <strong>{tree.name}</strong>
                            <span>总节点：{tree.totalNodes}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  </div>
                ) : null}

                {pendingTalentSelection ? (
                  <div className="character-sheet-dock__talent-modal-backdrop" role="presentation">
                    <article className="character-sheet-dock__talent-modal is-learning" role="dialog" aria-label="学习天赋树窗口">
                      <header className="character-sheet-dock__talent-modal-header">
                        <strong>{pendingTalentSelection.columnKey === "SKILL" ? "升级技能" : "学习天赋树"}</strong>
                        <button type="button" onClick={handleCloseTalentLearning} aria-label="关闭学习窗口">关闭</button>
                      </header>

                      <div className="character-sheet-dock__talent-learning-body">
                        <p>名称：{pendingTalentSelection.template.name}</p>
                        <p>总节点：{pendingTalentSelection.template.totalNodes}</p>
                        <p>学习后将在对应栏位生成天赋槽，并记录消耗与解锁节点。</p>
                      </div>

                      <div className="character-sheet-dock__talent-learning-actions">
                        <button type="button" onClick={handleCloseTalentLearning}>取消</button>
                        <button type="button" onClick={handleConfirmTalentLearning}>
                          {pendingTalentSelection.columnKey === "SKILL" ? "确认升级" : "确认学习"}
                        </button>
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            ) : activeCollectionTabKey && activeCollectionConfig ? (
              <div className="character-sheet-dock__items-layout">
                <nav className="character-sheet-dock__items-category-bar" aria-label={`${activeTabConfig.label}分类切换`}>
                  {activeCollectionConfig.categories.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      className={`character-sheet-dock__items-category-btn ${activeCollectionCategoryKey === category.key ? "is-active" : ""}`}
                      onClick={() => handleCollectionCategoryChange(activeCollectionTabKey, category.key)}
                      aria-label={`切换到${category.label}`}
                    >
                      {category.label}
                    </button>
                  ))}
                </nav>

                <div className="character-sheet-dock__items-columns">
                  <section className="character-sheet-dock__items-column" aria-label={`${activeTabConfig.label}左栏`}>
                    <div className="character-sheet-dock__items-column-list" role="list" aria-label={`${activeTabConfig.label}左栏条目`}>
                      {activeCollectionColumns.left.length > 0 ? (
                        activeCollectionColumns.left.map((item) => (
                          <article key={item.id} className="character-sheet-dock__items-entry" role="listitem">
                            <div className="character-sheet-dock__items-entry-head">
                              <strong>{item.name}</strong>
                              <span>x{item.count}</span>
                            </div>
                            <div className="character-sheet-dock__items-entry-meta">
                              <span>{item.info}</span>
                              <span>{item.usage}</span>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="character-sheet-dock__items-empty">暂无条目</p>
                      )}
                    </div>
                  </section>

                  <section className="character-sheet-dock__items-column" aria-label={`${activeTabConfig.label}右栏`}>
                    <div className="character-sheet-dock__items-column-list" role="list" aria-label={`${activeTabConfig.label}右栏条目`}>
                      {activeCollectionColumns.right.length > 0 ? (
                        activeCollectionColumns.right.map((item) => (
                          <article key={item.id} className="character-sheet-dock__items-entry" role="listitem">
                            <div className="character-sheet-dock__items-entry-head">
                              <strong>{item.name}</strong>
                              <span>x{item.count}</span>
                            </div>
                            <div className="character-sheet-dock__items-entry-meta">
                              <span>{item.info}</span>
                              <span>{item.usage}</span>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="character-sheet-dock__items-empty">暂无条目</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="character-sheet-dock__secondary-placeholder">
                <p>{activeTabConfig.placeholder}</p>
                <p>当前阶段为展示占位，后续逐步接入编辑与计算。</p>
              </div>
            )}
          </section>

          <nav className="character-sheet-dock__bookmark-stack" aria-label="角色卡页签">
            {CHARACTER_SHEET_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`character-sheet-dock__bookmark ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
                aria-label={tab.label}
              >
                <span className="character-sheet-dock__bookmark-icon" aria-hidden="true">
                  {tab.iconImageUrl ? (
                    <img src={tab.iconImageUrl} alt="" loading="lazy" />
                  ) : (
                    tab.iconText
                  )}
                </span>
                <i>{tab.label}</i>
              </button>
            ))}
          </nav>
        </section>
      </section>
    </section>
  );
}
