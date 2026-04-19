import { PlatformRole, Prisma, WorldMemberStatus, WorldRole, WorldVisibility } from "@prisma/client";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

type CreateWorldInput = {
  ownerId: string;
  name: string;
  description?: string;
  visibility: WorldVisibility;
  password?: string;
  coverImageDataUrl?: string;
};

export type WorldMemberManageRole = "PLAYER" | "ASSISTANT" | "OBSERVER" | "GM";

export type WorldMemberManageMember = {
  userId: string;
  username: string;
  accountDisplayName: string | null;
  worldDisplayName: string | null;
  role: WorldMemberManageRole;
  joinedAt: string;
  boundCharacterId: string | null;
  boundCharacterName: string | null;
};

export type WorldMemberManageCharacter = {
  id: string;
  name: string;
  type: "PC" | "NPC";
  userId: string | null;
};

export type WorldMemberManageData = {
  members: WorldMemberManageMember[];
  characters: WorldMemberManageCharacter[];
  roleOptions: WorldMemberManageRole[];
};

export type UpdateWorldMemberManageInput = {
  worldDisplayName?: string | null;
  role?: unknown;
  boundCharacterId?: string | null;
};

const COVER_FILE_PREFIX = "cover.";
const BACKEND_TEMPLATE_WORLD_INVITE_CODE = "system-backend-template-world";
const BACKEND_TEMPLATE_WORLD_NAME = "后台模板世界";
const BACKEND_TEMPLATE_WORLD_DESCRIPTION = "用于核心资源录入、规则回归与自动化结算验收的系统后台模板世界。";
const WORLD_MEMBER_MANAGE_ROLE_OPTIONS: WorldMemberManageRole[] = ["PLAYER", "ASSISTANT", "OBSERVER", "GM"];
const CORE_TEMPLATE_ABILITY_IDS = {
  guardianReaction: "tmpl_ability_guardian_reaction",
  arcaneBolt: "tmpl_ability_arcane_bolt",
  healingLight: "tmpl_ability_healing_light",
  battleFocus: "tmpl_ability_battle_focus"
} as const;
const CORE_TEMPLATE_ITEM_IDS = {
  trainingBlade: "tmpl_item_training_blade",
  travellerPotion: "tmpl_item_traveller_potion",
  sigilCompass: "tmpl_item_sigil_compass"
} as const;

type WorldDbClient = typeof prisma | Prisma.TransactionClient;

export type WorldRosterMember = {
  userId: string;
  username: string;
  accountDisplayName: string | null;
  worldDisplayName: string | null;
  role: WorldMemberManageRole;
  boundCharacterId: string | null;
  boundCharacterName: string | null;
};

function cloneJsonValue<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function toRequiredJsonInput(value: unknown, fallback: Prisma.InputJsonValue = []): Prisma.InputJsonValue {
  if (typeof value === "undefined" || value === null) {
    return cloneJsonValue(fallback) as Prisma.InputJsonValue;
  }
  return cloneJsonValue(value) as Prisma.InputJsonValue;
}

function toOptionalJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return cloneJsonValue(value) as Prisma.InputJsonValue;
}

async function getBackendTemplateWorld(db: WorldDbClient = prisma) {
  return db.world.findUnique({
    where: { inviteCode: BACKEND_TEMPLATE_WORLD_INVITE_CODE },
    select: {
      id: true,
      ownerId: true
    }
  });
}

async function ensureBackendTemplateWorldStarterResources(worldId: string, db: WorldDbClient = prisma) {
  const abilityCount = await db.abilityDefinition.count({ where: { worldId } });
  if (abilityCount > 0) {
    return;
  }

  await db.abilityDefinition.createMany({
    data: [
      {
        id: CORE_TEMPLATE_ABILITY_IDS.guardianReaction,
        worldId,
        name: "守护反应",
        category: "feature",
        source: "profession",
        sourceName: "战士",
        activation: "reaction",
        actionType: "reaction",
        description: "当你即将受到一次攻击时，以反应姿态为自己叠加防护。",
        rulesText: "受到攻击时触发，直到本次攻击结算结束前获得 AC +10。",
        tags: ["防御", "反应", "姿态"],
        levelReq: 1,
        resourceCosts: [{ type: "stamina", amount: 1, label: "技力" }],
        duration: "special",
        checkType: "none",
        trigger: {
          timing: "onAttackHit",
          condition: {
            type: "compare",
            field: "metadata.eventName",
            operator: "==",
            value: "attack:incoming"
          }
        },
        effects: [
          {
            type: "modifyAC",
            target: "self",
            value: 10,
            duration: "special",
            label: "守护反应"
          }
        ],
        reactionStrat: "always-ask",
        sortOrder: 10
      },
      {
        id: CORE_TEMPLATE_ABILITY_IDS.arcaneBolt,
        worldId,
        name: "奥术光矢",
        category: "spell",
        source: "profession",
        sourceName: "魔法师",
        activation: "active",
        actionType: "standard",
        description: "发射一束稳定的奥术弹体，对目标造成力场伤害。",
        rulesText: "进行一次法术攻击，命中后造成 1d8 力场伤害。",
        tags: ["法术", "远程", "伤害"],
        levelReq: 1,
        range: "60",
        resourceCosts: [{ type: "mp", amount: 2, label: "魔力值" }],
        duration: "instantaneous",
        checkType: "attack",
        attackAttr: "intelligence",
        damageRolls: [{ dice: "1d8", damageType: "force" }],
        effects: [],
        spellLevel: 0,
        spellSchool: "奥术",
        spellComps: { verbal: true, somatic: true },
        sortOrder: 20
      },
      {
        id: CORE_TEMPLATE_ABILITY_IDS.healingLight,
        worldId,
        name: "治愈微光",
        category: "spell",
        source: "profession",
        sourceName: "祭司",
        activation: "active",
        actionType: "standard",
        description: "呼唤温和的星辉，为同伴恢复生命。",
        rulesText: "目标恢复 1d8+3 点生命值。",
        tags: ["法术", "治疗", "支援"],
        levelReq: 1,
        range: "30",
        resourceCosts: [{ type: "mp", amount: 3, label: "魔力值" }],
        duration: "instantaneous",
        checkType: "none",
        effects: [
          {
            type: "heal",
            target: "target",
            value: "roll(\"1d8\") + 3",
            label: "治愈微光"
          }
        ],
        spellLevel: 1,
        spellSchool: "神圣",
        spellComps: { verbal: true, somatic: true },
        sortOrder: 30
      },
      {
        id: CORE_TEMPLATE_ABILITY_IDS.battleFocus,
        worldId,
        name: "战斗专注",
        category: "feature",
        source: "profession",
        sourceName: "骑士",
        activation: "active",
        actionType: "quick",
        description: "将气息稳定到战斗节奏中，提高命中与专注。",
        rulesText: "自身获得命中修正与 AC 微量提升，持续 1 轮。",
        tags: ["增益", "姿态", "战斗"],
        levelReq: 1,
        resourceCosts: [{ type: "fury", amount: 1, label: "战意" }],
        duration: "rounds",
        durationValue: 1,
        checkType: "none",
        effects: [
          {
            type: "applyState",
            target: "self",
            value: "battle-focus",
            duration: "rounds",
            durationValue: 1,
            label: "战斗专注"
          },
          {
            type: "modifyAC",
            target: "self",
            value: 2,
            duration: "rounds",
            durationValue: 1,
            label: "战斗专注护甲"
          }
        ],
        sortOrder: 40
      }
    ]
  });

  await db.raceDefinition.create({
    data: {
      id: "tmpl_race_human",
      worldId,
      name: "人类",
      description: "遍布艾尔泽兰特各地、最擅长适应与远行的冒险者。",
      loreText: "人类在苍穹纪元的冒险浪潮中最先组成跨国远征队。",
      attrBonus: [
        { type: "choice", amount: 2 },
        { type: "choice", amount: 1 }
      ],
      size: "medium",
      speed: 30,
      darkvision: 0,
      creatureType: "humanoid",
      languages: ["通用语"],
      ageDesc: "寿命短于长生种，但拥有极强的时代适应力。",
      traits: [
        {
          id: "tmpl_race_human_trait_adapt",
          name: "适应力",
          description: "获得一项额外熟练，并更容易接受多职业成长。"
        }
      ],
      subtypes: []
    }
  });

  await db.professionDefinition.createMany({
    data: [
      {
        id: "tmpl_profession_warrior",
        worldId,
        name: "战士",
        description: "以稳定站场与多段攻击著称的前线职业。",
        loreText: "王道冒险队中最可靠的前锋。",
        type: "combat",
        hitDie: "1d10",
        primaryAttribute: "strength",
        saveProficiencies: ["strength", "constitution"],
        armorProficiencies: ["轻甲", "中甲", "重甲", "盾牌"],
        weaponProficiencies: ["军用武器", "简易武器"],
        toolProficiencies: [],
        skillChoices: { count: 2, options: ["运动", "察觉", "威吓", "生存"] },
        startingEquipment: [CORE_TEMPLATE_ITEM_IDS.trainingBlade, CORE_TEMPLATE_ITEM_IDS.travellerPotion],
        levelFeatures: [
          {
            level: 1,
            features: ["守护反应"],
            linkedAbilityIds: [CORE_TEMPLATE_ABILITY_IDS.guardianReaction],
            hpIncrease: "1d10+体质"
          },
          {
            level: 2,
            features: ["战斗专注"],
            linkedAbilityIds: [CORE_TEMPLATE_ABILITY_IDS.battleFocus],
            furyIncrease: 1
          }
        ],
        talentTreeIds: []
      },
      {
        id: "tmpl_profession_mage",
        worldId,
        name: "魔法师",
        description: "依靠法术压制场面的奥术施法者。",
        loreText: "旅团中的远程火力与知识担当。",
        type: "combat",
        hitDie: "1d6",
        primaryAttribute: "intelligence",
        saveProficiencies: ["intelligence", "wisdom"],
        armorProficiencies: [],
        weaponProficiencies: ["法杖", "匕首"],
        toolProficiencies: [],
        skillChoices: { count: 2, options: ["奥秘", "调查", "通识", "洞悉"] },
        startingEquipment: [CORE_TEMPLATE_ITEM_IDS.sigilCompass],
        spellcastingAttr: "intelligence",
        levelFeatures: [
          {
            level: 1,
            features: ["奥术光矢"],
            linkedAbilityIds: [CORE_TEMPLATE_ABILITY_IDS.arcaneBolt],
            hpIncrease: "1d6+体质",
            mpIncrease: 3
          }
        ],
        talentTreeIds: []
      }
    ]
  });

  await db.backgroundDefinition.create({
    data: {
      id: "tmpl_background_adventurer",
      worldId,
      name: "冒险者",
      description: "你习惯在未知地图、遗迹与任务之间穿梭。",
      loreText: "公会、旧大陆远征队与各国委托构成了你的日常。",
      skillPoints: 2,
      bonusLanguages: 1,
      toolProficiencies: ["野营工具"],
      startingEquipment: [CORE_TEMPLATE_ITEM_IDS.travellerPotion],
      features: [
        {
          name: "行旅经验",
          description: "在世界舞台中更容易通过探索与交涉推进事件。"
        }
      ]
    }
  });

  await db.itemDefinition.createMany({
    data: [
      {
        id: CORE_TEMPLATE_ITEM_IDS.trainingBlade,
        worldId,
        name: "训练长剑",
        description: "给新团员上手测试用的标准化训练武器。",
        category: "weapon",
        rarity: "common",
        weight: 3,
        price: 15,
        stackable: false,
        weaponProps: {
          attackType: "melee",
          damageType: "slashing",
          damageDice: "1d8",
          properties: ["多用"],
          attackAttribute: "strength"
        },
        tags: ["训练", "武器"]
      },
      {
        id: CORE_TEMPLATE_ITEM_IDS.travellerPotion,
        worldId,
        name: "旅团回复药",
        description: "在冒险途中快速恢复体力的基础药剂。",
        category: "potion",
        rarity: "common",
        weight: 0.2,
        price: 25,
        stackable: true,
        maxStack: 10,
        tags: ["恢复", "消耗品"]
      },
      {
        id: CORE_TEMPLATE_ITEM_IDS.sigilCompass,
        worldId,
        name: "符纹罗盘",
        description: "记录遗迹路线与场景方位的魔导工具。",
        category: "tool",
        rarity: "uncommon",
        weight: 1,
        price: 120,
        stackable: false,
        enchantments: [
          {
            name: "路标共鸣",
            description: "在探索场景时提升方向感与回溯效率。"
          }
        ],
        tags: ["探索", "工具"]
      }
    ]
  });

  await db.deckDefinition.create({
    data: {
      id: "tmpl_deck_tavern_event",
      worldId,
      name: "王道冒险邂逅牌堆",
      description: "用于快速生成旅途中发生的轻量事件。",
      cards: [
        {
          id: "tmpl_deck_tavern_event_card_1",
          name: "空港委托",
          description: "接到一份前往旧大陆遗迹的短期委托。",
          weight: 3
        },
        {
          id: "tmpl_deck_tavern_event_card_2",
          name: "路边商旅",
          description: "商旅请求你们护送一段路程，并交换情报。",
          weight: 2,
          linkedItemId: CORE_TEMPLATE_ITEM_IDS.sigilCompass
        }
      ],
      replacement: true,
      drawnHistory: []
    }
  });

  await db.randomTable.create({
    data: {
      id: "tmpl_random_table_field_drop",
      worldId,
      name: "旅途拾遗表",
      description: "野外探索时可快速掷出的基础掉落表。",
      diceFormula: "1d6",
      entries: [
        { rangeMin: 1, rangeMax: 2, result: "回复药", linkedItemId: CORE_TEMPLATE_ITEM_IDS.travellerPotion },
        { rangeMin: 3, rangeMax: 4, result: "训练长剑", linkedItemId: CORE_TEMPLATE_ITEM_IDS.trainingBlade },
        { rangeMin: 5, rangeMax: 6, result: "发现符纹线索", linkedAbilityId: CORE_TEMPLATE_ABILITY_IDS.arcaneBolt }
      ]
    }
  });
}

function remapRaceTraits(rawTraits: unknown, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawTraits)) {
    return rawTraits;
  }

  return rawTraits.map((trait) => {
    if (!trait || typeof trait !== "object") {
      return trait;
    }
    const record = { ...(trait as Record<string, unknown>) };
    if (typeof record.linkedAbilityId === "string" && abilityIdMap.has(record.linkedAbilityId)) {
      record.linkedAbilityId = abilityIdMap.get(record.linkedAbilityId)!;
    }
    return record;
  });
}

function remapRaceSubtypes(rawSubtypes: unknown, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawSubtypes)) {
    return rawSubtypes;
  }

  return rawSubtypes.map((subtype) => {
    if (!subtype || typeof subtype !== "object") {
      return subtype;
    }

    const record = { ...(subtype as Record<string, unknown>) };
    record.traits = remapRaceTraits(record.traits, abilityIdMap);
    return record;
  });
}

function remapProfessionLevelFeatures(rawLevelFeatures: unknown, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawLevelFeatures)) {
    return rawLevelFeatures;
  }

  return rawLevelFeatures.map((feature) => {
    if (!feature || typeof feature !== "object") {
      return feature;
    }

    const record = { ...(feature as Record<string, unknown>) };
    if (Array.isArray(record.linkedAbilityIds)) {
      record.linkedAbilityIds = record.linkedAbilityIds.map((item) =>
        typeof item === "string" && abilityIdMap.has(item) ? abilityIdMap.get(item)! : item
      );
    }
    return record;
  });
}

function remapBackgroundFeatures(rawFeatures: unknown, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawFeatures)) {
    return rawFeatures;
  }

  return rawFeatures.map((feature) => {
    if (!feature || typeof feature !== "object") {
      return feature;
    }

    const record = { ...(feature as Record<string, unknown>) };
    if (typeof record.linkedAbilityId === "string" && abilityIdMap.has(record.linkedAbilityId)) {
      record.linkedAbilityId = abilityIdMap.get(record.linkedAbilityId)!;
    }
    return record;
  });
}

function remapItemEnchantments(rawEnchantments: unknown, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawEnchantments)) {
    return rawEnchantments;
  }

  return rawEnchantments.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }

    const record = { ...(entry as Record<string, unknown>) };
    if (typeof record.linkedAbilityId === "string" && abilityIdMap.has(record.linkedAbilityId)) {
      record.linkedAbilityId = abilityIdMap.get(record.linkedAbilityId)!;
    }
    return record;
  });
}

function remapDeckCards(rawCards: unknown, itemIdMap: Map<string, string>) {
  if (!Array.isArray(rawCards)) {
    return rawCards;
  }

  return rawCards.map((card) => {
    if (!card || typeof card !== "object") {
      return card;
    }

    const record = { ...(card as Record<string, unknown>) };
    if (typeof record.linkedItemId === "string" && itemIdMap.has(record.linkedItemId)) {
      record.linkedItemId = itemIdMap.get(record.linkedItemId)!;
    }
    return record;
  });
}

function remapRandomTableEntries(rawEntries: unknown, itemIdMap: Map<string, string>, abilityIdMap: Map<string, string>) {
  if (!Array.isArray(rawEntries)) {
    return rawEntries;
  }

  return rawEntries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }

    const record = { ...(entry as Record<string, unknown>) };
    if (typeof record.linkedItemId === "string" && itemIdMap.has(record.linkedItemId)) {
      record.linkedItemId = itemIdMap.get(record.linkedItemId)!;
    }
    if (typeof record.linkedAbilityId === "string" && abilityIdMap.has(record.linkedAbilityId)) {
      record.linkedAbilityId = abilityIdMap.get(record.linkedAbilityId)!;
    }
    return record;
  });
}

async function cloneBackendTemplateResources(sourceWorldId: string, targetWorldId: string, db: WorldDbClient) {
  const [abilities, races, professions, backgrounds, items, decks, randomTables, talentInstances] = await Promise.all([
    db.abilityDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.raceDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.professionDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.backgroundDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.itemDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.deckDefinition.findMany({ where: { worldId: sourceWorldId } }),
    db.randomTable.findMany({ where: { worldId: sourceWorldId } }),
    db.worldTalentTreeInstance.findMany({ where: { worldId: sourceWorldId } })
  ]);

  const abilityIdMap = new Map<string, string>();
  for (const ability of abilities) {
    const created = await db.abilityDefinition.create({
      data: {
        worldId: targetWorldId,
        name: ability.name,
        category: ability.category,
        source: ability.source,
        sourceName: ability.sourceName,
        activation: ability.activation,
        actionType: ability.actionType,
        description: ability.description,
        rulesText: ability.rulesText,
        iconUrl: ability.iconUrl,
        tags: toRequiredJsonInput(ability.tags),
        levelReq: ability.levelReq,
        range: ability.range,
        aoeShape: ability.aoeShape,
        aoeSize: ability.aoeSize,
        resourceCosts: toRequiredJsonInput(ability.resourceCosts),
        cooldown: toOptionalJsonInput(ability.cooldown),
        duration: ability.duration,
        durationValue: ability.durationValue,
        concentration: ability.concentration,
        checkType: ability.checkType,
        attackAttr: ability.attackAttr,
        saveDC: toOptionalJsonInput(ability.saveDC),
        damageRolls: toOptionalJsonInput(ability.damageRolls),
        trigger: toOptionalJsonInput(ability.trigger),
        effects: toRequiredJsonInput(ability.effects),
        reactionStrat: ability.reactionStrat,
        spellLevel: ability.spellLevel,
        spellSchool: ability.spellSchool,
        spellComps: toOptionalJsonInput(ability.spellComps),
        canUpcast: ability.canUpcast,
        upcastEffect: ability.upcastEffect,
        sortOrder: ability.sortOrder
      },
      select: { id: true }
    });
    abilityIdMap.set(ability.id, created.id);
  }

  const itemIdMap = new Map<string, string>();
  for (const item of items) {
    const created = await db.itemDefinition.create({
      data: {
        worldId: targetWorldId,
        name: item.name,
        description: item.description,
        category: item.category,
        subcategory: item.subcategory,
        rarity: item.rarity,
        iconUrl: item.iconUrl,
        weight: item.weight,
        price: item.price,
        stackable: item.stackable,
        maxStack: item.maxStack,
        requiresIdent: item.requiresIdent,
        requiresAttune: item.requiresAttune,
        attuneReq: item.attuneReq,
        weaponProps: toOptionalJsonInput(item.weaponProps),
        armorProps: toOptionalJsonInput(item.armorProps),
        enchantments: toOptionalJsonInput(remapItemEnchantments(cloneJsonValue(item.enchantments), abilityIdMap)),
        enhanceSlots: item.enhanceSlots,
        gemSlots: item.gemSlots,
        tags: toRequiredJsonInput(item.tags)
      },
      select: { id: true }
    });
    itemIdMap.set(item.id, created.id);
  }

  for (const race of races) {
    await db.raceDefinition.create({
      data: {
        worldId: targetWorldId,
        name: race.name,
        description: race.description,
        loreText: race.loreText,
        iconUrl: race.iconUrl,
        attrBonus: toRequiredJsonInput(race.attrBonus),
        size: race.size,
        speed: race.speed,
        darkvision: race.darkvision,
        creatureType: race.creatureType,
        languages: toRequiredJsonInput(race.languages),
        ageDesc: race.ageDesc,
        traits: toRequiredJsonInput(remapRaceTraits(cloneJsonValue(race.traits), abilityIdMap)),
        subtypes: toRequiredJsonInput(remapRaceSubtypes(cloneJsonValue(race.subtypes), abilityIdMap))
      }
    });
  }

  for (const profession of professions) {
    await db.professionDefinition.create({
      data: {
        worldId: targetWorldId,
        name: profession.name,
        description: profession.description,
        loreText: profession.loreText,
        iconUrl: profession.iconUrl,
        type: profession.type,
        hitDie: profession.hitDie,
        primaryAttribute: profession.primaryAttribute,
        saveProficiencies: toRequiredJsonInput(profession.saveProficiencies),
        armorProficiencies: toRequiredJsonInput(profession.armorProficiencies),
        weaponProficiencies: toRequiredJsonInput(profession.weaponProficiencies),
        toolProficiencies: toRequiredJsonInput(profession.toolProficiencies),
        skillChoices: toRequiredJsonInput(profession.skillChoices),
        startingEquipment: (Array.isArray(profession.startingEquipment) ? profession.startingEquipment : []).map((item) =>
          typeof item === "string" && itemIdMap.has(item) ? itemIdMap.get(item)! : item
        ),
        startingWealth: profession.startingWealth,
        spellcastingAttr: profession.spellcastingAttr,
        furyPerLevel: profession.furyPerLevel,
        levelFeatures: toRequiredJsonInput(remapProfessionLevelFeatures(cloneJsonValue(profession.levelFeatures), abilityIdMap)),
        talentTreeIds: toRequiredJsonInput(profession.talentTreeIds)
      }
    });
  }

  for (const background of backgrounds) {
    await db.backgroundDefinition.create({
      data: {
        worldId: targetWorldId,
        name: background.name,
        description: background.description,
        loreText: background.loreText,
        iconUrl: background.iconUrl,
        skillPoints: background.skillPoints,
        bonusLanguages: background.bonusLanguages,
        toolProficiencies: toRequiredJsonInput(background.toolProficiencies),
        startingEquipment: (Array.isArray(background.startingEquipment) ? background.startingEquipment : []).map((item) =>
          typeof item === "string" && itemIdMap.has(item) ? itemIdMap.get(item)! : item
        ),
        features: toRequiredJsonInput(remapBackgroundFeatures(cloneJsonValue(background.features), abilityIdMap))
      }
    });
  }

  for (const deck of decks) {
    await db.deckDefinition.create({
      data: {
        worldId: targetWorldId,
        name: deck.name,
        description: deck.description,
        cards: toRequiredJsonInput(remapDeckCards(cloneJsonValue(deck.cards), itemIdMap)),
        replacement: deck.replacement,
        drawnHistory: []
      }
    });
  }

  for (const randomTable of randomTables) {
    await db.randomTable.create({
      data: {
        worldId: targetWorldId,
        name: randomTable.name,
        description: randomTable.description,
        diceFormula: randomTable.diceFormula,
        entries: toRequiredJsonInput(remapRandomTableEntries(cloneJsonValue(randomTable.entries), itemIdMap, abilityIdMap))
      }
    });
  }

  for (const instance of talentInstances) {
    await db.worldTalentTreeInstance.create({
      data: {
        worldId: targetWorldId,
        templateId: instance.templateId,
        templateVersion: instance.templateVersion,
        name: instance.name,
        treeType: instance.treeType,
        category: instance.category,
        graphSnapshot: toRequiredJsonInput(instance.graphSnapshot, {}),
        enabled: instance.enabled
      }
    });
  }
}

function resolveDataSqliteDir() {
  const candidates = [
    path.resolve(process.cwd(), "data/sqlite"),
    path.resolve(process.cwd(), "../data/sqlite")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveWorldSaveDir(worldId: string) {
  return path.join(resolveDataSqliteDir(), "worlds", worldId);
}

function extToMime(ext: string) {
  const normalized = ext.toLowerCase();
  if (normalized === "png") {
    return "image/png";
  }
  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }
  if (normalized === "webp") {
    return "image/webp";
  }
  if (normalized === "gif") {
    return "image/gif";
  }
  return null;
}

function mimeToExt(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/jpeg") {
    return "jpg";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }
  return null;
}

function parseCoverDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("invalid cover image format");
  }

  const mime = match[1];
  const ext = mimeToExt(mime);
  if (!ext) {
    throw new Error("unsupported cover image type");
  }

  const buffer = Buffer.from(match[2], "base64");
  return { ext, buffer };
}

async function saveWorldCover(worldId: string, coverImageDataUrl: string) {
  const { ext, buffer } = parseCoverDataUrl(coverImageDataUrl);
  const worldSaveDir = resolveWorldSaveDir(worldId);
  await fsp.mkdir(worldSaveDir, { recursive: true });

  const currentFiles = await fsp.readdir(worldSaveDir).catch(() => [] as string[]);
  await Promise.all(
    currentFiles
      .filter((fileName) => fileName.startsWith(COVER_FILE_PREFIX))
      .map((fileName) => fsp.rm(path.join(worldSaveDir, fileName), { force: true }))
  );

  const filePath = path.join(worldSaveDir, `${COVER_FILE_PREFIX}${ext}`);
  await fsp.writeFile(filePath, buffer);
}

async function loadWorldCoverDataUrl(worldId: string) {
  const worldSaveDir = resolveWorldSaveDir(worldId);
  const files = await fsp.readdir(worldSaveDir).catch(() => [] as string[]);
  const coverFile = files.find((fileName) => fileName.startsWith(COVER_FILE_PREFIX));
  if (!coverFile) {
    return null;
  }

  const ext = coverFile.slice(COVER_FILE_PREFIX.length);
  const mime = extToMime(ext);
  if (!mime) {
    return null;
  }

  const buffer = await fsp.readFile(path.join(worldSaveDir, coverFile)).catch(() => null);
  if (!buffer) {
    return null;
  }

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function removeWorldSaveDir(worldId: string) {
  const worldSaveDir = resolveWorldSaveDir(worldId);
  await fsp.rm(worldSaveDir, { recursive: true, force: true });
}

export async function ensureBackendTemplateWorldForPlatformAdmin(userId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true }
  });

  if (!currentUser) {
    throw new Error("user not found");
  }

  const isPlatformAdmin =
    currentUser.platformRole === PlatformRole.MASTER || currentUser.platformRole === PlatformRole.ADMIN;
  if (!isPlatformAdmin) {
    return null;
  }

  const preferredOwner =
    currentUser.platformRole === PlatformRole.MASTER
      ? currentUser
      : await prisma.user.findFirst({
        where: { platformRole: PlatformRole.MASTER },
        select: { id: true },
        orderBy: { createdAt: "asc" }
      });
  const ownerId = preferredOwner?.id ?? currentUser.id;

  const world = await prisma.world.upsert({
    where: { inviteCode: BACKEND_TEMPLATE_WORLD_INVITE_CODE },
    update: {
      name: BACKEND_TEMPLATE_WORLD_NAME,
      description: BACKEND_TEMPLATE_WORLD_DESCRIPTION,
      visibility: WorldVisibility.PRIVATE
    },
    create: {
      name: BACKEND_TEMPLATE_WORLD_NAME,
      description: BACKEND_TEMPLATE_WORLD_DESCRIPTION,
      visibility: WorldVisibility.PRIVATE,
      inviteCode: BACKEND_TEMPLATE_WORLD_INVITE_CODE,
      ownerId
    }
  });

  await prisma.worldMember.upsert({
    where: {
      worldId_userId: {
        worldId: world.id,
        userId: world.ownerId
      }
    },
    update: {
      role: WorldRole.GM,
      status: WorldMemberStatus.ACTIVE
    },
    create: {
      worldId: world.id,
      userId: world.ownerId,
      role: WorldRole.GM,
      status: WorldMemberStatus.ACTIVE
    }
  });

  await prisma.worldMember.upsert({
    where: {
      worldId_userId: {
        worldId: world.id,
        userId: currentUser.id
      }
    },
    update: {
      role: currentUser.id === world.ownerId ? WorldRole.GM : WorldRole.ASSISTANT,
      status: WorldMemberStatus.ACTIVE
    },
    create: {
      worldId: world.id,
      userId: currentUser.id,
      role: currentUser.id === world.ownerId ? WorldRole.GM : WorldRole.ASSISTANT,
      status: WorldMemberStatus.ACTIVE
    }
  });

  await prisma.scene.upsert({
    where: {
      worldId_sortOrder: {
        worldId: world.id,
        sortOrder: 0
      }
    },
    update: {
      name: "后台默认场景"
    },
    create: {
      worldId: world.id,
      name: "后台默认场景",
      sortOrder: 0,
      canvasState: {
        version: 1,
        objects: []
      }
    }
  });

  await ensureBackendTemplateWorldStarterResources(world.id);

  return world;
}

export async function createWorld(input: CreateWorldInput) {
  const worldName = input.name?.trim();
  if (!worldName) {
    throw new Error("world name is required");
  }

  let passwordHash: string | null = null;
  let inviteCode: string | null = null;
  if (input.visibility === WorldVisibility.PASSWORD) {
    inviteCode = await createUniqueInviteCode();
  }

  const templateWorld = await getBackendTemplateWorld();

  const created = await prisma.$transaction(async (tx) => {
    const world = await tx.world.create({
      data: {
        name: worldName,
        description: input.description?.trim() || null,
        ownerId: input.ownerId,
        visibility: input.visibility,
        passwordHash,
        inviteCode
      }
    });

    if (input.coverImageDataUrl) {
      await saveWorldCover(world.id, input.coverImageDataUrl);
    }

    await tx.worldMember.create({
      data: {
        worldId: world.id,
        userId: input.ownerId,
        role: WorldRole.GM
      }
    });

    await tx.scene.create({
      data: {
        worldId: world.id,
        name: "默认场景",
        sortOrder: 0
      }
    });

    if (templateWorld) {
      await ensureBackendTemplateWorldStarterResources(templateWorld.id, tx);
      await cloneBackendTemplateResources(templateWorld.id, world.id, tx);
    }

    return world;
  });

  return {
    ...created,
    coverImageDataUrl: await loadWorldCoverDataUrl(created.id)
  };
}

export async function listPublicWorlds() {
  return listVisibleWorlds("", undefined, "createdAt", "desc", false);
}

export async function listVisibleWorlds(
  userId: string,
  visibility?: WorldVisibility,
  sortBy: "createdAt" | "activeMembers" = "createdAt",
  order: "asc" | "desc" = "desc",
  enforceAccess = true
) {
  const currentUser = userId
    ? await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true }
    })
    : null;

  const isPlatformAdmin =
    currentUser?.platformRole === PlatformRole.MASTER || currentUser?.platformRole === PlatformRole.ADMIN;

  let friendOwnerIds: string[] = [];
  if (userId) {
    const accepted = await prisma.friend.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }]
      },
      select: {
        requesterId: true,
        addresseeId: true
      }
    });

    friendOwnerIds = accepted
      .map((item) => (item.requesterId === userId ? item.addresseeId : item.requesterId))
      .filter(Boolean);
  }

  const where = enforceAccess
    ? {
      OR: [
        { visibility: { in: [WorldVisibility.PUBLIC, WorldVisibility.PASSWORD] } },
        ...(userId ? [{ ownerId: userId }] : []),
        ...(friendOwnerIds.length > 0 ? [{ visibility: WorldVisibility.FRIENDS, ownerId: { in: friendOwnerIds } }] : []),
        ...(isPlatformAdmin ? [{}] : [])
      ]
    }
    : {};

  const worlds = await prisma.world.findMany({
    where: {
      ...where,
      ...(visibility ? { visibility } : {})
    },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          platformRole: true
        }
      },
      _count: {
        select: {
          members: true,
          scenes: true
        }
      }
    },
    orderBy: {
      createdAt: order
    }
  });

  const activeThreshold = new Date(Date.now() - 1000 * 60 * 15);
  const activeRows = await prisma.worldMember.groupBy({
    by: ["worldId"],
    where: {
      worldId: { in: worlds.map((item) => item.id) },
      status: "ACTIVE",
      updatedAt: { gte: activeThreshold }
    },
    _count: {
      worldId: true
    }
  });

  const activeCountMap = new Map(activeRows.map((item) => [item.worldId, item._count.worldId]));

  const mapped = worlds.map((item) => ({
    ...item,
    activeMemberCount: activeCountMap.get(item.id) ?? 0
  }));

  if (sortBy === "activeMembers") {
    mapped.sort((left, right) => {
      const delta = (left.activeMemberCount ?? 0) - (right.activeMemberCount ?? 0);
      return order === "asc" ? delta : -delta;
    });
  }

  return Promise.all(
    mapped.map(async (item) => ({
      ...item,
      coverImageDataUrl: await loadWorldCoverDataUrl(item.id)
    }))
  );
}

export async function listMyWorlds(userId: string) {
  const memberships = await prisma.worldMember.findMany({
    where: {
      userId,
      status: "ACTIVE"
    },
    include: {
      world: {
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
              platformRole: true
            }
          },
          _count: {
            select: {
              members: true,
              scenes: true
            }
          }
        }
      }
    },
    orderBy: {
      joinedAt: "desc"
    }
  });

  const mapped = memberships.map((item) => ({
    ...item.world,
    myRole: item.role
  }));

  const activeThreshold = new Date(Date.now() - 1000 * 60 * 15);
  const activeRows = await prisma.worldMember.groupBy({
    by: ["worldId"],
    where: {
      worldId: { in: mapped.map((item) => item.id) },
      status: "ACTIVE",
      updatedAt: { gte: activeThreshold }
    },
    _count: {
      worldId: true
    }
  });
  const activeCountMap = new Map(activeRows.map((item) => [item.worldId, item._count.worldId]));

  const withActiveCount = mapped.map((item) => ({
    ...item,
    activeMemberCount: activeCountMap.get(item.id) ?? 0
  }));

  return Promise.all(
    withActiveCount.map(async (item) => ({
      ...item,
      coverImageDataUrl: await loadWorldCoverDataUrl(item.id)
    }))
  );
}

export async function joinWorld(worldId: string, userId: string, inviteCode?: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId }
  });

  if (!world) {
    throw new Error("world not found");
  }

  const existing = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      await prisma.worldMember.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE"
        }
      });
    }

    return {
      worldId,
      userId,
      role: existing.role
    };
  }

  if (world.visibility === WorldVisibility.PRIVATE || world.visibility === WorldVisibility.FRIENDS) {
    throw new Error("this world is not open for direct join yet");
  }

  if (world.visibility === WorldVisibility.PASSWORD) {
    const rawInviteCode = inviteCode?.trim() ?? "";
    if (!world.inviteCode || !rawInviteCode) {
      throw new Error("invite code is required");
    }
    if (rawInviteCode !== world.inviteCode) {
      throw new Error("invalid invite code");
    }
  }

  const created = await prisma.worldMember.create({
    data: {
      worldId,
      userId,
      role: WorldRole.PLAYER,
      status: "ACTIVE"
    }
  });

  return {
    worldId: created.worldId,
    userId: created.userId,
    role: created.role
  };
}

export async function getWorldDetail(worldId: string, userId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          platformRole: true
        }
      },
      _count: {
        select: {
          members: true,
          scenes: true
        }
      }
    }
  });

  if (!world) {
    throw new Error("world not found");
  }

  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  const isOwner = world.ownerId === userId;
  const canView =
    world.visibility === WorldVisibility.PUBLIC ||
    world.visibility === WorldVisibility.PASSWORD ||
    isOwner ||
    !!membership;

  if (!canView) {
    throw new Error("forbidden");
  }

  return {
    ...world,
    coverImageDataUrl: await loadWorldCoverDataUrl(world.id),
    myRole: membership?.role ?? (isOwner ? WorldRole.GM : null),
    canJoin: !membership && world.visibility !== WorldVisibility.PRIVATE && world.visibility !== WorldVisibility.FRIENDS
  };
}

export async function listWorldRosterData(worldId: string, actorId: string): Promise<WorldRosterMember[]> {
  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId: actorId
      }
    },
    select: {
      status: true
    }
  });

  if (!membership || membership.status !== WorldMemberStatus.ACTIVE) {
    throw new Error("not a member of world");
  }

  const [memberRows, characterRows] = await Promise.all([
    prisma.worldMember.findMany({
      where: { worldId, status: WorldMemberStatus.ACTIVE },
      select: {
        userId: true,
        displayName: true,
        role: true,
        user: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    }),
    prisma.character.findMany({
      where: { worldId, userId: { not: null } },
      select: {
        id: true,
        name: true,
        userId: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);

  const boundCharacterByUserId = new Map<string, { id: string; name: string }>();
  for (const row of characterRows) {
    if (!row.userId || boundCharacterByUserId.has(row.userId)) {
      continue;
    }
    boundCharacterByUserId.set(row.userId, { id: row.id, name: row.name });
  }

  return memberRows
    .map((row) => ({
      userId: row.userId,
      username: row.user.username,
      accountDisplayName: row.user.displayName,
      worldDisplayName: row.displayName,
      role: normalizeWorldMemberManageRole(row.role),
      boundCharacterId: boundCharacterByUserId.get(row.userId)?.id ?? null,
      boundCharacterName: boundCharacterByUserId.get(row.userId)?.name ?? null
    }))
    .sort((left, right) => left.username.localeCompare(right.username, "zh-CN"));
}

function normalizeWorldMemberManageRole(role: WorldRole): WorldMemberManageRole {
  if (role === WorldRole.GM) {
    return "GM";
  }
  if (role === WorldRole.ASSISTANT) {
    return "ASSISTANT";
  }
  if (role === WorldRole.OBSERVER) {
    return "OBSERVER";
  }
  return "PLAYER";
}

function parseWorldMemberManageRole(role: unknown): WorldMemberManageRole {
  if (typeof role !== "string") {
    throw new Error("invalid world role");
  }
  const normalized = role.toUpperCase().trim();
  if (normalized === "GM" || normalized === "ASSISTANT" || normalized === "PLAYER" || normalized === "OBSERVER") {
    return normalized;
  }
  throw new Error("invalid world role");
}

async function ensureActorCanManageWorldMembers(worldId: string, actorId: string) {
  const [world, membership] = await Promise.all([
    prisma.world.findUnique({ where: { id: worldId }, select: { id: true } }),
    prisma.worldMember.findUnique({
      where: { worldId_userId: { worldId, userId: actorId } },
      select: { role: true, status: true }
    })
  ]);

  if (!world) {
    throw new Error("world not found");
  }
  if (!membership || membership.status !== WorldMemberStatus.ACTIVE) {
    throw new Error("not a member of world");
  }
  if (membership.role !== WorldRole.GM) {
    throw new Error("forbidden");
  }
}

export async function listWorldMemberManageData(worldId: string, actorId: string): Promise<WorldMemberManageData> {
  await ensureActorCanManageWorldMembers(worldId, actorId);

  const [memberRows, characterRows] = await Promise.all([
    prisma.worldMember.findMany({
      where: { worldId, status: WorldMemberStatus.ACTIVE },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        displayName: true,
        user: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    }),
    prisma.character.findMany({
      where: { worldId },
      select: {
        id: true,
        name: true,
        type: true,
        userId: true,
        updatedAt: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "asc" }]
    })
  ]);

  const latestBoundCharacterByUserId = new Map<string, { id: string; name: string; updatedAt: Date }>();
  for (const character of characterRows) {
    if (!character.userId) {
      continue;
    }
    const current = latestBoundCharacterByUserId.get(character.userId) ?? null;
    if (!current || character.updatedAt.getTime() >= current.updatedAt.getTime()) {
      latestBoundCharacterByUserId.set(character.userId, {
        id: character.id,
        name: character.name,
        updatedAt: character.updatedAt
      });
    }
  }

  const rolePriority: Record<WorldMemberManageRole, number> = {
    GM: 0,
    ASSISTANT: 1,
    PLAYER: 2,
    OBSERVER: 3
  };

  const members: WorldMemberManageMember[] = memberRows
    .map((row) => {
      const role = normalizeWorldMemberManageRole(row.role);
      const bound = latestBoundCharacterByUserId.get(row.userId) ?? null;

      return {
        userId: row.userId,
        username: row.user.username,
        accountDisplayName: row.user.displayName,
        worldDisplayName: row.displayName,
        role,
        joinedAt: row.joinedAt.toISOString(),
        boundCharacterId: bound?.id ?? null,
        boundCharacterName: bound?.name ?? null
      };
    })
    .sort((left, right) => {
      const roleDelta = rolePriority[left.role] - rolePriority[right.role];
      if (roleDelta !== 0) {
        return roleDelta;
      }
      return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
    });

  const characters: WorldMemberManageCharacter[] = characterRows.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    userId: item.userId
  }));

  return {
    members,
    characters,
    roleOptions: [...WORLD_MEMBER_MANAGE_ROLE_OPTIONS]
  };
}

export async function updateWorldMemberManageData(
  worldId: string,
  actorId: string,
  memberUserId: string,
  input: UpdateWorldMemberManageInput
): Promise<WorldMemberManageMember> {
  const normalizedMemberUserId = memberUserId.trim();
  if (!normalizedMemberUserId) {
    throw new Error("member user id is required");
  }

  await ensureActorCanManageWorldMembers(worldId, actorId);

  const targetMembership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId: normalizedMemberUserId
      }
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!targetMembership || targetMembership.status !== WorldMemberStatus.ACTIVE) {
    throw new Error("target user is not an active world member");
  }

  const memberPatch: { displayName?: string | null; role?: WorldRole } = {};
  if (Object.prototype.hasOwnProperty.call(input, "worldDisplayName")) {
    const rawDisplayName = input.worldDisplayName;
    if (rawDisplayName === null) {
      memberPatch.displayName = null;
    } else if (typeof rawDisplayName === "string") {
      const trimmed = rawDisplayName.trim();
      memberPatch.displayName = trimmed ? trimmed.slice(0, 32) : null;
    } else {
      throw new Error("invalid world display name");
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "role")) {
    memberPatch.role = parseWorldMemberManageRole(input.role) as WorldRole;
  }

  const shouldUpdateBinding = Object.prototype.hasOwnProperty.call(input, "boundCharacterId");
  const rawBoundCharacterId = input.boundCharacterId;
  if (shouldUpdateBinding && rawBoundCharacterId !== null && typeof rawBoundCharacterId !== "string") {
    throw new Error("invalid character id");
  }
  const normalizedBoundCharacterId = typeof rawBoundCharacterId === "string" ? rawBoundCharacterId.trim() : "";

  await prisma.$transaction(async (tx) => {
    if (Object.keys(memberPatch).length > 0) {
      await tx.worldMember.update({
        where: {
          worldId_userId: {
            worldId,
            userId: normalizedMemberUserId
          }
        },
        data: memberPatch
      });
    }

    if (!shouldUpdateBinding) {
      return;
    }

    if (!normalizedBoundCharacterId) {
      await tx.character.updateMany({
        where: {
          worldId,
          userId: normalizedMemberUserId
        },
        data: {
          userId: null
        }
      });
      return;
    }

    const character = await tx.character.findUnique({
      where: { id: normalizedBoundCharacterId },
      select: {
        id: true,
        worldId: true,
        userId: true
      }
    });
    if (!character || character.worldId !== worldId) {
      throw new Error("character not found");
    }
    if (character.userId && character.userId !== normalizedMemberUserId) {
      throw new Error("character already bound");
    }

    await tx.character.updateMany({
      where: {
        worldId,
        userId: normalizedMemberUserId,
        id: { not: normalizedBoundCharacterId }
      },
      data: {
        userId: null
      }
    });

    await tx.character.update({
      where: { id: normalizedBoundCharacterId },
      data: {
        userId: normalizedMemberUserId
      }
    });
  });

  const [member, boundCharacter] = await Promise.all([
    prisma.worldMember.findUnique({
      where: {
        worldId_userId: {
          worldId,
          userId: normalizedMemberUserId
        }
      },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        displayName: true,
        status: true,
        user: {
          select: {
            username: true,
            displayName: true
          }
        }
      }
    }),
    prisma.character.findFirst({
      where: {
        worldId,
        userId: normalizedMemberUserId
      },
      select: {
        id: true,
        name: true
      },
      orderBy: [{ updatedAt: "desc" }]
    })
  ]);

  if (!member || member.status !== WorldMemberStatus.ACTIVE) {
    throw new Error("target user is not an active world member");
  }

  return {
    userId: member.userId,
    username: member.user.username,
    accountDisplayName: member.user.displayName,
    worldDisplayName: member.displayName,
    role: normalizeWorldMemberManageRole(member.role),
    joinedAt: member.joinedAt.toISOString(),
    boundCharacterId: boundCharacter?.id ?? null,
    boundCharacterName: boundCharacter?.name ?? null
  };
}

export function getAvailableCreateVisibilities(platformRole: PlatformRole) {
  if (platformRole === PlatformRole.MASTER || platformRole === PlatformRole.ADMIN) {
    return ["PUBLIC", "PASSWORD", "FRIENDS", "PRIVATE"];
  }

  return ["PUBLIC", "PASSWORD", "FRIENDS", "PRIVATE"];
}

export async function deleteWorld(worldId: string, userId: string) {
  const [world, actor, membership] = await Promise.all([
    prisma.world.findUnique({ where: { id: worldId }, select: { id: true, ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } }),
    prisma.worldMember.findUnique({
      where: { worldId_userId: { worldId, userId } },
      select: { role: true }
    })
  ]);

  if (!world) {
    throw new Error("world not found");
  }

  const isPlatformAdmin = actor?.platformRole === PlatformRole.MASTER || actor?.platformRole === PlatformRole.ADMIN;
  const isWorldGm = membership?.role === WorldRole.GM;
  const canDelete = world.ownerId === userId || isPlatformAdmin || isWorldGm;
  if (!canDelete) {
    throw new Error("forbidden");
  }

  await prisma.$transaction(async (tx) => {
    await tx.storyEvent.deleteMany({ where: { worldId } });
    await tx.aiSession.deleteMany({ where: { worldId } });
    await tx.message.deleteMany({ where: { worldId } });
    await tx.character.deleteMany({ where: { worldId } });
    await tx.scene.deleteMany({ where: { worldId } });
    await tx.worldMember.deleteMany({ where: { worldId } });
    await tx.world.delete({ where: { id: worldId } });
  });

  await removeWorldSaveDir(worldId);

  return { worldId };
}

async function createUniqueInviteCode() {
  for (let i = 0; i < 10; i += 1) {
    const candidate = randomInviteCode();
    const exists = await prisma.world.findUnique({ where: { inviteCode: candidate }, select: { id: true } });
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("failed to generate invite code");
}

function randomInviteCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}
