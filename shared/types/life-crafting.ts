/**
 * 生活职业与魔法物品制造骨架。
 *
 * 这里先定义可视化编辑器和后端结算会共同依赖的数据形状，不预设最终数值规则。
 * 等规则书补完后，稀有度容量、职业清单、配方难度、组件效果都应通过世界资源配置写入。
 */

import type { ConditionExpression, EffectExpression, ResourceCost } from "./world-entities";

export type LifeProfessionDiscipline =
  | "smithing"
  | "engineering"
  | "alchemy"
  | "enchanting"
  | "tailoring"
  | "jewelcrafting"
  | "cooking"
  | "gathering"
  | "custom";

export type CraftingItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic"
  | "custom";

export type CraftingGridCell = {
  x: number;
  y: number;
};

export type CraftingGridSize = {
  width: number;
  height: number;
};

export type CraftingGridShape = {
  size: CraftingGridSize;
  blockedCells?: CraftingGridCell[];
};

export type LifeProfessionFeatureGrant = {
  level: number;
  featureId: string;
  label?: string;
};

export type LifeProfessionDefinition = {
  id: string;
  worldId: string;
  name: string;
  discipline: LifeProfessionDiscipline | string;
  description?: string;
  maxLevel: number;
  grantedProficiencies?: string[];
  craftableCategories: string[];
  featureGrants: LifeProfessionFeatureGrant[];
  tags?: string[];
};

export type LifeProfessionProgress = {
  characterId: string;
  professionId: string;
  level: number;
  selectedFeatureIds: string[];
};

export type MagicItemChassisDefinition = {
  id: string;
  worldId: string;
  name: string;
  category: string;
  rarity: CraftingItemRarity | string;
  grid: CraftingGridShape;
  baseEffects?: EffectExpression[];
  tags?: string[];
};

export type MagicItemComponentDefinition = {
  id: string;
  worldId: string;
  name: string;
  category: string;
  rarity: CraftingItemRarity | string;
  footprint: CraftingGridShape;
  socketTags?: string[];
  effects: EffectExpression[];
  requirements?: ConditionExpression[];
  tags?: string[];
};

export type InstalledMagicItemComponent = {
  componentId: string;
  anchor: CraftingGridCell;
  rotation: 0 | 90 | 180 | 270;
  metadata?: Record<string, unknown>;
};

export type MagicItemAssembly = {
  id: string;
  worldId: string;
  ownerCharacterId?: string | null;
  chassisId: string;
  displayName: string;
  installedComponents: InstalledMagicItemComponent[];
  derivedEffects?: EffectExpression[];
  validationErrors?: string[];
};

export type CraftingRecipeDefinition = {
  id: string;
  worldId: string;
  name: string;
  discipline: LifeProfessionDiscipline | string;
  outputType: "chassis" | "component" | "assembledItem" | "material" | "custom";
  outputId?: string;
  requiredProfessionLevel: number;
  materialCosts: ResourceCost[];
  checkFormula?: string;
  requirements?: ConditionExpression[];
  tags?: string[];
};

export type CraftingJobStatus = "draft" | "queued" | "inProgress" | "completed" | "failed" | "cancelled";

export type CraftingJob = {
  id: string;
  worldId: string;
  actorCharacterId: string;
  recipeId: string;
  status: CraftingJobStatus;
  progress: number;
  requiredProgress: number;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
};
