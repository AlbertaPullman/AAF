import { prisma } from "../lib/prisma";
import {
  type TalentNodeData,
  type ParsedAffixMeta,
  type RequirementItem,
  parseAffixMeta,
  parseRequirementItems,
  rankOf,
  canUnlockNode,
  canLearnNode,
  pruneInvalidLearnedNodes,
  formatAffixText,
  normalizeStudyDescription,
} from "../../../shared/rules/talent-tree";
import * as talentTreeService from "./talent-tree.service";

// ──── 常量 ────

const PROFESSION_LIST = [
  "狂怒斗士", "战士", "影刃", "猎魔人", "灵语者", "祭司",
  "秘武者", "骑士", "魔法师", "吟游诗人", "魔能使", "机兵士",
] as const;

// ──── 权限辅助 ────

async function ensureWorldGM(worldId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  if (!member || (member.role !== "GM" && member.role !== "ASSISTANT")) {
    throw new Error("permission denied");
  }
  return member;
}

async function ensureWorldMember(worldId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  if (!member) throw new Error("not a member of world");
  return member;
}

async function ensureCharacterOwnerOrGM(worldId: string, characterId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: { worldId_userId: { worldId, userId } },
  });
  if (!member) throw new Error("not a member of world");

  const character = await prisma.character.findFirst({
    where: { id: characterId, worldId },
  });
  if (!character) throw new Error("character not found");

  const isGM = member.role === "GM" || member.role === "ASSISTANT";
  if (!isGM && character.userId !== userId) {
    throw new Error("permission denied");
  }

  return { member, character };
}

// ──── 图数据投影 ────

function projectGraphToNodes(graphSnapshot: unknown): TalentNodeData[] {
  if (!graphSnapshot || typeof graphSnapshot !== "object") return [];
  const rawCells = (graphSnapshot as { cells?: unknown }).cells;
  if (!Array.isArray(rawCells)) return [];

  const nodes: TalentNodeData[] = [];
  const parentMap = new Map<string, Set<string>>();
  const yMap = new Map<string, number>();
  const edgeList: Array<{ source: string; target: string }> = [];

  rawCells.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const cell = item as Record<string, unknown>;
    const shape = String(cell.shape ?? "");

    if (shape === "edge") {
      const source = cell.source && typeof cell.source === "object" ? (cell.source as Record<string, unknown>) : {};
      const target = cell.target && typeof cell.target === "object" ? (cell.target as Record<string, unknown>) : {};
      const sourceNodeId = typeof source.cell === "string" ? source.cell : "";
      const targetNodeId = typeof target.cell === "string" ? target.cell : "";
      if (sourceNodeId && targetNodeId) {
        edgeList.push({ source: sourceNodeId, target: targetNodeId });
      }
      return;
    }

    const data = cell.data && typeof cell.data === "object" ? (cell.data as Record<string, unknown>) : {};
    const position = cell.position && typeof cell.position === "object" ? (cell.position as Record<string, unknown>) : {};

    const id = typeof cell.id === "string" ? cell.id : `node_${index}`;
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "未命名节点";
    const y = typeof cell.y === "number" ? cell.y : (typeof position.y === "number" ? position.y : index * 24);
    yMap.set(id, y);

    const parsedAffix = parseAffixMeta(data.talentAffix, data.affixMeta as Record<string, unknown> | undefined);
    const cost = typeof data.cost === "number" && Number.isFinite(data.cost) ? Math.max(0, data.cost) : 1;

    nodes.push({
      id,
      title,
      cost,
      affixMeta: parsedAffix,
      requirementMeta: Array.isArray(data.requirementMeta)
        ? (data.requirementMeta as RequirementItem[])
        : parseRequirementItems(data.requirement, PROFESSION_LIST),
      parentNodeIds: Array.isArray(data.parentNodeIds)
        ? (data.parentNodeIds as string[])
        : [],
    });
  });

  const nodeIdSet = new Set(nodes.map((n) => n.id));
  edgeList.forEach((edge) => {
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) return;
    const sourceY = yMap.get(edge.source) ?? 0;
    const targetY = yMap.get(edge.target) ?? 0;
    const parentId = sourceY <= targetY ? edge.source : edge.target;
    const childId = sourceY <= targetY ? edge.target : edge.source;
    const set = parentMap.get(childId) ?? new Set<string>();
    set.add(parentId);
    parentMap.set(childId, set);
  });

  return nodes.map((node) => ({
    ...node,
    parentNodeIds: node.parentNodeIds.length
      ? node.parentNodeIds
      : Array.from(parentMap.get(node.id) ?? []),
  }));
}

// ──── 世界天赋树实例管理（GM 操作） ────

export async function listWorldTalentInstances(worldId: string, userId: string) {
  await ensureWorldMember(worldId, userId);
  return prisma.worldTalentTreeInstance.findMany({
    where: { worldId },
    orderBy: [{ treeType: "asc" }, { name: "asc" }],
    select: {
      id: true,
      templateId: true,
      templateVersion: true,
      name: true,
      treeType: true,
      category: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function importTalentTreeToWorld(
  worldId: string,
  userId: string,
  templateId: string
) {
  await ensureWorldGM(worldId, userId);

  const existing = await prisma.worldTalentTreeInstance.findUnique({
    where: { worldId_templateId: { worldId, templateId } },
  });
  if (existing) {
    throw new Error("该天赋树模板已在此世界中实例化");
  }

  const template = await talentTreeService.getTemplateById(templateId);
  if (!template) {
    throw new Error("talent tree template not found");
  }

  return prisma.worldTalentTreeInstance.create({
    data: {
      worldId,
      templateId: template.id,
      templateVersion: template.version,
      name: template.name,
      treeType: template.treeType,
      category: template.category,
      graphSnapshot: template.graphData as object,
    },
  });
}

export async function toggleTalentTreeInstance(
  worldId: string,
  userId: string,
  instanceId: string,
  enabled: boolean
) {
  await ensureWorldGM(worldId, userId);

  const instance = await prisma.worldTalentTreeInstance.findFirst({
    where: { id: instanceId, worldId },
  });
  if (!instance) throw new Error("talent tree instance not found");

  return prisma.worldTalentTreeInstance.update({
    where: { id: instanceId },
    data: { enabled },
  });
}

export async function removeTalentTreeInstance(
  worldId: string,
  userId: string,
  instanceId: string
) {
  await ensureWorldGM(worldId, userId);

  const instance = await prisma.worldTalentTreeInstance.findFirst({
    where: { id: instanceId, worldId },
  });
  if (!instance) throw new Error("talent tree instance not found");

  // 删除所有关联的角色天赋分配
  await prisma.characterTalentAllocation.deleteMany({
    where: { instanceId },
  });

  return prisma.worldTalentTreeInstance.delete({
    where: { id: instanceId },
  });
}

// ──── 角色天赋分配（玩家/GM 操作） ────

export async function getCharacterAllocations(
  worldId: string,
  characterId: string,
  userId: string
) {
  await ensureCharacterOwnerOrGM(worldId, characterId, userId);

  const allocations = await prisma.characterTalentAllocation.findMany({
    where: { characterId },
    include: {
      instance: {
        select: {
          id: true,
          name: true,
          treeType: true,
          category: true,
          enabled: true,
          graphSnapshot: true,
          templateVersion: true,
        },
      },
    },
  });

  return allocations.map((a) => ({
    id: a.id,
    characterId: a.characterId,
    instanceId: a.instanceId,
    ranks: a.ranks as Record<string, number>,
    pointsSpent: a.pointsSpent,
    resetCount: a.resetCount,
    instance: a.instance,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));
}

export async function previewLearnNode(
  worldId: string,
  characterId: string,
  userId: string,
  instanceId: string,
  nodeId: string,
  professionLevels: Record<string, number>,
  availablePoints: number
) {
  await ensureCharacterOwnerOrGM(worldId, characterId, userId);

  const instance = await prisma.worldTalentTreeInstance.findFirst({
    where: { id: instanceId, worldId, enabled: true },
  });
  if (!instance) throw new Error("talent tree instance not found or disabled");

  const allNodes = projectGraphToNodes(instance.graphSnapshot);
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) throw new Error("node not found in talent tree");

  const allocation = await prisma.characterTalentAllocation.findUnique({
    where: { characterId_instanceId: { characterId, instanceId } },
  });
  const currentRanks = (allocation?.ranks ?? {}) as Record<string, number>;

  const result = canLearnNode(node, currentRanks, currentRanks, availablePoints, allNodes, professionLevels);

  return {
    nodeId,
    allowed: result.allowed,
    reason: result.allowed ? null : (result as { reason: string }).reason,
    currentRank: rankOf(currentRanks, nodeId),
    maxRank: node.affixMeta.studyMax > 0 ? Math.max(1, node.affixMeta.studyMax) : 1,
    cost: node.cost,
  };
}

export async function commitTalentAllocation(
  worldId: string,
  characterId: string,
  userId: string,
  instanceId: string,
  ranks: Record<string, number>,
  professionLevels: Record<string, number>
) {
  await ensureCharacterOwnerOrGM(worldId, characterId, userId);

  const instance = await prisma.worldTalentTreeInstance.findFirst({
    where: { id: instanceId, worldId, enabled: true },
  });
  if (!instance) throw new Error("talent tree instance not found or disabled");

  const allNodes = projectGraphToNodes(instance.graphSnapshot);
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // 校验每个 rank 的合法性
  const cleanRanks: Record<string, number> = {};
  let totalSpent = 0;

  for (const [nodeId, rank] of Object.entries(ranks)) {
    if (rank <= 0) continue;
    const node = nodeMap.get(nodeId);
    if (!node) throw new Error(`node ${nodeId} not found in talent tree`);

    const maxRank = node.affixMeta.studyMax > 0 ? Math.max(1, node.affixMeta.studyMax) : 1;
    if (rank > maxRank) {
      throw new Error(`node ${node.title} rank ${rank} exceeds max ${maxRank}`);
    }

    cleanRanks[nodeId] = rank;
    totalSpent += rank * node.cost;
  }

  // 用共享纯函数验证解锁合法性
  for (const [nodeId, rank] of Object.entries(cleanRanks)) {
    if (rank <= 0) continue;
    const node = nodeMap.get(nodeId)!;
    if (!canUnlockNode(node, cleanRanks, professionLevels, allNodes)) {
      throw new Error(`node ${node.title} does not meet unlock requirements`);
    }
  }

  // 排他检查
  const exclusiveNodes = allNodes.filter((n) => n.affixMeta.exclusive && rankOf(cleanRanks, n.id) > 0);
  if (exclusiveNodes.length > 1) {
    throw new Error("同一天赋树中只能学习一个排他天赋");
  }

  // 通晓同名检查
  const masteryTitles = new Set<string>();
  for (const node of allNodes) {
    if (!node.affixMeta.mastery || rankOf(cleanRanks, node.id) <= 0) continue;
    if (masteryTitles.has(node.title)) {
      throw new Error(`通晓效果 "${node.title}" 不能重复学习`);
    }
    masteryTitles.add(node.title);
  }

  const allocation = await prisma.characterTalentAllocation.findUnique({
    where: { characterId_instanceId: { characterId, instanceId } },
  });

  if (allocation) {
    return prisma.characterTalentAllocation.update({
      where: { id: allocation.id },
      data: { ranks: cleanRanks, pointsSpent: totalSpent },
    });
  }

  return prisma.characterTalentAllocation.create({
    data: {
      characterId,
      instanceId,
      ranks: cleanRanks,
      pointsSpent: totalSpent,
    },
  });
}

export async function resetTalentAllocation(
  worldId: string,
  characterId: string,
  userId: string,
  instanceId: string
) {
  await ensureCharacterOwnerOrGM(worldId, characterId, userId);

  const allocation = await prisma.characterTalentAllocation.findUnique({
    where: { characterId_instanceId: { characterId, instanceId } },
  });
  if (!allocation) throw new Error("no allocation to reset");

  return prisma.characterTalentAllocation.update({
    where: { id: allocation.id },
    data: {
      ranks: {},
      pointsSpent: 0,
      resetCount: allocation.resetCount + 1,
    },
  });
}
