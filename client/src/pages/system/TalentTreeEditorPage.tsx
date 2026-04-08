import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Graph, Selection } from "@antv/x6";
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

type TalentTreeDirectoryItem = {
  id: string;
  path: string[];
  sortOrder: number;
};

type TemplateListResponse = {
  editable: boolean;
  templates: TalentTreeTemplate[];
  directories: TalentTreeDirectoryItem[];
};

type TalentDirectoryNode = {
  key: string;
  directoryId: string | null;
  sortOrder: number;
  label: string;
  path: string[];
  children: TalentDirectoryNode[];
  templates: TalentTreeTemplate[];
};

type TalentNodePreviewItem = {
  id: string;
  title: string;
  summary: string;
  cost: number;
  requirement: string;
  talentAffix: string;
};

type NodeFormState = {
  id: string;
  title: string;
  summary: string;
  description: string;
  studyDescriptions: string[];
  cost: number;
  requirement: string;
  affixMastery: boolean;
  affixStudy: boolean;
  affixStudyMax: number;
  affixExclusive: boolean;
};

type NodeClipboardPayload = {
  title: string;
  summary: string;
  description: string;
  cost: number;
  requirement: string;
  talentAffix: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

type NodeClipboardBundle = {
  nodes: Array<{
    oldId: string;
    payload: NodeClipboardPayload;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
};

type AffixMeta = {
  mastery: boolean;
  exclusive: boolean;
  studyMax?: number;
};

type RequirementItem = {
  profession: string;
  level: number;
};

type TalentImportNodeInput = {
  id?: string;
  name?: string;
  title?: string;
  summary?: string;
  description?: string;
  studyDescriptions?: string[];
  cost?: number;
  requirement?: string | Array<{ profession?: string; level?: number }>;
  affix?: string | string[] | { mastery?: boolean; exclusive?: boolean; studyMax?: number };
};

type TalentImportBranchInput = {
  x?: number;
  yStart?: number;
  autoConnect?: boolean;
  nodes?: TalentImportNodeInput[];
};

type TalentImportPayload = {
  name?: string;
  description?: string;
  treeType?: string;
  category?: string;
  autoConnect?: boolean;
  nodes?: TalentImportNodeInput[];
  branches?: TalentImportBranchInput[];
  edges?: Array<{ from?: string; to?: string }>;
};

type ParsedTalentImport = {
  graphData: { cells: Record<string, unknown>[] };
  nodeCount: number;
  edgeCount: number;
  meta: {
    name?: string;
    description?: string;
    treeType?: TalentTreeType;
    category?: string;
  };
};

type TemplateMetaFormState = {
  templateId: string;
  name: string;
  description: string;
  rootDirectory: string;
  subDirectoryInput: string;
};

const PROFESSION_NAME_SET = new Set([
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
]);

const TALENT_DIRECTORY_ROOTS = {
  profession: "职业天赋树",
  general: "通用天赋树"
} as const;

const TALENT_DIRECTORY_ROOT_ALIAS = new Map<string, string>([
  ["职业天赋树", TALENT_DIRECTORY_ROOTS.profession],
  ["职业天赋", TALENT_DIRECTORY_ROOTS.profession],
  ["职业", TALENT_DIRECTORY_ROOTS.profession],
  ["PROFESSION", TALENT_DIRECTORY_ROOTS.profession],
  ["通用天赋树", TALENT_DIRECTORY_ROOTS.general],
  ["通用天赋", TALENT_DIRECTORY_ROOTS.general],
  ["通用", TALENT_DIRECTORY_ROOTS.general],
  ["GENERAL", TALENT_DIRECTORY_ROOTS.general]
]);

const TALENT_NODE_PORTS = {
  groups: {
    in: {
      position: "top",
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: "#5b9be8",
          strokeWidth: 1,
          fill: "#ffffff"
        }
      }
    },
    out: {
      position: "bottom",
      attrs: {
        circle: {
          r: 4,
          magnet: true,
          stroke: "#5b9be8",
          strokeWidth: 1,
          fill: "#ffffff"
        }
      }
    }
  },
  items: [{ group: "in" }, { group: "out" }]
};

const TALENT_NODE_VISUAL = {
  bodyFill: "#ffffff",
  bodyStroke: "rgba(109, 165, 241, 0.28)",
  bodyStrokeWidth: 1,
  bodyRadius: 8,
  labelFill: "#124f90",
  labelFontSize: 11,
  labelFontWeight: 600
} as const;

type TalentNodeLabelPayload = {
  title: string;
  summary: string;
  cost: number;
  requirement: string;
  talentAffix: string;
};

function toShortNodeSummary(summary: string) {
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂无概述";
  }
  return normalized.length > 12 ? `${normalized.slice(0, 12)}…` : normalized;
}

function toTalentNodeLabelText(payload: TalentNodeLabelPayload) {
  const title = payload.title.trim() || "未命名节点";
  const cost = Number.isFinite(payload.cost) ? Math.max(0, Math.floor(payload.cost)) : 1;
  const requirement = payload.requirement.trim() || "无";
  const talentAffix = payload.talentAffix.trim() || "无";
  const summary = toShortNodeSummary(payload.summary);

  return [
    title,
    `消耗：${cost}`,
    `前置：${requirement}`,
    `词缀：${talentAffix}`,
    `概述：${summary}`
  ].join("\n");
}

function toTalentNodeLabelPayload(value: Record<string, unknown>): TalentNodeLabelPayload {
  return {
    title: typeof value.title === "string" ? value.title : "",
    summary: typeof value.summary === "string" ? value.summary : "",
    cost: typeof value.cost === "number" && Number.isFinite(value.cost) ? value.cost : 1,
    requirement: typeof value.requirement === "string" ? value.requirement : "",
    talentAffix: typeof value.talentAffix === "string" ? value.talentAffix : ""
  };
}

function createTalentNodeAttrs(payload: TalentNodeLabelPayload) {
  return {
    body: {
      fill: TALENT_NODE_VISUAL.bodyFill,
      stroke: TALENT_NODE_VISUAL.bodyStroke,
      strokeWidth: TALENT_NODE_VISUAL.bodyStrokeWidth,
      rx: TALENT_NODE_VISUAL.bodyRadius,
      ry: TALENT_NODE_VISUAL.bodyRadius
    },
    label: {
      text: toTalentNodeLabelText(payload),
      fill: TALENT_NODE_VISUAL.labelFill,
      fontSize: TALENT_NODE_VISUAL.labelFontSize,
      fontWeight: TALENT_NODE_VISUAL.labelFontWeight,
      lineHeight: 16,
      textVerticalAnchor: "top",
      textAnchor: "start",
      refX: 10,
      refY: 8,
      textWrap: {
        width: -20,
        height: -16,
        ellipsis: true,
        breakWord: true
      }
    }
  };
}

const IMPORT_LAYOUT = {
  startX: 80,
  startY: 80,
  columnGap: 230,
  rowGap: 104,
  nodeWidth: 196,
  nodeHeight: 92
};

const TALENT_EDITOR_GRID_SIZE = 12;
const TALENT_EDITOR_MIN_NODE_GAP_GRID = 5;
const TALENT_EDITOR_MIN_NODE_GAP = TALENT_EDITOR_GRID_SIZE * TALENT_EDITOR_MIN_NODE_GAP_GRID;
const TALENT_EDITOR_MIN_GAP_MAX_ITERATIONS = 12;

const TALENT_IMPORT_EXAMPLE = JSON.stringify(
  {
    name: "狂怒斗士天赋树",
    treeType: "PROFESSION",
    category: "职业天赋树/狂怒斗士",
    description: "从思维导图一键导入",
    branches: [
      {
        nodes: [
          {
            name: "鲁莽攻击",
            cost: 1,
            requirement: "无",
            affix: "",
            description: "你进行攻击时，可选择造成额外效果。"
          },
          {
            name: "血性狂怒",
            cost: 1,
            requirement: "1狂怒斗士",
            affix: "",
            description: "进入狂怒状态后获得额外收益。"
          }
        ]
      },
      {
        nodes: [
          {
            name: "钢筋铁骨",
            cost: 1,
            requirement: "无",
            affix: { studyMax: 5 },
            studyDescriptions: [
              "LV1：获得少量护甲",
              "LV2：护甲继续提升",
              "LV3：护甲继续提升",
              "LV4：护甲继续提升",
              "LV5：护甲继续提升"
            ]
          }
        ]
      }
    ]
  },
  null,
  2
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseImportTreeType(value: unknown): TalentTreeType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "GENERAL") {
    return "GENERAL";
  }
  if (normalized === "PROFESSION") {
    return "PROFESSION";
  }
  return undefined;
}

function toRootDirectoryByType(treeType: TalentTreeType) {
  return treeType === "GENERAL" ? TALENT_DIRECTORY_ROOTS.general : TALENT_DIRECTORY_ROOTS.profession;
}

function normalizeRootDirectoryName(value: string) {
  return TALENT_DIRECTORY_ROOT_ALIAS.get(value.trim().toUpperCase())
    || TALENT_DIRECTORY_ROOT_ALIAS.get(value.trim())
    || null;
}

function inferTreeTypeByDirectoryPath(pathValue: string[], fallback: TalentTreeType = "PROFESSION"): TalentTreeType {
  const root = normalizeRootDirectoryName(pathValue[0] ?? "");
  if (root === TALENT_DIRECTORY_ROOTS.general) {
    return "GENERAL";
  }
  if (root === TALENT_DIRECTORY_ROOTS.profession) {
    return "PROFESSION";
  }
  return fallback;
}

function normalizeCategoryPath(pathValue: string[], fallback: TalentTreeType = "PROFESSION") {
  const normalized = pathValue
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!normalized.length) {
    return [toRootDirectoryByType(fallback)];
  }

  const root = normalizeRootDirectoryName(normalized[0]);
  if (root) {
    return [root, ...normalized.slice(1)];
  }

  return [toRootDirectoryByType(fallback), ...normalized.slice(0, 5)];
}

function normalizeRequirementFromImport(value: TalentImportNodeInput["requirement"]) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }
      const level = typeof item.level === "number" && Number.isFinite(item.level) ? Math.max(0, Math.floor(item.level)) : null;
      const profession = typeof item.profession === "string" ? item.profession.trim() : "";
      if (level === null || !profession) {
        return "";
      }
      return `${level}${profession}`;
    })
    .filter(Boolean)
    .join("/");
}

function normalizeAffixFromImport(value: TalentImportNodeInput["affix"]) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join("，");
  }

  if (isRecord(value)) {
    return formatTalentAffixText({
      mastery: Boolean(value.mastery),
      exclusive: Boolean(value.exclusive),
      studyMax: typeof value.studyMax === "number" && Number.isFinite(value.studyMax)
        ? Math.max(1, Math.floor(value.studyMax))
        : undefined
    });
  }

  return "";
}

function resolveNodeDescriptionFromImport(node: TalentImportNodeInput, talentAffix: string) {
  const studyLines = Array.isArray(node.studyDescriptions)
    ? node.studyDescriptions.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean)
    : [];

  if (!studyLines.length) {
    return typeof node.description === "string" ? node.description : "";
  }

  const affixMeta = parseTalentAffixMeta(talentAffix);
  const studyMax = Math.max(studyLines.length, Number(affixMeta.studyMax || 1));
  return composeStudyDescription(studyLines, studyMax);
}

function parseTalentImportPayload(raw: unknown): ParsedTalentImport {
  const payload: TalentImportPayload = Array.isArray(raw)
    ? { nodes: raw as TalentImportNodeInput[] }
    : (isRecord(raw) ? (raw as TalentImportPayload) : {});

  const branches: TalentImportBranchInput[] = Array.isArray(payload.branches)
    ? payload.branches
    : [{ nodes: Array.isArray(payload.nodes) ? payload.nodes : [] }];

  const defaultAutoConnect = payload.autoConnect !== false;
  const cells: Record<string, unknown>[] = [];
  const aliasToNodeId = new Map<string, string>();
  let nodeCount = 0;
  let edgeCount = 0;

  branches.forEach((branch, branchIndex) => {
    const sourceNodes = Array.isArray(branch.nodes) ? branch.nodes : [];
    const nodeIds: string[] = [];
    const baseX = typeof branch.x === "number" && Number.isFinite(branch.x)
      ? branch.x
      : IMPORT_LAYOUT.startX + branchIndex * IMPORT_LAYOUT.columnGap;
    const baseY = typeof branch.yStart === "number" && Number.isFinite(branch.yStart)
      ? branch.yStart
      : IMPORT_LAYOUT.startY;

    sourceNodes.forEach((node, nodeIndex) => {
      const title = (typeof node.name === "string" ? node.name : node.title || "").trim() || `天赋节点 ${nodeCount + 1}`;
      const nodeId = typeof node.id === "string" && node.id.trim()
        ? node.id.trim()
        : `import_node_${branchIndex + 1}_${nodeIndex + 1}`;
      const cost = typeof node.cost === "number" && Number.isFinite(node.cost) ? Math.max(0, Math.floor(node.cost)) : 1;
      const talentAffix = normalizeAffixFromImport(node.affix);

      const x = baseX;
      const y = baseY + nodeIndex * IMPORT_LAYOUT.rowGap;
      const description = resolveNodeDescriptionFromImport(node, talentAffix);
      const nodePayload = {
        title,
        summary: typeof node.summary === "string" ? node.summary : "",
        cost,
        requirement: normalizeRequirementFromImport(node.requirement),
        talentAffix
      };

      cells.push({
        id: nodeId,
        shape: "rect",
        x,
        y,
        width: IMPORT_LAYOUT.nodeWidth,
        height: IMPORT_LAYOUT.nodeHeight,
        attrs: createTalentNodeAttrs(nodePayload),
        data: {
          title: nodePayload.title,
          summary: nodePayload.summary,
          description,
          cost: nodePayload.cost,
          requirement: nodePayload.requirement,
          talentAffix: nodePayload.talentAffix
        },
        ports: TALENT_NODE_PORTS
      });

      aliasToNodeId.set(nodeId, nodeId);
      aliasToNodeId.set(title, nodeId);
      nodeIds.push(nodeId);
      nodeCount += 1;
    });

    const shouldAutoConnect = branch.autoConnect ?? defaultAutoConnect;
    if (!shouldAutoConnect) {
      return;
    }

    for (let i = 1; i < nodeIds.length; i += 1) {
      const parentId = nodeIds[i - 1];
      const childId = nodeIds[i];
      cells.push({
        id: `import_edge_auto_${branchIndex + 1}_${i}`,
        shape: "edge",
        source: { cell: parentId },
        target: { cell: childId },
        attrs: {
          line: {
            stroke: "#5b9be8",
            strokeWidth: 2
          }
        }
      });
      edgeCount += 1;
    }
  });

  if (Array.isArray(payload.edges)) {
    payload.edges.forEach((edge, index) => {
      const fromAlias = typeof edge?.from === "string" ? edge.from.trim() : "";
      const toAlias = typeof edge?.to === "string" ? edge.to.trim() : "";
      if (!fromAlias || !toAlias) {
        return;
      }
      const sourceId = aliasToNodeId.get(fromAlias);
      const targetId = aliasToNodeId.get(toAlias);
      if (!sourceId || !targetId || sourceId === targetId) {
        return;
      }

      cells.push({
        id: `import_edge_manual_${index + 1}`,
        shape: "edge",
        source: { cell: sourceId },
        target: { cell: targetId },
        attrs: {
          line: {
            stroke: "#5b9be8",
            strokeWidth: 2
          }
        }
      });
      edgeCount += 1;
    });
  }

  return {
    graphData: { cells },
    nodeCount,
    edgeCount,
    meta: {
      name: typeof payload.name === "string" ? payload.name.trim() : undefined,
      description: typeof payload.description === "string" ? payload.description : undefined,
      treeType: parseImportTreeType(payload.treeType),
      category: typeof payload.category === "string" ? payload.category.trim() : undefined
    }
  };
}

function parseDirectoryPath(value: string, fallback: TalentTreeType = "PROFESSION") {
  return normalizeCategoryPath(value.split("/"), fallback);
}

function toDirectoryKey(pathValue: string[]) {
  return pathValue.join("::");
}

function normalizeTemplateSort(left: TalentTreeTemplate, right: TalentTreeTemplate) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function buildTalentDirectoryTree(templates: TalentTreeTemplate[], directories: TalentTreeDirectoryItem[]) {
  const roots: TalentDirectoryNode[] = [];
  const nodeMap = new Map<string, TalentDirectoryNode>();

  const ensureNode = (pathValue: string[]) => {
    if (!pathValue.length) {
      return null;
    }

    let parent: TalentDirectoryNode | null = null;
    for (let index = 0; index < pathValue.length; index += 1) {
      const currentPath = pathValue.slice(0, index + 1);
      const key = toDirectoryKey(currentPath);
      let current = nodeMap.get(key);
      if (!current) {
        current = {
          key,
          directoryId: null,
          sortOrder: Number.MAX_SAFE_INTEGER,
          label: currentPath[currentPath.length - 1],
          path: currentPath,
          children: [],
          templates: []
        };
        nodeMap.set(key, current);
        if (parent) {
          if (!parent.children.some((item) => item.key === current?.key)) {
            parent.children.push(current);
          }
        } else if (!roots.some((item) => item.key === current?.key)) {
          roots.push(current);
        }
      }
      parent = current;
    }

    return parent;
  };

  directories
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .forEach((directory) => {
      const rawPath = (directory.path ?? []).map((item) => String(item || ""));
      const fallbackTreeType = inferTreeTypeByDirectoryPath(rawPath, "PROFESSION");
      const normalizedPath = normalizeCategoryPath(rawPath, fallbackTreeType);
      const node = ensureNode(normalizedPath);
      if (node) {
        node.directoryId = directory.id;
        node.sortOrder = directory.sortOrder;
      }
    });

  const uncategorizedTemplates: TalentTreeTemplate[] = [];
  templates
    .slice()
    .sort(normalizeTemplateSort)
    .forEach((template) => {
      const pathValue = parseDirectoryPath(template.category || "", template.treeType);
      const node = ensureNode(pathValue);
      if (node) {
        node.templates.push(template);
      } else {
        uncategorizedTemplates.push(template);
      }
    });

  const sortNodes = (nodes: TalentDirectoryNode[]) => {
    nodes
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.label.localeCompare(right.label, "zh-Hans-CN");
      })
      .forEach((node) => {
        node.templates.sort(normalizeTemplateSort);
        sortNodes(node.children);
      });
  };

  sortNodes(roots);

  if (uncategorizedTemplates.length) {
    roots.unshift({
      key: "__root__",
      directoryId: null,
      sortOrder: Number.MIN_SAFE_INTEGER,
      label: "未分类",
      path: [],
      children: [],
      templates: uncategorizedTemplates
    });
  }

  return roots;
}

function extractTalentNodePreviewItems(rawGraph: unknown): TalentNodePreviewItem[] {
  const graphData = toGraphData(rawGraph);
  const cells = Array.isArray(graphData.cells) ? graphData.cells : [];
  const previews = cells
    .filter((cell) => cell.shape !== "edge")
    .map((cell, index) => {
      const data = cell.data && typeof cell.data === "object" ? (cell.data as Record<string, unknown>) : {};
      const title = (typeof data.title === "string" && data.title.trim()) || resolveNodeTitleFromCell(cell);
      const x = typeof cell.x === "number" ? cell.x : 0;
      const y = typeof cell.y === "number" ? cell.y : 0;
      return {
        index,
        x,
        y,
        item: {
          id: String(cell.id ?? `preview_node_${index + 1}`),
          title,
          summary: typeof data.summary === "string" ? data.summary : "",
          cost: typeof data.cost === "number" && Number.isFinite(data.cost) ? data.cost : 1,
          requirement: typeof data.requirement === "string" ? data.requirement : "",
          talentAffix: typeof data.talentAffix === "string" ? data.talentAffix : ""
        }
      };
    });

  return previews
    .sort((left, right) => left.y - right.y || left.x - right.x || left.index - right.index)
    .map((row) => row.item);
}

function resolveTemplateDirectoryHint(template: TalentTreeTemplate) {
  const categoryPath = parseDirectoryPath(template.category || "", template.treeType);
  if (categoryPath.length <= 1) {
    return "根目录";
  }
  return categoryPath.slice(1).join(" / ");
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveNodeTitleFromCell(cell: Record<string, unknown>) {
  const data = cell.data && typeof cell.data === "object" ? (cell.data as Record<string, unknown>) : null;
  const dataTitle = data && typeof data.title === "string" ? data.title.trim() : "";
  if (dataTitle) {
    return dataTitle;
  }

  const attrs = cell.attrs && typeof cell.attrs === "object" ? (cell.attrs as Record<string, unknown>) : null;
  const label = attrs?.label && typeof attrs.label === "object" ? (attrs.label as Record<string, unknown>) : null;
  const labelTextRaw = label && typeof label.text === "string" ? label.text.trim() : "";
  const labelText = labelTextRaw.split("\n")[0]?.trim() ?? "";
  if (labelText) {
    return labelText;
  }

  return "未命名节点";
}

function toGraphData(value: unknown) {
  if (!value || typeof value !== "object") {
    return { cells: [] };
  }

  const cells = (value as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) {
    return { cells: [] };
  }

  const normalizedCells = cells
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const cell = { ...(item as Record<string, unknown>) };
      if (cell.shape === "edge") {
        return cell;
      }

      const data = cell.data && typeof cell.data === "object" ? { ...(cell.data as Record<string, unknown>) } : {};
      const title = resolveNodeTitleFromCell(cell);
      data.title = typeof data.title === "string" && data.title.trim() ? data.title : title;
      data.summary = typeof data.summary === "string" ? data.summary : "";
      data.description = typeof data.description === "string" ? data.description : "";
      data.cost = typeof data.cost === "number" && Number.isFinite(data.cost) ? data.cost : 1;
      data.requirement = typeof data.requirement === "string" ? data.requirement : "";
      data.talentAffix = typeof data.talentAffix === "string" ? data.talentAffix : "";

      const attrs = cell.attrs && typeof cell.attrs === "object" ? { ...(cell.attrs as Record<string, unknown>) } : {};
      const body = attrs.body && typeof attrs.body === "object" ? { ...(attrs.body as Record<string, unknown>) } : {};
      const label = attrs.label && typeof attrs.label === "object" ? { ...(attrs.label as Record<string, unknown>) } : {};
      attrs.body = {
        ...body,
        fill: TALENT_NODE_VISUAL.bodyFill,
        stroke: TALENT_NODE_VISUAL.bodyStroke,
        strokeWidth: TALENT_NODE_VISUAL.bodyStrokeWidth,
        rx: TALENT_NODE_VISUAL.bodyRadius,
        ry: TALENT_NODE_VISUAL.bodyRadius
      };
      label.fill = TALENT_NODE_VISUAL.labelFill;
      label.fontSize = TALENT_NODE_VISUAL.labelFontSize;
      label.fontWeight = TALENT_NODE_VISUAL.labelFontWeight;
      label.lineHeight = 16;
      label.textAnchor = "start";
      label.textVerticalAnchor = "top";
      label.refX = 10;
      label.refY = 8;
      label.textWrap = {
        width: -20,
        height: -16,
        ellipsis: true,
        breakWord: true
      };
      label.text = toTalentNodeLabelText(toTalentNodeLabelPayload(data));
      attrs.label = label;

      const width = IMPORT_LAYOUT.nodeWidth;
      const height = IMPORT_LAYOUT.nodeHeight;

      const ports = cell.ports && typeof cell.ports === "object" ? (cell.ports as Record<string, unknown>) : null;
      const existingItems = ports && Array.isArray((ports as { items?: unknown }).items)
        ? ((ports as { items?: unknown[] }).items ?? [])
        : [];
      const hasValidPorts = existingItems.length > 0;

      return {
        ...cell,
        width,
        height,
        data,
        attrs,
        ports: hasValidPorts ? ports : TALENT_NODE_PORTS
      };
    })
    .filter((item): item is Record<string, unknown> => !!item);

  return { cells: normalizedCells };
}

function enforceNodeMinimumGap(graph: Graph, movedNodeId: string, minGap: number) {
  const movedCell = graph.getCellById(movedNodeId);
  if (!movedCell || !movedCell.isNode()) {
    return false;
  }

  const movedNode = movedCell as unknown as {
    getBBox: () => { x: number; y: number; width: number; height: number };
    position: (x: number, y: number, options?: { silent?: boolean }) => void;
  };

  const otherNodes = graph
    .getNodes()
    .filter((node) => String(node.id) !== movedNodeId) as Array<{
      getBBox: () => { x: number; y: number; width: number; height: number };
    }>;

  if (!otherNodes.length) {
    return false;
  }

  let adjusted = false;

  for (let pass = 0; pass < TALENT_EDITOR_MIN_GAP_MAX_ITERATIONS; pass += 1) {
    const movedBox = movedNode.getBBox();
    const movedRect = {
      left: movedBox.x,
      right: movedBox.x + movedBox.width,
      top: movedBox.y,
      bottom: movedBox.y + movedBox.height
    };

    let passAdjusted = false;

    for (const otherNode of otherNodes) {
      const other = otherNode.getBBox();
      const overlapX = Math.min(movedRect.right, other.x + other.width) - Math.max(movedRect.left, other.x);
      if (overlapX <= 0) {
        continue;
      }

      const movedCenterY = movedRect.top + movedBox.height / 2;
      const otherCenterY = other.y + other.height / 2;

      let nextY: number | null = null;

      if (movedRect.top >= other.y + other.height) {
        const verticalGap = movedRect.top - (other.y + other.height);
        if (verticalGap < minGap) {
          nextY = other.y + other.height + minGap;
        }
      } else if (other.y >= movedRect.bottom) {
        const verticalGap = other.y - movedRect.bottom;
        if (verticalGap < minGap) {
          nextY = other.y - minGap - movedBox.height;
        }
      } else {
        nextY = movedCenterY >= otherCenterY
          ? other.y + other.height + minGap
          : other.y - minGap - movedBox.height;
      }

      if (nextY === null) {
        continue;
      }

      const currentX = movedRect.left;
      movedNode.position(currentX, Math.max(0, nextY), { silent: true });

      adjusted = true;
      passAdjusted = true;
      break;
    }

    if (!passAdjusted) {
      break;
    }
  }

  return adjusted;
}

function enforceAllNodesMinimumGap(graph: Graph, minGap: number) {
  let adjusted = false;
  graph.getNodes().forEach((node) => {
    if (enforceNodeMinimumGap(graph, String(node.id), minGap)) {
      adjusted = true;
    }
  });
  return adjusted;
}

function parseTalentAffixMeta(value: unknown): AffixMeta {
  const text = typeof value === "string" ? value.trim() : "";
  const parts = text
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  let mastery = false;
  let exclusive = false;
  let studyMax: number | undefined;

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
      studyMax = Math.max(1, Number(studyMatch[1]));
    }
  });

  return { mastery, exclusive, studyMax };
}

function formatTalentAffixText(affix: { mastery: boolean; exclusive: boolean; studyMax?: number }) {
  const parts: string[] = [];
  if (affix.mastery) {
    parts.push("通晓");
  }
  if (affix.studyMax && affix.studyMax > 0) {
    parts.push(`研习${affix.studyMax}`);
  }
  if (affix.exclusive) {
    parts.push("排他");
  }
  return parts.join("，");
}

function parseStudyDescriptionLines(description: string, studyMax: number) {
  const normalized = (description || "").replace(/\r\n/g, "\n").trim();
  const rows = Array.from({ length: Math.max(1, studyMax) }, () => "");
  if (!normalized) {
    return rows;
  }

  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  let hasPrefixedLine = false;
  lines.forEach((line) => {
    const matched = line.match(/^level\s*(\d+)\s*[:：]?\s*(.*)$/i);
    if (!matched) {
      return;
    }
    hasPrefixedLine = true;
    const level = Math.max(1, Number(matched[1]));
    if (level > rows.length) {
      return;
    }
    rows[level - 1] = matched[2] ?? "";
  });

  if (!hasPrefixedLine) {
    rows[0] = normalized;
  }

  return rows;
}

function composeStudyDescription(studyDescriptions: string[], studyMax: number) {
  const size = Math.max(1, studyMax);
  return Array.from({ length: size }, (_, index) => {
    const value = (studyDescriptions[index] ?? "").trim();
    return `level${index + 1} ${value}`;
  }).join("\n");
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
      if (!Number.isFinite(level) || level < 0 || !profession || !PROFESSION_NAME_SET.has(profession)) {
        return null;
      }
      return { level, profession };
    })
    .filter((item): item is RequirementItem => !!item);
}

function enrichTalentGraphForRuntime(raw: unknown) {
  const graph = toGraphData(raw);
  const cells = Array.isArray(graph.cells) ? graph.cells : [];
  const nodeIds = new Set<string>();
  const nodeYMap = new Map<string, number>();

  cells.forEach((cell) => {
    if (!cell || typeof cell !== "object") {
      return;
    }
    const shape = String((cell as { shape?: unknown }).shape ?? "");
    if (shape === "edge") {
      return;
    }
    const id = String((cell as { id?: unknown }).id ?? "");
    if (!id) {
      return;
    }
    nodeIds.add(id);
    const position = (cell as { position?: { y?: unknown } }).position;
    const y = typeof (cell as { y?: unknown }).y === "number"
      ? Number((cell as { y: number }).y)
      : (typeof position?.y === "number" ? Number(position.y) : null);
    if (y !== null) {
      nodeYMap.set(id, y);
    }
  });

  const parentMap = new Map<string, Set<string>>();
  cells.forEach((cell) => {
    if (!cell || typeof cell !== "object") {
      return;
    }
    const shape = String((cell as { shape?: unknown }).shape ?? "");
    if (shape !== "edge") {
      return;
    }

    const source = (cell as { source?: { cell?: unknown } }).source;
    const target = (cell as { target?: { cell?: unknown } }).target;
    let sourceId = typeof source?.cell === "string" ? source.cell : "";
    let targetId = typeof target?.cell === "string" ? target.cell : "";
    if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      return;
    }

    const sourceY = nodeYMap.get(sourceId) ?? null;
    const targetY = nodeYMap.get(targetId) ?? null;

    if (sourceY !== null && targetY !== null && sourceY > targetY) {
      const temp = sourceId;
      sourceId = targetId;
      targetId = temp;
    }

    const current = parentMap.get(targetId) ?? new Set<string>();
    current.add(sourceId);
    parentMap.set(targetId, current);
  });

  const enrichedCells = cells.map((cell) => {
    if (!cell || typeof cell !== "object") {
      return cell;
    }

    const shape = String((cell as { shape?: unknown }).shape ?? "");
    if (shape === "edge") {
      return cell;
    }

    const id = String((cell as { id?: unknown }).id ?? "");
    const data = (cell as { data?: unknown }).data;
    const nextData = data && typeof data === "object" ? { ...(data as Record<string, unknown>) } : {};
    const requirement = typeof nextData.requirement === "string" ? nextData.requirement : "";
    const affix = typeof nextData.talentAffix === "string" ? nextData.talentAffix : "";

    nextData.parentNodeIds = Array.from(parentMap.get(id) ?? []);
    nextData.affixMeta = parseTalentAffixMeta(affix);
    nextData.requirementMeta = parseRequirementItems(requirement);

    return {
      ...(cell as Record<string, unknown>),
      data: nextData
    };
  });

  return {
    ...graph,
    cells: enrichedCells
  };
}

export default function TalentTreeEditorPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const graphRef = useRef<Graph | null>(null);
  const nodeDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTemplateShortcutRef = useRef<(() => Promise<boolean>) | null>(null);
  const graphHistoryRef = useRef<Array<Record<string, unknown>>>([]);
  const muteGraphHistoryRef = useRef(false);
  const [graphContainerEl, setGraphContainerEl] = useState<HTMLDivElement | null>(null);
  const [graphReady, setGraphReady] = useState(false);
  const [graphVersion, setGraphVersion] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editable, setEditable] = useState(false);
  const [templates, setTemplates] = useState<TalentTreeTemplate[]>([]);
  const [directories, setDirectories] = useState<TalentTreeDirectoryItem[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [expandedDirectoryKeys, setExpandedDirectoryKeys] = useState<string[]>([]);
  const [activeDirectoryPath, setActiveDirectoryPath] = useState<string[]>([]);
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [newDirectoryLevel, setNewDirectoryLevel] = useState(2);
  const [newDirectoryNames, setNewDirectoryNames] = useState<string[]>([TALENT_DIRECTORY_ROOTS.profession, ""]);

  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [categoryInput, setCategoryInput] = useState<string>(TALENT_DIRECTORY_ROOTS.profession);
  const [isTemplateMetaModalOpen, setIsTemplateMetaModalOpen] = useState(false);
  const [templateMetaSaving, setTemplateMetaSaving] = useState(false);
  const [templateMetaForm, setTemplateMetaForm] = useState<TemplateMetaFormState | null>(null);
  const [editingNodeForm, setEditingNodeForm] = useState<NodeFormState | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [selectedGraphNodeIds, setSelectedGraphNodeIds] = useState<string[]>([]);
  const [nodeClipboard, setNodeClipboard] = useState<NodeClipboardBundle | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonInput, setImportJsonInput] = useState(TALENT_IMPORT_EXAMPLE);
  const [importApplyMeta, setImportApplyMeta] = useState(true);
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null);

  const isAdmin = user?.platformRole === "MASTER" || user?.platformRole === "ADMIN";

  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId]
  );

  const directoryTree = useMemo(
    () => buildTalentDirectoryTree(templates, directories),
    [templates, directories]
  );

  const previewNodes = useMemo(() => {
    if (graphRef.current) {
      return extractTalentNodePreviewItems(graphRef.current.toJSON());
    }
    return extractTalentNodePreviewItems(activeTemplate?.graphData);
  }, [activeTemplate, graphVersion]);

  const bumpGraphVersion = useCallback(() => {
    setGraphVersion((prev) => prev + 1);
  }, []);

  const recordGraphSnapshot = useCallback((graph: Graph | null) => {
    if (!graph || muteGraphHistoryRef.current) {
      return;
    }

    const snapshot = graph.toJSON() as Record<string, unknown>;
    graphHistoryRef.current.push(snapshot);
    if (graphHistoryRef.current.length > 80) {
      graphHistoryRef.current.shift();
    }
  }, []);

  const resetGraphHistory = useCallback((graph: Graph | null) => {
    if (!graph) {
      graphHistoryRef.current = [];
      return;
    }
    graphHistoryRef.current = [graph.toJSON() as Record<string, unknown>];
  }, []);

  const ensureEdgesBehindNodes = useCallback((graph: Graph | null) => {
    if (!graph) {
      return;
    }
    graph.getEdges().forEach((edge) => {
      edge.toBack();
    });
  }, []);

  const applyGraphSnapshot = useCallback((graph: Graph | null, snapshot: Record<string, unknown> | null | undefined) => {
    if (!graph || !snapshot) {
      return;
    }

    muteGraphHistoryRef.current = true;
    graph.fromJSON(toGraphData(snapshot));
    ensureEdgesBehindNodes(graph);
    muteGraphHistoryRef.current = false;
    bumpGraphVersion();
  }, [bumpGraphVersion, ensureEdgesBehindNodes]);

  const openNodeEditorById = useCallback((nodeId: string) => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const node = graph.getCellById(nodeId);
    if (!node || !node.isNode()) {
      return;
    }

    setSelectedGraphNodeId(String(node.id));
    setSelectedGraphNodeIds([String(node.id)]);
    setSelectedPreviewNodeId(String(node.id));

    const raw = node.getData() as Record<string, unknown>;
    const titleFromLabel = String(node.attr("label/text") ?? "").trim();
    setEditingNodeForm({
      id: String(node.id),
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title : (titleFromLabel || "未命名节点"),
      summary: typeof raw.summary === "string" ? raw.summary : "",
      description: typeof raw.description === "string" ? raw.description : "",
      studyDescriptions: [],
      cost: typeof raw.cost === "number" && Number.isFinite(raw.cost) ? raw.cost : 1,
      requirement: typeof raw.requirement === "string" ? raw.requirement : "",
      affixMastery: false,
      affixStudy: false,
      affixStudyMax: 1,
      affixExclusive: false
    });

    const affixMeta = parseTalentAffixMeta(raw.talentAffix);
    const studyMax = Math.max(1, Number(affixMeta.studyMax || 1));
    const isStudy = Number.isFinite(affixMeta.studyMax) && studyMax > 0;

    setEditingNodeForm((prev) => {
      if (!prev) {
        return prev;
      }
      const nodeDescription = typeof raw.description === "string" ? raw.description : "";
      const studyDescriptions = isStudy ? parseStudyDescriptionLines(nodeDescription, studyMax) : [];
      return {
        ...prev,
        affixMastery: affixMeta.mastery,
        affixExclusive: affixMeta.exclusive,
        affixStudy: isStudy,
        affixStudyMax: studyMax,
        studyDescriptions
      };
    });

    setIsNodeEditorOpen(true);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await http.get("/talent-trees/templates");
      const data = (resp.data?.data ?? { editable: false, templates: [], directories: [] }) as TemplateListResponse;
      setEditable(Boolean(data.editable));
      setTemplates(data.templates ?? []);
      setDirectories(data.directories ?? []);
      setActiveTemplateId((prev) => {
        if (prev && (data.templates ?? []).some((item) => item.id === prev)) {
          return prev;
        }
        return data.templates?.[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载天赋树模板失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!directories.length) {
      setExpandedDirectoryKeys((prev) => (prev.includes("__root__") ? prev : [...prev, "__root__"]));
      return;
    }

    const allKeys = directories
      .map((item) => item.path ?? [])
      .filter((pathValue) => pathValue.length > 0)
      .flatMap((pathValue) => pathValue.map((_, index) => toDirectoryKey(pathValue.slice(0, index + 1))));

    setExpandedDirectoryKeys((prev) => {
      const merged = new Set(prev);
      allKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  }, [directories]);

  useEffect(() => {
    if (!activeTemplate) {
      setActiveDirectoryPath([]);
      return;
    }

    const pathValue = parseDirectoryPath(activeTemplate.category || "", activeTemplate.treeType);
    setActiveDirectoryPath(pathValue);
    if (!pathValue.length) {
      return;
    }

    const keys = pathValue.map((_, index) => toDirectoryKey(pathValue.slice(0, index + 1)));
    setExpandedDirectoryKeys((prev) => {
      const merged = new Set(prev);
      keys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  }, [activeTemplate]);

  useEffect(() => {
    if (!isAdmin || !graphContainerEl || graphRef.current) {
      return;
    }

    const graph = new Graph({
      container: graphContainerEl,
      autoResize: true,
      grid: {
        size: TALENT_EDITOR_GRID_SIZE,
        visible: true,
        type: "mesh",
        args: {
          color: "rgba(143, 176, 219, 0.36)",
          thickness: 1
        }
      },
      panning: {
        enabled: true,
        modifiers: ["space"]
      },
      mousewheel: {
        enabled: true,
        modifiers: ["ctrl", "meta"],
        minScale: 0.4,
        maxScale: 2.2
      },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        snap: true,
        connector: "rounded",
        connectionPoint: "boundary",
        highlight: true
      }
    });

    graph.use(new Selection({
      enabled: true,
      rubberband: true,
      rubberEdge: true,
      multiple: true,
      movable: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: false,
      strict: false,
      eventTypes: ["leftMouseDown"]
    }));

    graph.on("edge:added", ({ edge }) => {
      edge.toBack();
    });

    ensureEdgesBehindNodes(graph);

    const onGraphMutation = () => {
      recordGraphSnapshot(graph);
      bumpGraphVersion();
    };

    graph.on("cell:added", onGraphMutation);
    graph.on("cell:removed", onGraphMutation);
    graph.on("node:change:position", onGraphMutation);
    graph.on("node:change:data", onGraphMutation);
    graph.on("edge:change:source", onGraphMutation);
    graph.on("edge:change:target", onGraphMutation);

    graph.on("node:moved", ({ node }) => {
      const adjusted = enforceNodeMinimumGap(graph, String(node.id), TALENT_EDITOR_MIN_NODE_GAP);
      if (adjusted) {
        recordGraphSnapshot(graph);
        bumpGraphVersion();
      }
    });

    graph.on("node:dblclick", ({ node }) => {
      openNodeEditorById(String(node.id));
    });

    graph.on("node:click", ({ node }) => {
      const nodeId = String(node.id);
      setSelectedGraphNodeId(nodeId);
      setSelectedPreviewNodeId(nodeId);
      const selectedNodes = graph.getSelectedCells().filter((cell) => cell.isNode());
      if (selectedNodes.length > 0) {
        setSelectedGraphNodeIds(selectedNodes.map((cell) => String(cell.id)));
        return;
      }
      setSelectedGraphNodeIds([nodeId]);
    });

    graph.on("blank:click", () => {
      setSelectedGraphNodeId(null);
      setSelectedGraphNodeIds([]);
      setSelectedPreviewNodeId(null);
    });

    graph.on("selection:changed", ({ selected }) => {
      const selectedNodes = selected.filter((cell: { isNode: () => boolean }) => cell.isNode());
      const ids = selectedNodes.map((cell: { id: string }) => String(cell.id));
      setSelectedGraphNodeIds(ids);
      setSelectedGraphNodeId(ids[0] ?? null);
      setSelectedPreviewNodeId(ids[0] ?? null);
    });

    resetGraphHistory(graph);
    bumpGraphVersion();

    graphRef.current = graph;
    setGraphReady(true);
    return () => {
      graph.dispose();
      graphRef.current = null;
      setGraphReady(false);
    };
  }, [
    isAdmin,
    graphContainerEl,
    ensureEdgesBehindNodes,
    openNodeEditorById,
    recordGraphSnapshot,
    resetGraphHistory,
    bumpGraphVersion
  ]);

  useEffect(() => {
    if (!activeTemplate) {
      setNameInput("");
      setDescriptionInput("");
      setCategoryInput(TALENT_DIRECTORY_ROOTS.profession);
      if (graphRef.current) {
        applyGraphSnapshot(graphRef.current, { cells: [] });
        resetGraphHistory(graphRef.current);
      }
      setSelectedGraphNodeId(null);
      setSelectedGraphNodeIds([]);
      setSelectedPreviewNodeId(null);
      setEditingNodeForm(null);
      setIsNodeEditorOpen(false);
      return;
    }

    setNameInput(activeTemplate.name);
    setDescriptionInput(activeTemplate.description || "");
    setCategoryInput(parseDirectoryPath(activeTemplate.category || "", activeTemplate.treeType).join("/"));
    if (graphRef.current) {
      applyGraphSnapshot(graphRef.current, toGraphData(activeTemplate.graphData));
      resetGraphHistory(graphRef.current);
    }
    setSelectedGraphNodeId(null);
    setSelectedGraphNodeIds([]);
    setSelectedPreviewNodeId(null);
    setEditingNodeForm(null);
    setIsNodeEditorOpen(false);
  }, [activeTemplate, graphReady, applyGraphSnapshot, resetGraphHistory]);

  const addTalentNode = () => {
    if (!graphRef.current) {
      setError("画布尚未初始化，请稍后重试");
      return;
    }

    const count = graphRef.current.getNodes().length + 1;
    const createdNode = graphRef.current.addNode({
      shape: "rect",
      x: 80 + count * 16,
      y: 80 + count * 12,
      width: IMPORT_LAYOUT.nodeWidth,
      height: IMPORT_LAYOUT.nodeHeight,
      attrs: createTalentNodeAttrs({
        title: `天赋节点 ${count}`,
        summary: "",
        cost: 1,
        requirement: "",
        talentAffix: ""
      }),
      data: {
        title: `天赋节点 ${count}`,
        summary: "",
        description: "",
        cost: 1,
        requirement: "",
        talentAffix: ""
      },
      ports: TALENT_NODE_PORTS
    });
    if (createdNode) {
      enforceNodeMinimumGap(graphRef.current, String(createdNode.id), TALENT_EDITOR_MIN_NODE_GAP);
    }
    graphRef.current.centerContent();
    bumpGraphVersion();
    setNotice(`已新增节点：天赋节点 ${count}`);
  };

  const addLinkHint = () => {
    setNotice("请拖拽节点上下圆点端口连线；双击节点可打开节点配置弹窗。");
  };

  const onCopySelectedNode = useCallback(() => {
    if (!graphRef.current) {
      setNotice("画布尚未初始化");
      return;
    }

    const isNodeCell = (cell: unknown): cell is {
      id: string;
      isNode: () => boolean;
      getData: () => unknown;
      position: () => { x: number; y: number };
      size: () => { width: number; height: number };
      attr: (path: string) => unknown;
    } => {
      if (!cell || typeof cell !== "object") {
        return false;
      }
      const maybeCell = cell as { isNode?: () => boolean };
      return typeof maybeCell.isNode === "function" && maybeCell.isNode();
    };

    const selectedNodes = graphRef.current
      .getSelectedCells()
      .filter(isNodeCell);

    const copyTargets = selectedNodes.length > 0
      ? selectedNodes
      : (selectedGraphNodeId
        ? [graphRef.current.getCellById(selectedGraphNodeId)].filter(isNodeCell)
        : []);

    if (!copyTargets.length) {
      setNotice("请先点击或框选节点再复制");
      return;
    }

    const copiedNodeIds = new Set(copyTargets.map((node) => String(node.id)));
    const copiedNodes = copyTargets.map((node) => {
      const geometryNode = node as unknown as {
        position: () => { x: number; y: number };
        size: () => { width: number; height: number };
      };
      const raw = node.getData() as Record<string, unknown>;
      const position = geometryNode.position();
      const size = geometryNode.size();
      const titleFromLabel = String(node.attr("label/text") ?? "").trim();
      const title = (typeof raw.title === "string" && raw.title.trim()) || titleFromLabel || "未命名节点";

      return {
        oldId: String(node.id),
        payload: {
          title,
          summary: typeof raw.summary === "string" ? raw.summary : "",
          description: typeof raw.description === "string" ? raw.description : "",
          cost: typeof raw.cost === "number" && Number.isFinite(raw.cost) ? raw.cost : 1,
          requirement: typeof raw.requirement === "string" ? raw.requirement : "",
          talentAffix: typeof raw.talentAffix === "string" ? raw.talentAffix : "",
          width: Number.isFinite(size.width) ? size.width : 180,
          height: Number.isFinite(size.height) ? size.height : 56,
          x: Number.isFinite(position.x) ? position.x : 80,
          y: Number.isFinite(position.y) ? position.y : 80
        }
      };
    });

    const copiedEdges = graphRef.current
      .getEdges()
      .map((edge) => {
        const sourceCell = String(edge.getSourceCellId() ?? "");
        const targetCell = String(edge.getTargetCellId() ?? "");
        if (!sourceCell || !targetCell) {
          return null;
        }
        if (!copiedNodeIds.has(sourceCell) || !copiedNodeIds.has(targetCell)) {
          return null;
        }
        return {
          source: sourceCell,
          target: targetCell
        };
      })
      .filter((edge): edge is { source: string; target: string } => Boolean(edge));

    setNodeClipboard({
      nodes: copiedNodes,
      edges: copiedEdges
    });

    if (copiedNodes.length === 1) {
      setNotice(`已复制节点：${copiedNodes[0].payload.title}`);
      return;
    }
    setNotice(`已复制 ${copiedNodes.length} 个节点（含内部连线 ${copiedEdges.length} 条）`);
  }, [selectedGraphNodeId]);

  const onPasteCopiedNode = useCallback(() => {
    if (!graphRef.current) {
      setError("画布尚未初始化，请稍后重试");
      return;
    }
    if (!nodeClipboard || !nodeClipboard.nodes.length) {
      setNotice("暂无已复制节点，请先 Ctrl+C 复制节点");
      return;
    }

    const idMap = new Map<string, string>();
    const createdNodeIds: string[] = [];

    nodeClipboard.nodes.forEach((item, index) => {
      const baseTitle = item.payload.title.trim() || "未命名节点";
      const nextTitle = `${baseTitle}（复制）`;
      const created = graphRef.current?.addNode({
        shape: "rect",
        x: item.payload.x + 32,
        y: item.payload.y + 32,
        width: Math.max(item.payload.width, IMPORT_LAYOUT.nodeWidth),
        height: Math.max(item.payload.height, IMPORT_LAYOUT.nodeHeight),
        attrs: createTalentNodeAttrs({
          title: nextTitle,
          summary: item.payload.summary,
          cost: item.payload.cost,
          requirement: item.payload.requirement,
          talentAffix: item.payload.talentAffix
        }),
        data: {
          title: nextTitle,
          summary: item.payload.summary,
          description: item.payload.description,
          cost: item.payload.cost,
          requirement: item.payload.requirement,
          talentAffix: item.payload.talentAffix
        },
        ports: TALENT_NODE_PORTS
      });
      if (!created) {
        return;
      }
      const createdId = String(created.id);
      idMap.set(item.oldId, createdId);
      createdNodeIds.push(createdId);

      if (index === 0) {
        setSelectedGraphNodeId(createdId);
      }
    });

    nodeClipboard.edges.forEach((edge, index) => {
      const sourceId = idMap.get(edge.source);
      const targetId = idMap.get(edge.target);
      if (!sourceId || !targetId || sourceId === targetId) {
        return;
      }

      graphRef.current?.addEdge({
        id: `paste_edge_${Date.now()}_${index + 1}`,
        source: { cell: sourceId },
        target: { cell: targetId },
        attrs: {
          line: {
            stroke: "#5b9be8",
            strokeWidth: 2
          }
        }
      });
    });

    const createdCells = createdNodeIds
      .map((id) => graphRef.current?.getCellById(id))
      .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
    if (graphRef.current) {
      enforceAllNodesMinimumGap(graphRef.current, TALENT_EDITOR_MIN_NODE_GAP);
    }
    graphRef.current.resetSelection(createdCells);
    setSelectedGraphNodeIds(createdNodeIds);
    setSelectedPreviewNodeId(createdNodeIds[0] ?? null);

    if (createdNodeIds.length === 1) {
      const onlyNode = nodeClipboard.nodes[0];
      setNotice(`已粘贴节点：${onlyNode.payload.title}（复制）`);
      return;
    }
    setNotice(`已粘贴 ${createdNodeIds.length} 个节点，连线 ${nodeClipboard.edges.length} 条`);
  }, [nodeClipboard]);

  const onCreateChildNode = () => {
    if (!graphRef.current || !selectedGraphNodeId) {
      setNotice("请先点击选中一个父节点");
      return;
    }

    const parent = graphRef.current.getCellById(selectedGraphNodeId);
    if (!parent || !parent.isNode()) {
      setNotice("当前未选中可用父节点");
      return;
    }

    const parentData = parent.getData() as Record<string, unknown>;
    const parentTitle = String(parentData.title ?? parent.attr("label/text") ?? "节点").trim() || "节点";
    const parentPos = parent.position();
    const parentSize = parent.size();
    const childTitle = `${parentTitle}-子节点`;
    const childX = parentPos.x;
    const childY = parentPos.y + parentSize.height + 110;

    const child = graphRef.current.addNode({
      shape: "rect",
      x: childX,
      y: childY,
      width: IMPORT_LAYOUT.nodeWidth,
      height: IMPORT_LAYOUT.nodeHeight,
      attrs: createTalentNodeAttrs({
        title: childTitle,
        summary: "",
        cost: 1,
        requirement: parentTitle,
        talentAffix: ""
      }),
      data: {
        title: childTitle,
        summary: "",
        description: "",
        cost: 1,
        requirement: parentTitle,
        talentAffix: ""
      },
      ports: TALENT_NODE_PORTS
    });
    enforceNodeMinimumGap(graphRef.current, String(child.id), TALENT_EDITOR_MIN_NODE_GAP);

    const parentOutPort = parent.getPorts().find((port) => port.group === "out")?.id;
    const childInPort = child.getPorts().find((port) => port.group === "in")?.id;

    graphRef.current.addEdge({
      source: parentOutPort
        ? { cell: parent.id, port: parentOutPort }
        : { cell: parent.id },
      target: childInPort
        ? { cell: child.id, port: childInPort }
        : { cell: child.id },
      attrs: {
        line: {
          stroke: "#5b9be8",
          strokeWidth: 2
        }
      }
    });

    setSelectedGraphNodeId(String(child.id));
    setSelectedPreviewNodeId(String(child.id));
    setNotice(`已创建并连线子节点：${childTitle}`);
  };

  const onDeleteSelectedCells = useCallback(() => {
    if (!editable || !graphRef.current) {
      return;
    }

    const selectedFromGraph = graphRef.current
      .getSelectedCells()
      .filter((cell) => cell.isNode() || cell.isEdge())
      .map((cell) => String(cell.id));

    const fallbackIds = selectedGraphNodeIds.length > 0
      ? selectedGraphNodeIds
      : (selectedGraphNodeId ? [selectedGraphNodeId] : []);

    const targetIds = Array.from(new Set((selectedFromGraph.length > 0 ? selectedFromGraph : fallbackIds).filter(Boolean)));

    if (targetIds.length < 1) {
      setNotice("请先点击或框选节点/连线，再按 Delete/Backspace 删除");
      return;
    }

    let removedNodeCount = 0;
    let removedEdgeCount = 0;

    targetIds.forEach((id) => {
      const cell = graphRef.current?.getCellById(id);
      if (!cell || (!cell.isNode() && !cell.isEdge())) {
        return;
      }
      if (cell.isNode()) {
        removedNodeCount += 1;
      } else if (cell.isEdge()) {
        removedEdgeCount += 1;
      }
      graphRef.current?.removeCell(cell);
    });

    setSelectedGraphNodeId(null);
    setSelectedGraphNodeIds([]);
    setSelectedPreviewNodeId(null);
    setIsNodeEditorOpen(false);
    setEditingNodeForm(null);
    if (removedNodeCount > 0 && removedEdgeCount > 0) {
      setNotice(`已删除 ${removedNodeCount} 个节点，${removedEdgeCount} 条连线`);
      return;
    }
    if (removedNodeCount > 0) {
      setNotice(removedNodeCount === 1 ? "已删除 1 个节点" : `已删除 ${removedNodeCount} 个节点`);
      return;
    }
    if (removedEdgeCount > 0) {
      setNotice(removedEdgeCount === 1 ? "已删除 1 条连线" : `已删除 ${removedEdgeCount} 条连线`);
    }
  }, [editable, selectedGraphNodeId, selectedGraphNodeIds]);

  const onUndoGraph = useCallback(() => {
    if (!editable || !graphRef.current) {
      return;
    }

    if (graphHistoryRef.current.length <= 1) {
      setNotice("当前没有可撤回的操作");
      return;
    }

    graphHistoryRef.current.pop();
    const previousSnapshot = graphHistoryRef.current[graphHistoryRef.current.length - 1];
    applyGraphSnapshot(graphRef.current, previousSnapshot);
    setSelectedGraphNodeId(null);
    setSelectedGraphNodeIds([]);
    setSelectedPreviewNodeId(null);
    setNotice("已撤回一步画布变更");
  }, [editable, applyGraphSnapshot]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const onWindowKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() ?? "";
      const isTextInput = tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(target?.isContentEditable);
      if (isTextInput) {
        return;
      }

      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        if (editable) {
          void saveTemplateShortcutRef.current?.();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        onUndoGraph();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        onCopySelectedNode();
      }
      if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        onPasteCopiedNode();
      }

      if (key === "backspace" || key === "delete") {
        event.preventDefault();
        onDeleteSelectedCells();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [isAdmin, editable, onCopySelectedNode, onPasteCopiedNode, onDeleteSelectedCells, onUndoGraph]);

  const onChangeEditingNodeForm = (patch: Partial<Omit<NodeFormState, "id">>) => {
    if (!editingNodeForm) {
      return;
    }

    setEditingNodeForm({
      ...editingNodeForm,
      ...patch
    });
  };

  const onInsertBoldForDescription = () => {
    setEditingNodeForm((prev) => {
      if (!prev) {
        return prev;
      }

      const textarea = nodeDescriptionTextareaRef.current;
      const rawText = prev.description || "";
      const start = textarea?.selectionStart ?? rawText.length;
      const end = textarea?.selectionEnd ?? rawText.length;
      const selected = rawText.slice(start, end);
      const token = selected || "关键词";
      const nextText = `${rawText.slice(0, start)}**${token}**${rawText.slice(end)}`;

      requestAnimationFrame(() => {
        if (!nodeDescriptionTextareaRef.current) {
          return;
        }

        const target = nodeDescriptionTextareaRef.current;
        target.focus();
        const tokenStart = start + 2;
        const tokenEnd = tokenStart + token.length;
        if (selected) {
          target.setSelectionRange(tokenEnd, tokenEnd);
        } else {
          target.setSelectionRange(tokenStart, tokenEnd);
        }
      });

      return {
        ...prev,
        description: nextText
      };
    });
  };

  const onNodeDescriptionKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "b") {
      event.preventDefault();
      onInsertBoldForDescription();
    }
  };

  const onApplyNodeEditor = () => {
    if (!editingNodeForm || !graphRef.current) {
      return;
    }

    const nextTitle = editingNodeForm.title.trim() || "未命名节点";
    const node = graphRef.current.getCellById(editingNodeForm.id);
    if (!node || !node.isNode()) {
      return;
    }

    const affixStudyMax = editingNodeForm.affixStudy ? Math.max(1, Number(editingNodeForm.affixStudyMax || 1)) : undefined;
    const talentAffix = formatTalentAffixText({
      mastery: editingNodeForm.affixMastery,
      exclusive: editingNodeForm.affixExclusive,
      studyMax: affixStudyMax
    });
    const description = editingNodeForm.affixStudy
      ? composeStudyDescription(editingNodeForm.studyDescriptions, affixStudyMax || 1)
      : editingNodeForm.description;

    node.setData({
      title: nextTitle,
      summary: editingNodeForm.summary,
      description,
      cost: editingNodeForm.cost,
      requirement: editingNodeForm.requirement,
      talentAffix,
      studyDescriptions: editingNodeForm.affixStudy ? editingNodeForm.studyDescriptions : [],
      affixMeta: {
        mastery: editingNodeForm.affixMastery,
        exclusive: editingNodeForm.affixExclusive,
        studyMax: affixStudyMax
      }
    });
    node.attr(createTalentNodeAttrs({
      title: nextTitle,
      summary: editingNodeForm.summary,
      cost: editingNodeForm.cost,
      requirement: editingNodeForm.requirement,
      talentAffix
    }));
    const ports = node.getPorts();
    if (!ports.length) {
      node.prop("ports", TALENT_NODE_PORTS);
    }

    setEditingNodeForm({ ...editingNodeForm, title: nextTitle });
    setNotice("节点信息已更新（保存模板后生效）");
    setIsNodeEditorOpen(false);
  };

  const onDeleteEditingNode = () => {
    if (!editingNodeForm || !graphRef.current) {
      return;
    }

    const node = graphRef.current.getCellById(editingNodeForm.id);
    if (!node || !node.isNode()) {
      return;
    }

    const confirmed = window.confirm(`确认删除节点【${editingNodeForm.title || "未命名节点"}】吗？`);
    if (!confirmed) {
      return;
    }

    graphRef.current.removeCell(node);
    setIsNodeEditorOpen(false);
    setEditingNodeForm(null);
    setNotice("节点已删除（保存模板后生效）");
  };

  const onCreateDirectory = async () => {
    if (!editable) {
      setError("当前账号无编辑权限");
      return;
    }

    const rawPath = newDirectoryNames
      .slice(0, newDirectoryLevel)
      .map((item) => item.trim());

    if (!rawPath[0] || rawPath.slice(1).some((item) => !item)) {
      setError("请完整填写每一级目录名");
      return;
    }

    const pathValue = normalizeCategoryPath(rawPath, "PROFESSION");

    setLoading(true);
    setError(null);
    try {
      await http.post("/talent-trees/directories", { path: pathValue });
      await loadTemplates();
      const key = toDirectoryKey(pathValue);
      setExpandedDirectoryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setActiveDirectoryPath(pathValue);
      setShowDirectoryModal(false);
      setNotice("目录已创建");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建目录失败");
    } finally {
      setLoading(false);
    }
  };

  const onMoveTemplateToDirectory = useCallback(async (templateId: string, nextPath: string[]) => {
    if (!editable) {
      return;
    }

    const target = templates.find((item) => item.id === templateId);
    if (!target) {
      return;
    }

    const currentPath = parseDirectoryPath(target.category || "", target.treeType);
    if (toDirectoryKey(currentPath) === toDirectoryKey(nextPath)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await http.put(`/talent-trees/templates/${templateId}`, {
        category: nextPath.join("/")
      });
      await loadTemplates();
      setActiveTemplateId(templateId);
      setActiveDirectoryPath(nextPath);
      setNotice("模板已移动到新目录");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "模板移动失败");
    } finally {
      setLoading(false);
    }
  }, [editable, templates, loadTemplates]);

  const onCreateTemplate = async () => {
    if (!editable) {
      setError("当前账号无编辑权限");
      return;
    }

    setError(null);
    try {
      const initialPath = normalizeCategoryPath(
        activeDirectoryPath.length ? activeDirectoryPath : [TALENT_DIRECTORY_ROOTS.profession],
        "PROFESSION"
      );
      const initialTreeType = inferTreeTypeByDirectoryPath(initialPath, "PROFESSION");
      const draftName = `新建天赋树_${Date.now().toString(36).slice(-4)}`;
      const resp = await http.post("/talent-trees/templates", {
        name: draftName,
        treeType: initialTreeType,
        category: initialPath.join("/"),
        description: ""
      });
      const created = resp.data?.data as TalentTreeTemplate;
      await loadTemplates();
      setActiveTemplateId(created.id);
      setNotice("已创建新模板");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建模板失败");
    }
  };

  const onSaveTemplate = async () => {
    if (!activeTemplate || !editable || !graphRef.current || !graphReady) {
      setError("画布尚未初始化，请稍后重试");
      return false;
    }

    setSaving(true);
    setError(null);
    try {
      const graphData = enrichTalentGraphForRuntime(graphRef.current.toJSON());
      const normalizedCategoryPath = parseDirectoryPath(categoryInput, activeTemplate.treeType);
      const normalizedCategory = normalizedCategoryPath.join("/");
      const resolvedTreeType = inferTreeTypeByDirectoryPath(normalizedCategoryPath, activeTemplate.treeType);
      const resp = await http.put(`/talent-trees/templates/${activeTemplate.id}`, {
        name: nameInput,
        description: descriptionInput,
        treeType: resolvedTreeType,
        category: normalizedCategory,
        graphData
      });

      const updated = resp.data?.data as TalentTreeTemplate;
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await loadTemplates();
      setActiveTemplateId(updated.id);
      setCategoryInput(normalizedCategory);
      setNotice("天赋树已保存");
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    saveTemplateShortcutRef.current = onSaveTemplate;
  }, [onSaveTemplate]);

  const onPublishTemplate = async () => {
    if (!activeTemplate || !editable) {
      return;
    }

    const saved = await onSaveTemplate();
    if (!saved) {
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const resp = await http.post(`/talent-trees/templates/${activeTemplate.id}/publish`);
      const published = resp.data?.data as TalentTreeTemplate;
      setTemplates((prev) => prev.map((item) => (item.id === published.id ? published : item)));
      setNotice("模板已发布");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "发布失败");
    } finally {
      setPublishing(false);
    }
  };

  const onDeleteTemplate = async () => {
    if (!activeTemplate || !editable) {
      return;
    }

    const confirmed = window.confirm(`确认删除天赋树模板【${activeTemplate.name}】吗？该操作不可恢复。`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await http.delete(`/talent-trees/templates/${activeTemplate.id}`);
      const nextTemplates = templates.filter((item) => item.id !== activeTemplate.id);
      setTemplates(nextTemplates);
      setActiveTemplateId(nextTemplates[0]?.id ?? null);
      setNotice("模板已删除");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const onApplyJsonImport = () => {
    if (!editable || !graphRef.current) {
      setError("当前账号无编辑权限或画布尚未初始化");
      return;
    }

    setError(null);
    try {
      const parsedRaw = JSON.parse(importJsonInput);
      const parsed = parseTalentImportPayload(parsedRaw);
      if (parsed.nodeCount < 1) {
        setError("导入失败：未解析到任何节点，请检查 JSON 中是否包含 nodes 或 branches");
        return;
      }

      applyGraphSnapshot(graphRef.current, toGraphData(parsed.graphData));
      enforceAllNodesMinimumGap(graphRef.current, TALENT_EDITOR_MIN_NODE_GAP);
      resetGraphHistory(graphRef.current);
      graphRef.current.centerContent();

      if (importApplyMeta) {
        if (parsed.meta.name) {
          setNameInput(parsed.meta.name);
        }
        if (typeof parsed.meta.description === "string") {
          setDescriptionInput(parsed.meta.description);
        }
        if (parsed.meta.category || parsed.meta.treeType) {
          const currentPath = parseDirectoryPath(categoryInput, activeTemplate?.treeType ?? "PROFESSION");
          const fallbackTreeType = parsed.meta.treeType ?? inferTreeTypeByDirectoryPath(currentPath, activeTemplate?.treeType ?? "PROFESSION");
          const nextPath = parsed.meta.category
            ? parseDirectoryPath(parsed.meta.category, fallbackTreeType)
            : normalizeCategoryPath([toRootDirectoryByType(fallbackTreeType), ...currentPath.slice(1)], fallbackTreeType);
          setCategoryInput(nextPath.join("/"));
        }
      }

      setIsImportModalOpen(false);
      setSelectedGraphNodeId(null);
      setSelectedGraphNodeIds([]);
      setSelectedPreviewNodeId(null);
      setNotice(`JSON 导入完成：${parsed.nodeCount} 个节点，${parsed.edgeCount} 条连线（记得再点一次“保存模板”）`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "JSON 解析失败";
      setError(`导入失败：${message}`);
    }
  };

  const onExportJson = () => {
    if (!graphRef.current || !activeTemplate) {
      setError("请先选择一个模板再导出");
      return;
    }

    const nodes = graphRef.current.getNodes().map((node) => {
      const raw = node.getData() as Record<string, unknown>;
      const pos = node.position();
      const titleFromLabel = String(node.attr("label/text") ?? "").trim();
      const title = (typeof raw.title === "string" && raw.title.trim()) || titleFromLabel || "未命名节点";
      return {
        id: String(node.id),
        x: Number.isFinite(pos.x) ? pos.x : 0,
        y: Number.isFinite(pos.y) ? pos.y : 0,
        name: title,
        summary: typeof raw.summary === "string" ? raw.summary : "",
        description: typeof raw.description === "string" ? raw.description : "",
        cost: typeof raw.cost === "number" && Number.isFinite(raw.cost) ? raw.cost : 1,
        requirement: typeof raw.requirement === "string" ? raw.requirement : "",
        affix: typeof raw.talentAffix === "string" ? raw.talentAffix : ""
      };
    });

    const sortedByX = [...nodes].sort((a, b) => a.x - b.x || a.y - b.y);
    const branches: Array<{ x: number; autoConnect: false; nodes: Array<Record<string, unknown>> }> = [];
    const branchTolerance = 40;

    sortedByX.forEach((node) => {
      const lastBranch = branches[branches.length - 1];
      if (!lastBranch || Math.abs(lastBranch.x - node.x) > branchTolerance) {
        branches.push({
          x: node.x,
          autoConnect: false,
          nodes: []
        });
      }

      branches[branches.length - 1].nodes.push({
        id: node.id,
        name: node.name,
        summary: node.summary,
        description: node.description,
        cost: node.cost,
        requirement: node.requirement,
        affix: node.affix
      });
    });

    branches.forEach((branch) => {
      branch.nodes.sort((left, right) => {
        const leftNode = nodes.find((item) => item.id === String(left.id));
        const rightNode = nodes.find((item) => item.id === String(right.id));
        return (leftNode?.y ?? 0) - (rightNode?.y ?? 0);
      });
    });

    const edges = graphRef.current.getEdges()
      .map((edge) => {
        const from = String(edge.getSourceCellId() ?? "").trim();
        const to = String(edge.getTargetCellId() ?? "").trim();
        if (!from || !to || from === to) {
          return null;
        }
        return { from, to };
      })
      .filter((item): item is { from: string; to: string } => Boolean(item));

    const exportCategoryPath = parseDirectoryPath(categoryInput, activeTemplate.treeType);
    const exportPayload: TalentImportPayload = {
      name: nameInput.trim() || activeTemplate.name,
      description: descriptionInput,
      treeType: inferTreeTypeByDirectoryPath(exportCategoryPath, activeTemplate.treeType),
      category: exportCategoryPath.join("/"),
      autoConnect: false,
      branches,
      edges
    };

    const jsonText = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
    const fileBaseName = sanitizeFileName(nameInput || activeTemplate.name || "talent-tree");
    const fileName = `${fileBaseName || "talent-tree"}.json`;
    const downloadUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);

    setNotice(`已导出 JSON：${fileName}`);
  };

  const onSelectPreviewNode = (nodeId: string) => {
    const graph = graphRef.current;
    if (graph) {
      const node = graph.getCellById(nodeId);
      if (node && node.isNode()) {
        graph.resetSelection([node]);
      }
    }
    setSelectedGraphNodeId(nodeId);
    setSelectedGraphNodeIds([nodeId]);
    setSelectedPreviewNodeId(nodeId);
  };

  const openTemplateMetaEditor = useCallback((template: TalentTreeTemplate) => {
    const categoryPath = parseDirectoryPath(template.category || "", template.treeType);
    setTemplateMetaForm({
      templateId: template.id,
      name: template.name,
      description: template.description || "",
      rootDirectory: categoryPath[0] ?? TALENT_DIRECTORY_ROOTS.profession,
      subDirectoryInput: categoryPath.slice(1).join("/")
    });
    setIsTemplateMetaModalOpen(true);
  }, []);

  const onSaveTemplateMeta = useCallback(async () => {
    if (!editable || !templateMetaForm) {
      return;
    }

    const nextName = templateMetaForm.name.trim();
    if (!nextName) {
      setError("模板名称不能为空");
      return;
    }

    const subPath = templateMetaForm.subDirectoryInput
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    const nextCategoryPath = normalizeCategoryPath([templateMetaForm.rootDirectory, ...subPath], "PROFESSION");
    const nextTreeType = inferTreeTypeByDirectoryPath(nextCategoryPath, "PROFESSION");

    setTemplateMetaSaving(true);
    setError(null);
    try {
      await http.put(`/talent-trees/templates/${templateMetaForm.templateId}`, {
        name: nextName,
        description: templateMetaForm.description,
        category: nextCategoryPath.join("/"),
        treeType: nextTreeType
      });
      await loadTemplates();
      setActiveTemplateId(templateMetaForm.templateId);
      if (activeTemplateId === templateMetaForm.templateId) {
        setNameInput(nextName);
        setDescriptionInput(templateMetaForm.description);
        setCategoryInput(nextCategoryPath.join("/"));
      }
      setActiveDirectoryPath(nextCategoryPath);
      setNotice("模板信息已更新");
      setIsTemplateMetaModalOpen(false);
      setTemplateMetaForm(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "更新模板信息失败");
    } finally {
      setTemplateMetaSaving(false);
    }
  }, [editable, templateMetaForm, loadTemplates, activeTemplateId]);

  const renderDirectoryNode = (node: TalentDirectoryNode, level = 1) => {
    const expanded = expandedDirectoryKeys.includes(node.key);
    const canAcceptDrop = editable && Boolean(draggingTemplateId);

    return (
      <div key={node.key} className="talent-editor-sidebar__tree-group">
        <button
          type="button"
          className={`talent-editor-sidebar__tree-node level-${level} ${expanded ? "is-active" : ""}`}
          onClick={() => {
            setActiveDirectoryPath(node.path);
            setExpandedDirectoryKeys((prev) => (
              prev.includes(node.key)
                ? prev.filter((item) => item !== node.key)
                : [...prev, node.key]
            ));
          }}
          onDragOver={(event) => {
            if (canAcceptDrop) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            if (!canAcceptDrop || !draggingTemplateId) {
              return;
            }
            event.preventDefault();
            void onMoveTemplateToDirectory(draggingTemplateId, node.path);
            setDraggingTemplateId(null);
          }}
        >
          <span>{expanded ? "▾" : "▸"}</span>
          <strong>{node.label}</strong>
        </button>

        {expanded ? (
          <div className="talent-editor-sidebar__tree-children">
            {node.children.map((child) => renderDirectoryNode(child, level + 1))}
            {node.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`talent-editor-sidebar__item ${template.id === activeTemplateId ? "is-active" : ""}`}
                draggable={editable}
                onDragStart={() => {
                  if (editable) {
                    setDraggingTemplateId(template.id);
                  }
                }}
                onDragEnd={() => setDraggingTemplateId(null)}
                onContextMenu={(event) => {
                  if (!editable) {
                    return;
                  }
                  event.preventDefault();
                  openTemplateMetaEditor(template);
                }}
                onClick={() => {
                  setActiveTemplateId(template.id);
                  setActiveDirectoryPath(node.path);
                }}
              >
                <p>{template.name}</p>
                <span>{resolveTemplateDirectoryHint(template)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="talent-editor-page">
      {!isAdmin ? (
        <section className="talent-editor-main">
          <div className="talent-editor-main__empty">仅平台管理员可进入大厅侧天赋树编辑器。</div>
          <div className="talent-editor-toolbar">
            <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
          </div>
        </section>
      ) : null}
      {isAdmin ? (
      <>
      <div className="talent-editor-page__topbar">
        <div className="talent-editor-page__actions">
          <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
          <button type="button" onClick={() => void loadTemplates()} disabled={loading}>
            {loading ? "刷新中..." : "刷新"}
          </button>
          {editable ? (
            <button type="button" onClick={onCreateTemplate}>新建模板</button>
          ) : null}
        </div>
      </div>

      {error ? <div className="talent-editor-page__error">{error}</div> : null}
      {notice ? <div className="talent-editor-page__notice">{notice}</div> : null}

      <section className="talent-editor-layout">
        <aside className="talent-editor-sidebar">
          <div className="talent-editor-sidebar__head">
            <h2>模板目录</h2>
            {editable ? (
              <button
                type="button"
                className="talent-editor-sidebar__create-directory"
                onClick={() => {
                  const rootDirectory = normalizeRootDirectoryName(activeDirectoryPath[0] ?? "") ?? TALENT_DIRECTORY_ROOTS.profession;
                  setNewDirectoryLevel(2);
                  setNewDirectoryNames([rootDirectory, ""]);
                  setShowDirectoryModal(true);
                }}
              >
                新建目录
              </button>
            ) : null}
          </div>
          <p className="talent-editor-sidebar__hint">可拖拽模板到目录节点完成分类；右键模板条目可编辑名称与描述。</p>
          {templates.length === 0 ? <p className="talent-editor-sidebar__empty">暂无天赋树模板</p> : null}
          <div className="talent-editor-sidebar__list">
            {directoryTree.map((node) => renderDirectoryNode(node))}
          </div>
        </aside>

        <main className="talent-editor-main">
          {!activeTemplate ? (
            <div className="talent-editor-main__empty">请选择模板开始编辑</div>
          ) : (
            <>
              <div className="talent-editor-toolbar">
                <button type="button" onClick={addTalentNode} disabled={!editable}>新增节点</button>
                <button type="button" onClick={onCreateChildNode} disabled={!editable || !selectedGraphNodeId}>生成子节点</button>
                <button type="button" onClick={addLinkHint}>连线提示</button>
                <button type="button" onClick={() => setIsImportModalOpen(true)} disabled={!editable}>导入JSON</button>
                <button type="button" onClick={onExportJson} disabled={!activeTemplate}>导出JSON</button>
                <button type="button" onClick={onSaveTemplate} disabled={!editable || saving}>
                  {saving ? "保存中..." : "保存模板"}
                </button>
                <button type="button" onClick={onPublishTemplate} disabled={!editable || publishing}>
                  {publishing ? "发布中..." : "发布模板"}
                </button>
                <button type="button" onClick={onDeleteTemplate} disabled={!editable || deleting}>
                  {deleting ? "删除中..." : "删除模板"}
                </button>
              </div>

              <div className="talent-editor-shortcuts">模板信息（名称/描述/目录）请在左侧目录中右键对应条目进行编辑。</div>

              <div className="talent-editor-shortcuts">快捷键：Ctrl+S 保存模板，Ctrl+Z 撤回画布操作，Delete/Backspace 删除选中节点或连线。</div>

              <div className="talent-editor-canvas" ref={setGraphContainerEl} />

            </>
          )}
        </main>
      </section>

      {isTemplateMetaModalOpen && templateMetaForm ? (
        <div className="talent-template-modal" onClick={() => setIsTemplateMetaModalOpen(false)}>
          <section className="talent-template-modal__panel" onClick={(event) => event.stopPropagation()}>
            <header className="talent-template-modal__header">
              <h3>模板信息</h3>
              <button
                type="button"
                onClick={() => {
                  setIsTemplateMetaModalOpen(false);
                  setTemplateMetaForm(null);
                }}
              >
                关闭
              </button>
            </header>

            <div className="talent-template-modal__form">
              <label>
                名称
                <input
                  value={templateMetaForm.name}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setTemplateMetaForm((prev) => (prev ? { ...prev, name: nextValue } : prev));
                  }}
                  maxLength={80}
                  disabled={!editable}
                />
              </label>

              <label>
                一级目录（决定天赋树类型）
                <select
                  value={templateMetaForm.rootDirectory}
                  onChange={(event) => {
                    const rootDirectory = normalizeRootDirectoryName(event.target.value) ?? TALENT_DIRECTORY_ROOTS.profession;
                    setTemplateMetaForm((prev) => (prev ? { ...prev, rootDirectory } : prev));
                  }}
                  disabled={!editable}
                >
                  <option value={TALENT_DIRECTORY_ROOTS.profession}>{TALENT_DIRECTORY_ROOTS.profession}</option>
                  <option value={TALENT_DIRECTORY_ROOTS.general}>{TALENT_DIRECTORY_ROOTS.general}</option>
                </select>
              </label>

              <label>
                子目录（可选，多级用 / 分隔）
                <input
                  value={templateMetaForm.subDirectoryInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setTemplateMetaForm((prev) => (prev ? { ...prev, subDirectoryInput: nextValue } : prev));
                  }}
                  placeholder="例如：战士/防御"
                  maxLength={180}
                  disabled={!editable}
                />
              </label>

              <label>
                描述
                <textarea
                  value={templateMetaForm.description}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setTemplateMetaForm((prev) => (prev ? { ...prev, description: nextValue } : prev));
                  }}
                  rows={3}
                  disabled={!editable}
                />
              </label>
            </div>

            <div className="talent-template-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setIsTemplateMetaModalOpen(false);
                  setTemplateMetaForm(null);
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void onSaveTemplateMeta()}
                disabled={!editable || templateMetaSaving}
              >
                {templateMetaSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDirectoryModal ? (
        <div className="talent-directory-modal">
          <section className="talent-directory-modal__panel">
            <header className="talent-directory-modal__header">
              <h3>新建目录</h3>
              <button type="button" onClick={() => setShowDirectoryModal(false)}>关闭</button>
            </header>

            <label className="talent-directory-modal__level">
              目录级数
              <select
                value={newDirectoryLevel}
                onChange={(event) => {
                  const nextLevel = Math.max(2, Math.min(6, Number(event.target.value || 2)));
                  setNewDirectoryLevel(nextLevel);
                  setNewDirectoryNames((prev) => {
                    const fixedRoot = normalizeRootDirectoryName(prev[0] ?? "") ?? TALENT_DIRECTORY_ROOTS.profession;
                    const next = Array.from({ length: nextLevel }, (_, index) => {
                      if (index === 0) {
                        return fixedRoot;
                      }
                      return prev[index] ?? "";
                    });
                    return next;
                  });
                }}
              >
                <option value={2}>二级</option>
                <option value={3}>三级</option>
                <option value={4}>四级</option>
                <option value={5}>五级</option>
                <option value={6}>六级</option>
              </select>
            </label>

            <label>
              一级目录（固定）
              <select
                value={newDirectoryNames[0] ?? TALENT_DIRECTORY_ROOTS.profession}
                onChange={(event) => {
                  const rootDirectory = normalizeRootDirectoryName(event.target.value) ?? TALENT_DIRECTORY_ROOTS.profession;
                  setNewDirectoryNames((prev) => {
                    const next = [...prev];
                    next[0] = rootDirectory;
                    return next;
                  });
                }}
              >
                <option value={TALENT_DIRECTORY_ROOTS.profession}>{TALENT_DIRECTORY_ROOTS.profession}</option>
                <option value={TALENT_DIRECTORY_ROOTS.general}>{TALENT_DIRECTORY_ROOTS.general}</option>
              </select>
            </label>

            <div className="talent-directory-modal__fields">
              {Array.from({ length: Math.max(0, newDirectoryLevel - 1) }).map((_, index) => {
                const levelIndex = index + 1;
                return (
                <label key={`talent_dir_level_${levelIndex + 1}`}>
                  {`第 ${levelIndex + 1} 级目录名`}
                  <input
                    value={newDirectoryNames[levelIndex] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setNewDirectoryNames((prev) => {
                        const next = [...prev];
                        next[levelIndex] = nextValue;
                        return next;
                      });
                    }}
                    maxLength={32}
                  />
                </label>
              );
              })}
            </div>

            <div className="talent-directory-modal__actions">
              <button type="button" onClick={() => setShowDirectoryModal(false)}>取消</button>
              <button type="button" onClick={onCreateDirectory}>创建目录</button>
            </div>
          </section>
        </div>
      ) : null}

      {isImportModalOpen ? (
        <div className="talent-import-modal" onClick={() => setIsImportModalOpen(false)}>
          <section className="talent-import-modal__panel" onClick={(event) => event.stopPropagation()}>
            <header className="talent-import-modal__header">
              <h3>导入天赋树 JSON</h3>
              <button type="button" onClick={() => setIsImportModalOpen(false)}>关闭</button>
            </header>

            <div className="talent-import-modal__tips">
              <p>支持两种节点写法：直接使用 nodes（会按顺序竖直连线）或使用 branches（每个分支内自动竖直连线）。</p>
              <p>节点字段可用：name/title、cost、requirement、affix、description、studyDescriptions。</p>
              <p>导入会覆盖当前画布，不会自动保存到服务器，请导入后点击“保存模板”。</p>
            </div>

            <label className="talent-import-modal__meta-toggle">
              <input
                type="checkbox"
                checked={importApplyMeta}
                onChange={(event) => setImportApplyMeta(event.target.checked)}
              />
              <span>同时应用 JSON 中的 name/treeType/category/description 到当前模板元信息</span>
            </label>

            <textarea
              className="talent-import-modal__textarea"
              value={importJsonInput}
              onChange={(event) => setImportJsonInput(event.target.value)}
              rows={18}
            />

            <div className="talent-import-modal__actions">
              <button
                type="button"
                onClick={() => setImportJsonInput(TALENT_IMPORT_EXAMPLE)}
              >
                重置示例
              </button>
              <button type="button" onClick={() => setIsImportModalOpen(false)}>取消</button>
              <button type="button" onClick={onApplyJsonImport}>执行导入</button>
            </div>
          </section>
        </div>
      ) : null}

      {isNodeEditorOpen && editingNodeForm ? (
        <div className="talent-node-editor-modal">
          <section className="talent-node-editor-modal__panel" onClick={(event) => event.stopPropagation()}>
            <header className="talent-node-editor-modal__header">
              <h3>节点配置</h3>
              <button type="button" onClick={() => setIsNodeEditorOpen(false)}>关闭</button>
            </header>
            <div className="talent-node-editor-modal__form">
              <label>
                节点名字
                <input
                  value={editingNodeForm.title}
                  onChange={(e) => onChangeEditingNodeForm({ title: e.target.value })}
                  disabled={!editable}
                />
              </label>
              <label>
                概述（缩略图显示）
                <input
                  value={editingNodeForm.summary}
                  onChange={(e) => onChangeEditingNodeForm({ summary: e.target.value })}
                  disabled={!editable}
                />
              </label>
              <label>
                天赋点消耗
                <input
                  type="number"
                  min={0}
                  value={editingNodeForm.cost}
                  onChange={(e) => onChangeEditingNodeForm({ cost: Math.max(0, Number(e.target.value || 0)) })}
                  disabled={!editable}
                />
              </label>
              <label>
                前置要求
                <input
                  value={editingNodeForm.requirement}
                  onChange={(e) => onChangeEditingNodeForm({ requirement: e.target.value })}
                  disabled={!editable}
                />
              </label>
              <label>
                天赋词缀
                <div className="talent-node-editor-modal__affix-picker">
                  <label className="talent-node-editor-modal__affix-item">
                    <input
                      type="checkbox"
                      checked={editingNodeForm.affixMastery}
                      onChange={(e) => onChangeEditingNodeForm({ affixMastery: e.target.checked })}
                      disabled={!editable}
                    />
                    <span>通晓</span>
                  </label>
                  <label className="talent-node-editor-modal__affix-item">
                    <input
                      type="checkbox"
                      checked={editingNodeForm.affixStudy}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditingNodeForm((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          const studyMax = Math.max(1, Number(prev.affixStudyMax || 1));
                          return {
                            ...prev,
                            affixStudy: checked,
                            studyDescriptions: checked ? parseStudyDescriptionLines(prev.description, studyMax) : prev.studyDescriptions
                          };
                        });
                      }}
                      disabled={!editable}
                    />
                    <span>研习X</span>
                  </label>
                  <label className="talent-node-editor-modal__affix-item">
                    <input
                      type="checkbox"
                      checked={editingNodeForm.affixExclusive}
                      onChange={(e) => onChangeEditingNodeForm({ affixExclusive: e.target.checked })}
                      disabled={!editable}
                    />
                    <span>排他</span>
                  </label>
                </div>
                {editingNodeForm.affixStudy ? (
                  <div className="talent-node-editor-modal__study-max">
                    <span>研习等级 X</span>
                    <input
                      type="number"
                      min={1}
                      value={editingNodeForm.affixStudyMax}
                      onChange={(e) => {
                        const nextMax = Math.max(1, Number(e.target.value || 1));
                        setEditingNodeForm((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          const nextDescriptions = Array.from({ length: nextMax }, (_, index) => prev.studyDescriptions[index] ?? "");
                          return {
                            ...prev,
                            affixStudyMax: nextMax,
                            studyDescriptions: nextDescriptions
                          };
                        });
                      }}
                      disabled={!editable}
                    />
                  </div>
                ) : null}
              </label>
              <label>
                节点描述
                {editingNodeForm.affixStudy ? (
                  <div className="talent-node-editor-modal__study-lines">
                    {Array.from({ length: Math.max(1, editingNodeForm.affixStudyMax) }).map((_, index) => (
                      <label key={`study_line_${index}`} className="talent-node-editor-modal__study-line">
                        <span>{`level${index + 1}`}</span>
                        <input
                          value={editingNodeForm.studyDescriptions[index] ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEditingNodeForm((prev) => {
                              if (!prev) {
                                return prev;
                              }
                              const nextDescriptions = [...prev.studyDescriptions];
                              nextDescriptions[index] = value;
                              return {
                                ...prev,
                                studyDescriptions: nextDescriptions
                              };
                            });
                          }}
                          disabled={!editable}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="talent-node-editor-modal__desc-tools">
                      <button type="button" onClick={onInsertBoldForDescription} disabled={!editable}>加粗选中</button>
                      <span>先选中文本再点按钮，详情图中会高亮显示关键词</span>
                    </div>
                    <textarea
                      rows={8}
                      className="talent-node-editor-modal__desc-textarea"
                      ref={nodeDescriptionTextareaRef}
                      value={editingNodeForm.description}
                      onChange={(e) => onChangeEditingNodeForm({ description: e.target.value })}
                      onKeyDown={onNodeDescriptionKeyDown}
                      disabled={!editable}
                    />
                  </>
                )}
              </label>
            </div>
            <div className="talent-node-editor-modal__actions">
              <button type="button" onClick={() => setIsNodeEditorOpen(false)}>取消</button>
              <button type="button" onClick={onDeleteEditingNode} disabled={!editable}>删除节点</button>
              <button type="button" onClick={onApplyNodeEditor} disabled={!editable}>应用</button>
            </div>
          </section>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
