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

type TemplateListResponse = {
  editable: boolean;
  templates: TalentTreeTemplate[];
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

const IMPORT_LAYOUT = {
  startX: 80,
  startY: 80,
  columnGap: 230,
  rowGap: 120,
  nodeWidth: 180,
  nodeHeight: 56
};

const TALENT_IMPORT_EXAMPLE = JSON.stringify(
  {
    name: "狂怒斗士天赋树",
    treeType: "PROFESSION",
    category: "狂怒斗士",
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

      cells.push({
        id: nodeId,
        shape: "rect",
        x,
        y,
        width: IMPORT_LAYOUT.nodeWidth,
        height: IMPORT_LAYOUT.nodeHeight,
        attrs: {
          body: {
            fill: "#f7fbff",
            stroke: "#74aef4",
            rx: 10,
            ry: 10
          },
          label: {
            text: title,
            fill: "#1b4f8a",
            fontSize: 13,
            fontWeight: 600
          }
        },
        data: {
          title,
          summary: typeof node.summary === "string" ? node.summary : "",
          description,
          cost,
          requirement: normalizeRequirementFromImport(node.requirement),
          talentAffix
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
  const labelText = label && typeof label.text === "string" ? label.text.trim() : "";
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
      const label = attrs.label && typeof attrs.label === "object" ? { ...(attrs.label as Record<string, unknown>) } : {};
      label.text = data.title;
      attrs.label = label;

      const ports = cell.ports && typeof cell.ports === "object" ? (cell.ports as Record<string, unknown>) : null;
      const existingItems = ports && Array.isArray((ports as { items?: unknown }).items)
        ? ((ports as { items?: unknown[] }).items ?? [])
        : [];
      const hasValidPorts = existingItems.length > 0;

      return {
        ...cell,
        data,
        attrs,
        ports: hasValidPorts ? ports : TALENT_NODE_PORTS
      };
    })
    .filter((item): item is Record<string, unknown> => !!item);

  return { cells: normalizedCells };
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
  const [graphContainerEl, setGraphContainerEl] = useState<HTMLDivElement | null>(null);
  const [graphReady, setGraphReady] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editable, setEditable] = useState(false);
  const [templates, setTemplates] = useState<TalentTreeTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [treeTypeInput, setTreeTypeInput] = useState<TalentTreeType>("PROFESSION");
  const [categoryInput, setCategoryInput] = useState("职业天赋");
  const [editingNodeForm, setEditingNodeForm] = useState<NodeFormState | null>(null);
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [selectedGraphNodeIds, setSelectedGraphNodeIds] = useState<string[]>([]);
  const [nodeClipboard, setNodeClipboard] = useState<NodeClipboardBundle | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonInput, setImportJsonInput] = useState(TALENT_IMPORT_EXAMPLE);
  const [importApplyMeta, setImportApplyMeta] = useState(true);

  const isAdmin = user?.platformRole === "MASTER" || user?.platformRole === "ADMIN";

  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId]
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await http.get("/talent-trees/templates");
      const data = (resp.data?.data ?? { editable: false, templates: [] }) as TemplateListResponse;
      setEditable(Boolean(data.editable));
      setTemplates(data.templates ?? []);
      if (!activeTemplateId && data.templates?.[0]?.id) {
        setActiveTemplateId(data.templates[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载天赋树模板失败");
    } finally {
      setLoading(false);
    }
  }, [activeTemplateId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!isAdmin || !graphContainerEl || graphRef.current) {
      return;
    }

    const graph = new Graph({
      container: graphContainerEl,
      autoResize: true,
      grid: {
        size: 12,
        visible: true
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
      multiple: true,
      movable: true,
      showNodeSelectionBox: true,
      strict: false,
      eventTypes: ["leftMouseDown"]
    }));

    graph.on("node:contextmenu", ({ e, node }) => {
      e.preventDefault();
      setSelectedGraphNodeId(String(node.id));
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
    });

    graph.on("node:click", ({ node }) => {
      const nodeId = String(node.id);
      setSelectedGraphNodeId(nodeId);
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
    });

    graph.on("selection:changed", ({ selected }) => {
      const selectedNodes = selected.filter((cell: { isNode: () => boolean }) => cell.isNode());
      const ids = selectedNodes.map((cell: { id: string }) => String(cell.id));
      setSelectedGraphNodeIds(ids);
      setSelectedGraphNodeId(ids[0] ?? null);
    });

    graphRef.current = graph;
    setGraphReady(true);
    return () => {
      graph.dispose();
      graphRef.current = null;
      setGraphReady(false);
    };
  }, [isAdmin, graphContainerEl]);

  useEffect(() => {
    if (!activeTemplate) {
      setNameInput("");
      setDescriptionInput("");
      setTreeTypeInput("PROFESSION");
      setCategoryInput("职业天赋");
      if (graphRef.current) {
        graphRef.current.fromJSON({ cells: [] });
      }
      setSelectedGraphNodeId(null);
      setSelectedGraphNodeIds([]);
      setEditingNodeForm(null);
      setIsNodeEditorOpen(false);
      return;
    }

    setNameInput(activeTemplate.name);
    setDescriptionInput(activeTemplate.description || "");
    setTreeTypeInput(activeTemplate.treeType);
    setCategoryInput(activeTemplate.category || (activeTemplate.treeType === "GENERAL" ? "通用天赋" : "职业天赋"));
    if (graphRef.current) {
      graphRef.current.fromJSON(toGraphData(activeTemplate.graphData));
    }
    setSelectedGraphNodeId(null);
    setSelectedGraphNodeIds([]);
    setEditingNodeForm(null);
    setIsNodeEditorOpen(false);
  }, [activeTemplate, graphReady]);

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }
    setCategoryInput((prev) => {
      if (prev.trim()) {
        return prev;
      }
      return treeTypeInput === "GENERAL" ? "通用天赋" : "职业天赋";
    });
  }, [treeTypeInput, activeTemplate]);

  const addTalentNode = () => {
    if (!graphRef.current) {
      setError("画布尚未初始化，请稍后重试");
      return;
    }

    const count = graphRef.current.getNodes().length + 1;
    graphRef.current.addNode({
      shape: "rect",
      x: 80 + count * 16,
      y: 80 + count * 12,
      width: 180,
      height: 56,
      attrs: {
        body: {
          fill: "#f7fbff",
          stroke: "#74aef4",
          rx: 10,
          ry: 10
        },
        label: {
          text: `天赋节点 ${count}`,
          fill: "#1b4f8a",
          fontSize: 13,
          fontWeight: 600
        }
      },
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
    graphRef.current.centerContent();
    setNotice(`已新增节点：天赋节点 ${count}`);
  };

  const addLinkHint = () => {
    setNotice("请拖拽节点上下圆点端口连线；右键节点可打开节点配置弹窗。");
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
        width: item.payload.width,
        height: item.payload.height,
        attrs: {
          body: {
            fill: "#f7fbff",
            stroke: "#74aef4",
            rx: 10,
            ry: 10
          },
          label: {
            text: nextTitle,
            fill: "#1b4f8a",
            fontSize: 13,
            fontWeight: 600
          }
        },
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
    graphRef.current.resetSelection(createdCells);
    setSelectedGraphNodeIds(createdNodeIds);

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
      width: 180,
      height: 56,
      attrs: {
        body: {
          fill: "#f7fbff",
          stroke: "#74aef4",
          rx: 10,
          ry: 10
        },
        label: {
          text: childTitle,
          fill: "#1b4f8a",
          fontSize: 13,
          fontWeight: 600
        }
      },
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
    setNotice(`已创建并连线子节点：${childTitle}`);
  };

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
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        onCopySelectedNode();
      }
      if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        onPasteCopiedNode();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [isAdmin, onCopySelectedNode, onPasteCopiedNode]);

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
    node.attr("label/text", nextTitle);
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

  const onCreateTemplate = async () => {
    if (!editable) {
      setError("当前账号无编辑权限");
      return;
    }

    const draftName = window.prompt("请输入新天赋树名称");
    if (!draftName?.trim()) {
      return;
    }

    setError(null);
    try {
      const resp = await http.post("/talent-trees/templates", {
        name: draftName.trim(),
        treeType: "PROFESSION",
        category: "职业天赋",
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
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const graphData = enrichTalentGraphForRuntime(graphRef.current.toJSON());
      const resp = await http.put(`/talent-trees/templates/${activeTemplate.id}`, {
        name: nameInput,
        description: descriptionInput,
        treeType: treeTypeInput,
        category: categoryInput,
        graphData
      });

      const updated = resp.data?.data as TalentTreeTemplate;
      setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotice("天赋树已保存");
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

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

      graphRef.current.fromJSON(toGraphData(parsed.graphData));
      graphRef.current.centerContent();

      if (importApplyMeta) {
        if (parsed.meta.name) {
          setNameInput(parsed.meta.name);
        }
        if (typeof parsed.meta.description === "string") {
          setDescriptionInput(parsed.meta.description);
        }
        if (parsed.meta.treeType) {
          setTreeTypeInput(parsed.meta.treeType);
        }
        if (parsed.meta.category) {
          setCategoryInput(parsed.meta.category);
        }
      }

      setIsImportModalOpen(false);
      setSelectedGraphNodeId(null);
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

    const exportPayload: TalentImportPayload = {
      name: nameInput.trim() || activeTemplate.name,
      description: descriptionInput,
      treeType: treeTypeInput,
      category: categoryInput,
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
          <h2>模板列表</h2>
          {templates.length === 0 ? <p className="talent-editor-sidebar__empty">暂无天赋树模板</p> : null}
          <div className="talent-editor-sidebar__list">
            {templates.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`talent-editor-sidebar__item ${item.id === activeTemplateId ? "is-active" : ""}`}
                onClick={() => setActiveTemplateId(item.id)}
              >
                <p>{item.name}</p>
                <span>{item.category} · {item.treeType}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="talent-editor-main">
          {!activeTemplate ? (
            <div className="talent-editor-main__empty">请选择模板开始编辑</div>
          ) : (
            <>
              <div className="talent-editor-form">
                <label>
                  名称
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={!editable} />
                </label>
                <label>
                  类型
                  <select
                    value={treeTypeInput}
                    onChange={(e) => setTreeTypeInput(e.target.value as TalentTreeType)}
                    disabled={!editable}
                  >
                    <option value="PROFESSION">职业天赋树</option>
                    <option value="GENERAL">通用天赋树</option>
                  </select>
                </label>
                <label>
                  分类
                  <input
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    placeholder="如：战士系、法师系、通用天赋"
                    maxLength={30}
                    disabled={!editable}
                  />
                </label>
                <label>
                  描述
                  <textarea
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    rows={2}
                    disabled={!editable}
                  />
                </label>
              </div>

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

              <div className="talent-editor-canvas" ref={setGraphContainerEl} />

            </>
          )}
        </main>
      </section>

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
              <span>同时应用 JSON 中的 name/treeType/category/description 到模板表单</span>
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
        <div className="talent-node-editor-modal" onClick={() => setIsNodeEditorOpen(false)}>
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
