import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";
import { connectSocket, disconnectSocket, reconnectSocket, socket, SOCKET_EVENTS } from "../../lib/socket";
import defaultWorldCover from "../../assets/auth/AAFlogo.png";
import { CharacterSheetWorkbench } from "../../components/character/CharacterSheetWorkbench";

type WorldItem = {
  id: string;
  name: string;
  description: string | null;
  coverImageDataUrl?: string | null;
  visibility: "PUBLIC" | "PASSWORD" | "FRIENDS" | "PRIVATE";
  inviteCode?: string | null;
  activeMemberCount?: number;
  createdAt: string;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
  };
  _count: {
    members: number;
    scenes: number;
  };
  myRole?: string;
};

type LobbyChannelKey = "LOBBY" | "SYSTEM" | "PRIVATE" | string;

type ChatMessage = {
  id: string;
  channelKey?: string;
  content: string;
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type FriendUser = {
  id: string;
  username: string;
  displayName: string | null;
};

type FriendItem = {
  id: string;
  status: "ACCEPTED";
  updatedAt: string;
  user: FriendUser;
};

type FriendRequestItem = {
  id: string;
  status: "PENDING";
  createdAt: string;
  fromUser: FriendUser;
};

type LobbyRightPanelTab = "FORUM" | "TOOLBOX";

type LobbyToolKey =
  | "CHARACTER_PRESET"
  | "RULEBOOK"
  | "MONSTER_ATLAS"
  | "WORLD_SETTINGS"
  | "TOKEN_DRAW"
  | "TALENT_TREE";

type LobbyToolItem = {
  key: LobbyToolKey;
  title: string;
  summary: string;
  lobbyUsage: string;
  worldUsage: string;
};

type CharacterBootstrapStep = "NONE" | "ENTRY" | "TUTORIAL_PROMPT" | "QUICK_CREATE";

type LobbyCharacterTokenSnapshot = {
  id: string;
  createdAt: string;
  dataUrl: string;
};

type LobbyCharacterDraft = {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  tokenCurrentDataUrl?: string | null;
  tokenSnapshots?: LobbyCharacterTokenSnapshot[];
};

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

type TalentTreeTemplateListResponse = {
  editable: boolean;
  templates: TalentTreeTemplate[];
};

type TalentTreeNodeView = {
  id: string;
  title: string;
  summary: string;
  description: string;
  requirement: string;
  talentAffix: string;
  cost: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TalentTreeEdgeView = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

type TalentTreeProjection = {
  nodes: TalentTreeNodeView[];
  edges: TalentTreeEdgeView[];
  width: number;
  height: number;
};

type TalentPreviewMode = "THUMBNAIL" | "DETAIL";

const TALENT_PREVIEW_CANVAS_PADDING = 32;
const TALENT_PREVIEW_SYNC_MIN_NODE_WIDTH = 196;
const TALENT_PREVIEW_SYNC_MIN_NODE_HEIGHT = 92;
const TALENT_PREVIEW_DETAIL_NODE_HEIGHT = 180;

type RulebookEntryStatus = "DRAFT" | "PUBLISHED";

type RulebookEntry = {
  id: string;
  title: string;
  summary: string;
  directoryPath: string[];
  contentHtml: string;
  status: RulebookEntryStatus;
  version: number;
  updatedAt: string;
};

type RulebookEntryListResponse = {
  editable: boolean;
  entries: RulebookEntry[];
};

type RulebookDirectoryNode = {
  key: string;
  label: string;
  children: RulebookDirectoryNode[];
  entries: RulebookEntry[];
};

const LOBBY_TOOL_ITEMS: LobbyToolItem[] = [
  {
    key: "CHARACTER_PRESET",
    title: "角色卡预创建",
    summary: "在大厅提前准备角色基础信息，进世界后一键导入继续编辑。",
    lobbyUsage: "用于预创建角色草稿与基础属性模板。",
    worldUsage: "在世界内演进为完整角色卡页面，支持导入大厅预创建角色。"
  },
  {
    key: "RULEBOOK",
    title: "规则书",
    summary: "提前查看跑团规则条目与检索入口，减少开团时沟通成本。",
    lobbyUsage: "大厅内用于预览与快速检索规则。",
    worldUsage: "世界内同样可调用规则检索，作为实时裁定参考。"
  },
  {
    key: "MONSTER_ATLAS",
    title: "怪物图鉴",
    summary: "查看怪物条目索引和基础标签，便于会前准备和查阅。",
    lobbyUsage: "大厅内用于预览怪物条目和分类。",
    worldUsage: "世界内可按战斗上下文快速调取图鉴信息。"
  },
  {
    key: "WORLD_SETTINGS",
    title: "世界设定",
    summary: "浏览世界观设定条目，统一玩家的背景认知和代入感。",
    lobbyUsage: "大厅内用于会前阅读和设定对齐。",
    worldUsage: "世界内作为规则与叙事查询入口随时调用。"
  },
  {
    key: "TOKEN_DRAW",
    title: "token绘制",
    summary: "预留 token 素材绘制与草稿入口，后续接入世界内画布工作流。",
    lobbyUsage: "大厅内用于会前准备 token 草稿。",
    worldUsage: "世界内衔接到实际画布与 token 管理流程。"
  },
  {
    key: "TALENT_TREE",
    title: "天赋树预览",
    summary: "支持职业天赋树与通用天赋树的绘制、发布与只读预览。",
    lobbyUsage: "大厅内可查看已发布天赋树并进入编辑器维护。",
    worldUsage: "世界内后续复用同一骨架做玩家只读查看与分配流程。"
  }
];

const BASE_CHANNELS: LobbyChannelKey[] = ["LOBBY", "SYSTEM"];
const CHARACTER_TUTORIAL_PROMPT_STORAGE_KEY = "aaf-character-tutorial-prompted";
const CHARACTER_DRAFTS_STORAGE_KEY = "aaf-lobby-character-drafts";

const ADMIN_EDITOR_ITEMS = [
  { key: "talent_editor", label: "天赋树编辑器", path: "/system/talent-trees" },
  { key: "talent_trial", label: "角色天赋试用", path: "/system/talent-trial" },
  { key: "rulebook_editor", label: "规则书编辑器", path: "/system/rulebook" }
] as const;

function normalizeLobbyChannel(channelKey?: string): LobbyChannelKey {
  const normalized = (channelKey ?? "LOBBY").toUpperCase().trim();
  return normalized || "LOBBY";
}

function truncateLabel(value: string, maxChars = 4): string {
  const chars = Array.from(value.trim());
  if (chars.length <= maxChars) {
    return chars.join("");
  }
  return chars.slice(0, maxChars).join("");
}

function extractPrivateChannelName(channelKey: LobbyChannelKey): string {
  const raw = (channelKey ?? "").trim();
  if (!raw) {
    return "私聊";
  }

  const withoutPrefix = raw.replace(/^PRIVATE[\s:|#@_-]*/i, "").trim();
  if (withoutPrefix && withoutPrefix.toUpperCase() !== "PRIVATE") {
    return withoutPrefix;
  }

  const splitByDelimiter = raw.split(/[:|#@_-]+/).map((segment) => segment.trim()).filter(Boolean);
  if (splitByDelimiter.length > 1) {
    return splitByDelimiter[splitByDelimiter.length - 1];
  }

  return "私聊";
}

function getLobbyChannelLabel(channelKey: LobbyChannelKey): string {
  const raw = (channelKey ?? "LOBBY").trim() || "LOBBY";
  const normalized = normalizeLobbyChannel(raw);
  if (normalized === "LOBBY") {
    return "大厅";
  }
  if (normalized === "SYSTEM") {
    return "系统";
  }
  if (normalized.startsWith("PRIVATE")) {
    return truncateLabel(extractPrivateChannelName(raw), 4);
  }
  return truncateLabel(raw, 4);
}

function isSystemChannel(channelKey: LobbyChannelKey): boolean {
  return normalizeLobbyChannel(channelKey) === "SYSTEM";
}

function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function formatTimeOnly(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatCrossDayDivider(date: Date, now: Date): string {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((todayStart - targetStart) / oneDayMs);
  if (dayDiff === 1) {
    return `昨天 ${formatTimeOnly(date)}`;
  }
  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatTimeOnly(date)}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTimeOnly(date)}`;
}

function formatOldMessageHint(date: Date, now: Date): string {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((todayStart - targetStart) / oneDayMs);

  if (dayDiff <= 0) {
    return "";
  }

  const yearDiff = now.getFullYear() - date.getFullYear();
  if (
    yearDiff > 1
    || (yearDiff === 1 && (now.getMonth() > date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate())))
  ) {
    return `${yearDiff}年前`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function normalizeTalentCategory(value: unknown, treeType: TalentTreeType) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return treeType === "GENERAL" ? "通用天赋" : "职业天赋";
}

function readCellLabel(cell: Record<string, unknown>) {
  const label = (cell as { label?: unknown }).label;
  if (typeof label === "string" && label.trim()) {
    return label.trim();
  }

  const attrs = (cell as { attrs?: unknown }).attrs;
  if (!attrs || typeof attrs !== "object") {
    return "";
  }

  const labelNode = (attrs as { label?: unknown }).label;
  if (!labelNode || typeof labelNode !== "object") {
    return "";
  }

  const text = (labelNode as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}

function extractTalentNodes(graphData: unknown): TalentTreeNodeView[] {
  if (!graphData || typeof graphData !== "object") {
    return [];
  }

  const cells = (graphData as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) {
    return [];
  }

  return cells
    .map((item, index): TalentTreeNodeView | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const cell = item as Record<string, unknown>;
      if (cell.shape === "edge") {
        return null;
      }

      const rawId = typeof cell.id === "string" ? cell.id : "";
      const data = cell.data && typeof cell.data === "object" ? (cell.data as Record<string, unknown>) : {};
      const title = (typeof data.title === "string" && data.title.trim()) || readCellLabel(cell) || "未命名节点";
      const summary = typeof data.summary === "string" ? data.summary : "";
      const cost = typeof data.cost === "number" && Number.isFinite(data.cost) ? Number(data.cost) : 1;
      const description = typeof data.description === "string" ? data.description : "";
      const requirement = typeof data.requirement === "string" ? data.requirement : "";
      const talentAffix = typeof data.talentAffix === "string" ? data.talentAffix : "";
      const position = cell.position && typeof cell.position === "object"
        ? (cell.position as Record<string, unknown>)
        : null;
      const size = cell.size && typeof cell.size === "object"
        ? (cell.size as Record<string, unknown>)
        : null;

      const x = typeof cell.x === "number" && Number.isFinite(cell.x)
        ? Number(cell.x)
        : (typeof position?.x === "number" && Number.isFinite(position.x) ? Number(position.x) : index * 36);
      const y = typeof cell.y === "number" && Number.isFinite(cell.y)
        ? Number(cell.y)
        : (typeof position?.y === "number" && Number.isFinite(position.y) ? Number(position.y) : index * 26);
      const width = typeof cell.width === "number" && Number.isFinite(cell.width)
        ? Number(cell.width)
        : (typeof size?.width === "number" && Number.isFinite(size.width) ? Number(size.width) : 220);
      const height = typeof cell.height === "number" && Number.isFinite(cell.height)
        ? Number(cell.height)
        : (typeof size?.height === "number" && Number.isFinite(size.height) ? Number(size.height) : 120);

      return {
        id: rawId || `node_${index}`,
        title,
        summary,
        description,
        requirement,
        talentAffix,
        cost,
        x,
        y,
        width,
        height
      };
    })
    .filter((item): item is TalentTreeNodeView => !!item);
}

function extractTalentEdges(graphData: unknown): TalentTreeEdgeView[] {
  if (!graphData || typeof graphData !== "object") {
    return [];
  }

  const cells = (graphData as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) {
    return [];
  }

  return cells
    .map((item, index): TalentTreeEdgeView | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const cell = item as Record<string, unknown>;
      if (cell.shape !== "edge") {
        return null;
      }

      const source = cell.source && typeof cell.source === "object" ? (cell.source as Record<string, unknown>) : {};
      const target = cell.target && typeof cell.target === "object" ? (cell.target as Record<string, unknown>) : {};
      const sourceNodeId = typeof source.cell === "string" ? source.cell : "";
      const targetNodeId = typeof target.cell === "string" ? target.cell : "";
      if (!sourceNodeId || !targetNodeId) {
        return null;
      }

      return {
        id: typeof cell.id === "string" ? cell.id : `edge_${index}`,
        sourceNodeId,
        targetNodeId
      };
    })
    .filter((item): item is TalentTreeEdgeView => !!item);
}

function createTalentProjection(graphData: unknown, mode: TalentPreviewMode): TalentTreeProjection {
  const nodes = extractTalentNodes(graphData);
  const edges = extractTalentEdges(graphData);
  if (!nodes.length) {
    return { nodes, edges, width: 680, height: 360 };
  }

  const spacingX = 1;
  const spacingY = 1;
  const previewNodeWidth = TALENT_PREVIEW_SYNC_MIN_NODE_WIDTH;
  const previewNodeHeight = mode === "DETAIL"
    ? TALENT_PREVIEW_DETAIL_NODE_HEIGHT
    : TALENT_PREVIEW_SYNC_MIN_NODE_HEIGHT;

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const shiftedNodes = nodes.map((node) => ({
    ...node,
    x: (node.x - minX) * spacingX + TALENT_PREVIEW_CANVAS_PADDING,
    y: (node.y - minY) * spacingY + TALENT_PREVIEW_CANVAS_PADDING,
    width: previewNodeWidth,
    height: previewNodeHeight
  }));

  const maxX = Math.max(...shiftedNodes.map((node) => node.x + node.width));
  const maxY = Math.max(...shiftedNodes.map((node) => node.y + node.height));

  return {
    nodes: shiftedNodes,
    edges,
    width: Math.max(680, maxX + TALENT_PREVIEW_CANVAS_PADDING),
    height: Math.max(360, maxY + TALENT_PREVIEW_CANVAS_PADDING)
  };
}

function renderTalentInlineBoldText(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`b_${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`t_${index}`}>{part}</Fragment>;
  });
}

function renderTalentLevelLine(line: string): ReactNode {
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

function renderTalentRichParagraphs(value: string): ReactNode {
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
              <Fragment key={`l_${paragraphIndex}_${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderTalentInlineBoldText(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function normalizeRulebookPath(pathValue: unknown) {
  if (!Array.isArray(pathValue)) {
    return [] as string[];
  }

  return pathValue
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);
}

function buildRulebookDirectoryTree(entries: RulebookEntry[]) {
  const rootMap = new Map<string, RulebookDirectoryNode>();

  for (const entry of entries) {
    const path = normalizeRulebookPath(entry.directoryPath);
    if (!path.length) {
      const key = "__root__";
      const bucket = rootMap.get(key) ?? { key, label: "未分类", children: [], entries: [] };
      bucket.entries.push(entry);
      rootMap.set(key, bucket);
      continue;
    }

    let currentLevel = rootMap;
    let parentNode: RulebookDirectoryNode | null = null;
    const segments: string[] = [];

    for (const segment of path) {
      segments.push(segment);
      const key = segments.join("::");
      let current = currentLevel.get(key);
      if (!current) {
        current = { key, label: segment, children: [], entries: [] };
        currentLevel.set(key, current);
        if (parentNode) {
          parentNode.children.push(current);
        }
      }

      parentNode = current;
      const nextLevel = new Map<string, RulebookDirectoryNode>();
      for (const child of current.children) {
        nextLevel.set(child.key, child);
      }
      currentLevel = nextLevel;
    }

    if (parentNode) {
      parentNode.entries.push(entry);
    }
  }

  return Array.from(rootMap.values());
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [publicWorlds, setPublicWorlds] = useState<WorldItem[]>([]);
  const [myWorlds, setMyWorlds] = useState<WorldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PASSWORD" | "FRIENDS" | "PRIVATE">("PUBLIC");
  const [creating, setCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [worldScopeFilter, setWorldScopeFilter] = useState<"ALL" | "FAVORITES" | "MINE" | "JOINED">("ALL");
  const [worldQuery, setWorldQuery] = useState("");
  const [worldVisibilityFilter, setWorldVisibilityFilter] = useState<"ALL" | "PUBLIC" | "PASSWORD" | "FRIENDS" | "PRIVATE">("ALL");
  const [worldSortBy, setWorldSortBy] = useState<"ACTIVE" | "CREATED_AT">("ACTIVE");
  const [worldSortOrder, setWorldSortOrder] = useState<"DESC" | "ASC">("DESC");
  const [favoriteWorldIds, setFavoriteWorldIds] = useState<string[]>(() => {
    const raw = window.localStorage.getItem("lobby-world-favorites");
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  });
  const [deleteConfirmWorldId, setDeleteConfirmWorldId] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [deletingWorldId, setDeletingWorldId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("disconnected");
  const [unreadChannelMap, setUnreadChannelMap] = useState<Record<string, number>>({});
  const [currentLobbyChannel, setCurrentLobbyChannel] = useState<LobbyChannelKey>("LOBBY");
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<LobbyRightPanelTab>("FORUM");
  const [activeLobbyToolKey, setActiveLobbyToolKey] = useState<LobbyToolKey | null>(null);
  const [characterBootstrapStep, setCharacterBootstrapStep] = useState<CharacterBootstrapStep>("NONE");
  const [characterDraftName, setCharacterDraftName] = useState("");
  const [characterDraftLevel, setCharacterDraftLevel] = useState("1");
  const [characterDrafts, setCharacterDrafts] = useState<LobbyCharacterDraft[]>([]);
  const [isExistingCharacterListExpanded, setIsExistingCharacterListExpanded] = useState(false);
  const [activeCharacterDraftId, setActiveCharacterDraftId] = useState<string | null>(null);
  const [activeCharacterName, setActiveCharacterName] = useState("未命名角色");
  const [activeCharacterTokenDataUrl, setActiveCharacterTokenDataUrl] = useState<string | null>(null);
  const [talentTemplates, setTalentTemplates] = useState<TalentTreeTemplate[]>([]);
  const [talentTemplateLoading, setTalentTemplateLoading] = useState(false);
  const [talentTemplateError, setTalentTemplateError] = useState<string | null>(null);
  const [expandedTalentTreeTypes, setExpandedTalentTreeTypes] = useState<TalentTreeType[]>(["PROFESSION", "GENERAL"]);
  const [expandedTalentCategoryKeys, setExpandedTalentCategoryKeys] = useState<string[]>([]);
  const [selectedTalentTemplateId, setSelectedTalentTemplateId] = useState<string | null>(null);
  const [selectedTalentNodeId, setSelectedTalentNodeId] = useState<string | null>(null);
  const [talentPreviewMode, setTalentPreviewMode] = useState<TalentPreviewMode>("THUMBNAIL");
  const [showTalentDirectoryDrawer, setShowTalentDirectoryDrawer] = useState(false);

  const [rulebookEntries, setRulebookEntries] = useState<RulebookEntry[]>([]);
  const [rulebookLoading, setRulebookLoading] = useState(false);
  const [rulebookError, setRulebookError] = useState<string | null>(null);
  const [expandedRulebookDirectoryKeys, setExpandedRulebookDirectoryKeys] = useState<string[]>([]);
  const [selectedRulebookEntryId, setSelectedRulebookEntryId] = useState<string | null>(null);
  const [showRulebookDirectoryDrawer, setShowRulebookDirectoryDrawer] = useState(false);

  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<"friends" | "requests">("friends");
  const [nicknameInput, setNicknameInput] = useState(user?.displayName || user?.username || "");
  const [savingNickname, setSavingNickname] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [friendActionId, setFriendActionId] = useState<string | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);

  const currentUserIdRef = useRef<string | undefined>(user?.id);
  const currentChannelRef = useRef<LobbyChannelKey>("LOBBY");
  const channelDropdownRef = useRef<HTMLDivElement | null>(null);
  const channelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const socialDropdownRef = useRef<HTMLElement | null>(null);
  const socialTriggerRef = useRef<HTMLButtonElement | null>(null);

  const displayName = useMemo(() => user?.displayName || user?.username || "未知用户", [user]);
  const isPlatformAdmin = user?.platformRole === "MASTER" || user?.platformRole === "ADMIN";

  const currentChannelName = useMemo(() => getLobbyChannelLabel(currentLobbyChannel), [currentLobbyChannel]);
  const userButtonLabel = useMemo(() => {
    const firstChar = Array.from(displayName.trim())[0] ?? "";
    if (!firstChar || /^[0-9]$/.test(firstChar)) {
      return "我";
    }
    return firstChar.toUpperCase();
  }, [displayName]);

  const activeLobbyTool = useMemo(
    () => LOBBY_TOOL_ITEMS.find((item) => item.key === activeLobbyToolKey) ?? null,
    [activeLobbyToolKey]
  );

  const visibleTalentTemplates = useMemo(() => {
    if (isPlatformAdmin) {
      return talentTemplates;
    }
    return talentTemplates.filter((item) => item.status === "PUBLISHED");
  }, [isPlatformAdmin, talentTemplates]);

  const talentDirectoryTree = useMemo(() => {
    const treeTypeLabelMap: Record<TalentTreeType, string> = {
      PROFESSION: "职业天赋树",
      GENERAL: "通用天赋树"
    };
    const orderedTreeTypes: TalentTreeType[] = ["PROFESSION", "GENERAL"];

    return orderedTreeTypes.map((treeType) => {
      const templates = visibleTalentTemplates.filter((item) => item.treeType === treeType);
      const categoryMap = new Map<string, TalentTreeTemplate[]>();
      for (const template of templates) {
        const category = normalizeTalentCategory(template.category, template.treeType);
        const bucket = categoryMap.get(category) ?? [];
        bucket.push(template);
        categoryMap.set(category, bucket);
      }

      return {
        treeType,
        label: treeTypeLabelMap[treeType],
        categories: Array.from(categoryMap.entries()).map(([category, bucket]) => ({
          key: `${treeType}::${category}`,
          category,
          templates: bucket
        }))
      };
    });
  }, [visibleTalentTemplates]);

  const flattenedTalentTemplates = useMemo(
    () => talentDirectoryTree.flatMap((group) => group.categories.flatMap((category) => category.templates)),
    [talentDirectoryTree]
  );

  const selectedTalentTemplate = useMemo(
    () => flattenedTalentTemplates.find((item) => item.id === selectedTalentTemplateId) ?? flattenedTalentTemplates[0] ?? null,
    [selectedTalentTemplateId, flattenedTalentTemplates]
  );

  const selectedTalentNodes = useMemo(
    () => extractTalentNodes(selectedTalentTemplate?.graphData),
    [selectedTalentTemplate]
  );

  const selectedTalentProjection = useMemo(
    () => createTalentProjection(selectedTalentTemplate?.graphData, talentPreviewMode),
    [selectedTalentTemplate, talentPreviewMode]
  );

  const selectedTalentNode = useMemo(
    () => selectedTalentNodes.find((item) => item.id === selectedTalentNodeId) ?? selectedTalentNodes[0] ?? null,
    [selectedTalentNodeId, selectedTalentNodes]
  );

  const visibleRulebookEntries = useMemo(() => {
    if (isPlatformAdmin) {
      return rulebookEntries;
    }
    return rulebookEntries.filter((item) => item.status === "PUBLISHED");
  }, [isPlatformAdmin, rulebookEntries]);

  const rulebookDirectoryTree = useMemo(
    () => buildRulebookDirectoryTree(visibleRulebookEntries),
    [visibleRulebookEntries]
  );

  const selectedRulebookEntry = useMemo(
    () => visibleRulebookEntries.find((item) => item.id === selectedRulebookEntryId) ?? visibleRulebookEntries[0] ?? null,
    [selectedRulebookEntryId, visibleRulebookEntries]
  );

  const selectedRulebookHtml = useMemo(
    () => DOMPurify.sanitize(selectedRulebookEntry?.contentHtml || "<p>暂无正文</p>"),
    [selectedRulebookEntry]
  );
  
  const worldCards = useMemo(() => {
    const merged = new Map<string, WorldItem>();
    for (const item of [...publicWorlds, ...myWorlds]) {
      merged.set(item.id, item);
    }
    return Array.from(merged.values());
  }, [publicWorlds, myWorlds]);

  const joinedWorldIdSet = useMemo(() => new Set(myWorlds.map((item) => item.id)), [myWorlds]);

  const filteredWorldCards = useMemo(() => {
    const favoriteSet = new Set(favoriteWorldIds);
    const query = worldQuery.trim().toLowerCase();

    const list = worldCards.filter((item) => {
      if (worldScopeFilter === "FAVORITES" && !favoriteSet.has(item.id)) {
        return false;
      }
      if (worldScopeFilter === "MINE" && item.owner.id !== user?.id) {
        return false;
      }
      if (worldScopeFilter === "JOINED" && !joinedWorldIdSet.has(item.id)) {
        return false;
      }
      if (worldVisibilityFilter !== "ALL" && item.visibility !== worldVisibilityFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = `${item.name} ${item.description ?? ""} ${item.owner.displayName ?? ""} ${item.owner.username}`.toLowerCase();
      return haystack.includes(query);
    });

    list.sort((left, right) => {
      const direction = worldSortOrder === "ASC" ? 1 : -1;
      if (worldSortBy === "ACTIVE") {
        return (((left.activeMemberCount ?? 0) - (right.activeMemberCount ?? 0)) || (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())) * direction;
      }
      return (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()) * direction;
    });

    return list;
  }, [favoriteWorldIds, joinedWorldIdSet, user?.id, worldCards, worldQuery, worldScopeFilter, worldSortBy, worldSortOrder, worldVisibilityFilter]);

  const availableChannels = useMemo(() => {
    const dynamic = new Map<string, LobbyChannelKey>();
    for (const message of chatMessages) {
      const raw = (message.channelKey ?? "LOBBY").trim() || "LOBBY";
      const normalized = normalizeLobbyChannel(raw);
      if (!dynamic.has(normalized)) {
        dynamic.set(normalized, raw);
      }
    }

    const merged = [...BASE_CHANNELS] as LobbyChannelKey[];
    const mergedNormalized = new Set(merged.map((channel) => normalizeLobbyChannel(channel)));
    for (const [, channel] of dynamic) {
      const normalized = normalizeLobbyChannel(channel);
      if (!mergedNormalized.has(normalized)) {
        merged.push(channel);
        mergedNormalized.add(normalized);
      }
    }
    return merged;
  }, [chatMessages]);

  const filteredChatMessages = useMemo(
    () => chatMessages.filter((message) => normalizeLobbyChannel(message.channelKey) === normalizeLobbyChannel(currentLobbyChannel)),
    [chatMessages, currentLobbyChannel]
  );

  const unreadSummary = useMemo(() => {
    const entries = Object.entries(unreadChannelMap).filter(([, count]) => count > 0);
    const totalUnread = entries.reduce((acc, [, count]) => acc + count, 0);
    const channelCount = entries.length;
    if (channelCount === 0) {
      return "";
    }
    if (channelCount === 1) {
      const [channel] = entries[0];
      return `${getLobbyChannelLabel(channel)}频道有新消息`;
    }
    return `${channelCount}个频道共有${totalUnread}条未读消息`;
  }, [unreadChannelMap]);

  const chatInputDisabled = useMemo(() => isSystemChannel(currentLobbyChannel) || socketStatus !== "connected", [currentLobbyChannel, socketStatus]);

  const onlineFriends = useMemo(() => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() <= 1000 * 60 * 10), [friends]);
  const offlineFriends = useMemo(() => friends.filter((item) => Date.now() - new Date(item.updatedAt).getTime() > 1000 * 60 * 10), [friends]);

  const refreshRecentLobbyMessages = useCallback(async () => {
    const resp = await http.get("/chat/global/recent", { params: { limit: 100 } });
    const list = (resp.data.data ?? []) as ChatMessage[];
    setChatMessages(list.map((item) => ({ ...item, channelKey: (item.channelKey ?? "LOBBY").trim() || "LOBBY" })));
  }, []);

  const loadWorlds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicResp, mineResp] = await Promise.all([http.get("/worlds"), http.get("/worlds", { params: { scope: "mine" } })]);

      setPublicWorlds(publicResp.data.data ?? []);
      setMyWorlds(mineResp.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载世界列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSocialData = useCallback(async () => {
    if (!token) {
      return;
    }

    setSocialLoading(true);
    setSocialError(null);
    try {
      const [friendsResp, requestsResp] = await Promise.all([http.get("/social/friends"), http.get("/social/requests/incoming")]);
      setFriends((friendsResp.data?.data ?? []) as FriendItem[]);
      setIncomingRequests((requestsResp.data?.data ?? []) as FriendRequestItem[]);
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "加载社交数据失败");
    } finally {
      setSocialLoading(false);
    }
  }, [token]);

  const loadTalentTemplates = useCallback(async () => {
    setTalentTemplateLoading(true);
    setTalentTemplateError(null);
    try {
      const resp = await http.get("/talent-trees/templates");
      const data = (resp.data?.data ?? { editable: false, templates: [] }) as TalentTreeTemplateListResponse;
      const templates = (data.templates ?? []).map((item) => ({
        ...item,
        category: normalizeTalentCategory(item.category, item.treeType)
      }));
      setTalentTemplates(templates);
    } catch (err: any) {
      setTalentTemplateError(err.response?.data?.error?.message || "加载天赋树目录失败");
    } finally {
      setTalentTemplateLoading(false);
    }
  }, []);

  const loadRulebookEntries = useCallback(async () => {
    setRulebookLoading(true);
    setRulebookError(null);
    try {
      const resp = await http.get("/rulebook/entries");
      const data = (resp.data?.data ?? { editable: false, entries: [] }) as RulebookEntryListResponse;
      setRulebookEntries(
        (data.entries ?? []).map((item) => ({
          ...item,
          directoryPath: normalizeRulebookPath(item.directoryPath)
        }))
      );
    } catch (err: any) {
      setRulebookError(err.response?.data?.error?.message || "加载规则书目录失败");
    } finally {
      setRulebookLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    void loadSocialData();
  }, [loadSocialData]);

  useEffect(() => {
    currentUserIdRef.current = user?.id;
    setNicknameInput(user?.displayName || user?.username || "");
  }, [user?.id, user?.displayName, user?.username]);

  useEffect(() => {
    currentChannelRef.current = currentLobbyChannel;
  }, [currentLobbyChannel]);

  useEffect(() => {
    if (!isSocialOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (socialDropdownRef.current?.contains(target)) {
        return;
      }
      if (socialTriggerRef.current?.contains(target)) {
        return;
      }
      setIsSocialOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSocialOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isSocialOpen]);

  useEffect(() => {
    if (!showChannelModal) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (channelDropdownRef.current?.contains(target)) {
        return;
      }
      if (channelTriggerRef.current?.contains(target)) {
        return;
      }
      setShowChannelModal(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowChannelModal(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [showChannelModal]);

  useEffect(() => {
    if (!activeLobbyToolKey) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveLobbyToolKey(null);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [activeLobbyToolKey]);

  useEffect(() => {
    if (activeLobbyToolKey !== "TALENT_TREE") {
      setShowTalentDirectoryDrawer(false);
    } else {
      void loadTalentTemplates();
    }
  }, [activeLobbyToolKey, loadTalentTemplates]);

  useEffect(() => {
    if (activeLobbyToolKey !== "RULEBOOK") {
      setShowRulebookDirectoryDrawer(false);
      return;
    }
    void loadRulebookEntries();
  }, [activeLobbyToolKey, loadRulebookEntries]);

  useEffect(() => {
    if (!flattenedTalentTemplates.length) {
      setSelectedTalentTemplateId(null);
      return;
    }
    setSelectedTalentTemplateId((prev) => {
      if (prev && flattenedTalentTemplates.some((item) => item.id === prev)) {
        return prev;
      }
      return flattenedTalentTemplates[0].id;
    });
  }, [flattenedTalentTemplates]);

  useEffect(() => {
    if (!selectedTalentTemplate) {
      return;
    }

    const category = normalizeTalentCategory(selectedTalentTemplate.category, selectedTalentTemplate.treeType);
    const categoryKey = `${selectedTalentTemplate.treeType}::${category}`;
    setExpandedTalentTreeTypes((prev) => {
      if (prev.includes(selectedTalentTemplate.treeType)) {
        return prev;
      }
      return [...prev, selectedTalentTemplate.treeType];
    });
    setExpandedTalentCategoryKeys((prev) => {
      if (prev.includes(categoryKey)) {
        return prev;
      }
      return [...prev, categoryKey];
    });
  }, [selectedTalentTemplate]);

  useEffect(() => {
    if (!visibleRulebookEntries.length) {
      setSelectedRulebookEntryId(null);
      return;
    }

    setSelectedRulebookEntryId((prev) => {
      if (prev && visibleRulebookEntries.some((item) => item.id === prev)) {
        return prev;
      }
      return visibleRulebookEntries[0].id;
    });
  }, [visibleRulebookEntries]);

  useEffect(() => {
    if (!selectedTalentNodes.length) {
      setSelectedTalentNodeId(null);
      return;
    }
    setSelectedTalentNodeId((prev) => {
      if (prev && selectedTalentNodes.some((item) => item.id === prev)) {
        return prev;
      }
      return selectedTalentNodes[0].id;
    });
  }, [selectedTalentNodes]);

  useEffect(() => {
    const normalized = normalizeLobbyChannel(currentLobbyChannel);
    setUnreadChannelMap((prev) => {
      if (!prev[normalized]) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  }, [currentLobbyChannel]);

  useEffect(() => {
    if (!deleteConfirmWorldId || deleteCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [deleteConfirmWorldId, deleteCountdown]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setSocketStatus("connecting");

    void (async () => {
      try {
        await refreshRecentLobbyMessages();
      } catch {
        // keep empty state when history loading fails
      }
    })();

    connectSocket(token);

    const onAck = () => {
      setSocketStatus("connected");
    };

    const onConnect = () => {
      setSocketStatus("connected");
    };

    const onDisconnect = () => {
      setSocketStatus("disconnected");
    };

    const onConnectError = () => {
      setSocketStatus("reconnecting");
      setError((prev) => prev ?? "实时连接异常，正在自动重连");
    };

    const onReconnectAttempt = () => {
      setSocketStatus("reconnecting");
    };

    const onReconnectFailed = () => {
      setSocketStatus("disconnected");
    };

    const onNewMessage = (message: ChatMessage) => {
      const normalizedChannel = normalizeLobbyChannel(message.channelKey);
      const rawChannel = (message.channelKey ?? "LOBBY").trim() || "LOBBY";
      const isFromSelf = message.fromUser?.id === currentUserIdRef.current;
      const isCurrentChannel = normalizeLobbyChannel(currentChannelRef.current) === normalizedChannel;
      if (!isFromSelf && !isCurrentChannel) {
        setUnreadChannelMap((prev) => ({
          ...prev,
          [normalizedChannel]: (prev[normalizedChannel] ?? 0) + 1
        }));
      }

      setChatMessages((prev) => {
        const next = [...prev, { ...message, channelKey: rawChannel }];
        if (next.length > 200) {
          return next.slice(next.length - 200);
        }
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.connectionAck, onAck);
    socket.on(SOCKET_EVENTS.globalMessageNew, onNewMessage);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off(SOCKET_EVENTS.connectionAck, onAck);
      socket.off(SOCKET_EVENTS.globalMessageNew, onNewMessage);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      setSocketStatus("disconnected");
      disconnectSocket();
    };
  }, [token, refreshRecentLobbyMessages]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRecentLobbyMessages();
    }, 12000);

    return () => {
      window.clearInterval(timer);
    };
  }, [token, refreshRecentLobbyMessages]);


  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("世界名称不能为空");
      return;
    }
    setCreating(true);
    try {
      const resp = await http.post("/worlds", {
        name,
        description,
        visibility,
        coverImageDataUrl: coverPreview,
      });

      const created = resp.data?.data as WorldItem | undefined;
      if (created?.inviteCode) {
        setCreatedInviteCode(created.inviteCode);
      } else {
        setCreatedInviteCode(null);
      }

      setName("");
      setDescription("");
      setVisibility("PUBLIC");
      setCoverPreview(null);
      setIsCreateModalOpen(false);
      await loadWorlds();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建世界失败");
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async (world: WorldItem) => {
    try {
      const joinPayload: { inviteCode?: string } = {};
      if (world.visibility === "PASSWORD") {
        const input = window.prompt(`请输入世界 [${world.name}] 的邀请码`);
        if (!input) {
          return;
        }
        joinPayload.inviteCode = input.trim();
      }

      await http.post(`/worlds/${world.id}/join`, joinPayload);
      await loadWorlds();
      navigate(`/world/${world.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加入世界失败");
    }
  };

  const onLogout = () => {
    disconnectSocket();
    clearAuth();
    navigate("/login");
  };

  const onToggleFavoriteWorld = (worldId: string) => {
    setFavoriteWorldIds((prev) => {
      if (prev.includes(worldId)) {
        return prev.filter((item) => item !== worldId);
      }
      return [...prev, worldId];
    });
  };

  const onCoverFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setCoverPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onPrepareDeleteWorld = (worldId: string) => {
    setDeleteConfirmWorldId(worldId);
    setDeleteCountdown(5);
  };

  const onDeleteWorld = async (worldId: string) => {
    setDeletingWorldId(worldId);
    setError(null);
    try {
      await http.delete(`/worlds/${worldId}`);
      setDeleteConfirmWorldId(null);
      setDeleteCountdown(0);
      setFavoriteWorldIds((prev) => prev.filter((item) => item !== worldId));
      await loadWorlds();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "删除世界失败");
    } finally {
      setDeletingWorldId(null);
    }
  };

  const onSendChat = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitLobbyChat();
  };

  const submitLobbyChat = async () => {
    if (!chatInput.trim() || chatInputDisabled) {
      return;
    }

    setChatSending(true);
    const content = chatInput;
    setChatInput("");

    const ackTimeout = window.setTimeout(() => {
      setChatSending(false);
      setError((prev) => prev ?? "发送超时，请稍后重试");
      setChatInput((current) => current || content);
    }, 8000);

    socket.emit(
      SOCKET_EVENTS.globalMessageSend,
      { content, channelKey: normalizeLobbyChannel(currentLobbyChannel) },
      (result?: { ok?: boolean; error?: string }) => {
        window.clearTimeout(ackTimeout);
        if (!result?.ok) {
          setError(result?.error || "发送消息失败");
          setChatInput(content);
        }
        setChatSending(false);
      }
    );
  };

  const onChatInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.ctrlKey) {
      return;
    }

    event.preventDefault();
    void submitLobbyChat();
  };

  const onSaveNickname = async () => {
    if (!nicknameInput.trim()) {
      setSocialError("昵称不能为空");
      return;
    }

    setSavingNickname(true);
    setSocialError(null);
    try {
      const resp = await http.patch("/auth/me", { displayName: nicknameInput.trim() });
      const updated = resp.data?.data;
      updateUser({ displayName: updated?.displayName ?? nicknameInput.trim() });
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "保存昵称失败");
    } finally {
      setSavingNickname(false);
    }
  };

  const onSendFriendRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!friendQuery.trim()) {
      setSocialError("请输入好友昵称或账号");
      return;
    }

    setSendingFriendRequest(true);
    setSocialError(null);
    try {
      await http.post("/social/requests", { query: friendQuery.trim() });
      setShowAddFriendModal(false);
      setFriendQuery("");
      await loadSocialData();
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "发送好友申请失败");
    } finally {
      setSendingFriendRequest(false);
    }
  };

  const onHandleFriendRequest = async (requestId: string, action: "accept" | "reject") => {
    setFriendActionId(requestId);
    setSocialError(null);
    try {
      await http.patch(`/social/requests/${requestId}`, { action });
      await loadSocialData();
      if (action === "reject") {
        await refreshRecentLobbyMessages();
      }
    } catch (err: any) {
      setSocialError(err.response?.data?.error?.message || "处理好友申请失败");
    } finally {
      setFriendActionId(null);
    }
  };

  const closeCharacterBootstrap = () => {
    setCharacterBootstrapStep("NONE");
    setCharacterDraftName("");
    setCharacterDraftLevel("1");
    setIsExistingCharacterListExpanded(false);
  };

  const readLobbyCharacterDrafts = useCallback((): LobbyCharacterDraft[] => {
    const raw = window.localStorage.getItem(CHARACTER_DRAFTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is LobbyCharacterDraft => {
          if (!item || typeof item !== "object") {
            return false;
          }
          const candidate = item as Partial<LobbyCharacterDraft>;
          return (
            typeof candidate.id === "string"
            && typeof candidate.ownerUserId === "string"
            && typeof candidate.name === "string"
            && typeof candidate.createdAt === "string"
            && (candidate.tokenCurrentDataUrl == null || typeof candidate.tokenCurrentDataUrl === "string")
          );
        })
        .map((item) => {
          const tokenSnapshots = Array.isArray(item.tokenSnapshots)
            ? item.tokenSnapshots.filter((snapshot): snapshot is LobbyCharacterTokenSnapshot => (
              !!snapshot
              && typeof snapshot === "object"
              && typeof snapshot.id === "string"
              && typeof snapshot.createdAt === "string"
              && typeof snapshot.dataUrl === "string"
            ))
            : [];

          return {
            ...item,
            tokenCurrentDataUrl: item.tokenCurrentDataUrl ?? null,
            tokenSnapshots
          };
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch {
      return [];
    }
  }, []);

  const writeLobbyCharacterDrafts = useCallback((drafts: LobbyCharacterDraft[]) => {
    window.localStorage.setItem(CHARACTER_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }, []);

  const openCharacterDraft = (draft: LobbyCharacterDraft) => {
    setActiveCharacterDraftId(draft.id);
    setActiveCharacterName(draft.name);
    setActiveCharacterTokenDataUrl(draft.tokenCurrentDataUrl ?? null);
    closeCharacterBootstrap();
    setActiveLobbyToolKey("CHARACTER_PRESET");
  };

  const openCharacterPresetBootstrap = () => {
    setCharacterDraftName("");
    setCharacterDraftLevel("1");
    const allDrafts = readLobbyCharacterDrafts();
    const currentUserDrafts = allDrafts.filter((item) => item.ownerUserId === (user?.id ?? ""));
    setCharacterDrafts(currentUserDrafts);
    setIsExistingCharacterListExpanded(false);
    setCharacterBootstrapStep("ENTRY");
  };

  const onSelectCharacterBootstrapAction = (action: "TUTORIAL" | "QUICK" | "EXISTING") => {
    if (action === "TUTORIAL") {
      setCharacterBootstrapStep("TUTORIAL_PROMPT");
      return;
    }

    if (action === "QUICK") {
      setCharacterBootstrapStep("QUICK_CREATE");
      return;
    }

    setIsExistingCharacterListExpanded((prev) => !prev);
  };

  const onSelectTutorialChoice = (needTutorial: boolean) => {
    window.localStorage.setItem(CHARACTER_TUTORIAL_PROMPT_STORAGE_KEY, "1");
    if (needTutorial) {
      // 教程流程先保留入口，后续接入完整的新手引导。
    }
    setCharacterBootstrapStep("QUICK_CREATE");
  };

  const onConfirmCharacterBootstrap = () => {
    const nextName = characterDraftName.trim();
    if (!nextName) {
      setError("请先填写角色名字");
      return;
    }

    const ownerUserId = user?.id ?? "anonymous";
    const nextDraft: LobbyCharacterDraft = {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ownerUserId,
      name: nextName,
      createdAt: new Date().toISOString(),
      tokenCurrentDataUrl: null,
      tokenSnapshots: []
    };
    const allDrafts = readLobbyCharacterDrafts();
    const updatedDrafts = [nextDraft, ...allDrafts];
    writeLobbyCharacterDrafts(updatedDrafts);

    openCharacterDraft(nextDraft);
  };

  const onCharacterTokenUpload = useCallback((tokenDataUrl: string) => {
    if (!activeCharacterDraftId) {
      return;
    }

    const snapshotId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const nextSnapshot: LobbyCharacterTokenSnapshot = {
      id: snapshotId,
      createdAt: new Date().toISOString(),
      dataUrl: tokenDataUrl
    };

    const allDrafts = readLobbyCharacterDrafts();
    const updatedDrafts = allDrafts.map((draft) => {
      if (draft.id !== activeCharacterDraftId) {
        return draft;
      }

      const tokenSnapshots = Array.isArray(draft.tokenSnapshots) ? draft.tokenSnapshots : [];
      return {
        ...draft,
        tokenCurrentDataUrl: tokenDataUrl,
        tokenSnapshots: [...tokenSnapshots, nextSnapshot]
      };
    });

    writeLobbyCharacterDrafts(updatedDrafts);
    setActiveCharacterTokenDataUrl(tokenDataUrl);

    const ownerUserId = user?.id ?? "";
    setCharacterDrafts(updatedDrafts.filter((item) => item.ownerUserId === ownerUserId));
  }, [activeCharacterDraftId, readLobbyCharacterDrafts, user?.id, writeLobbyCharacterDrafts]);

  return (
    <div className="lobby-page-wrapper">
      {/* 顶部栏 */}
      <header className="lobby-topbar-fixed">
        <div className="lobby-topbar-fixed__left">
          <h1 className="lobby-topbar-fixed__title">大厅</h1>
        </div>
        <p className="lobby-topbar-fixed__welcome">欢迎回来，{displayName}，选择世界、集结队友，然后踏上新的冒险。</p>
      </header>

      {typeof document !== "undefined"
        ? createPortal(
            <button
              className="lobby-user-fab"
              type="button"
              ref={socialTriggerRef}
              title="社交中心"
              onClick={() => {
                setIsSocialOpen((prev) => !prev);
                setSocialTab("friends");
                setSocialError(null);
              }}
              aria-label="打开社交中心"
            >
              {userButtonLabel}
            </button>,
            document.body
          )
        : null}

      {/* 三栏主容器 */}
      <div className="lobby-layout-3col">
        {/* 左侧：聊天面板 */}
        <aside className="lobby-chat-sidebar">
          <div className="lobby-chat-sidebar__header">
            <div className="lobby-chat-sidebar__header-main">
              <h2>{currentChannelName}</h2>
              <button
                className="lobby-chat-sidebar__channel-btn"
                type="button"
                ref={channelTriggerRef}
                onClick={() => setShowChannelModal((prev) => !prev)}
              >
                频道列表
              </button>
              {unreadSummary ? (
                <span className="lobby-chat-sidebar__channel-tip">{unreadSummary}</span>
              ) : null}

              {showChannelModal ? (
                <div className="lobby-channel-select" ref={channelDropdownRef}>
                  {availableChannels.map((channel) => {
                    const normalized = normalizeLobbyChannel(channel);
                    const active = normalized === normalizeLobbyChannel(currentLobbyChannel);
                    const unreadCount = unreadChannelMap[normalized] ?? 0;
                    return (
                      <button
                        key={channel}
                        className={`lobby-channel-select__item ${active ? "is-active" : ""}`}
                        type="button"
                        onClick={() => {
                          setCurrentLobbyChannel(channel);
                          setShowChannelModal(false);
                        }}
                      >
                        <span>{getLobbyChannelLabel(channel)}</span>
                        <span className="lobby-channel-select__meta">
                          {unreadCount > 0 ? (
                            <span className="lobby-channel-select__new-badge">NEW！！</span>
                          ) : null}
                          {active ? <span>✓</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <span
              className={`lobby-chat__status ${
                socketStatus === "connected" ? "is-connected" : socketStatus === "reconnecting" ? "is-reconnecting" : "is-disconnected"
              }`}
              title={
                socketStatus === "connected"
                  ? "实时连接中"
                  : socketStatus === "reconnecting"
                    ? "重连中..."
                    : socketStatus === "connecting"
                      ? "连接中..."
                      : "已断开"
              }
            >
              •
            </span>
          </div>

          {socketStatus !== "connected" ? (
            <div className="lobby-chat-sidebar__alert">
              <span>{socketStatus === "reconnecting" ? "实时连接异常，正在自动重连" : "实时连接已断开"}</span>
              <button type="button" onClick={reconnectSocket}>
                重连
              </button>
            </div>
          ) : null}

          <div className="lobby-chat-sidebar__messages">
            {filteredChatMessages.length === 0 ? (
              <p className="lobby-chat-sidebar__empty">当前频道暂无消息</p>
            ) : null}
            {filteredChatMessages.map((message, index) => {
              const now = new Date();
              const currentDate = new Date(message.createdAt);
              const prevDate = index > 0 ? new Date(filteredChatMessages[index - 1].createdAt) : null;
              const showDayDivider = prevDate ? !isSameDate(currentDate, prevDate) : !isSameDate(currentDate, now);
              const oldMessageHint = formatOldMessageHint(currentDate, now);

              return (
                <Fragment key={message.id}>
                  {showDayDivider ? (
                    <p className="lobby-chat-sidebar__day-divider">{formatCrossDayDivider(currentDate, now)}</p>
                  ) : null}
                  <div className="lobby-chat-sidebar__message">
                    <p className="lobby-chat-sidebar__message-meta">
                      <span className="lobby-badge">{getLobbyChannelLabel(message.channelKey ?? "LOBBY")}</span>
                      <span>{message.fromUser.displayName || message.fromUser.username}</span>
                      <span>{formatTimeOnly(currentDate)}</span>
                    </p>
                    <p className="lobby-chat-sidebar__message-content">{message.content}</p>
                    {oldMessageHint ? (
                      <p className="lobby-chat-sidebar__message-date-hint">{oldMessageHint}</p>
                    ) : null}
                  </div>
                </Fragment>
              );
            })}
          </div>

          <form className="lobby-chat-sidebar__form" onSubmit={onSendChat}>
            <textarea
              className="lobby-chat-sidebar__input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={onChatInputKeyDown}
              placeholder={
                isSystemChannel(currentLobbyChannel)
                  ? "系统频道为只读通知频道"
                  : "输入大厅消息"
              }
              maxLength={1000}
              disabled={chatInputDisabled}
              rows={3}
            />
            <button
              className="lobby-chat-sidebar__send"
              type="submit"
              disabled={chatSending || chatInputDisabled}
            >
              {chatSending ? "发送中..." : "发送"}
            </button>
          </form>
        </aside>

        {/* 中间：世界列表 */}
        <main className="lobby-main-content">
          <div className="lobby-main-content__top">
            {error ? (
              <div className="lobby-main-content__error">{error}</div>
            ) : null}
            {createdInviteCode ? (
              <div className="lobby-main-content__success">
                邀请世界已创建，邀请码：{createdInviteCode}
              </div>
            ) : null}

            <section className="lobby-toolbar">
              <input
                className="lobby-toolbar__search"
                value={worldQuery}
                onChange={(event) => setWorldQuery(event.target.value)}
                placeholder="搜索世界名、描述、创建者"
              />

              <select
                value={worldScopeFilter}
                onChange={(event) =>
                  setWorldScopeFilter(
                    event.target.value as "ALL" | "FAVORITES" | "MINE" | "JOINED"
                  )
                }
              >
                <option value="ALL">全部世界</option>
                <option value="FAVORITES">收藏世界</option>
                <option value="MINE">我的世界</option>
                <option value="JOINED">已加入世界</option>
              </select>

              {isPlatformAdmin ? (
                <select
                  value={worldVisibilityFilter}
                  onChange={(event) =>
                    setWorldVisibilityFilter(
                      event.target.value as
                        | "ALL"
                        | "PUBLIC"
                        | "PASSWORD"
                        | "FRIENDS"
                        | "PRIVATE"
                    )
                  }
                >
                  <option value="ALL">全部隐私类型</option>
                  <option value="PUBLIC">公开</option>
                  <option value="PASSWORD">邀请</option>
                  <option value="PRIVATE">私密</option>
                  <option value="FRIENDS">仅好友</option>
                </select>
              ) : null}

              <select
                value={worldSortBy}
                onChange={(event) =>
                  setWorldSortBy(event.target.value as "ACTIVE" | "CREATED_AT")
                }
              >
                <option value="ACTIVE">按活跃人数</option>
                <option value="CREATED_AT">按创建时间</option>
              </select>

              <select
                value={worldSortOrder}
                onChange={(event) =>
                  setWorldSortOrder(event.target.value as "DESC" | "ASC")
                }
              >
                <option value="DESC">降序</option>
                <option value="ASC">升序</option>
              </select>

              <button
                type="button"
                className="lobby-toolbar__create"
                onClick={() => {
                  setCreatedInviteCode(null);
                  setIsCreateModalOpen(true);
                }}
              >
                创建世界
              </button>
            </section>
          </div>

          <section className="lobby-world-board">
            {loading ? <p className="text-gray-500">加载中...</p> : null}
            {!loading && filteredWorldCards.length === 0 ? (
              <p className="text-gray-500">没有符合条件的世界</p>
            ) : null}

            {filteredWorldCards.map((world) => {
              const joined = joinedWorldIdSet.has(world.id);
              const isFavorite = favoriteWorldIds.includes(world.id);
              const canDelete = world.owner.id === user?.id || isPlatformAdmin || world.myRole === "GM";
              const isDeletePending = deleteConfirmWorldId === world.id;
              const coverImage = world.coverImageDataUrl || defaultWorldCover;
              const visibilityLabel =
                world.visibility === "PASSWORD"
                  ? "邀请"
                  : world.visibility === "FRIENDS"
                    ? "仅好友"
                    : world.visibility === "PRIVATE"
                      ? "私密"
                      : "公开";

              return (
                <article className="lobby-world-card2" key={world.id}>
                  <div
                    className="lobby-world-card2__cover"
                    style={{ backgroundImage: `url(${coverImage})` }}
                  />
                  <div className="lobby-world-card2__content">
                    <div className="lobby-world-card2__info">
                      <div className="lobby-world-card2__head">
                        <h3>{world.name}</h3>
                      </div>
                      <p className="lobby-world-card2__desc">
                        {world.description || "暂无描述"}
                      </p>
                      <div className="lobby-world-card2__meta">
                        <span>总成员 {world._count.members}</span>
                        <span>活跃 {world.activeMemberCount ?? 0}</span>
                        <span>
                          创建者{" "}
                          {world.owner.displayName || world.owner.username}
                        </span>
                        {world.owner.id === user?.id &&
                        world.visibility === "PASSWORD" &&
                        world.inviteCode ? (
                          <span>邀请码 {world.inviteCode}</span>
                        ) : null}
                      </div>
                      <div className="lobby-world-card2__meta-bottom">
                        <span className="lobby-badge">{visibilityLabel}</span>
                        <span>{new Date(world.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="lobby-world-card2__actions-col">
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteWorld(world.id)}
                      >
                        {isFavorite ? "已收藏" : "收藏"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          joined
                            ? navigate(`/world/${world.id}`)
                            : void onJoin(world)
                        }
                      >
                        {joined ? "进入" : "加入"}
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onPrepareDeleteWorld(world.id)}
                        >
                          删除世界
                        </button>
                      ) : null}
                    </div>

                    {isDeletePending ? (
                      <div className="lobby-world-card2__danger-zone">
                        <p>危险操作：删除后不可恢复。</p>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmWorldId(null);
                              setDeleteCountdown(0);
                            }}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={deleteCountdown > 0 || deletingWorldId === world.id}
                            onClick={() => {
                              void onDeleteWorld(world.id);
                            }}
                          >
                            {deletingWorldId === world.id
                              ? "删除中..."
                              : deleteCountdown > 0
                                ? `确认删除（${deleteCountdown}s）`
                                : "确认删除"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        </main>

        {/* 右侧：大厅复合容器（论坛 + 工具箱） */}
        <aside className="lobby-sidebar-right">
          <div className="lobby-sidebar-right__tabs">
            <button
              type="button"
              className={rightPanelTab === "FORUM" ? "is-active" : ""}
              onClick={() => setRightPanelTab("FORUM")}
            >
              星语论坛
            </button>
            <button
              type="button"
              className={rightPanelTab === "TOOLBOX" ? "is-active" : ""}
              onClick={() => setRightPanelTab("TOOLBOX")}
            >
              工具箱
            </button>
          </div>

          <div className="lobby-sidebar-right__body">
            {rightPanelTab === "FORUM" ? (
              <section className="lobby-sidebar-right__forum">
                <h3>星语论坛</h3>
                <p>论坛仅在大厅开放，用于会前交流与公告发布。</p>
                <p className="lobby-sidebar-right__hint">当前阶段先保留占位，后续再接入论坛功能。</p>
              </section>
            ) : null}

            {rightPanelTab === "TOOLBOX" ? (
              <section className="lobby-toolbox-grid">
                {LOBBY_TOOL_ITEMS.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    className="lobby-toolbox-card"
                    onClick={() => {
                      if (tool.key === "CHARACTER_PRESET") {
                        openCharacterPresetBootstrap();
                        return;
                      }
                      setActiveLobbyToolKey(tool.key);
                    }}
                  >
                    <h3>{tool.title}</h3>
                    <p>{tool.summary}</p>
                    <span>点击展开工具说明</span>
                  </button>
                ))}
              </section>
            ) : null}
          </div>
        </aside>
      </div>

      {characterBootstrapStep !== "NONE" ? (
        <div className="lobby-tool-modal-bg" onClick={closeCharacterBootstrap}>
          <section
            className="lobby-tool-modal__panel lobby-character-bootstrap-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="lobby-tool-modal__header">
              <h3>
                {characterBootstrapStep === "ENTRY"
                  ? "角色卡预创建"
                  : characterBootstrapStep === "TUTORIAL_PROMPT"
                    ? "新手车卡教程"
                    : "快速创建角色"}
              </h3>
              <button type="button" onClick={closeCharacterBootstrap}>关闭</button>
            </header>

            {characterBootstrapStep === "ENTRY" ? (
              <>
                <p className="lobby-tool-modal__summary">请选择角色卡预创建方式。</p>
                <div className="lobby-character-bootstrap-modal__entry-actions">
                  <button type="button" onClick={() => onSelectCharacterBootstrapAction("TUTORIAL")}>新手教程</button>
                  <button type="button" onClick={() => onSelectCharacterBootstrapAction("QUICK")}>快速车卡</button>
                  <button type="button" onClick={() => onSelectCharacterBootstrapAction("EXISTING")}>
                    已有角色
                  </button>
                </div>

                {isExistingCharacterListExpanded ? (
                  <div className="lobby-character-bootstrap-modal__existing-list" role="list" aria-label="已有角色列表">
                    {characterDrafts.length > 0 ? (
                      characterDrafts.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          role="listitem"
                          className="lobby-character-bootstrap-modal__existing-item"
                          onClick={() => openCharacterDraft(draft)}
                          title={`打开角色 ${draft.name}`}
                        >
                          <span>{draft.name}</span>
                          <small>{new Date(draft.createdAt).toLocaleDateString("zh-CN")}</small>
                        </button>
                      ))
                    ) : (
                      <p className="lobby-character-bootstrap-modal__existing-empty">你还没有创建过角色，先使用快速车卡创建一个吧。</p>
                    )}
                  </div>
                ) : null}
              </>
            ) : characterBootstrapStep === "TUTORIAL_PROMPT" ? (
              <>
                <p className="lobby-tool-modal__summary">初次创建角色卡时，是否需要新手车卡教程引导？</p>
                <p className="lobby-tool-modal__hint">教程功能将于后续版本接入，当前选择后会继续进入快速创建。</p>
                <div className="lobby-character-bootstrap-modal__tutorial-actions">
                  <button type="button" onClick={() => onSelectTutorialChoice(true)}>是，需要教程</button>
                  <button type="button" onClick={() => onSelectTutorialChoice(false)}>否，直接创建</button>
                </div>
              </>
            ) : (
              <form
                className="lobby-character-bootstrap-modal__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onConfirmCharacterBootstrap();
                }}
              >
                <label className="lobby-character-bootstrap-modal__field" htmlFor="character-draft-name">
                  <span>角色名字</span>
                  <input
                    id="character-draft-name"
                    value={characterDraftName}
                    onChange={(event) => setCharacterDraftName(event.target.value)}
                    placeholder="请输入角色名字"
                    maxLength={40}
                    autoFocus
                  />
                </label>

                <label className="lobby-character-bootstrap-modal__field" htmlFor="character-draft-level">
                  <span>角色等级（预留）</span>
                  <input
                    id="character-draft-level"
                    value={characterDraftLevel}
                    onChange={(event) => setCharacterDraftLevel(event.target.value)}
                    disabled
                    placeholder="暂未开放"
                  />
                </label>

                <p className="lobby-tool-modal__hint">当前阶段仅启用名字字段，后续会逐步补充等级与进一步引导。</p>

                <div className="lobby-character-bootstrap-modal__actions">
                  <button type="button" onClick={closeCharacterBootstrap}>取消</button>
                  <button type="submit" disabled={!characterDraftName.trim()}>进入角色卡</button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}

      {activeLobbyTool?.key === "CHARACTER_PRESET" ? (
        <div className="character-sheet-dock-layer">
          <CharacterSheetWorkbench
            characterId={activeCharacterDraftId ?? undefined}
            characterName={activeCharacterName}
            characterTokenDataUrl={activeCharacterTokenDataUrl}
            onClose={() => setActiveLobbyToolKey(null)}
            onTokenConfig={() => {
              // token 配置逻辑将在后续战斗自动化阶段接入。
            }}
            onTokenUpload={onCharacterTokenUpload}
            onExport={() => {
              // 角色卡导出逻辑将在后续数据结构稳定后接入。
            }}
            onImport={() => {
              // 角色卡导入逻辑将在后续数据结构稳定后接入。
            }}
          />
        </div>
      ) : null}

      {activeLobbyTool && activeLobbyTool.key !== "CHARACTER_PRESET" ? (
        <div className="lobby-tool-modal-bg" onClick={() => setActiveLobbyToolKey(null)}>
          <section
            className={[
              "lobby-tool-modal__panel",
              activeLobbyTool.key === "TALENT_TREE" || activeLobbyTool.key === "RULEBOOK" ? "is-talent-viewer" : "",
              activeLobbyTool.key === "RULEBOOK" ? "is-rulebook-viewer" : ""
            ].filter(Boolean).join(" ")}
            onClick={(event) => event.stopPropagation()}
          >
            <header
              className={`lobby-tool-modal__header ${activeLobbyTool.key === "TALENT_TREE" || activeLobbyTool.key === "RULEBOOK" ? "is-compact" : ""}`}
            >
              {activeLobbyTool.key === "TALENT_TREE" || activeLobbyTool.key === "RULEBOOK" ? null : <h3>{activeLobbyTool.title}</h3>}
              {activeLobbyTool.key !== "TALENT_TREE" ? (
                <button type="button" onClick={() => setActiveLobbyToolKey(null)}>
                  关闭
                </button>
              ) : null}
            </header>
            {activeLobbyTool.key === "TALENT_TREE" ? (
              <section className="lobby-talent-viewer">
                <div className="lobby-talent-viewer__topbar">
                  <button
                    type="button"
                    className="lobby-talent-viewer__drawer-trigger"
                    onClick={() => setShowTalentDirectoryDrawer(true)}
                  >
                    打开目录
                  </button>
                </div>

                <div className="lobby-talent-viewer__layout">
                  <aside className={`lobby-talent-viewer__directory ${showTalentDirectoryDrawer ? "is-open" : ""}`}>
                    <header className="lobby-talent-viewer__directory-head">
                      <p>天赋目录</p>
                      <button type="button" onClick={() => setShowTalentDirectoryDrawer(false)}>收起</button>
                    </header>

                    <div className="lobby-talent-viewer__directory-tree">
                      {talentTemplateLoading ? <p>目录加载中...</p> : null}
                      {talentTemplateError ? <p>{talentTemplateError}</p> : null}
                      {!talentTemplateLoading && !talentTemplateError && flattenedTalentTemplates.length === 0 ? (
                        <p>暂无可查看模板</p>
                      ) : null}

                      {talentDirectoryTree.map((treeGroup) => {
                        const isTreeExpanded = expandedTalentTreeTypes.includes(treeGroup.treeType);
                        return (
                          <div key={treeGroup.treeType} className="lobby-talent-viewer__tree-group">
                            <button
                              type="button"
                              className={`lobby-talent-viewer__tree-level1 ${isTreeExpanded ? "is-active" : ""}`}
                              onClick={() => {
                                setExpandedTalentTreeTypes((prev) => (
                                  prev.includes(treeGroup.treeType)
                                    ? prev.filter((item) => item !== treeGroup.treeType)
                                    : [...prev, treeGroup.treeType]
                                ));
                              }}
                            >
                              <span>{isTreeExpanded ? "▾" : "▸"}</span>
                              <strong>{treeGroup.label}</strong>
                            </button>

                            {isTreeExpanded ? (
                              <div className="lobby-talent-viewer__tree-level2-wrap">
                                {treeGroup.categories.map((categoryGroup) => {
                                  const isCategoryExpanded = expandedTalentCategoryKeys.includes(categoryGroup.key);
                                  return (
                                    <div key={categoryGroup.key} className="lobby-talent-viewer__category-group">
                                      <button
                                        type="button"
                                        className={`lobby-talent-viewer__tree-level2 ${isCategoryExpanded ? "is-active" : ""}`}
                                        onClick={() => {
                                          setExpandedTalentCategoryKeys((prev) => (
                                            prev.includes(categoryGroup.key)
                                              ? prev.filter((item) => item !== categoryGroup.key)
                                              : [...prev, categoryGroup.key]
                                          ));
                                        }}
                                      >
                                        <span>{isCategoryExpanded ? "▾" : "▸"}</span>
                                        <strong>{categoryGroup.category}</strong>
                                      </button>

                                      {isCategoryExpanded ? (
                                        <div className="lobby-talent-viewer__tree-level3-wrap">
                                          {categoryGroup.templates.map((template) => (
                                            <button
                                              key={template.id}
                                              type="button"
                                              className={`lobby-talent-viewer__tree-level3 ${selectedTalentTemplate?.id === template.id ? "is-active" : ""}`}
                                              onClick={() => {
                                                setSelectedTalentTemplateId(template.id);
                                                setShowTalentDirectoryDrawer(false);
                                              }}
                                            >
                                              <strong>{template.name}</strong>
                                              <span>{categoryGroup.category}</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <main className="lobby-talent-viewer__main">
                    {!selectedTalentTemplate ? (
                      <div className="lobby-talent-viewer__empty">暂无可查看模板</div>
                    ) : (
                      <>
                        <header className="lobby-talent-viewer__main-head">
                          <h4>{selectedTalentTemplate.name}</h4>
                          <div className="lobby-talent-viewer__main-actions">
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
                            <button
                              type="button"
                              className="lobby-talent-viewer__close-inline"
                              onClick={() => setActiveLobbyToolKey(null)}
                            >
                              关闭
                            </button>
                          </div>
                        </header>
                        <p className="lobby-talent-viewer__description">
                          {selectedTalentTemplate.description || "暂无描述"}
                        </p>

                        <section className="lobby-talent-viewer__canvas-wrap">
                          <section
                            className={`lobby-talent-viewer__workspace ${
                              talentPreviewMode === "DETAIL" ? "is-detail-mode" : "is-thumbnail-mode"
                            }`}
                          >
                            <section className="lobby-talent-viewer__canvas-viewport">
                              <div
                                className="lobby-talent-viewer__canvas"
                                style={{ width: selectedTalentProjection.width, height: selectedTalentProjection.height }}
                              >
                                <svg
                                  className="lobby-talent-viewer__edges"
                                  width={selectedTalentProjection.width}
                                  height={selectedTalentProjection.height}
                                  viewBox={`0 0 ${selectedTalentProjection.width} ${selectedTalentProjection.height}`}
                                >
                                  {selectedTalentProjection.edges.map((edge) => {
                                    const sourceNode = selectedTalentProjection.nodes.find((node) => node.id === edge.sourceNodeId);
                                    const targetNode = selectedTalentProjection.nodes.find((node) => node.id === edge.targetNodeId);
                                    if (!sourceNode || !targetNode) {
                                      return null;
                                    }

                                    const sourceToLower = sourceNode.y <= targetNode.y;
                                    const x1 = sourceNode.x + sourceNode.width / 2;
                                    const y1 = sourceToLower ? sourceNode.y + sourceNode.height : sourceNode.y;
                                    const x2 = targetNode.x + targetNode.width / 2;
                                    const y2 = sourceToLower ? targetNode.y : targetNode.y + targetNode.height;

                                    return (
                                      <line
                                        key={edge.id}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke="var(--talent-connection, #5a89cc)"
                                        strokeWidth={2.4}
                                        strokeLinecap="round"
                                      />
                                    );
                                  })}
                                </svg>

                                {selectedTalentProjection.nodes.map((node) => (
                                  <button
                                    key={node.id}
                                    type="button"
                                    className={`lobby-talent-viewer__canvas-node ${selectedTalentNode?.id === node.id ? "is-active" : ""}`}
                                    style={{
                                      left: node.x,
                                      top: node.y,
                                      width: node.width,
                                      height: node.height
                                    }}
                                    onClick={() => setSelectedTalentNodeId(node.id)}
                                  >
                                    <p className="lobby-talent-viewer__canvas-line1">{node.title}</p>
                                    <p>消耗：{node.cost}</p>
                                    <p>前置：{node.requirement || "无"}</p>
                                    <p>词缀：{node.talentAffix || "无"}</p>
                                    {talentPreviewMode === "THUMBNAIL" ? (
                                      <p className="lobby-talent-viewer__summary-line">概述：{node.summary || "暂无概述"}</p>
                                    ) : (
                                      <div className="lobby-talent-viewer__canvas-desc">
                                        {renderTalentRichParagraphs(node.description)}
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </section>

                            {talentPreviewMode === "THUMBNAIL" ? (
                              <section className="lobby-talent-viewer__node-detail">
                                {!selectedTalentNode ? (
                                  <p>请选择节点查看详情</p>
                                ) : (
                                  <>
                                    <h5>{selectedTalentNode.title}</h5>
                                    <p>消耗：{selectedTalentNode.cost}</p>
                                    <p>前置：{selectedTalentNode.requirement || "无"}</p>
                                    <p>词缀：{selectedTalentNode.talentAffix || "无"}</p>
                                    <div className="lobby-talent-viewer__node-detail-desc">
                                      {renderTalentRichParagraphs(selectedTalentNode.description)}
                                    </div>
                                  </>
                                )}
                              </section>
                            ) : null}
                          </section>
                        </section>
                      </>
                    )}
                  </main>
                </div>

              </section>
            ) : activeLobbyTool.key === "RULEBOOK" ? (
              <section className="lobby-rulebook-viewer">
                <div className="lobby-talent-viewer__topbar">
                  <button
                    type="button"
                    className="lobby-talent-viewer__drawer-trigger"
                    onClick={() => setShowRulebookDirectoryDrawer(true)}
                  >
                    打开目录
                  </button>
                </div>

                <div className="lobby-talent-viewer__layout lobby-rulebook-viewer__layout">
                  <aside className={`lobby-talent-viewer__directory ${showRulebookDirectoryDrawer ? "is-open" : ""}`}>
                    <header className="lobby-talent-viewer__directory-head">
                      <p>规则目录</p>
                      <button type="button" onClick={() => setShowRulebookDirectoryDrawer(false)}>收起</button>
                    </header>

                    <div className="lobby-talent-viewer__directory-tree">
                      {rulebookLoading ? <p>目录加载中...</p> : null}
                      {rulebookError ? <p>{rulebookError}</p> : null}
                      {!rulebookLoading && !rulebookError && visibleRulebookEntries.length === 0 ? (
                        <p>暂无可查看条目</p>
                      ) : null}

                      {rulebookDirectoryTree.map((level1) => {
                        const level1Expanded = expandedRulebookDirectoryKeys.includes(level1.key);
                        return (
                          <div key={level1.key} className="lobby-talent-viewer__tree-group">
                            <button
                              type="button"
                              className={`lobby-talent-viewer__tree-level1 ${level1Expanded ? "is-active" : ""}`}
                              onClick={() => {
                                setExpandedRulebookDirectoryKeys((prev) => (
                                  prev.includes(level1.key)
                                    ? prev.filter((item) => item !== level1.key)
                                    : [...prev, level1.key]
                                ));
                              }}
                            >
                              <span>{level1Expanded ? "▾" : "▸"}</span>
                              <strong>{level1.label}</strong>
                            </button>

                            {level1Expanded ? (
                              <div className="lobby-talent-viewer__tree-level2-wrap">
                                {level1.children.map((level2) => {
                                  const level2Expanded = expandedRulebookDirectoryKeys.includes(level2.key);
                                  return (
                                    <div key={level2.key} className="lobby-talent-viewer__category-group">
                                      <button
                                        type="button"
                                        className={`lobby-talent-viewer__tree-level2 ${level2Expanded ? "is-active" : ""}`}
                                        onClick={() => {
                                          setExpandedRulebookDirectoryKeys((prev) => (
                                            prev.includes(level2.key)
                                              ? prev.filter((item) => item !== level2.key)
                                              : [...prev, level2.key]
                                          ));
                                        }}
                                      >
                                        <span>{level2Expanded ? "▾" : "▸"}</span>
                                        <strong>{level2.label}</strong>
                                      </button>

                                      {level2Expanded ? (
                                        <div className="lobby-talent-viewer__tree-level3-wrap">
                                          {level2.children.map((level3) => {
                                            const level3Expanded = expandedRulebookDirectoryKeys.includes(level3.key);
                                            return (
                                              <div key={level3.key} className="lobby-talent-viewer__category-group">
                                                <button
                                                  type="button"
                                                  className={`lobby-talent-viewer__tree-level2 ${level3Expanded ? "is-active" : ""}`}
                                                  onClick={() => {
                                                    setExpandedRulebookDirectoryKeys((prev) => (
                                                      prev.includes(level3.key)
                                                        ? prev.filter((item) => item !== level3.key)
                                                        : [...prev, level3.key]
                                                    ));
                                                  }}
                                                >
                                                  <span>{level3Expanded ? "▾" : "▸"}</span>
                                                  <strong>{level3.label}</strong>
                                                </button>

                                                {level3Expanded ? (
                                                  <div className="lobby-talent-viewer__tree-level3-wrap">
                                                    {level3.entries.map((entry) => (
                                                      <button
                                                        key={entry.id}
                                                        type="button"
                                                        className={`lobby-talent-viewer__tree-level3 ${selectedRulebookEntry?.id === entry.id ? "is-active" : ""}`}
                                                        onClick={() => {
                                                          setSelectedRulebookEntryId(entry.id);
                                                          setShowRulebookDirectoryDrawer(false);
                                                        }}
                                                      >
                                                        <strong>{entry.title}</strong>
                                                        <span>v{entry.version} · {entry.status}</span>
                                                      </button>
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          })}

                                          {level2.entries.map((entry) => (
                                            <button
                                              key={entry.id}
                                              type="button"
                                              className={`lobby-talent-viewer__tree-level3 ${selectedRulebookEntry?.id === entry.id ? "is-active" : ""}`}
                                              onClick={() => {
                                                setSelectedRulebookEntryId(entry.id);
                                                setShowRulebookDirectoryDrawer(false);
                                              }}
                                            >
                                              <strong>{entry.title}</strong>
                                              <span>v{entry.version} · {entry.status}</span>
                                            </button>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}

                                {level1.entries.map((entry) => (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    className={`lobby-talent-viewer__tree-level3 ${selectedRulebookEntry?.id === entry.id ? "is-active" : ""}`}
                                    onClick={() => {
                                      setSelectedRulebookEntryId(entry.id);
                                      setShowRulebookDirectoryDrawer(false);
                                    }}
                                  >
                                    <strong>{entry.title}</strong>
                                    <span>v{entry.version} · {entry.status}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <main className="lobby-rulebook-viewer__main">
                    {!selectedRulebookEntry ? (
                      <div className="lobby-talent-viewer__empty">暂无可查看规则条目</div>
                    ) : (
                      <>
                        <header className="lobby-talent-viewer__main-head">
                          <h4>{selectedRulebookEntry.title}</h4>
                          <span>{selectedRulebookEntry.directoryPath.join(" / ") || "未分类"}</span>
                        </header>
                        <p className="lobby-talent-viewer__description">
                          {selectedRulebookEntry.summary || "暂无摘要"}
                        </p>
                        <section className="lobby-rulebook-viewer__content" dangerouslySetInnerHTML={{ __html: selectedRulebookHtml }} />
                      </>
                    )}
                  </main>
                </div>

              </section>
            ) : (
              <>
                <p className="lobby-tool-modal__summary">{activeLobbyTool.summary}</p>
                <div className="lobby-tool-modal__block">
                  <p className="lobby-tool-modal__label">大厅用途</p>
                  <p>{activeLobbyTool.lobbyUsage}</p>
                </div>
                <div className="lobby-tool-modal__block">
                  <p className="lobby-tool-modal__label">世界内用途</p>
                  <p>{activeLobbyTool.worldUsage}</p>
                </div>
                <p className="lobby-tool-modal__hint">
                  当前为统一骨架弹窗，后续将按同一逻辑升级为世界内可复用的完整工具页面/面板。
                </p>
              </>
            )}
          </section>
        </div>
      ) : null}

      {/* 社交中心模态框 */}
      {isSocialOpen ? (
        <section
          className="lobby-social-modal lobby-social-modal--dropdown"
          ref={socialDropdownRef}
        >
            <div className="lobby-social__header">
              <p className="lobby-social__title">社交中心</p>
              <div className="lobby-social__nickname-row">
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="显示昵称"
                  maxLength={40}
                />
                <button
                  type="button"
                  onClick={() => void onSaveNickname()}
                  disabled={savingNickname}
                >
                  {savingNickname ? "保存中..." : "保存"}
                </button>
              </div>
            </div>

            <div className="lobby-social__tabs">
              <button
                type="button"
                className={socialTab === "friends" ? "is-active" : ""}
                onClick={() => setSocialTab("friends")}
              >
                好友
              </button>
              <button
                type="button"
                className={socialTab === "requests" ? "is-active" : ""}
                onClick={() => setSocialTab("requests")}
              >
                好友申请
              </button>
            </div>

            {isPlatformAdmin ? (
              <div className="lobby-social__admin-tools">
                <p className="lobby-social__section-title">管理入口</p>
                <div className="lobby-social__admin-actions">
                  {ADMIN_EDITOR_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setIsSocialOpen(false);
                        navigate(item.path);
                      }}
                    >
                      进入{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="lobby-social__body">
              {socialLoading ? (
                <p className="text-sm text-gray-500">社交数据加载中...</p>
              ) : null}
              {!socialLoading && socialTab === "friends" ? (
                <div className="space-y-3">
                  <div>
                    <p className="lobby-social__section-title">在线好友</p>
                    {onlineFriends.length === 0 ? (
                      <p className="text-sm text-gray-500">暂无在线好友</p>
                    ) : null}
                    {onlineFriends.map((item) => (
                      <div
                        className="lobby-social__friend-item"
                        key={`online-${item.id}`}
                      >
                        <span>
                          {item.user.displayName || item.user.username}
                        </span>
                        <span className="lobby-social__friend-status is-online">
                          在线
                        </span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="lobby-social__section-title">离线好友</p>
                    {offlineFriends.length === 0 ? (
                      <p className="text-sm text-gray-500">暂无离线好友</p>
                    ) : null}
                    {offlineFriends.map((item) => (
                      <div
                        className="lobby-social__friend-item"
                        key={`offline-${item.id}`}
                      >
                        <span>
                          {item.user.displayName || item.user.username}
                        </span>
                        <span className="lobby-social__friend-status">
                          离线
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!socialLoading && socialTab === "requests" ? (
                <div className="space-y-2">
                  {incomingRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      暂无待处理好友申请
                    </p>
                  ) : null}
                  {incomingRequests.map((item) => (
                    <div className="lobby-social__request-item" key={item.id}>
                      <div>
                        <p className="lobby-social__request-name">
                          {item.fromUser.displayName || item.fromUser.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          账号：{item.fromUser.username}
                        </p>
                      </div>
                      <div className="lobby-social__request-actions">
                        <button
                          type="button"
                          className="lobby-social__accept"
                          onClick={() => {
                            void onHandleFriendRequest(
                              item.id,
                              "accept"
                            );
                          }}
                          disabled={friendActionId === item.id}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="lobby-social__reject"
                          onClick={() => {
                            void onHandleFriendRequest(
                              item.id,
                              "reject"
                            );
                          }}
                          disabled={friendActionId === item.id}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {socialError ? (
              <div className="lobby-social__error">{socialError}</div>
            ) : null}

            <div className="lobby-social__footer">
              <button
                type="button"
                onClick={() => {
                  setShowAddFriendModal(true);
                  setSocialError(null);
                }}
              >
                添加好友
              </button>
              <button
                type="button"
                className="lobby-social__logout"
                onClick={onLogout}
              >
                退出登录
              </button>
            </div>
          </section>
      ) : null}

      {/* 添加好友模态框 */}
      {showAddFriendModal ? (
        <div className="lobby-social-modal-bg" onClick={() => setShowAddFriendModal(false)}>
          <div
            className="lobby-social-modal-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>添加好友</h3>
            <p className="text-sm text-gray-600">
              输入对方昵称或账号名，发送好友申请。
            </p>
            <form className="space-y-3" onSubmit={onSendFriendRequest}>
              <input
                className="w-full rounded border px-3 py-2"
                value={friendQuery}
                onChange={(e) => setFriendQuery(e.target.value)}
                placeholder="昵称或账号名"
                maxLength={40}
              />
              <div className="lobby-social-modal__actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFriendModal(false);
                    setFriendQuery("");
                  }}
                >
                  取消
                </button>
                <button type="submit" disabled={sendingFriendRequest}>
                  {sendingFriendRequest ? "发送中..." : "发送申请"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* 创建世界模态框 */}
      {isCreateModalOpen ? (
        <div className="lobby-social-modal-bg" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="lobby-world-modal__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>创建世界</h3>
            <p className="text-sm text-gray-600">
              宣传图建议使用横图，推荐分辨率 1920*1080（16:9）。
            </p>
            <form className="space-y-3" onSubmit={onCreate}>
              <input
                className="w-full rounded border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="世界名称"
                required
              />
              <textarea
                className="w-full rounded border px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="世界描述（可选）"
                rows={3}
              />
              <select
                className="w-full rounded border px-3 py-2"
                value={visibility}
                onChange={(e) =>
                  setVisibility(
                    e.target.value as
                      | "PUBLIC"
                      | "PASSWORD"
                      | "FRIENDS"
                      | "PRIVATE"
                  )
                }
              >
                <option value="PUBLIC">公开</option>
                <option value="PASSWORD">邀请（需邀请码）</option>
                <option value="PRIVATE">私密（仅自己可见）</option>
                <option value="FRIENDS">仅好友可见</option>
              </select>

              <label className="lobby-world-modal__upload">
                宣传图片
                <input
                  type="file"
                  accept="image/*"
                  onChange={onCoverFileChange}
                />
              </label>

              {coverPreview ? (
                <div
                  className="lobby-world-modal__preview"
                  style={{ backgroundImage: `url(${coverPreview})` }}
                />
              ) : null}

              <div className="lobby-world-modal__actions">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setCoverPreview(null);
                  }}
                >
                  取消
                </button>
                <button type="submit" disabled={creating}>
                  {creating ? "创建中..." : "创建"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

