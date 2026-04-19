// ===== 天赋树共享类型 =====

export type AffixMeta = Record<string, unknown>;

export type ParsedAffixMeta = {
  mastery: boolean;
  exclusive: boolean;
  studyMax: number;
};

export type RequirementItem = {
  profession: string;
  level: number;
};

export type TalentNodeData = {
  id: string;
  title: string;
  cost: number;
  affixMeta: ParsedAffixMeta;
  requirementMeta: RequirementItem[];
  parentNodeIds: string[];
};

// ===== 纯函数：词缀解析 =====

export function parseAffixMeta(value: unknown, rawMeta?: AffixMeta): ParsedAffixMeta {
  let mastery = false;
  let exclusive = false;
  let studyMax = 0;

  if (rawMeta && typeof rawMeta === "object") {
    const legacyType = typeof (rawMeta as Record<string, unknown>).type === "string"
      ? (rawMeta as Record<string, unknown>).type as string
      : "";
    if (legacyType === "MASTERY") {
      mastery = true;
    }
    if (legacyType === "EXCLUSIVE") {
      exclusive = true;
    }
    if (legacyType === "STUDY") {
      studyMax = Math.max(1, Number((rawMeta as Record<string, unknown>).studyMax || 1));
    }
    if ((rawMeta as Record<string, unknown>).mastery === true) {
      mastery = true;
    }
    if ((rawMeta as Record<string, unknown>).exclusive === true) {
      exclusive = true;
    }
    const rawStudyMax = Number((rawMeta as Record<string, unknown>).studyMax);
    if (Number.isFinite(rawStudyMax) && rawStudyMax > 0) {
      studyMax = Math.max(studyMax, rawStudyMax);
    }
  }

  const text = typeof value === "string" ? value.trim() : "";
  if (text) {
    const parts = text
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    parts.forEach((item) => {
      if (item.startsWith("通晓")) {
        mastery = true;
        return;
      }
      if (item.startsWith("排他")) {
        exclusive = true;
        return;
      }
      const studyMatch = item.match(/^研习\s*(\d+)$/);
      if (studyMatch) {
        studyMax = Math.max(studyMax, Math.max(1, Number(studyMatch[1])));
      }
    });
  }

  return { mastery, exclusive, studyMax };
}

export function formatAffixText(meta: ParsedAffixMeta): string {
  const parts: string[] = [];
  if (meta.mastery) {
    parts.push("通晓");
  }
  if (meta.studyMax > 0) {
    parts.push(`研习${meta.studyMax}`);
  }
  if (meta.exclusive) {
    parts.push("排他");
  }
  return parts.join("，");
}

// ===== 纯函数：前置解析 =====

export function parseRequirementItems(value: unknown, professionList: readonly string[]): RequirementItem[] {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "无") {
    return [];
  }

  return text
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+)\s*(.+)$/);
      if (!match) {
        return null;
      }
      const level = Number(match[1]);
      const profession = match[2].trim();
      if (!Number.isFinite(level) || level < 0 || !profession || !professionList.includes(profession)) {
        return null;
      }
      return { level, profession };
    })
    .filter((item): item is RequirementItem => !!item);
}

// ===== 纯函数：工具 =====

export function rankOf(ranks: Record<string, number>, nodeId: string): number {
  return Math.max(0, Number(ranks[nodeId] || 0));
}

// ===== 纯函数：节点解锁判定 =====

export function canUnlockNode(
  node: TalentNodeData,
  ranks: Record<string, number>,
  professionLevels: Record<string, number>,
  allNodes: TalentNodeData[]
): boolean {
  if (rankOf(ranks, node.id) > 0) {
    return true;
  }

  const requirementPass = node.requirementMeta.every((item) => {
    const currentLevel = professionLevels[item.profession] ?? 0;
    return currentLevel >= item.level;
  });

  const parentPass = node.parentNodeIds.every(
    (parentId) => rankOf(ranks, parentId) > 0
  );

  const masteryPass = node.affixMeta.mastery
    ? allNodes.some(
      (other) => other.id !== node.id && other.title === node.title && rankOf(ranks, other.id) > 0
    )
    : false;

  return masteryPass || (requirementPass && parentPass);
}

// ===== 纯函数：节点学习判定 =====

export type LearnNodeResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function canLearnNode(
  node: TalentNodeData,
  ranks: Record<string, number>,
  committedRanks: Record<string, number>,
  availablePoints: number,
  allNodes: TalentNodeData[],
  professionLevels: Record<string, number>
): LearnNodeResult {
  if (!canUnlockNode(node, ranks, professionLevels, allNodes)) {
    return { allowed: false, reason: "该节点尚未解锁，无法学习。" };
  }

  const currentRank = rankOf(ranks, node.id);
  const maxRank = node.affixMeta.studyMax > 0
    ? Math.max(1, node.affixMeta.studyMax)
    : 1;

  if (currentRank >= maxRank) {
    return { allowed: false, reason: "该节点已达到可学习上限。" };
  }

  if (node.affixMeta.exclusive) {
    const otherExclusive = allNodes.some((item) => {
      if (item.id === node.id || !item.affixMeta.exclusive) {
        return false;
      }
      return rankOf(ranks, item.id) > 0;
    });
    if (otherExclusive) {
      return { allowed: false, reason: "本天赋树已有已学习的排他天赋，无法再学习其他排他天赋。" };
    }
  }

  if (node.affixMeta.mastery) {
    const sameTitleLearned = allNodes.some((item) => {
      if (item.id === node.id || item.title !== node.title) {
        return false;
      }
      return rankOf(ranks, item.id) > 0;
    });
    if (sameTitleLearned) {
      return { allowed: false, reason: "通晓同名效果不会叠加，无需重复学习。" };
    }
  }

  if (availablePoints < node.cost) {
    return { allowed: false, reason: "天赋点不足，无法学习该节点。" };
  }

  return { allowed: true };
}

// ===== 纯函数：级联回退（取消学习时剪枝失效子孙） =====

export function pruneInvalidLearnedNodes(
  ranks: Record<string, number>,
  committedRanks: Record<string, number>,
  professionLevels: Record<string, number>,
  allNodes: TalentNodeData[]
): Record<string, number> {
  const pruned = { ...ranks };
  let changed: boolean;

  do {
    changed = false;
    allNodes.forEach((node) => {
      const current = rankOf(pruned, node.id);
      if (current <= 0) {
        return;
      }

      if (canUnlockNode(node, pruned, professionLevels, allNodes)) {
        return;
      }

      const floorRank = rankOf(committedRanks, node.id);
      if (current <= floorRank) {
        return;
      }

      if (floorRank <= 0) {
        delete pruned[node.id];
      } else {
        pruned[node.id] = floorRank;
      }
      changed = true;
    });
  } while (changed);

  return pruned;
}

// ===== 纯函数：节点学习状态文案 =====

export function getNodeLearningStatusText(
  node: TalentNodeData,
  unlocked: boolean,
  rank: number
): string {
  if (!unlocked) {
    return "未解锁";
  }
  if (node.affixMeta.studyMax > 0) {
    if (rank > 0) {
      return `已学习${rank}次`;
    }
    return "未学习";
  }
  if (rank > 0) {
    return "已学习";
  }
  return "未学习";
}

// ===== 纯函数：研习描述规范化 =====

export function normalizeStudyDescription(value: string, studyMax: number): string {
  if (studyMax <= 0) {
    return value;
  }

  const normalized = (value || "").replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  const rows = Array.from({ length: studyMax }, () => "");
  let hasPrefixed = false;

  lines.forEach((line) => {
    const matched = line.match(/^level\s*(\d+)\s*[:：]?\s*(.*)$/i);
    if (!matched) {
      return;
    }
    hasPrefixed = true;
    const level = Math.max(1, Number(matched[1]));
    if (level <= studyMax) {
      rows[level - 1] = matched[2] ?? "";
    }
  });

  if (!hasPrefixed && normalized) {
    rows[0] = normalized;
  }

  return rows.map((row, index) => `level${index + 1} ${row}`).join("\n");
}
