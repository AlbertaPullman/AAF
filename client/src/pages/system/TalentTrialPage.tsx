import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";

type TalentTreeType = "PROFESSION" | "GENERAL";
type TalentTreeStatus = "DRAFT" | "PUBLISHED";

type TalentTreeTemplate = {
  id: string;
  name: string;
  description: string;
  treeType: TalentTreeType;
  category: string;
  status: TalentTreeStatus;
  version: number;
  graphData: unknown;
  updatedAt: string;
};

type TemplateListResponse = {
  editable: boolean;
  templates: TalentTreeTemplate[];
};

type AffixMeta = Record<string, unknown>;

type RequirementItem = {
  profession: string;
  level: number;
};

type ParsedAffixMeta = {
  mastery: boolean;
  exclusive: boolean;
  studyMax: number;
};

type TalentNode = {
  id: string;
  title: string;
  summary: string;
  description: string;
  requirement: string;
  cost: number;
  talentAffix: string;
  affixMeta: ParsedAffixMeta;
  requirementMeta: RequirementItem[];
  parentNodeIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
};

type TalentEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

type TalentProjection = {
  nodes: TalentNode[];
  edges: TalentEdge[];
  width: number;
  height: number;
};

type PersistedTrialState = {
  professionLevels: Record<string, number>;
  committedRanks: Record<string, number>;
};

type TalentPreviewMode = "THUMBNAIL" | "DETAIL";

const BASE_TALENT_POINTS = 999;
const TALENT_PREVIEW_THUMBNAIL_SPACING_X = 1.06;
const TALENT_PREVIEW_THUMBNAIL_SPACING_Y = 1.12;
const TALENT_PREVIEW_DETAIL_SPACING_X = 1.04;
const TALENT_PREVIEW_DETAIL_SPACING_Y = 1.74;
const TALENT_PREVIEW_THUMBNAIL_NODE_HEIGHT = 156;
const TALENT_PREVIEW_DETAIL_NODE_HEIGHT = 300;

const PROFESSION_LIST = [
  "狂怒斗士",
  "战士",
  "影刃",
  "猎魔人",
  "灵语者",
  "祭司",
  "秘武者",
  "骑士",
  "魔法师",
  "吟游诗人",
  "魔能使",
  "机兵士"
] as const;

const STORAGE_PREFIX = "talent-trial-state-v1:";

function parseAffixMeta(value: unknown, rawMeta?: AffixMeta): ParsedAffixMeta {
  let mastery = false;
  let exclusive = false;
  let studyMax = 0;

  if (rawMeta && typeof rawMeta === "object") {
    const legacyType = typeof rawMeta.type === "string" ? rawMeta.type : "";
    if (legacyType === "MASTERY") {
      mastery = true;
    }
    if (legacyType === "EXCLUSIVE") {
      exclusive = true;
    }
    if (legacyType === "STUDY") {
      studyMax = Math.max(1, Number(rawMeta.studyMax || 1));
    }
    if (rawMeta.mastery === true) {
      mastery = true;
    }
    if (rawMeta.exclusive === true) {
      exclusive = true;
    }
    if (Number.isFinite(Number(rawMeta.studyMax)) && Number(rawMeta.studyMax) > 0) {
      studyMax = Math.max(studyMax, Number(rawMeta.studyMax));
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

function formatAffixText(meta: ParsedAffixMeta): string {
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

function normalizeStudyDescription(value: string, studyMax: number): string {
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

function parseRequirementItems(value: unknown): RequirementItem[] {
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
      if (!Number.isFinite(level) || level < 0 || !profession || !PROFESSION_LIST.includes(profession as any)) {
        return null;
      }
      return { level, profession };
    })
    .filter((item): item is RequirementItem => !!item);
}

function rankOf(ranks: Record<string, number>, nodeId: string): number {
  return Math.max(0, Number(ranks[nodeId] || 0));
}

function getNodeLearningStatusText(node: TalentNode, unlocked: boolean, rank: number) {
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

function buildProjection(graphData: unknown, mode: TalentPreviewMode): TalentProjection {
  if (!graphData || typeof graphData !== "object") {
    return { nodes: [], edges: [], width: 780, height: 420 };
  }
  const rawCells = (graphData as { cells?: unknown }).cells;
  if (!Array.isArray(rawCells)) {
    return { nodes: [], edges: [], width: 780, height: 420 };
  }

  const nodes: TalentNode[] = [];
  const edges: TalentEdge[] = [];
  const parentMap = new Map<string, Set<string>>();
  const yMap = new Map<string, number>();

  rawCells.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const cell = item as Record<string, unknown>;
    const shape = String(cell.shape ?? "");
    if (shape === "edge") {
      const source = cell.source && typeof cell.source === "object" ? (cell.source as Record<string, unknown>) : {};
      const target = cell.target && typeof cell.target === "object" ? (cell.target as Record<string, unknown>) : {};
      const sourceNodeId = typeof source.cell === "string" ? source.cell : "";
      const targetNodeId = typeof target.cell === "string" ? target.cell : "";
      if (sourceNodeId && targetNodeId) {
        edges.push({
          id: typeof cell.id === "string" ? cell.id : `edge_${index}`,
          sourceNodeId,
          targetNodeId
        });
      }
      return;
    }

    const data = cell.data && typeof cell.data === "object" ? (cell.data as Record<string, unknown>) : {};
    const position = cell.position && typeof cell.position === "object" ? (cell.position as Record<string, unknown>) : {};
    const size = cell.size && typeof cell.size === "object" ? (cell.size as Record<string, unknown>) : {};

    const id = typeof cell.id === "string" ? cell.id : `node_${index}`;
    const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "未命名节点";
    const x = typeof cell.x === "number" ? cell.x : (typeof position.x === "number" ? position.x : index * 30);
    const y = typeof cell.y === "number" ? cell.y : (typeof position.y === "number" ? position.y : index * 24);
    const width = typeof cell.width === "number" ? cell.width : (typeof size.width === "number" ? size.width : 220);
    const height = typeof cell.height === "number" ? cell.height : (typeof size.height === "number" ? size.height : 160);

    yMap.set(id, y);

    const parsedAffix = parseAffixMeta(data.talentAffix, data.affixMeta as AffixMeta | undefined);
    const talentAffix = (typeof data.talentAffix === "string" && data.talentAffix.trim())
      ? data.talentAffix
      : formatAffixText(parsedAffix);
    const descriptionText = typeof data.description === "string" ? data.description : "";

    nodes.push({
      id,
      title,
      summary: typeof data.summary === "string" ? data.summary : "",
      description: normalizeStudyDescription(descriptionText, parsedAffix.studyMax),
      requirement: typeof data.requirement === "string" ? data.requirement : "",
      cost: typeof data.cost === "number" && Number.isFinite(data.cost) ? Math.max(0, Number(data.cost)) : 1,
      talentAffix,
      affixMeta: parsedAffix,
      requirementMeta: Array.isArray(data.requirementMeta)
        ? (data.requirementMeta as RequirementItem[])
        : parseRequirementItems(data.requirement),
      parentNodeIds: Array.isArray(data.parentNodeIds)
        ? (data.parentNodeIds as string[])
        : [],
      x,
      y,
      width,
      height
    });
  });

  if (!nodes.length) {
    return { nodes: [], edges, width: 780, height: 420 };
  }

  const nodeIdSet = new Set(nodes.map((node) => node.id));
  edges.forEach((edge) => {
    if (!nodeIdSet.has(edge.sourceNodeId) || !nodeIdSet.has(edge.targetNodeId)) {
      return;
    }

    let parentId = edge.sourceNodeId;
    let childId = edge.targetNodeId;
    const sourceY = yMap.get(edge.sourceNodeId) ?? 0;
    const targetY = yMap.get(edge.targetNodeId) ?? 0;
    if (sourceY > targetY) {
      parentId = edge.targetNodeId;
      childId = edge.sourceNodeId;
    }

    const set = parentMap.get(childId) ?? new Set<string>();
    set.add(parentId);
    parentMap.set(childId, set);
  });

  const normalizedNodes = nodes.map((node) => ({
    ...node,
    parentNodeIds: node.parentNodeIds.length
      ? node.parentNodeIds
      : Array.from(parentMap.get(node.id) ?? [])
  }));

  const baseSpacingX = mode === "DETAIL" ? TALENT_PREVIEW_DETAIL_SPACING_X : TALENT_PREVIEW_THUMBNAIL_SPACING_X;
  const baseSpacingY = mode === "DETAIL" ? TALENT_PREVIEW_DETAIL_SPACING_Y : TALENT_PREVIEW_THUMBNAIL_SPACING_Y;
  const nodeHeight = mode === "DETAIL" ? TALENT_PREVIEW_DETAIL_NODE_HEIGHT : TALENT_PREVIEW_THUMBNAIL_NODE_HEIGHT;

  const maxNodeWidth = Math.max(...normalizedNodes.map((node) => Math.max(180, node.width)));
  const widthScale = Math.max(1, maxNodeWidth / 180);
  const heightScale = Math.max(1, nodeHeight / TALENT_PREVIEW_THUMBNAIL_NODE_HEIGHT);
  const spacingX = baseSpacingX * widthScale;
  const spacingY = baseSpacingY * heightScale;

  const minX = Math.min(...normalizedNodes.map((node) => node.x));
  const minY = Math.min(...normalizedNodes.map((node) => node.y));
  const shiftedNodes = normalizedNodes.map((node) => ({
    ...node,
    x: (node.x - minX) * spacingX + 32,
    y: (node.y - minY) * spacingY + 32,
    width: Math.max(180, node.width),
    height: nodeHeight
  }));

  if (mode === "DETAIL") {
    const minVerticalGap = 20;
    const layerMergeThreshold = 90;
    const sortedNodes = [...shiftedNodes].sort((left, right) => left.y - right.y);
    const layers: TalentNode[][] = [];

    sortedNodes.forEach((node) => {
      const lastLayer = layers[layers.length - 1];
      if (!lastLayer) {
        layers.push([node]);
        return;
      }
      const layerAnchor = lastLayer[0].y;
      if (Math.abs(node.y - layerAnchor) <= layerMergeThreshold) {
        lastLayer.push(node);
      } else {
        layers.push([node]);
      }
    });

    let previousLayerBottom = 0;
    layers.forEach((layer, index) => {
      const naturalY = Math.min(...layer.map((node) => node.y));
      const alignedY = index === 0 ? naturalY : Math.max(naturalY, previousLayerBottom + minVerticalGap);
      layer.forEach((node) => {
        node.y = alignedY;
      });
      previousLayerBottom = alignedY + nodeHeight;
    });
  }

  const maxX = Math.max(...shiftedNodes.map((node) => node.x + node.width));
  const maxY = Math.max(...shiftedNodes.map((node) => node.y + node.height));

  return {
    nodes: shiftedNodes,
    edges,
    width: Math.max(780, maxX + 32),
    height: Math.max(420, maxY + 32)
  };
}

function renderTalentInlineBoldText(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`b_${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`t_${index}`}>{part}</span>;
  });
}

function renderTalentLevelLine(line: string) {
  const matched = line.match(/^(level\s*\d+)\s*[:：]?\s*(.*)$/i);
  if (!matched) {
    return renderTalentInlineBoldText(line);
  }

  const [, levelLabel, detailText] = matched;
  return (
    <>
      <span className="lobby-talent-rich-levels__badge">{levelLabel}</span>
      {detailText ? <span className="lobby-talent-rich-levels__content">{renderTalentInlineBoldText(detailText)}</span> : null}
    </>
  );
}

function renderTalentRichParagraphs(value: string) {
  const normalized = (value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return <p>暂无描述</p>;
  }

  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
        const isStudyLevels = lines.length > 0 && lines.every((line) => /^level\s*\d+\b/i.test(line));

        if (isStudyLevels) {
          return (
            <div key={`p_${paragraphIndex}`} className="lobby-talent-rich-levels">
              {lines.map((line, lineIndex) => (
                <div key={`l_${paragraphIndex}_${lineIndex}`} className="lobby-talent-rich-levels__item">
                  {renderTalentLevelLine(line)}
                </div>
              ))}
            </div>
          );
        }

        return (
          <p key={`p_${paragraphIndex}`}>
            {lines.map((line, lineIndex) => (
              <span key={`l_${paragraphIndex}_${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderTalentInlineBoldText(line)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function loadPersisted(templateId: string): PersistedTrialState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${templateId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedTrialState;
    return {
      professionLevels: parsed.professionLevels && typeof parsed.professionLevels === "object" ? parsed.professionLevels : {},
      committedRanks: parsed.committedRanks && typeof parsed.committedRanks === "object" ? parsed.committedRanks : {}
    };
  } catch {
    return null;
  }
}

function savePersisted(templateId: string, data: PersistedTrialState) {
  localStorage.setItem(`${STORAGE_PREFIX}${templateId}`, JSON.stringify(data));
}

export default function TalentTrialPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.platformRole === "MASTER" || user?.platformRole === "ADMIN";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TalentTreeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [professionLevels, setProfessionLevels] = useState<Record<string, number>>({});
  const [committedRanks, setCommittedRanks] = useState<Record<string, number>>({});
  const [draftRanks, setDraftRanks] = useState<Record<string, number>>({});
  const [isLearningMode, setIsLearningMode] = useState(false);
  const [talentPreviewMode, setTalentPreviewMode] = useState<TalentPreviewMode>("THUMBNAIL");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  );

  const projection = useMemo(
    () => buildProjection(selectedTemplate?.graphData, talentPreviewMode),
    [selectedTemplate, talentPreviewMode]
  );

  const nodeById = useMemo(() => {
    const map = new Map<string, TalentNode>();
    projection.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [projection.nodes]);

  const activeRanks = isLearningMode ? draftRanks : committedRanks;

  const selectedNode = useMemo(
    () => projection.nodes.find((node) => node.id === selectedNodeId) ?? projection.nodes[0] ?? null,
    [projection.nodes, selectedNodeId]
  );

  const spentPoints = useMemo(
    () => projection.nodes.reduce((sum, node) => sum + rankOf(activeRanks, node.id) * node.cost, 0),
    [projection.nodes, activeRanks]
  );

  const availablePoints = BASE_TALENT_POINTS - spentPoints;

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await http.get("/talent-trees/templates");
      const data = (resp.data?.data ?? { templates: [] }) as TemplateListResponse;
      setTemplates(data.templates ?? []);
      if (!selectedTemplateId && data.templates?.[0]?.id) {
        setSelectedTemplateId(data.templates[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载天赋树模板失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void loadTemplates();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTemplate) {
      setProfessionLevels({});
      setCommittedRanks({});
      setDraftRanks({});
      setIsLearningMode(false);
      return;
    }

    const persisted = loadPersisted(selectedTemplate.id);
    const defaultLevels: Record<string, number> = {};
    PROFESSION_LIST.forEach((name) => {
      defaultLevels[name] = Math.max(0, Number(persisted?.professionLevels?.[name] || 0));
    });

    setProfessionLevels(defaultLevels);
    setCommittedRanks(persisted?.committedRanks ?? {});
    setDraftRanks(persisted?.committedRanks ?? {});
    setIsLearningMode(false);
    setSelectedNodeId(null);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!projection.nodes.length) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId((prev) => {
      if (prev && projection.nodes.some((node) => node.id === prev)) {
        return prev;
      }
      return projection.nodes[0].id;
    });
  }, [projection.nodes]);

  const isNodeUnlocked = useMemo(() => {
    const cache = new Map<string, boolean>();

    const canUnlock = (node: TalentNode): boolean => {
      const cached = cache.get(node.id);
      if (cached !== undefined) {
        return cached;
      }

      if (rankOf(activeRanks, node.id) > 0) {
        cache.set(node.id, true);
        return true;
      }

      const requirementPass = node.requirementMeta.every((item) => {
        const currentLevel = professionLevels[item.profession] ?? 0;
        return currentLevel >= item.level;
      });

      const parentPass = node.parentNodeIds.every((parentId) => rankOf(activeRanks, parentId) > 0);

      const masteryPass = node.affixMeta.mastery
        ? projection.nodes.some((other) => other.id !== node.id && other.title === node.title && rankOf(activeRanks, other.id) > 0)
        : false;

      const result = masteryPass || (requirementPass && parentPass);
      cache.set(node.id, result);
      return result;
    };

    const result = new Map<string, boolean>();
    projection.nodes.forEach((node) => {
      result.set(node.id, canUnlock(node));
    });
    return result;
  }, [activeRanks, professionLevels, projection.nodes]);

  const onStartLearning = () => {
    setDraftRanks(committedRanks);
    setIsLearningMode(true);
    setNotice("已进入学习模式，可点击节点左侧按钮预演学习。");
  };

  const onCancelLearning = () => {
    setDraftRanks(committedRanks);
    setIsLearningMode(false);
    setNotice("已取消本次学习，未保存改动已回退。");
  };

  const onCommitLearning = () => {
    if (!selectedTemplate) {
      return;
    }
    const confirmed = window.confirm("确认本次学习并保存吗？保存后将永久扣除对应天赋点。\n（当前为试用持久化）");
    if (!confirmed) {
      return;
    }

    setCommittedRanks(draftRanks);
    setIsLearningMode(false);
    savePersisted(selectedTemplate.id, {
      professionLevels,
      committedRanks: draftRanks
    });
    setNotice("学习结果已保存。刷新后仍会保留当前试用进度。");
  };

  const onLearnNode = (node: TalentNode) => {
    if (!isLearningMode) {
      return;
    }

    if (!isNodeUnlocked.get(node.id)) {
      setNotice("该节点尚未解锁，无法学习。");
      return;
    }

    const currentRank = rankOf(draftRanks, node.id);
    const committedRank = rankOf(committedRanks, node.id);
    const maxRank = node.affixMeta.studyMax > 0 ? Math.max(1, Number(node.affixMeta.studyMax || 1)) : 1;

    if (currentRank >= maxRank) {
      setNotice("该节点已达到可学习上限。");
      return;
    }

    if (node.affixMeta.exclusive) {
      const otherExclusive = projection.nodes.some((item) => {
        if (item.id === node.id || !item.affixMeta.exclusive) {
          return false;
        }
        return rankOf(draftRanks, item.id) > 0;
      });
      if (otherExclusive) {
        setNotice("本天赋树已有已学习的排他天赋，无法再学习其他排他天赋。");
        return;
      }
    }

    if (node.affixMeta.mastery) {
      const sameTitleLearned = projection.nodes.some((item) => {
        if (item.id === node.id || item.title !== node.title) {
          return false;
        }
        return rankOf(draftRanks, item.id) > 0;
      });
      if (sameTitleLearned) {
        setNotice("通晓同名效果不会叠加，无需重复学习。");
        return;
      }
    }

    if (availablePoints < node.cost) {
      setNotice("天赋点不足，无法学习该节点。");
      return;
    }

    const next = {
      ...draftRanks,
      [node.id]: currentRank + 1
    };

    if (currentRank === 0 && committedRank === 0 && node.affixMeta.mastery) {
      projection.nodes.forEach((item) => {
        if (item.id !== node.id && item.title === node.title && rankOf(next, item.id) === 0) {
          next[item.id] = 0;
        }
      });
    }

    setDraftRanks(next);
  };

  const onUnlearnNode = (node: TalentNode) => {
    if (!isLearningMode) {
      return;
    }

    const currentRank = rankOf(draftRanks, node.id);
    const committedRank = rankOf(committedRanks, node.id);
    if (currentRank <= committedRank) {
      setNotice("该节点无可回退的本次学习记录。");
      return;
    }

    const nextRank = currentRank - 1;
    const next = { ...draftRanks };
    if (nextRank <= 0) {
      delete next[node.id];
    } else {
      next[node.id] = nextRank;
    }

    const isLearnStateValid = (target: TalentNode, ranks: Record<string, number>) => {
      const requirementPass = target.requirementMeta.every((item) => {
        const currentLevel = professionLevels[item.profession] ?? 0;
        return currentLevel >= item.level;
      });

      const parentPass = target.parentNodeIds.every((parentId) => rankOf(ranks, parentId) > 0);

      const masteryPass = target.affixMeta.mastery
        ? projection.nodes.some(
          (other) => other.id !== target.id && other.title === target.title && rankOf(ranks, other.id) > 0
        )
        : false;

      return masteryPass || (requirementPass && parentPass);
    };

    const pruned = { ...next };
    let changed = false;
    do {
      changed = false;
      projection.nodes.forEach((item) => {
        const current = rankOf(pruned, item.id);
        if (current <= 0) {
          return;
        }

        if (isLearnStateValid(item, pruned)) {
          return;
        }

        const floorRank = rankOf(committedRanks, item.id);
        if (current <= floorRank) {
          return;
        }

        if (floorRank <= 0) {
          delete pruned[item.id];
        } else {
          pruned[item.id] = floorRank;
        }
        changed = true;
      });
    } while (changed);

    setDraftRanks(pruned);
  };

  const onResetTrial = () => {
    if (!selectedTemplate) {
      return;
    }
    const confirmed = window.confirm("确认重置当前试用进度吗？\n将清空职业等级和全部学习记录。");
    if (!confirmed) {
      return;
    }

    const resetLevels: Record<string, number> = {};
    PROFESSION_LIST.forEach((name) => {
      resetLevels[name] = 0;
    });

    setProfessionLevels(resetLevels);
    setCommittedRanks({});
    setDraftRanks({});
    setIsLearningMode(false);
    localStorage.removeItem(`${STORAGE_PREFIX}${selectedTemplate.id}`);
    setNotice("已重置到初始状态，可重新测试学习流程。");
  };

  if (!isAdmin) {
    return (
      <div className="talent-trial-page">
        <div className="talent-trial-page__empty">仅平台管理员可使用角色天赋试用功能。</div>
        <div className="talent-trial-page__actions">
          <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
        </div>
      </div>
    );
  }

  return (
    <div className="talent-trial-page">
      <header className="talent-trial-page__header">
        <div>
          <h1>角色天赋试用</h1>
          <p>用于预模拟角色卡中的天赋学习流程（默认天赋点 999）。</p>
        </div>
        <div className="talent-trial-page__actions">
          <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
          <button type="button" onClick={() => void loadTemplates()} disabled={loading}>{loading ? "刷新中..." : "刷新"}</button>
        </div>
      </header>

      {error ? <p className="talent-trial-page__error">{error}</p> : null}
      {notice ? <p className="talent-trial-page__notice">{notice}</p> : null}

      <section className="talent-trial-toolbar">
        <label>
          选择天赋树
          <select
            value={selectedTemplate?.id ?? ""}
            onChange={(event) => setSelectedTemplateId(event.target.value || null)}
          >
            {templates.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.category}</option>
            ))}
          </select>
        </label>
        <div className="talent-trial-points">剩余天赋点：{availablePoints}</div>
        <button
          type="button"
          className={`lobby-talent-viewer__mode-btn ${talentPreviewMode === "DETAIL" ? "is-active" : ""}`}
          onClick={() => setTalentPreviewMode("DETAIL")}
        >
          详情图
        </button>
        <button
          type="button"
          className={`lobby-talent-viewer__mode-btn ${talentPreviewMode === "THUMBNAIL" ? "is-active" : ""}`}
          onClick={() => setTalentPreviewMode("THUMBNAIL")}
        >
          缩略图
        </button>
        {!isLearningMode ? (
          <button type="button" onClick={onStartLearning} disabled={!selectedTemplate}>学习天赋</button>
        ) : (
          <>
            <button type="button" onClick={onCommitLearning}>学习并保存</button>
            <button type="button" onClick={onCancelLearning}>取消本次学习</button>
          </>
        )}
        <button type="button" onClick={onResetTrial} disabled={!selectedTemplate}>重置</button>
      </section>

      <section className="talent-trial-professions">
        <h3>职业等级设定（用于前置条件测试）</h3>
        <div className="talent-trial-professions__grid">
          {PROFESSION_LIST.map((name) => (
            <label key={name}>
              <span>{name}</span>
              <input
                type="number"
                min={0}
                value={professionLevels[name] ?? 0}
                onChange={(event) => {
                  const next = Math.max(0, Number(event.target.value || 0));
                  setProfessionLevels((prev) => ({ ...prev, [name]: next }));
                }}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="talent-trial-canvas-wrap">
        {!selectedTemplate ? (
          <p className="talent-trial-page__empty">暂无可试用模板</p>
        ) : (
          <section
            className={`lobby-talent-viewer__workspace ${
              talentPreviewMode === "DETAIL" ? "is-detail-mode" : "is-thumbnail-mode"
            } talent-trial-viewer__workspace`}
          >
            <section className="lobby-talent-viewer__canvas-viewport">
              <div className="lobby-talent-viewer__canvas" style={{ width: projection.width, height: projection.height }}>
                <svg className="lobby-talent-viewer__edges" width={projection.width} height={projection.height} viewBox={`0 0 ${projection.width} ${projection.height}`}>
                  {projection.edges.map((edge) => {
                    const source = nodeById.get(edge.sourceNodeId);
                    const target = nodeById.get(edge.targetNodeId);
                    if (!source || !target) {
                      return null;
                    }
                    const sourceDown = source.y <= target.y;
                    const x1 = source.x + source.width / 2;
                    const y1 = sourceDown ? source.y + source.height : source.y;
                    const x2 = target.x + target.width / 2;
                    const y2 = sourceDown ? target.y : target.y + target.height;
                    return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2d3748" strokeWidth={2.4} strokeLinecap="round" />;
                  })}
                </svg>

                {projection.nodes.map((node) => {
                  const unlocked = Boolean(isNodeUnlocked.get(node.id));
                  const rank = rankOf(activeRanks, node.id);
                  const committedRank = rankOf(committedRanks, node.id);
                    const statusText = getNodeLearningStatusText(node, unlocked, rank);

                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`lobby-talent-viewer__canvas-node talent-trial-node ${selectedNode?.id === node.id ? "is-active" : ""} ${unlocked ? "is-unlocked" : "is-locked"} ${rank > 0 ? "is-learned" : ""}`}
                      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      {isLearningMode ? (
                        <div className="talent-trial-node-ops">
                          <button type="button" onClick={(event) => { event.stopPropagation(); onLearnNode(node); }} title="学习该节点">✓</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); onUnlearnNode(node); }} title="撤销本次学习">✕</button>
                        </div>
                      ) : null}

                      <p className="lobby-talent-viewer__canvas-line1">{node.title}</p>
                      <p>消耗：{node.cost}</p>
                      <p>前置：{node.requirement || "无"}</p>
                      <p>词缀：{node.talentAffix || "无"}</p>
                      <p className="talent-trial-node__rank">
                        {statusText}
                        {rank > committedRank ? "（未保存）" : ""}
                      </p>
                      {talentPreviewMode === "THUMBNAIL" ? (
                        <p className="lobby-talent-viewer__summary-line">概述：{node.summary || "暂无概述"}</p>
                      ) : (
                        <div className="lobby-talent-viewer__canvas-desc">
                          {renderTalentRichParagraphs(node.description)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {talentPreviewMode === "THUMBNAIL" ? (
              <section className="lobby-talent-viewer__node-detail">
                {!selectedNode ? (
                  <p>请选择节点查看详情</p>
                ) : (
                  <>
                    <h5>{selectedNode.title}</h5>
                    <p>消耗：{selectedNode.cost}</p>
                    <p>前置：{selectedNode.requirement || "无"}</p>
                    <p>词缀：{selectedNode.talentAffix || "无"}</p>
                    <div className="lobby-talent-viewer__node-detail-desc">
                      {renderTalentRichParagraphs(selectedNode.description)}
                    </div>
                  </>
                )}
              </section>
            ) : null}
          </section>
        )}
      </section>
    </div>
  );
}
