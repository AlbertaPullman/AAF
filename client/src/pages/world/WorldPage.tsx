import { useEffect, useMemo, useRef, useState, type FormEvent, type ComponentType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageSquare, Swords, Map as MapIcon, User, Package, Settings, Sparkles, Dice5, Music, Layers } from "lucide-react";
import "../../world/styles/world-shell.css";
import { http } from "../../lib/http";
import { connectSocket, disconnectSocket, socket, SOCKET_EVENTS } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";
import { AbilityExecutionPanel } from "../../world/components/AbilityExecutionPanel";
import { BattleSequenceBar, type InitiativeEntry } from "../../world/components/BattleSequenceBar";
import { CharacterPanel } from "../../world/components/CharacterPanel";
import { ContextMenu, useContextMenu } from "../../world/components/ContextMenu";
import { DrawPanel } from "../../world/components/DrawPanel";
import { FateClockWidget } from "../../world/components/FateClockWidget";
import { FloatingToolWindow, type FloatingToolWindowPlacement } from "../../world/components/FloatingToolWindow";
import { HoverInsightProvider, type HoverInsightEntry } from "../../world/components/HoverInsightCards";
import {
  HotkeySettingsPanel,
  formatKeyBinding,
  loadWorldHotkeyBindings,
  saveWorldHotkeyBindings,
} from "../../world/components/HotkeySettingsPanel";
import { HUDPanel } from "../../world/components/HUDPanel";
import { MeasurePanel } from "../../world/components/MeasurePanel";
import { SceneCombatPanel } from "../../world/components/SceneCombatPanel";
import { ScenePanel } from "../../world/components/ScenePanel";
import { SceneVisualPanel } from "../../world/components/SceneVisualPanel";
import { StoryEventPanel } from "../../world/components/StoryEventPanel";
import { TokenPanel } from "../../world/components/TokenPanel";
import { WorldCanvas } from "../../world/components/WorldCanvas";
import { CollectionPackPanel } from "../../world/components/system/CollectionPackPanel";
import { EntityManager } from "../../world/components/system/EntityManager";
import { ThemePickerOverlay } from "../../world/components/system/ThemePickerOverlay";
import { useThemeStore } from "../../store/themeStore";
import { isKnownPack as isKnownThemePack, type ThemePackId } from "../../lib/theme";
import { mapWorldRuntimeErrorMessage } from "../../world/i18n/messages";
import { useKeyboardShortcuts } from "../../world/hooks/useKeyboardShortcuts";
import { useWorldEntityStore, type EntityRecord, type EntityType } from "../../world/stores/worldEntityStore";
import {
  type ContextMenuArea,
  type ContextMenuItem,
  type FateClockDefinition,
  type HUDConfig,
  type HUDSlot,
} from "../../../../shared/types/world-entities";
import { PERMISSIONS, hasPermission, isTabVisible, type WorldRoleType } from "../../../../shared/types/permissions";
import {
  SystemPanelContent,
  getDefaultToolbarButtons,
  getDefaultTreeData,
  type TreeNode,
  type SystemTabKey as SystemPanelTabKey,
} from "../../world/components/SystemPanelContent";
import type {
  TokenItem,
  CharacterItem,
  SceneItem,
  ChatMessage,
  WorldDetail,
  WorldRuntimeState,
  RuntimeModuleState,
  WorldChatChannel,
  ChannelUnreadMap
} from "./types";

type SceneLightSourceState = {
  id: string;
  targetType: "actor" | "object" | "point";
  targetId?: string | null;
  x?: number;
  y?: number;
  brightRadiusFeet: number;
  dimRadiusFeet: number;
  colorHex: string;
  followTarget: boolean;
  durationMode: "rounds" | "battle-end" | "concentration" | "manual";
  durationRounds?: number;
};

type SceneFogRevealedArea = {
  id: string;
  shape: "circle" | "rect" | "polygon";
  points?: Array<{ x: number; y: number }>;
  radius?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type SceneFogState = {
  enabled: boolean;
  mode: "full" | "hidden";
  colorHex: string;
  revealedAreas: SceneFogRevealedArea[];
};

type SceneVisualState = {
  sceneId: string;
  preset: "custom" | "battle" | "rest" | "dungeon" | "narrative";
  backgroundImageUrl: string | null;
  grid: {
    enabled: boolean;
    unitFeet: number;
    type: "square" | "hex";
    sizePx: number;
    colorHex: string;
    opacity: number;
    snap: boolean;
  };
  lights: SceneLightSourceState[];
  fog: SceneFogState;
  lighting: {
    globalLight: boolean;
    darkness: number;
    gmSeeInvisible: boolean;
  };
  elevation: {
    enabled: boolean;
    baseLevel: number;
  };
  updatedAt: string;
};

type SceneVisualPatchInput = {
  preset?: SceneVisualState["preset"];
  backgroundImageUrl?: string | null;
  grid?: Partial<SceneVisualState["grid"]>;
  lights?: SceneLightSourceState[];
  fog?: Partial<SceneFogState>;
  lighting?: Partial<SceneVisualState["lighting"]>;
  elevation?: Partial<SceneVisualState["elevation"]>;
};

type CombatParticipantState = {
  tokenId: string;
  name: string;
  initiative: number;
  rank: number;
};

type SceneCombatState = {
  sceneId: string;
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason: string | null;
  updatedAt: string;
};

type SceneCombatInput = {
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason?: string | null;
};

type StoryOptionCheckMode = "SINGLE" | "PER_PLAYER" | "UNLIMITED";

type StoryEventOption = {
  id: string;
  label: string;
  check?: {
    skillKey: string;
    dc: number;
    checkMode: StoryOptionCheckMode;
  };
  closed: boolean;
  attempts: Array<{
    id: string;
    userId: string;
    finalTotal: number;
    success: boolean;
    createdAt: string;
  }>;
};

type StoryEventItem = {
  id: string;
  title: string;
  description: string;
  status: "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED";
  options: StoryEventOption[];
  narrativeRequests: Array<{
    id: string;
    userId: string;
    cost: number;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    gmNote?: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

type StoryEventCardItem = {
  id: string;
  content: string;
  createdAt: string;
};

type StoryEventSearchResult = {
  keyword: string;
  filters: {
    sceneId?: string;
    eventStatus: "ALL" | "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED";
    channelKey: "ALL" | "OOC" | "IC" | "SYSTEM";
    hours?: number;
  };
  events: StoryEventItem[];
  messages: Array<{
    id: string;
    channelKey?: string;
    content: string;
    createdAt: string;
    linkedEventId?: string;
    matchedBy: Array<"CHAT_CONTENT" | "EVENT_LINK">;
    fromUser: {
      id: string;
      username: string;
      displayName: string | null;
    };
  }>;
};

type SystemTabKey = "chat" | "battle" | "scene" | "char" | "ability" | "item" | "random" | "music" | "collect" | "system";

type OverlayState =
  | { id: string; kind: "entity"; entityType: EntityType; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "players"; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "ability"; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "story"; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "hotkeys"; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "theme"; title: string; placement: FloatingToolWindowPlacement; compact?: boolean }
  | { id: string; kind: "character"; title: string; characterId?: string; mode: "view" | "create"; placement: FloatingToolWindowPlacement; compact?: boolean };

type OverlayDraft =
  | { kind: "entity"; entityType: EntityType; title: string; compact?: boolean }
  | { kind: "players"; title: string; compact?: boolean }
  | { kind: "ability"; title: string; compact?: boolean }
  | { kind: "story"; title: string; compact?: boolean }
  | { kind: "hotkeys"; title: string; compact?: boolean }
  | { kind: "theme"; title: string; compact?: boolean }
  | { kind: "character"; title: string; characterId?: string; mode: "view" | "create"; compact?: boolean };

type WorldMemberManageRole = "PLAYER" | "ASSISTANT" | "OBSERVER" | "GM";

type WorldMemberManageMember = {
  userId: string;
  username: string;
  accountDisplayName: string | null;
  worldDisplayName: string | null;
  role: WorldMemberManageRole;
  joinedAt: string;
  boundCharacterId: string | null;
  boundCharacterName: string | null;
};

type WorldMemberManageCharacter = {
  id: string;
  name: string;
  type: "PC" | "NPC";
  userId: string | null;
};

type WorldMemberManageData = {
  members: WorldMemberManageMember[];
  characters: WorldMemberManageCharacter[];
  roleOptions: WorldMemberManageRole[];
};

type WorldRosterMember = {
  userId: string;
  username: string;
  accountDisplayName: string | null;
  worldDisplayName: string | null;
  role: WorldMemberManageRole;
  boundCharacterId: string | null;
  boundCharacterName: string | null;
};

type WorldLatencyEntry = {
  latencyMs: number;
  updatedAt: string;
};

type AbilityAutomationMode = "manual" | "assisted" | "full";

type AbilityExecutionResult = {
  ability: {
    id: string;
    name: string;
    activation: string;
    actionType: string;
  };
  actor: {
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  };
  targets: Array<{
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  }>;
  settlement: {
    success?: boolean;
    check?: {
      success?: boolean;
      total?: number;
      targetValue?: number;
    };
    damage?: {
      total?: number;
      damageType?: string;
    };
  } | null;
  costs: Array<{
    type: string;
    amount: number;
    label: string;
  }>;
  effects: Array<{
    type: string;
    target: string;
    value: string | number | boolean | null;
    label?: string;
  }>;
  workflow?: {
    mode: AbilityAutomationMode;
    status: "running" | "waiting" | "completed" | "failed";
    damageApplications?: Array<{
      targetName: string;
      rawDamage: number;
      appliedDamage: number;
      applied: boolean;
    }>;
  };
};

const EMPTY_UNREAD: ChannelUnreadMap = { OOC: 0, IC: 0, SYSTEM: 0, SESSION: 0, COMBAT: 0 };

const SYSTEM_TABS: Array<{
  key: SystemTabKey;
  label: string;
  title: string;
  description: string;
  view: "chat" | "battle" | "scene" | "system";
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "chat", label: "聊", title: "世界频道", description: "OOC / IC / SYSTEM 实时同步", view: "chat", icon: MessageSquare },
  { key: "battle", label: "战", title: "战斗序列", description: "先攻顺序、回合操作、状态管理", view: "battle", icon: Swords },
  { key: "scene", label: "景", title: "场景控制", description: "场景、视觉、网格、光照、迷雾", view: "scene", icon: MapIcon },
  { key: "char", label: "角", title: "角色管理", description: "玩家 / NPC / 怪物图鉴", view: "scene", icon: User },
  { key: "ability", label: "能", title: "能力库", description: "职业特性、法术、状态、触发器", view: "scene", icon: Sparkles },
  { key: "item", label: "物", title: "物品库", description: "武器、防具、消耗品、魔法道具", view: "scene", icon: Package },
  { key: "random", label: "随", title: "随机工具", description: "随机表、牌堆、骰子", view: "scene", icon: Dice5 },
  { key: "music", label: "乐", title: "音乐播放", description: "BGM、SFX、歌单管理", view: "scene", icon: Music },
  { key: "collect", label: "集", title: "合集管理", description: "世界包导入 / 导出", view: "system", icon: Layers },
  { key: "system", label: "系", title: "系统设置", description: "权限、模块、资源库", view: "system", icon: Settings },
];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  abilities: "能力",
  races: "种族",
  professions: "职业",
  backgrounds: "背景",
  items: "物品",
  fateClocks: "命刻",
  decks: "牌组",
  randomTables: "随机表",
};

const COMMON_RULE_INSIGHT_ENTRIES: HoverInsightEntry[] = [
  {
    id: "status:dazed",
    title: "晕眩",
    kind: "状态",
    summary: "无法稳定行动的控制状态。",
    description: "晕眩代表角色短时间失去完整反应与行动节奏。后续规则落库后，这里会显示具体的动作限制、豁免与持续时间。",
    aliases: ["眩晕", "Dazed"],
    meta: ["控制", "状态"],
  },
  {
    id: "term:battle-spirit",
    title: "战意",
    kind: "资源",
    summary: "战斗职业常用的现场资源。",
    description: "战意通常由攻击、受击或职业特性获得，用于发动战技、爆发或防御反应。",
    aliases: ["战意值"],
    meta: ["资源", "职业"],
  },
];

function getRecordText(record: EntityRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getRecordMeta(record: EntityRecord): string[] {
  return ["folderPath", "category", "source", "rarity", "type"]
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 4);
}

function buildEntityInsightEntry(entityType: EntityType, record: EntityRecord): HoverInsightEntry {
  const description = getRecordText(record, ["description", "rulesText", "loreText"]);
  return {
    id: `${entityType}:${record.id}`,
    title: record.name || "未命名",
    kind: ENTITY_TYPE_LABELS[entityType],
    summary: getRecordText(record, ["folderPath", "sourceName"]),
    description: description || "这个条目还没有填写简介。后续补完展示文本后，这里会作为快捷说明卡展示。",
    meta: getRecordMeta(record),
    aliases: typeof record.name === "string" ? [record.name] : [],
  };
}

function createDefaultHudConfig(): HUDConfig {
  return {
    mode: "combat",
    combatSlots: Array.from({ length: 10 }, (_, index) => ({ index, type: "empty" as const })),
    generalTabs: [
      { id: "character", label: "角色", type: "character", visible: true },
      { id: "inventory", label: "背包", type: "inventory", visible: true },
      { id: "abilities", label: "能力", type: "abilities", visible: true },
      { id: "journal", label: "日志", type: "journal", visible: true },
    ],
  };
}

function getWorldUnreadStorageKey(worldId: string, sceneId: string, userId?: string) {
  return `world-chat-unread:${worldId}:${sceneId}:${userId ?? "anonymous"}`;
}

function parseUnread(raw: string | null): ChannelUnreadMap {
  if (!raw) {
    return EMPTY_UNREAD;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ChannelUnreadMap>;
    return {
      OOC: Number(parsed.OOC) || 0,
      IC: Number(parsed.IC) || 0,
      SYSTEM: Number(parsed.SYSTEM) || 0,
      SESSION: Number(parsed.SESSION) || 0,
      COMBAT: Number(parsed.COMBAT) || 0,
    };
  } catch {
    return EMPTY_UNREAD;
  }
}

function canCurrentRoleSendChannel(role: WorldDetail["myRole"], channel: WorldChatChannel): boolean {
  if (channel === "SYSTEM") {
    return role === "GM";
  }
  return true;
}

function mergeLocatedMessageIntoList(messages: ChatMessage[], target: ChatMessage): ChatMessage[] {
  const merged = [...messages.filter((item) => item.id !== target.id), target];
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return merged;
}

function getMyTokenId(userId: string) {
  return `token:${userId}`;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  const message =
    typeof error === "object" && error && "response" in error
      ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
      : undefined;

  return mapWorldRuntimeErrorMessage(message || fallback);
}

function getRecordNumber(record: unknown, key: string, fallback = 0) {
  if (!record || typeof record !== "object") {
    return fallback;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRecordString(record: unknown, key: string, fallback = "") {
  if (!record || typeof record !== "object") {
    return fallback;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function getPartyHealthClass(character: CharacterItem) {
  const hp = getRecordNumber(character.stats, "hp", 0);
  const maxHp = Math.max(hp, getRecordNumber(character.snapshot, "maxHp", hp));

  if (maxHp <= 0) {
    return "is-unknown";
  }

  const ratio = hp / maxHp;
  if (ratio >= 0.66) {
    return "is-good";
  }
  if (ratio >= 0.33) {
    return "is-warn";
  }
  return "is-bad";
}

function getRosterDisplayName(member: WorldRosterMember) {
  return member.worldDisplayName || member.accountDisplayName || member.username;
}

function getLatencyClass(latencyMs: number | null | undefined, online: boolean) {
  if (!online || latencyMs == null) {
    return "is-unknown";
  }
  if (latencyMs <= 90) {
    return "is-good";
  }
  if (latencyMs <= 180) {
    return "is-warn";
  }
  return "is-bad";
}

function getLatencyLabel(latencyMs: number | null | undefined, online: boolean) {
  if (!online) {
    return "绂荤嚎";
  }
  if (latencyMs == null) {
    return "--";
  }
  return `${latencyMs}ms`;
}

function canViewEntityType(role: WorldRoleType | null, entityType: EntityType) {
  switch (entityType) {
    case "abilities":
      return hasPermission(role, PERMISSIONS.ABILITY_VIEW);
    case "items":
      return hasPermission(role, PERMISSIONS.ITEM_VIEW);
    case "fateClocks":
      return hasPermission(role, PERMISSIONS.FATE_CLOCK_VIEW);
    case "decks":
      return hasPermission(role, PERMISSIONS.DECK_VIEW);
    case "randomTables":
      return hasPermission(role, PERMISSIONS.RANDOM_TABLE_VIEW);
    default:
      return hasPermission(role, PERMISSIONS.ENTITY_VIEW);
  }
}

function canEditEntityType(role: WorldRoleType | null, entityType: EntityType) {
  switch (entityType) {
    case "abilities":
      return hasPermission(role, PERMISSIONS.ABILITY_CREATE) || hasPermission(role, PERMISSIONS.ABILITY_EDIT);
    case "items":
      return hasPermission(role, PERMISSIONS.ITEM_CREATE) || hasPermission(role, PERMISSIONS.ITEM_EDIT);
    case "fateClocks":
      return hasPermission(role, PERMISSIONS.FATE_CLOCK_CREATE);
    case "decks":
      return hasPermission(role, PERMISSIONS.DECK_CREATE);
    case "randomTables":
      return hasPermission(role, PERMISSIONS.RANDOM_TABLE_CREATE);
    default:
      return hasPermission(role, PERMISSIONS.ENTITY_CREATE) || hasPermission(role, PERMISSIONS.ENTITY_EDIT);
  }
}

const ABILITY_CATEGORY_LABELS: Record<string, string> = {
  spell: "法术",
  combatTechnique: "战技",
  feature: "职业特性",
  racial: "种族能力",
  item: "物品能力",
  custom: "自定义",
};

function getEntityText(record: EntityRecord, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildAbilityLibraryTree(records: EntityRecord[], collapsedNodes: Set<string>): TreeNode[] {
  if (records.length === 0) {
    return getDefaultTreeData("ability");
  }

  const groups = new Map<string, EntityRecord[]>();
  for (const record of records) {
    const folder = getEntityText(record, "folderPath");
    const category = getEntityText(record, "category", "custom");
    const groupLabel = folder || ABILITY_CATEGORY_LABELS[category] || category || "未分类";
    groups.set(groupLabel, [...(groups.get(groupLabel) ?? []), record]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"))
    .map(([label, items]) => {
      const id = `ability-group:${label}`;
      return {
        id,
        type: "dir" as const,
        icon: "✦",
        label,
        meta: `${items.length}`,
        collapsed: collapsedNodes.has(id),
        children: items
          .slice()
          .sort((left, right) =>
            getEntityText(left, "name", "未命名能力").localeCompare(getEntityText(right, "name", "未命名能力"), "zh-Hans-CN")
          )
          .map((item) => ({
            id: `ability:${item.id}`,
            type: "leaf" as const,
            icon: "◆",
            label: getEntityText(item, "name", "未命名能力"),
            meta: getEntityText(item, "activation", getEntityText(item, "actionType")),
          })),
      };
    });
}

function messageBadges(message: ChatMessage): string[] {
  const badges: string[] = [];
  if (message.metadata?.storyEventCheckTag) {
    badges.push(`检定 ${message.metadata.storyEventCheckTag.optionLabel}`);
  }
  if (message.metadata?.storyEventCard) {
    badges.push(`事件卡 ${message.metadata.storyEventCard.title}`);
  }
  if (message.metadata?.storyPointProposalTag) {
    badges.push(`物语点 ${message.metadata.storyPointProposalTag.status}`);
  }
  if (message.metadata?.storyPointProposalDecisionTag) {
    badges.push(`裁决 ${message.metadata.storyPointProposalDecisionTag.status}`);
  }
  if (message.metadata?.aiAssistantContextTag) {
    badges.push("AI 助手");
  }
  return badges;
}

export default function WorldPage() {
  const navigate = useNavigate();
  const { worldId = "" } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const loadEntities = useWorldEntityStore((state) => state.loadEntities);
  const createEntity = useWorldEntityStore((state) => state.createEntity);
  const deleteEntity = useWorldEntityStore((state) => state.deleteEntity);
  const advanceFateClock = useWorldEntityStore((state) => state.advanceFateClock);
  const resetWorldEntities = useWorldEntityStore((state) => state.resetAll);
  const abilityRecords = useWorldEntityStore((state) => state.abilities.items);
  const itemRecords = useWorldEntityStore((state) => state.items.items);
  const raceRecords = useWorldEntityStore((state) => state.races.items);
  const professionRecords = useWorldEntityStore((state) => state.professions.items);
  const backgroundRecords = useWorldEntityStore((state) => state.backgrounds.items);
  const deckRecords = useWorldEntityStore((state) => state.decks.items);
  const randomTableRecords = useWorldEntityStore((state) => state.randomTables.items);
  const fateClockRecords = useWorldEntityStore((state) => state.fateClocks.items);

  const [worldName, setWorldName] = useState("世界");
  const [myRole, setMyRole] = useState<WorldDetail["myRole"]>(null);
  const [socketReady, setSocketReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [tokens, setTokens] = useState<Record<string, TokenItem>>({});
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [newSceneName, setNewSceneName] = useState("");
  const [renameSceneName, setRenameSceneName] = useState("");
  const [creatingScene, setCreatingScene] = useState(false);
  const [renamingScene, setRenamingScene] = useState(false);
  const [deletingScene, setDeletingScene] = useState(false);
  const [sortingScene, setSortingScene] = useState(false);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterType, setNewCharacterType] = useState<"PC" | "NPC">("PC");
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [editCharacterName, setEditCharacterName] = useState("");
  const [editHp, setEditHp] = useState("0");
  const [editMp, setEditMp] = useState("0");
  const [editLevel, setEditLevel] = useState("1");
  const [editClassName, setEditClassName] = useState("");
  const [worldMessages, setWorldMessages] = useState<ChatMessage[]>([]);
  const [worldChatChannel, setWorldChatChannel] = useState<WorldChatChannel>("OOC");
  const [worldChatUnread, setWorldChatUnread] = useState<ChannelUnreadMap>(EMPTY_UNREAD);
  const [worldChatInput, setWorldChatInput] = useState("");
  const [worldChatSending, setWorldChatSending] = useState(false);
  const [runtimeState, setRuntimeState] = useState<WorldRuntimeState | null>(null);
  const [runtimeModules, setRuntimeModules] = useState<RuntimeModuleState[]>([]);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [togglingModuleKey, setTogglingModuleKey] = useState<string | null>(null);
  const [sceneVisualState, setSceneVisualState] = useState<SceneVisualState | null>(null);
  const [sceneCombatState, setSceneCombatState] = useState<SceneCombatState | null>(null);
  const [sceneVisualLoading, setSceneVisualLoading] = useState(false);
  const [sceneCombatLoading, setSceneCombatLoading] = useState(false);
  const [sceneVisualSaving, setSceneVisualSaving] = useState(false);
  const [sceneCombatSaving, setSceneCombatSaving] = useState(false);
  const [sceneCombatAdvancing, setSceneCombatAdvancing] = useState(false);
  const [storyEvents, setStoryEvents] = useState<StoryEventItem[]>([]);
  const [storyEventCards, setStoryEventCards] = useState<StoryEventCardItem[]>([]);
  const [storyEventLoading, setStoryEventLoading] = useState(false);
  const [storySearchKeyword, setStorySearchKeyword] = useState("");
  const [storySearchEventStatus, setStorySearchEventStatus] = useState<"ALL" | "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED">("ALL");
  const [storySearchChannelKey, setStorySearchChannelKey] = useState<"ALL" | "OOC" | "IC" | "SYSTEM">("ALL");
  const [storySearchHours, setStorySearchHours] = useState("24");
  const [storySearching, setStorySearching] = useState(false);
  const [storySearchResult, setStorySearchResult] = useState<StoryEventSearchResult | null>(null);
  const [focusedWorldMessageId, setFocusedWorldMessageId] = useState<string | null>(null);
  const [focusedStoryEventId, setFocusedStoryEventId] = useState<string | null>(null);
  const [assistantInstruction, setAssistantInstruction] = useState("");
  const [assistantGenerating, setAssistantGenerating] = useState(false);

  const [activeSystemTab, setActiveSystemTab] = useState<SystemTabKey>("scene");
  const [customKeyBindings, setCustomKeyBindings] = useState(() => loadWorldHotkeyBindings(worldId || "pending", user?.id));
  const [systemPanelCollapsed, setSystemPanelCollapsed] = useState(false);
  const [showHUD, setShowHUD] = useState(true);
  const [showBattleBar, setShowBattleBar] = useState(false);
  const [gmPlayerView, setGmPlayerView] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedFateClockId, setSelectedFateClockId] = useState<string | null>(null);
  const [showFateCreateForm, setShowFateCreateForm] = useState(false);
  const [fateClockName, setFateClockName] = useState("");
  const [fateClockSegments, setFateClockSegments] = useState("6");
  const [fateClockDirection, setFateClockDirection] = useState<"advance" | "countdown">("advance");
  const [fateClockVisible, setFateClockVisible] = useState(true);
  const [overlays, setOverlays] = useState<OverlayState[]>([]);
  const overlayCounterRef = useRef(0);
  const [stageNotice, setStageNotice] = useState("正在连接世界舞台...");
  const [hudConfig, setHudConfig] = useState<HUDConfig>(() => createDefaultHudConfig());
  const [memberManageData, setMemberManageData] = useState<WorldMemberManageData | null>(null);
  const [memberManageLoading, setMemberManageLoading] = useState(false);
  const [memberManageError, setMemberManageError] = useState<string | null>(null);
  const [savingMemberUserId, setSavingMemberUserId] = useState<string | null>(null);
  const [worldRoster, setWorldRoster] = useState<WorldRosterMember[]>([]);
  const [onlineMemberUserIds, setOnlineMemberUserIds] = useState<string[]>([]);
  const [worldLatencyByUserId, setWorldLatencyByUserId] = useState<Record<string, WorldLatencyEntry>>({});
  const [selectedBattleAbilityId, setSelectedBattleAbilityId] = useState("");
  const [abilityActorCharacterId, setAbilityActorCharacterId] = useState("");
  const [abilityTargetCharacterId, setAbilityTargetCharacterId] = useState("");
  const [abilityAutomationMode, setAbilityAutomationMode] = useState<AbilityAutomationMode>("assisted");
  const [abilityExecuting, setAbilityExecuting] = useState(false);
  const [abilityExecutionResult, setAbilityExecutionResult] = useState<AbilityExecutionResult | null>(null);

  // 系统面板目录树状态
  const [treeData, setTreeData] = useState<Record<string, TreeNode[]>>({});
  const [treeCollapsedNodes, setTreeCollapsedNodes] = useState<Set<string>>(new Set());

  const actualRole = myRole as WorldRoleType | null;
  const isActualGm = actualRole === "GM";
  const isGmPlayerView = isActualGm && gmPlayerView;
  const role = isGmPlayerView ? "PLAYER" : actualRole;
  const isGm = role === "GM";
  const tokenList = useMemo(() => Object.values(tokens), [tokens]);
  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );
  const selectedScene = useMemo(
    () => scenes.find((item) => item.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId]
  );
  const canSendCurrentChannel = useMemo(
    () => canCurrentRoleSendChannel(role, worldChatChannel),
    [role, worldChatChannel]
  );
  const canUseAssistant = role === "GM" || role === "ASSISTANT";
  const canManageSceneVisual = hasPermission(role, PERMISSIONS.SCENE_EDIT_VISUAL);
  const canManageCombat = hasPermission(role, PERMISSIONS.COMBAT_MANAGE);
  const canAdvanceTurn = hasPermission(role, PERMISSIONS.COMBAT_ADVANCE_TURN) || canManageCombat;
  const canDragToken = hasPermission(role, PERMISSIONS.TOKEN_MOVE_OWN) || hasPermission(role, PERMISSIONS.TOKEN_MOVE_ANY);
  const canCreateClock = hasPermission(role, PERMISSIONS.FATE_CLOCK_CREATE);
  const canAdvanceClock = hasPermission(role, PERMISSIONS.FATE_CLOCK_ADVANCE);
  const canDeleteClock = hasPermission(role, PERMISSIONS.FATE_CLOCK_DELETE);
  const canManagePlayers = hasPermission(role, PERMISSIONS.SYSTEM_MANAGE_PLAYERS);
  const canManageModules = hasPermission(role, PERMISSIONS.SYSTEM_MANAGE_EXTENSIONS);
  const canSeeHiddenClocks = role === "GM" || role === "ASSISTANT";
  const canCreateCharacter = hasPermission(role, PERMISSIONS.CHARACTER_CREATE);
  const canCreateNpc = role === "GM";
  const canDeployToken = Boolean(
    selectedCharacter &&
      (hasPermission(role, PERMISSIONS.TOKEN_CREATE) ||
        hasPermission(role, PERMISSIONS.TOKEN_MOVE_OWN) ||
        hasPermission(role, PERMISSIONS.TOKEN_MOVE_ANY))
  );
  const canExecuteAbility = Boolean(role && role !== "OBSERVER");

  const selectedSceneIndex = useMemo(() => scenes.findIndex((item) => item.id === selectedSceneId), [scenes, selectedSceneId]);
  const canMoveSceneUp = selectedSceneIndex > 0;
  const canMoveSceneDown = selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1;

  const visibleTabs = useMemo(() => SYSTEM_TABS.filter((tab) => isTabVisible(tab.key, role)), [role]);
  const activeTabMeta = useMemo(
    () => visibleTabs.find((tab) => tab.key === activeSystemTab) ?? visibleTabs[0] ?? SYSTEM_TABS[0],
    [activeSystemTab, visibleTabs]
  );
  const shortcutPreview = useMemo(
    () =>
      customKeyBindings
        .filter((item) => ["toggleSystemPanel", "toggleChat", "openHotkeys", "endTurn", "advanceFateClock", "toggleHUD"].includes(item.action))
        .filter((item) => !item.disabled && item.key)
        .map((item) => `${formatKeyBinding(item)} ${item.label}`)
        .join(" · "),
    [customKeyBindings]
  );

  const currentSceneIdRef = useRef(selectedSceneId);
  const currentChannelRef = useRef(worldChatChannel);
  const contextMenu = useContextMenu();

  const fateClocks = useMemo(() => fateClockRecords as unknown as FateClockDefinition[], [fateClockRecords]);
  const visibleFateClocks = useMemo(() => {
    const filtered = fateClocks.filter((clock) => {
      if (!clock.visibleToPlayers && !canSeeHiddenClocks) {
        return false;
      }
      if (!selectedSceneId) {
        return true;
      }
      return !clock.sceneId || clock.sceneId === selectedSceneId;
    });

    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [canSeeHiddenClocks, fateClocks, selectedSceneId]);

  const currentFateClock = useMemo(
    () => visibleFateClocks.find((clock) => clock.id === selectedFateClockId) ?? visibleFateClocks[0] ?? null,
    [selectedFateClockId, visibleFateClocks]
  );

  const myBoundTokenId = useMemo(() => {
    if (!user?.id) {
      return null;
    }
    if (selectedCharacter) {
      return `token:character:${selectedCharacter.id}`;
    }
    return getMyTokenId(user.id);
  }, [selectedCharacter, user?.id]);

  const battleEntries = useMemo<InitiativeEntry[]>(() => {
    if (!sceneCombatState) {
      return [];
    }

    return sceneCombatState.participants.map((participant, index) => {
      const tokenItem = tokens[participant.tokenId];
      const characterId = tokenItem?.characterId ?? null;
      const character = characterId
        ? characters.find((item) => item.id === characterId) ?? null
        : null;
      const hp = character ? getRecordNumber(character.stats, "hp", 0) : undefined;
      const maxHp = character && hp !== undefined
        ? Math.max(hp, getRecordNumber(character.snapshot, "maxHp", hp))
        : undefined;

      return {
        id: participant.tokenId,
        name: participant.name || tokenItem?.characterName || "未命名单位",
        initiative: participant.initiative,
        isCurrentTurn: index === sceneCombatState.turnIndex,
        isMine: participant.tokenId === myBoundTokenId,
        type: character?.type ?? "NPC",
        hp,
        maxHp: maxHp && maxHp > 0 ? maxHp : undefined,
      };
    });
  }, [characters, myBoundTokenId, sceneCombatState, tokens]);

  const isBattleSequenceVisible =
    sceneCombatState?.status === "active" && showBattleBar && battleEntries.length > 0;

  const unreadTotal = worldChatUnread.OOC + worldChatUnread.IC + worldChatUnread.SYSTEM;

  const hoverInsightEntries = useMemo(
    () => [
      ...COMMON_RULE_INSIGHT_ENTRIES,
      ...abilityRecords.map((record) => buildEntityInsightEntry("abilities", record)),
      ...itemRecords.map((record) => buildEntityInsightEntry("items", record)),
      ...raceRecords.map((record) => buildEntityInsightEntry("races", record)),
      ...professionRecords.map((record) => buildEntityInsightEntry("professions", record)),
      ...backgroundRecords.map((record) => buildEntityInsightEntry("backgrounds", record)),
      ...fateClockRecords.map((record) => buildEntityInsightEntry("fateClocks", record)),
      ...deckRecords.map((record) => buildEntityInsightEntry("decks", record)),
      ...randomTableRecords.map((record) => buildEntityInsightEntry("randomTables", record)),
    ],
    [abilityRecords, backgroundRecords, deckRecords, fateClockRecords, itemRecords, professionRecords, raceRecords, randomTableRecords]
  );

  const hudResources = useMemo(() => {
    const hp = getRecordNumber(selectedCharacter?.stats, "hp", 0);
    const mp = getRecordNumber(selectedCharacter?.stats, "mp", 0);
    const stamina = getRecordNumber(selectedCharacter?.stats, "stamina", 0);
    const fury = getRecordNumber(selectedCharacter?.stats, "fury", 0);
    const maxHp = Math.max(1, getRecordNumber(selectedCharacter?.snapshot, "maxHp", hp || 1));
    const maxMp = Math.max(1, getRecordNumber(selectedCharacter?.snapshot, "maxMp", mp || 1));
    const maxStamina = Math.max(stamina, getRecordNumber(selectedCharacter?.snapshot, "maxStamina", stamina));
    const maxFury = Math.max(fury, getRecordNumber(selectedCharacter?.snapshot, "maxFury", fury));

    return {
      hp,
      maxHp,
      mp,
      maxMp,
      stamina,
      maxStamina,
      fury,
      maxFury,
    };
  }, [selectedCharacter]);

  const resolveHudLabel = (type: "ability" | "item", id: string) => {
    const source = type === "ability" ? abilityRecords : itemRecords;
    const found = source.find((entry) => entry.id === id) as { name?: string } | undefined;
    return found?.name || "未命名";
  };

  const resolveHudIcon = (type: "ability" | "item", id: string) => {
    const source = type === "ability" ? abilityRecords : itemRecords;
    const found = source.find((entry) => entry.id === id) as { iconUrl?: string } | undefined;
    return found?.iconUrl;
  };

  const partyCharacters = useMemo(() => {
    const items = [...characters];
    items.sort((a, b) => {
      if (a.id === selectedCharacterId) return -1;
      if (b.id === selectedCharacterId) return 1;
      if (a.type !== b.type) {
        return a.type === "PC" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });
    return items;
  }, [characters, selectedCharacterId]);

  const partySummaryCards = useMemo(() => {
    const characterById = new Map(characters.map((item) => [item.id, item]));
    const boundCards = worldRoster
      .map((member) => {
        if (!member.boundCharacterId) {
          return null;
        }
        const character = characterById.get(member.boundCharacterId);
        if (!character) {
          return null;
        }
        return { member, character };
      })
      .filter((item): item is { member: WorldRosterMember; character: CharacterItem } => Boolean(item));

    const usedCharacterIds = new Set(boundCards.map((item) => item.character.id));
    const fallbackCards = partyCharacters
      .filter((character) => !usedCharacterIds.has(character.id))
      .map((character) => ({ member: null, character }));

    return [...boundCards, ...fallbackCards];
  }, [characters, partyCharacters, worldRoster]);

  const abilityActorCharacters = useMemo(() => {
    if (!role || role === "OBSERVER") {
      return [];
    }
    if (hasPermission(role, PERMISSIONS.CHARACTER_VIEW_ALL)) {
      return characters;
    }
    return characters.filter((character) => character.userId === user?.id);
  }, [characters, role, user?.id]);

  const onlineRosterMembers = useMemo(() => {
    const onlineSet = new Set(onlineMemberUserIds);
    return [...worldRoster].sort((left, right) => {
      const onlineDelta = Number(onlineSet.has(right.userId)) - Number(onlineSet.has(left.userId));
      if (onlineDelta !== 0) {
        return onlineDelta;
      }
      return getRosterDisplayName(left).localeCompare(getRosterDisplayName(right), "zh-CN");
    });
  }, [onlineMemberUserIds, worldRoster]);

  const currentContextItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu.area === "token") {
      return [
        {
          id: "token-focus",
          label: "聚焦这个棋子",
          action: "focus-token",
          requiredPermission: PERMISSIONS.TOKEN_MOVE_OWN,
        },
        {
          id: "token-character",
          label: "打开关联角色卡",
          action: "open-character-from-token",
        },
        { id: "divider-1", label: "", divider: true },
        {
          id: "token-next-turn",
          label: "推进当前回合",
          action: "combat-next-turn",
          requiredPermission: PERMISSIONS.COMBAT_ADVANCE_TURN,
          disabled: !canAdvanceTurn,
        },
      ];
    }

    if (contextMenu.area === "character-card") {
      return [
        {
          id: "character-open",
          label: "打开角色卡",
          action: "character-open-sheet",
        },
        {
          id: "character-active",
          label: "设为当前角色",
          action: "character-set-active",
        },
        {
          id: "character-deploy",
          label: "投放到舞台",
          action: "character-deploy-token",
          requiredPermission: PERMISSIONS.TOKEN_MOVE_OWN,
        },
        { id: "divider-character", label: "", divider: true },
        {
          id: "character-create",
          label: "创建新角色",
          action: "character-create",
          requiredPermission: PERMISSIONS.CHARACTER_CREATE,
          disabled: !canCreateCharacter,
        },
      ];
    }

    if (contextMenu.area === "initiative-entry") {
      return [
        {
          id: "initiative-focus",
          label: "聚焦棋子",
          action: "focus-token",
          requiredPermission: PERMISSIONS.TOKEN_MOVE_OWN,
        },
        {
          id: "initiative-character",
          label: "打开行动者角色卡",
          action: "open-character-from-initiative",
        },
        {
          id: "initiative-next-turn",
          label: "推进当前回合",
          action: "combat-next-turn",
          requiredPermission: PERMISSIONS.COMBAT_ADVANCE_TURN,
          disabled: !canAdvanceTurn,
        },
        { id: "divider-initiative", label: "", divider: true },
        { id: "initiative-ability", label: "打开能力结算台", action: "open-ability-overlay" },
      ];
    }

    if (contextMenu.area === "fate-clock") {
      return [
        {
          id: "clock-advance",
          label: "推进命刻 +1",
          action: "clock-advance",
          requiredPermission: PERMISSIONS.FATE_CLOCK_ADVANCE,
          disabled: !canAdvanceClock,
        },
        {
          id: "clock-retreat",
          label: "回退命刻 -1",
          action: "clock-retreat",
          requiredPermission: PERMISSIONS.FATE_CLOCK_ADVANCE,
          disabled: !canAdvanceClock,
        },
        { id: "divider-1", label: "", divider: true },
        {
          id: "clock-delete",
          label: "删除命刻",
          action: "clock-delete",
          requiredPermission: PERMISSIONS.FATE_CLOCK_DELETE,
          danger: true,
          disabled: !canDeleteClock,
        },
      ];
    }

    return [
      {
        id: "canvas-drop-token",
        label: "投放我的棋子",
        action: "add-my-token",
        requiredPermission: PERMISSIONS.TOKEN_MOVE_OWN,
      },
      {
        id: "canvas-center-token",
        label: "把主棋子移回中心",
        action: "center-my-token",
        requiredPermission: PERMISSIONS.TOKEN_MOVE_OWN,
      },
      { id: "divider-1", label: "", divider: true },
      { id: "canvas-open-scene", label: "打开场景页", action: "open-scene-tab" },
      { id: "canvas-open-chat", label: "打开聊天台", action: "open-chat-tab" },
      { id: "canvas-open-system", label: "打开系统页", action: "open-system-tab" },
    ];
  }, [canAdvanceClock, canAdvanceTurn, canCreateCharacter, canDeleteClock, contextMenu.area]);

  const loadRuntimeState = async () => {
    if (!worldId) {
      return;
    }

    setRuntimeLoading(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/runtime`);
      setRuntimeState((resp.data?.data ?? null) as WorldRuntimeState | null);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载世界运行状态失败"));
    } finally {
      setRuntimeLoading(false);
    }
  };

  const loadRuntimeModules = async () => {
    if (!worldId) {
      return;
    }

    setModuleLoading(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/runtime/modules`);
      setRuntimeModules((resp.data?.data ?? []) as RuntimeModuleState[]);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载模块列表失败"));
    } finally {
      setModuleLoading(false);
    }
  };

  const loadSceneVisualState = async () => {
    if (!worldId || !selectedSceneId) {
      setSceneVisualState(null);
      return;
    }

    setSceneVisualLoading(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/scenes/${selectedSceneId}/visual`);
      setSceneVisualState((resp.data?.data ?? null) as SceneVisualState | null);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载场景视觉状态失败"));
    } finally {
      setSceneVisualLoading(false);
    }
  };

  const onPatchSceneVisualState = async (input: SceneVisualPatchInput) => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    setSceneVisualSaving(true);
    try {
      const resp = await http.patch(`/worlds/${worldId}/scenes/${selectedSceneId}/visual`, input);
      setSceneVisualState((resp.data?.data ?? null) as SceneVisualState | null);
      setStageNotice("场景视觉已刷新到最新配置。");
    } catch (err) {
      setError(resolveErrorMessage(err, "更新场景视觉状态失败"));
    } finally {
      setSceneVisualSaving(false);
    }
  };

  const loadSceneCombatState = async () => {
    if (!worldId || !selectedSceneId) {
      setSceneCombatState(null);
      return;
    }

    setSceneCombatLoading(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/scenes/${selectedSceneId}/combat`);
      setSceneCombatState((resp.data?.data ?? null) as SceneCombatState | null);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载战斗状态失败"));
    } finally {
      setSceneCombatLoading(false);
    }
  };

  const onSaveSceneCombatState = async (input: SceneCombatInput) => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    setSceneCombatSaving(true);
    try {
      const resp = await http.put(`/worlds/${worldId}/scenes/${selectedSceneId}/combat`, input);
      setSceneCombatState((resp.data?.data ?? null) as SceneCombatState | null);
      setStageNotice("战斗序列已写入当前场景。");
    } catch (err) {
      setError(resolveErrorMessage(err, "保存战斗状态失败"));
    } finally {
      setSceneCombatSaving(false);
    }
  };

  const onAdvanceSceneCombatTurn = async () => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    setSceneCombatAdvancing(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/scenes/${selectedSceneId}/combat/next-turn`);
      setSceneCombatState((resp.data?.data ?? null) as SceneCombatState | null);
      setStageNotice("当前回合已推进到下一个单位。");
    } catch (err) {
      setError(resolveErrorMessage(err, "推进回合失败"));
    } finally {
      setSceneCombatAdvancing(false);
    }
  };

  const loadStoryEvents = async () => {
    if (!worldId) {
      return;
    }

    setStoryEventLoading(true);
    try {
      const [eventsResp, cardsResp] = await Promise.all([
        http.get(`/worlds/${worldId}/story-events`),
        http.get(`/worlds/${worldId}/story-events/cards`, { params: { limit: 20 } }),
      ]);
      setStoryEvents((eventsResp.data?.data ?? []) as StoryEventItem[]);
      setStoryEventCards((cardsResp.data?.data ?? []) as StoryEventCardItem[]);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载剧情事件失败"));
    } finally {
      setStoryEventLoading(false);
    }
  };

  const loadWorldChatMessages = async (options?: {
    channel?: WorldChatChannel;
    sceneId?: string;
    limit?: number;
    preserveUnread?: boolean;
  }) => {
    if (!worldId) {
      return;
    }

    const channel = options?.channel ?? worldChatChannel;
    const sceneId = options?.sceneId ?? selectedSceneId;
    if (!sceneId) {
      setWorldMessages([]);
      return;
    }

    try {
      const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
        params: { limit: options?.limit ?? 100, channelKey: channel, sceneId },
      });
      setWorldMessages((chatResp.data?.data ?? []) as ChatMessage[]);
      if (!options?.preserveUnread) {
        setWorldChatUnread((prev) => ({ ...prev, [channel]: 0 }));
      }
    } catch (err) {
      setError(resolveErrorMessage(err, "加载世界聊天记录失败"));
    }
  };

  const loadWorldBootstrap = async () => {
    if (!worldId) {
      return;
    }

    try {
      const [worldResp, characterResp, sceneResp, runtimeResp, modulesResp, rosterResp] = await Promise.all([
        http.get(`/worlds/${worldId}`),
        http.get(`/worlds/${worldId}/characters`),
        http.get(`/worlds/${worldId}/scenes`),
        http.get(`/worlds/${worldId}/runtime`),
        http.get(`/worlds/${worldId}/runtime/modules`),
        http.get(`/worlds/${worldId}/roster`),
      ]);

      const worldData = (worldResp.data?.data ?? null) as WorldDetail | null;
      const characterItems = (characterResp.data?.data ?? []) as CharacterItem[];
      const sceneItems = (sceneResp.data?.data ?? []) as SceneItem[];
      const rosterItems = (rosterResp.data?.data ?? []) as WorldRosterMember[];

      setWorldName(worldData?.name || "世界");
      setMyRole(worldData?.myRole ?? null);
      // 应用 GM 设置的世界级风格（最高优先级覆盖玩家偏好）
      {
        const rawPack = worldData?.themePack ?? null;
        const safePack: ThemePackId | null = rawPack && isKnownThemePack(rawPack) ? (rawPack as ThemePackId) : null;
        useThemeStore.getState().enterWorld({
          worldPack: safePack,
          forcedByGM: !!(safePack && worldData?.themePackForcedByGM),
        });
      }
      setCharacters(characterItems);
      setScenes(sceneItems);
      setWorldRoster(rosterItems);
      setRuntimeState((runtimeResp.data?.data ?? null) as WorldRuntimeState | null);
      setRuntimeModules((modulesResp.data?.data ?? []) as RuntimeModuleState[]);

      if (characterItems.length > 0) {
        const boundCharacterId = user?.id ? rosterItems.find((item) => item.userId === user.id)?.boundCharacterId : undefined;
        const preferred = boundCharacterId
          ? characterItems.find((item) => item.id === boundCharacterId)
          : user?.id
            ? characterItems.find((item) => item.userId === user.id)
            : undefined;
        setSelectedCharacterId((preferred ?? characterItems[0]).id);
      }

      if (sceneItems.length > 0) {
        setSelectedSceneId((prev) => prev || sceneItems[0].id);
        setRenameSceneName(sceneItems[0].name);
      }

      setStageNotice(`已接入 ${worldData?.name || "世界"} 的舞台控制台。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载世界信息失败"));
    }
  };

  const loadWorldRoster = async () => {
    if (!worldId) {
      return;
    }

    try {
      const resp = await http.get(`/worlds/${worldId}/roster`);
      setWorldRoster((resp.data?.data ?? []) as WorldRosterMember[]);
    } catch (err) {
      setError(resolveErrorMessage(err, "加载世界成员名单失败"));
    }
  };

  const loadWorldMemberManage = async () => {
    if (!worldId || !canManagePlayers) {
      return;
    }

    setMemberManageLoading(true);
    setMemberManageError(null);
    try {
      const resp = await http.get(`/worlds/${worldId}/members/manage`);
      setMemberManageData((resp.data?.data ?? null) as WorldMemberManageData | null);
    } catch (err) {
      setMemberManageError(resolveErrorMessage(err, "加载玩家管理数据失败"));
    } finally {
      setMemberManageLoading(false);
    }
  };

  const onToggleRuntimeModule = async (module: RuntimeModuleState) => {
    if (!worldId) {
      return;
    }

    const nextStatus = module.status === "enabled" ? "disabled" : "enabled";
    setTogglingModuleKey(module.key);
    try {
      const resp = await http.patch(`/worlds/${worldId}/runtime/modules/${module.key}`, { status: nextStatus });
      const updated = resp.data?.data as RuntimeModuleState;
      setRuntimeModules((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
      setStageNotice(`${updated.displayName} 已${updated.status === "enabled" ? "启用" : "禁用"}。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "切换模块状态失败"));
    } finally {
      setTogglingModuleKey(null);
    }
  };

  const onCreateStoryEvent = async (payload: { title: string; description: string }) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events`, payload);
      await loadStoryEvents();
      setStageNotice(`剧情事件“${payload.title}”已创建。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "创建剧情事件失败"));
    }
  };

  const onAddStoryEventOption = async (
    eventId: string,
    payload: { label: string; skillKey: string; dc: number; checkMode: StoryOptionCheckMode }
  ) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/options`, {
        label: payload.label,
        check: {
          skillKey: payload.skillKey,
          dc: payload.dc,
          checkMode: payload.checkMode,
        },
      });
      await loadStoryEvents();
    } catch (err) {
      setError(resolveErrorMessage(err, "新增剧情选项失败"));
    }
  };

  const onSubmitStoryEventCheck = async (eventId: string, optionId: string, payload: { finalTotal: number; chatContent: string }) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/options/${optionId}/check`, payload);
      await Promise.all([loadStoryEvents(), loadWorldChatMessages({ limit: 40, preserveUnread: true })]);
      setStageNotice("检定结果已同步到剧情与聊天上下文。");
    } catch (err) {
      setError(resolveErrorMessage(err, "提交检定失败"));
    }
  };

  const onResolveStoryEvent = async (eventId: string, payload: { summary: string; finalOutcome: string }) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/resolve`, payload);
      await Promise.all([loadStoryEvents(), loadWorldChatMessages({ limit: 40, preserveUnread: true })]);
      setStageNotice("剧情事件已结算，并写入 SYSTEM 频道。");
    } catch (err) {
      setError(resolveErrorMessage(err, "结算剧情事件失败"));
    }
  };

  const onCreateStoryNarrativeRequest = async (eventId: string, payload: { cost: number; reason: string }) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/narrative-requests`, payload);
      await Promise.all([loadStoryEvents(), loadWorldChatMessages({ limit: 40, preserveUnread: true })]);
      setStageNotice("物语点提案已提交，等待 GM 裁决。");
    } catch (err) {
      setError(resolveErrorMessage(err, "提交物语点提案失败"));
    }
  };

  const onDecideStoryNarrativeRequest = async (
    eventId: string,
    requestId: string,
    payload: { status: "APPROVED" | "REJECTED"; gmNote: string }
  ) => {
    if (!worldId) {
      return;
    }

    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/narrative-requests/${requestId}/decision`, payload);
      await Promise.all([loadStoryEvents(), loadWorldChatMessages({ limit: 40, preserveUnread: true })]);
      setStageNotice(`提案已${payload.status === "APPROVED" ? "通过" : "驳回"}。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "裁决物语点提案失败"));
    }
  };

  const onSearchStoryEventContext = async () => {
    if (!worldId) {
      return;
    }

    const keyword = storySearchKeyword.trim();
    if (!keyword) {
      setStorySearchResult(null);
      return;
    }

    setStorySearching(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/story-events/search`, {
        params: {
          q: keyword,
          sceneId: selectedSceneId,
          eventStatus: storySearchEventStatus,
          channelKey: storySearchChannelKey,
          hours: Number(storySearchHours) || undefined,
          limit: 20,
        },
      });
      setStorySearchResult((resp.data?.data ?? null) as StoryEventSearchResult | null);
    } catch (err) {
      setError(resolveErrorMessage(err, "检索剧情事件失败"));
    } finally {
      setStorySearching(false);
    }
  };

  const onClearStoryEventSearch = () => {
    setStorySearchKeyword("");
    setStorySearchEventStatus("ALL");
    setStorySearchChannelKey("ALL");
    setStorySearchHours("24");
    setStorySearchResult(null);
  };

  const openTab = (tab: SystemTabKey) => {
    if (!visibleTabs.some((item) => item.key === tab)) {
      return;
    }

    setActiveSystemTab(tab);
    setSystemPanelCollapsed(false);
  };

  const getOverlayKey = (overlay: OverlayDraft | OverlayState) => {
    if (overlay.kind === "entity") return `entity:${overlay.entityType}`;
    if (overlay.kind === "character") return `character:${overlay.mode}:${overlay.characterId ?? "new"}`;
    return overlay.kind;
  };

  const createOverlayPlacement = (kind: OverlayDraft["kind"], index: number): FloatingToolWindowPlacement => {
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    const baseWidth = kind === "entity" ? 760 : kind === "character" ? 600 : kind === "hotkeys" ? 640 : 700;
    const width = Math.min(baseWidth, Math.max(420, viewportWidth - 44));
    const offset = index % 7;
    return {
      left: Math.max(16, Math.min(96 + offset * 34, viewportWidth - width - 16)),
      top: 54 + offset * 28,
      width,
      zIndex: 292 + index,
    };
  };

  const focusOverlay = (overlayId: string) => {
    setOverlays((prev) => {
      const target = prev.find((item) => item.id === overlayId);
      if (!target) return prev;
      const ordered = [...prev.filter((item) => item.id !== overlayId), target];
      return ordered.map((item, index) => ({ ...item, placement: { ...item.placement, zIndex: 292 + index } }));
    });
  };

  const closeOverlay = (overlayId: string) => {
    setOverlays((prev) => prev.filter((item) => item.id !== overlayId));
  };

  const moveOverlay = (overlayId: string, next: { left: number; top: number }) => {
    setOverlays((prev) =>
      prev.map((item) => (item.id === overlayId ? { ...item, placement: { ...item.placement, ...next } } : item))
    );
  };

  const openOverlay = (draft: OverlayDraft) => {
    const key = getOverlayKey(draft);
    setOverlays((prev) => {
      const existing = prev.find((item) => getOverlayKey(item) === key);
      if (existing) {
        const ordered = [...prev.filter((item) => item.id !== existing.id), existing];
        return ordered.map((item, index) => ({ ...item, placement: { ...item.placement, zIndex: 292 + index } }));
      }

      const id = `overlay-${Date.now()}-${overlayCounterRef.current++}`;
      const next = {
        ...draft,
        id,
        placement: createOverlayPlacement(draft.kind, prev.length),
      } as OverlayState;
      return [...prev, next].map((item, index) => ({ ...item, placement: { ...item.placement, zIndex: 292 + index } }));
    });
  };

  const openEntityOverlay = (entityType: EntityType, title: string) => {
    openOverlay({ kind: "entity", entityType, title });
    setSystemPanelCollapsed(false);
  };

  const openPlayerOverlay = async () => {
    openOverlay({ kind: "players", title: "世界成员与权限管理" });
    setSystemPanelCollapsed(false);
    if (!memberManageData && !memberManageLoading) {
      await loadWorldMemberManage();
    }
  };

  const openAbilityOverlay = () => {
    openOverlay({ kind: "ability", title: "能力结算台" });
    setSystemPanelCollapsed(false);
  };

  const openStoryOverlay = () => {
    openOverlay({ kind: "story", title: "剧情事件板" });
    setSystemPanelCollapsed(false);
  };

  const openHotkeyOverlay = () => {
    openOverlay({ kind: "hotkeys", title: "快捷键设置" });
    setSystemPanelCollapsed(false);
  };

  const openThemeOverlay = () => {
    openOverlay({ kind: "theme", title: "设计风格" });
    setSystemPanelCollapsed(false);
  };

  const openCharacterOverlay = (characterId?: string, mode: "view" | "create" = "view") => {
    const character = characterId ? characters.find((item) => item.id === characterId) : null;
    if (characterId) {
      setSelectedCharacterId(characterId);
    }
    openOverlay({
      kind: "character",
      characterId,
      mode,
      title: mode === "create" ? "创建角色" : `角色卡 · ${character?.name ?? "未选择"}`,
    });
    setSystemPanelCollapsed(false);
  };

  const onLocateStoryEvent = (eventId: string) => {
    setFocusedStoryEventId(eventId);
    openTab("battle");
  };

  const onLocateWorldMessage = async (messageId: string, channelKey?: string) => {
    if (!worldId) {
      return;
    }

    try {
      const exactResp = await http.get(`/chat/worlds/${worldId}/messages/${messageId}`);
      const exact = (exactResp.data?.data ?? null) as ChatMessage | null;
      if (!exact) {
        setError("定位消息失败：目标消息不存在。");
        return;
      }

      const targetChannel = exact.channelKey === "IC" || exact.channelKey === "SYSTEM"
        ? exact.channelKey
        : ((channelKey as WorldChatChannel | undefined) || "OOC");
      const targetSceneId = exact.sceneId || selectedSceneId;

      setFocusedWorldMessageId(exact.id);
      openTab("chat");

      if (targetSceneId && targetSceneId !== selectedSceneId) {
        setSelectedSceneId(targetSceneId);
      }
      if (worldChatChannel !== targetChannel) {
        setWorldChatChannel(targetChannel);
      }

      const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
        params: { limit: 100, channelKey: targetChannel, sceneId: targetSceneId },
      });
      const recentList = (chatResp.data?.data ?? []) as ChatMessage[];
      setWorldMessages(mergeLocatedMessageIntoList(recentList, exact));
    } catch {
      setError("定位聊天消息失败。");
    }
  };

  const onGenerateAssistantResponse = async () => {
    if (!worldId || !selectedSceneId || !canUseAssistant) {
      return;
    }

    setAssistantGenerating(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/assistant/respond`, {
        sceneId: selectedSceneId,
        hours: 24,
        cardLimit: 8,
        messageLimit: 40,
        instruction: assistantInstruction.trim() || undefined,
      });

      const created = (resp.data?.data?.message ?? null) as ChatMessage | null;
      if (!created) {
        setError("AI 助手未返回有效消息。");
        return;
      }

      setFocusedWorldMessageId(created.id);
      setWorldChatChannel("SYSTEM");
      openTab("chat");
      const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
        params: { limit: 100, channelKey: "SYSTEM", sceneId: created.sceneId || selectedSceneId },
      });
      const recentList = (chatResp.data?.data ?? []) as ChatMessage[];
      setWorldMessages(mergeLocatedMessageIntoList(recentList, created));
      setAssistantInstruction("");
      setStageNotice("AI 助手已生成一条新的 SYSTEM 草稿。");
    } catch (err) {
      setError(resolveErrorMessage(err, "生成 AI 助手草稿失败"));
    } finally {
      setAssistantGenerating(false);
    }
  };

  const onMoveToken = (tokenId: string, x: number, y: number, ownerUserId?: string | null, characterId?: string | null) => {
    if (!worldId) {
      return;
    }
    if (!selectedSceneId) {
      setError("请先选择场景。");
      return;
    }

    socket.emit(
      SOCKET_EVENTS.sceneTokenMove,
      { worldId, sceneId: selectedSceneId, tokenId, x, y, ownerUserId, characterId },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "同步棋子位置失败。");
        }
      }
    );
  };

  const onCenterToken = () => {
    if (!user?.id) {
      return;
    }

    const tokenId = selectedCharacter ? `token:character:${selectedCharacter.id}` : getMyTokenId(user.id);
    const ownerUserId = selectedCharacter?.userId ?? user.id;
    onMoveToken(tokenId, 220, 150, ownerUserId, selectedCharacter?.id ?? null);
    setStageNotice("主棋子已移动回舞台中心。");
  };

  const onAddMyToken = () => {
    if (!user?.id) {
      return;
    }

    const tokenId = selectedCharacter ? `token:character:${selectedCharacter.id}` : getMyTokenId(user.id);
    const randomX = 60 + Math.floor(Math.random() * 480);
    const randomY = 50 + Math.floor(Math.random() * 220);
    onMoveToken(tokenId, randomX, randomY, selectedCharacter?.userId ?? user.id, selectedCharacter?.id ?? null);
    setStageNotice("已向当前舞台投放你的主棋子。");
  };

  const onCreateCharacter = async (event: FormEvent, overlayId?: string) => {
    event.preventDefault();
    if (!worldId || !newCharacterName.trim()) {
      return;
    }

    setCreatingCharacter(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/characters`, {
        name: newCharacterName,
        type: newCharacterType,
      });

      const created = resp.data?.data as CharacterItem;
      setCharacters((prev) => [...prev, created]);
      setSelectedCharacterId(created.id);
      if (overlayId) {
        setOverlays((prev) =>
          prev.map((item) =>
            item.id === overlayId && item.kind === "character"
              ? { ...item, characterId: created.id, mode: "view", title: `角色卡 · ${created.name}` }
              : item
          )
        );
      } else {
        openOverlay({ kind: "character", characterId: created.id, mode: "view", title: `角色卡 · ${created.name}` });
      }
      setNewCharacterName("");
      setNewCharacterType("PC");
      setStageNotice(`角色“${created.name}”已创建。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "创建角色失败"));
    } finally {
      setCreatingCharacter(false);
    }
  };

  const onSaveCharacter = async (event: FormEvent, characterId = selectedCharacterId) => {
    event.preventDefault();
    if (!worldId || !characterId) {
      return;
    }

    const hp = Math.max(0, Number(editHp) || 0);
    const mp = Math.max(0, Number(editMp) || 0);
    const level = Math.max(1, Number(editLevel) || 1);
    const className = editClassName.trim() || "unknown";

    setSavingCharacter(true);
    try {
      const resp = await http.put(`/worlds/${worldId}/characters/${characterId}`, {
        name: editCharacterName,
        stats: { hp, mp },
        snapshot: { level, class: className },
      });

      const updated = resp.data?.data as CharacterItem;
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setOverlays((prev) =>
        prev.map((item) =>
          item.kind === "character" && item.characterId === updated.id
            ? { ...item, title: `角色卡 · ${updated.name}` }
            : item
        )
      );
      setStageNotice(`角色“${updated.name}”已更新。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "保存角色失败"));
    } finally {
      setSavingCharacter(false);
    }
  };

  const onCreateScene = async (event: FormEvent) => {
    event.preventDefault();
    if (!worldId || !newSceneName.trim()) {
      return;
    }

    setCreatingScene(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/scenes`, { name: newSceneName });
      const created = resp.data?.data as SceneItem;
      setScenes((prev) => [...prev, created]);
      setSelectedSceneId(created.id);
      setNewSceneName("");
      setStageNotice(`新场景“${created.name}”已开辟。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "创建场景失败"));
    } finally {
      setCreatingScene(false);
    }
  };

  const onRenameScene = async (event: FormEvent) => {
    event.preventDefault();
    if (!worldId || !selectedSceneId || !renameSceneName.trim()) {
      return;
    }

    setRenamingScene(true);
    try {
      const resp = await http.put(`/worlds/${worldId}/scenes/${selectedSceneId}`, { name: renameSceneName });
      const updated = resp.data?.data as SceneItem;
      setScenes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setRenameSceneName(updated.name);
      setStageNotice(`场景已重命名为“${updated.name}”。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "重命名场景失败"));
    } finally {
      setRenamingScene(false);
    }
  };

  const onDeleteScene = async () => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    if (scenes.length <= 1) {
      setError("至少保留一个场景。");
      return;
    }

    setDeletingScene(true);
    try {
      await http.delete(`/worlds/${worldId}/scenes/${selectedSceneId}`);
      const sceneResp = await http.get(`/worlds/${worldId}/scenes`);
      const sceneItems = (sceneResp.data?.data ?? []) as SceneItem[];
      setScenes(sceneItems);
      if (sceneItems.length > 0) {
        setSelectedSceneId(sceneItems[0].id);
      }
      setStageNotice("当前场景已删除。");
    } catch (err) {
      setError(resolveErrorMessage(err, "删除场景失败"));
    } finally {
      setDeletingScene(false);
    }
  };

  const onMoveScene = async (direction: "UP" | "DOWN") => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    setSortingScene(true);
    try {
      const resp = await http.patch(`/worlds/${worldId}/scenes/${selectedSceneId}/sort`, { direction });
      const updatedScenes = (resp.data?.data ?? []) as SceneItem[];
      setScenes(updatedScenes);
      setStageNotice(`场景顺序已${direction === "UP" ? "上移" : "下移"}。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "调整场景顺序失败"));
    } finally {
      setSortingScene(false);
    }
  };

  const onSendWorldMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!worldId || !worldChatInput.trim()) {
      return;
    }
    if (!selectedSceneId) {
      setError("请先选择场景。");
      return;
    }
    if (!canSendCurrentChannel) {
      setError("SYSTEM 频道仅 GM 可发送消息。");
      return;
    }

    setWorldChatSending(true);
    const content = worldChatInput;
    setWorldChatInput("");

    socket.emit(
      SOCKET_EVENTS.worldMessageSend,
      { worldId, sceneId: selectedSceneId, content, channelKey: worldChatChannel },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "发送世界聊天失败。");
          setWorldChatInput(content);
        }
        setWorldChatSending(false);
      }
    );
  };

  const onCreateFateClock = async (event: FormEvent) => {
    event.preventDefault();
    if (!worldId || !canCreateClock || !fateClockName.trim()) {
      return;
    }

    try {
      const created = (await createEntity(worldId, "fateClocks", {
        name: fateClockName.trim(),
        description: selectedScene ? `${selectedScene.name} 的舞台命刻` : "",
        segments: Number(fateClockSegments) || 6,
        direction: fateClockDirection,
        visibleToPlayers: fateClockVisible,
        sceneId: selectedSceneId || undefined,
      })) as unknown as FateClockDefinition;

      setSelectedFateClockId(created.id);
      setFateClockName("");
      setFateClockSegments("6");
      setFateClockDirection("advance");
      setFateClockVisible(true);
      setShowFateCreateForm(false);
      setStageNotice(`命刻“${created.name}”已创建。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "创建命刻失败"));
    }
  };

  const onAdvanceClock = async (clockId: string, amount: number, reason: string) => {
    if (!worldId || !canAdvanceClock) {
      return;
    }

    try {
      await advanceFateClock(worldId, clockId, amount, reason || (amount > 0 ? "阶段推进" : "阶段回退"));
      setSelectedFateClockId(clockId);
      setStageNotice(`命刻已${amount > 0 ? "推进" : "回退"}${Math.abs(amount)} 格。`);
    } catch (err) {
      setError(resolveErrorMessage(err, "更新命刻失败"));
    }
  };

  const onDeleteClock = async (clockId: string) => {
    if (!worldId || !canDeleteClock) {
      return;
    }

    const target = fateClocks.find((clock) => clock.id === clockId);
    if (target && !window.confirm(`确认删除命刻“${target.name}”？`)) {
      return;
    }

    try {
      await deleteEntity(worldId, "fateClocks", clockId);
      setSelectedFateClockId((prev) => (prev === clockId ? null : prev));
      setStageNotice("命刻已删除。");
    } catch (err) {
      setError(resolveErrorMessage(err, "删除命刻失败"));
    }
  };

  const onSaveWorldMemberManage = async (
    memberUserId: string,
    payload: { worldDisplayName: string | null; role: WorldMemberManageRole; boundCharacterId: string | null }
  ) => {
    if (!worldId || !canManagePlayers) {
      return;
    }

    setSavingMemberUserId(memberUserId);
    try {
      const resp = await http.patch(`/worlds/${worldId}/members/${memberUserId}/manage`, payload);
      const updated = resp.data?.data as WorldMemberManageMember;
      setMemberManageData((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          members: prev.members.map((member) => (member.userId === updated.userId ? updated : member)),
        };
      });
      setWorldRoster((prev) =>
        prev.map((member) =>
          member.userId === updated.userId
            ? {
              ...member,
              worldDisplayName: updated.worldDisplayName,
              role: updated.role,
              boundCharacterId: updated.boundCharacterId,
              boundCharacterName: updated.boundCharacterName,
            }
            : member
        )
      );
      setStageNotice(`成员 ${updated.worldDisplayName || updated.username} 的世界权限已更新。`);
      void loadWorldRoster();
    } catch (err) {
      setMemberManageError(resolveErrorMessage(err, "更新玩家管理信息失败"));
    } finally {
      setSavingMemberUserId(null);
    }
  };

  const onSelectTokenFromBattle = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    openTab("battle");
  };

  const onHudSlotDrop = (slotIndex: number, data: { type: "ability" | "item"; id: string }) => {
    setHudConfig((prev) => ({
      ...prev,
      combatSlots: prev.combatSlots.map((slot) =>
        slot.index === slotIndex
          ? { ...slot, type: data.type, linkedId: data.id }
          : slot
      ),
    }));
    setStageNotice(`快捷栏 ${slotIndex + 1} 已绑定${data.type === "ability" ? "能力" : "物品"}。`);
  };

  const onHudSlotClick = (slot: HUDSlot) => {
    if (!slot.linkedId || slot.type === "empty") {
      return;
    }

    const label = resolveHudLabel(slot.type, slot.linkedId);
    setStageNotice(`已选中快捷栏：${label}`);
    if (slot.type === "ability") {
      setSelectedBattleAbilityId(slot.linkedId);
      if (selectedCharacterId) {
        setAbilityActorCharacterId(selectedCharacterId);
      }
      const targetCharacterId = selectedTokenId ? tokens[selectedTokenId]?.characterId ?? "" : "";
      if (targetCharacterId && targetCharacterId !== selectedCharacterId) {
        setAbilityTargetCharacterId(targetCharacterId);
      }
      openAbilityOverlay();
    } else {
      openTab("char");
    }
  };

  const onExecuteSelectedAbility = async () => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    if (!selectedBattleAbilityId || !abilityActorCharacterId) {
      setError("请先选择能力与施放者。");
      return;
    }

    setAbilityExecuting(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/scenes/${selectedSceneId}/abilities/${selectedBattleAbilityId}/execute`, {
        actorCharacterId: abilityActorCharacterId,
        targetCharacterIds: abilityTargetCharacterId ? [abilityTargetCharacterId] : [],
        automationMode: abilityAutomationMode,
        metadata: {
          source: "world-battle-panel",
          automationMode: abilityAutomationMode,
        },
      });

      const result = (resp.data?.data ?? null) as AbilityExecutionResult | null;
      if (!result) {
        throw new Error("ability execute returned empty result");
      }

      setAbilityExecutionResult(result);
      setCharacters((prev) =>
        prev.map((character) => {
          if (character.id === result.actor.id) {
            return {
              ...character,
              stats: result.actor.stats,
              snapshot: result.actor.snapshot,
            };
          }

          const target = result.targets.find((item) => item.id === character.id);
          if (!target) {
            return character;
          }

          return {
            ...character,
            stats: target.stats,
            snapshot: target.snapshot,
          };
        })
      );

      setStageNotice(
        `${result.actor.name} 执行了 ${result.ability.name}${result.targets.length > 0 ? `，目标：${result.targets.map((item) => item.name).join(" / ")}` : ""}。`
      );
    } catch (err) {
      setError(resolveErrorMessage(err, "执行能力失败"));
    } finally {
      setAbilityExecuting(false);
    }
  };

  const onShortcutHotbar = (slotIndex: number) => {
    const slot = hudConfig.combatSlots.find((item) => item.index === slotIndex);
    if (!slot) {
      return;
    }
    if (slot.type === "empty") {
      setStageNotice(`快捷栏 ${slotIndex + 1} 为空。`);
      return;
    }
    onHudSlotClick(slot);
  };

  const onContextAction = async (action: string, area: ContextMenuArea, targetId?: string) => {
    if ((area === "token" || area === "initiative-entry") && targetId) {
      setSelectedTokenId(targetId);
    }
    if (area === "fate-clock" && targetId) {
      setSelectedFateClockId(targetId);
    }
    if (area === "character-card" && targetId) {
      setSelectedCharacterId(targetId);
    }

    switch (action) {
      case "add-my-token":
        onAddMyToken();
        break;
      case "center-my-token":
      case "focus-token":
        onCenterToken();
        break;
      case "open-scene-tab":
        openTab("scene");
        break;
      case "open-chat-tab":
        openTab("chat");
        break;
      case "open-system-tab":
        openTab("system");
        break;
      case "open-character-from-token": {
        if (!targetId) {
          break;
        }
        const tokenRecord = tokens[targetId];
        if (tokenRecord?.characterId) {
          openCharacterOverlay(tokenRecord.characterId);
        }
        break;
      }
      case "open-character-from-initiative": {
        if (!targetId) {
          break;
        }
        const tokenRecord = tokens[targetId];
        if (tokenRecord?.characterId) {
          openCharacterOverlay(tokenRecord.characterId);
        } else {
          setStageNotice("这个先攻条目暂未绑定角色卡。");
        }
        break;
      }
      case "character-open-sheet":
        if (targetId) {
          openCharacterOverlay(targetId);
        }
        break;
      case "character-set-active":
        if (targetId) {
          setSelectedCharacterId(targetId);
          setStageNotice("已切换当前角色。");
        }
        break;
      case "character-create":
        openCharacterOverlay(undefined, "create");
        break;
      case "character-deploy-token": {
        if (!targetId || !user?.id) {
          break;
        }
        const character = characters.find((item) => item.id === targetId);
        if (!character) {
          break;
        }
        setSelectedCharacterId(character.id);
        const tokenId = `token:character:${character.id}`;
        const randomX = 80 + Math.floor(Math.random() * 420);
        const randomY = 70 + Math.floor(Math.random() * 220);
        onMoveToken(tokenId, randomX, randomY, character.userId ?? user.id, character.id);
        setStageNotice(`已将“${character.name}”投放到当前舞台。`);
        break;
      }
      case "open-ability-overlay":
        openAbilityOverlay();
        break;
      case "open-story-overlay":
        openStoryOverlay();
        break;
      case "combat-next-turn":
        if (canAdvanceTurn) {
          await onAdvanceSceneCombatTurn();
        }
        break;
      case "clock-advance":
        if (targetId) {
          await onAdvanceClock(targetId, 1, "右键菜单推进");
        }
        break;
      case "clock-retreat":
        if (targetId) {
          await onAdvanceClock(targetId, -1, "右键菜单回退");
        }
        break;
      case "clock-delete":
        if (targetId) {
          await onDeleteClock(targetId);
        }
        break;
      default:
        break;
    }
  };

  const onShortcutAction = async (action: string) => {
    switch (action) {
      case "toggleSystemPanel":
        setSystemPanelCollapsed((prev) => !prev);
        break;
      case "toggleHUD":
        setShowHUD((prev) => !prev);
        break;
      case "toggleChat":
        openTab("chat");
        break;
      case "openBattleTab":
        openTab("battle");
        break;
      case "openSceneTab":
        openTab("scene");
        break;
      case "openCharacterTab":
        openTab("char");
        break;
      case "openPackTab":
        openTab("collect");
        break;
      case "openSystemTab":
        openTab("system");
        break;
      case "openAbilityOverlay":
        openAbilityOverlay();
        break;
      case "openStoryOverlay":
        openStoryOverlay();
        break;
      case "openHotkeys":
        openHotkeyOverlay();
        break;
      case "centerOnToken":
        onCenterToken();
        break;
      case "endTurn":
        if (canAdvanceTurn) {
          await onAdvanceSceneCombatTurn();
        }
        break;
      case "toggleBattleBar":
        setShowBattleBar((prev) => !prev);
        break;
      case "advanceFateClock":
        if (currentFateClock) {
          await onAdvanceClock(currentFateClock.id, 1, "快捷键推进");
        }
        break;
      case "retreatFateClock":
        if (currentFateClock) {
          await onAdvanceClock(currentFateClock.id, -1, "快捷键回退");
        }
        break;
      case "toggleFullscreen":
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        break;
      case "quickSave":
        setStageNotice("当前世界为实时同步模式，无需手动存档。");
        break;
      case "escape":
        contextMenu.close();
        setOverlays((prev) => prev.slice(0, -1));
        setShowFateCreateForm(false);
        break;
      case "slot1":
      case "slot2":
      case "slot3":
      case "slot4":
      case "slot5":
      case "slot6":
      case "slot7":
      case "slot8":
      case "slot9":
      case "slot0": {
        const index = action === "slot0" ? 9 : Number(action.replace("slot", "")) - 1;
        onShortcutHotbar(index);
        break;
      }
      default:
        break;
    }
  };

  useKeyboardShortcuts({
    enabled: Boolean(worldId),
    customBindings: customKeyBindings,
    onAction: (action) => {
      void onShortcutAction(action);
    },
  });

  useEffect(() => {
    if (!worldId) {
      return;
    }
    setCustomKeyBindings(loadWorldHotkeyBindings(worldId, user?.id));
  }, [user?.id, worldId]);

  useEffect(() => {
    currentSceneIdRef.current = selectedSceneId;
  }, [selectedSceneId]);

  useEffect(() => {
    currentChannelRef.current = worldChatChannel;
  }, [worldChatChannel]);

  useEffect(() => {
    setHudConfig((prev) => {
      if (prev.combatSlots.some((slot) => slot.type !== "empty")) {
        return prev;
      }

      const seeds = [
        ...abilityRecords.slice(0, 6).map((item) => ({ type: "ability" as const, id: item.id })),
        ...itemRecords.slice(0, 4).map((item) => ({ type: "item" as const, id: item.id })),
      ];

      if (seeds.length === 0) {
        return prev;
      }

      return {
        ...prev,
        combatSlots: prev.combatSlots.map((slot, index) =>
          seeds[index] ? { ...slot, type: seeds[index].type, linkedId: seeds[index].id } : slot
        ),
      };
    });
  }, [abilityRecords, itemRecords]);

  useEffect(() => {
    return () => {
      resetWorldEntities();
    };
  }, [resetWorldEntities]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    const key = getWorldUnreadStorageKey(worldId, selectedSceneId, user?.id);
    const raw = localStorage.getItem(key);
    setWorldChatUnread(parseUnread(raw));
  }, [selectedSceneId, user?.id, worldId]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    const key = getWorldUnreadStorageKey(worldId, selectedSceneId, user?.id);
    localStorage.setItem(key, JSON.stringify(worldChatUnread));
  }, [selectedSceneId, user?.id, worldChatUnread, worldId]);

  useEffect(() => {
    if (!selectedCharacter) {
      setEditCharacterName("");
      setEditHp("0");
      setEditMp("0");
      setEditLevel("1");
      setEditClassName("");
      return;
    }

    setEditCharacterName(selectedCharacter.name);
    setEditHp(String(getRecordNumber(selectedCharacter.stats, "hp", 0)));
    setEditMp(String(getRecordNumber(selectedCharacter.stats, "mp", 0)));
    setEditLevel(String(getRecordNumber(selectedCharacter.snapshot, "level", 1)));
    setEditClassName(getRecordString(selectedCharacter.snapshot, "class", ""));
  }, [selectedCharacter]);

  useEffect(() => {
    if (!worldId) {
      navigate("/lobby");
      return;
    }

    void loadWorldBootstrap();
  }, [navigate, user?.id, worldId]);

  useEffect(() => {
    if (!worldId) {
      return;
    }

    void Promise.all([
      loadEntities(worldId, "abilities"),
      loadEntities(worldId, "items"),
      loadEntities(worldId, "fateClocks"),
    ]);
  }, [loadEntities, worldId]);

  useEffect(() => {
    if (!selectedBattleAbilityId && abilityRecords.length > 0) {
      setSelectedBattleAbilityId(String(abilityRecords[0].id));
    }
  }, [abilityRecords, selectedBattleAbilityId]);

  useEffect(() => {
    if (selectedCharacterId) {
      setAbilityActorCharacterId((prev) =>
        prev && characters.some((item) => item.id === prev)
          ? prev
          : selectedCharacterId
      );
      return;
    }

    if (!abilityActorCharacterId && characters.length > 0) {
      setAbilityActorCharacterId(characters[0].id);
    }
  }, [abilityActorCharacterId, characters, selectedCharacterId]);

  useEffect(() => {
    if (!abilityTargetCharacterId) {
      return;
    }

    const targetStillExists = characters.some((item) => item.id === abilityTargetCharacterId && item.id !== abilityActorCharacterId);
    if (!targetStillExists) {
      setAbilityTargetCharacterId("");
    }
  }, [abilityActorCharacterId, abilityTargetCharacterId, characters]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    void loadSceneVisualState();
    void loadSceneCombatState();
    void loadStoryEvents();
  }, [selectedSceneId, worldId]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    void loadWorldChatMessages();
  }, [selectedSceneId, worldChatChannel, worldId]);

  useEffect(() => {
    if (!token || !worldId) {
      return;
    }

    connectSocket(token);

    const onAck = () => {
      setSocketReady(true);
      socket.emit(SOCKET_EVENTS.worldJoin, { worldId }, (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "加入世界房间失败。");
        }
      });
    };

    const onConnect = () => {
      setSocketReady(true);
      socket.emit(SOCKET_EVENTS.worldJoin, { worldId });
    };

    const onDisconnect = () => {
      setSocketReady(false);
    };

    const onWorldMembersUpdate = (payload: { worldId: string; onlineCount: number; memberUserIds?: string[] }) => {
      if (payload.worldId === worldId) {
        setOnlineCount(payload.onlineCount);
        if (Array.isArray(payload.memberUserIds)) {
          setOnlineMemberUserIds(payload.memberUserIds);
        }
      }
    };

    const onWorldLatencyUpdate = (payload: {
      worldId: string;
      latencies: Array<{ userId: string; latencyMs: number; updatedAt: string }>;
    }) => {
      if (payload.worldId !== worldId) {
        return;
      }

      const nextMap: Record<string, WorldLatencyEntry> = {};
      for (const entry of payload.latencies ?? []) {
        nextMap[entry.userId] = {
          latencyMs: entry.latencyMs,
          updatedAt: entry.updatedAt,
        };
      }
      setWorldLatencyByUserId(nextMap);
    };

    const onTokenMoved = (payload: { worldId: string; sceneId?: string; tokens: TokenItem[] }) => {
      if (payload.worldId !== worldId) {
        return;
      }
      if (payload.sceneId && currentSceneIdRef.current && payload.sceneId !== currentSceneIdRef.current) {
        return;
      }

      setTokens((prev) => {
        const next = { ...prev };
        for (const item of payload.tokens ?? []) {
          next[item.tokenId] = item;
        }
        return next;
      });
    };

    const onWorldMessageNew = (message: ChatMessage) => {
      if (message.worldId !== worldId) {
        return;
      }
      if (currentSceneIdRef.current && message.sceneId !== currentSceneIdRef.current) {
        return;
      }

      const messageChannel = ((message.channelKey ?? "OOC") as WorldChatChannel);
      if (messageChannel !== currentChannelRef.current) {
        setWorldChatUnread((prev) => ({
          ...prev,
          [messageChannel]: prev[messageChannel] + 1,
        }));
        return;
      }

      setWorldMessages((prev) => {
        const next = [...prev, message];
        if (next.length > 100) {
          return next.slice(next.length - 100);
        }
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.connectionAck, onAck);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.worldMembersUpdate, onWorldMembersUpdate);
    socket.on(SOCKET_EVENTS.worldLatencyUpdate, onWorldLatencyUpdate);
    socket.on(SOCKET_EVENTS.sceneTokenMoved, onTokenMoved);
    socket.on(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);

    return () => {
      socket.emit(SOCKET_EVENTS.worldLeave, { worldId });
      socket.off(SOCKET_EVENTS.connectionAck, onAck);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.worldMembersUpdate, onWorldMembersUpdate);
      socket.off(SOCKET_EVENTS.worldLatencyUpdate, onWorldLatencyUpdate);
      socket.off(SOCKET_EVENTS.sceneTokenMoved, onTokenMoved);
      socket.off(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);
      disconnectSocket();
      // 离开世界 → 恢复到玩家个人偏好
      useThemeStore.getState().leaveWorld();
    };
  }, [token, worldId]);

  useEffect(() => {
    if (!worldId || !socketReady) {
      return;
    }

    let lastMeasuredLatency = 0;
    const probeLatency = () => {
      const startedAt = performance.now();
      socket.emit(
        SOCKET_EVENTS.worldLatencyProbe,
        { worldId, latencyMs: lastMeasuredLatency },
        (result: { ok: boolean; error?: string }) => {
          if (!result?.ok || !user?.id) {
            return;
          }

          lastMeasuredLatency = Math.max(0, Math.round(performance.now() - startedAt));
          setWorldLatencyByUserId((prev) => ({
            ...prev,
            [user.id]: {
              latencyMs: lastMeasuredLatency,
              updatedAt: new Date().toISOString(),
            },
          }));
        }
      );
    };

    probeLatency();
    const timer = window.setInterval(probeLatency, 10_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [socketReady, user?.id, worldId]);

  useEffect(() => {
    if (!worldId || !selectedSceneId || !socketReady) {
      return;
    }

    setTokens({});
    socket.emit(SOCKET_EVENTS.sceneSelect, { worldId, sceneId: selectedSceneId }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) {
        setError(result.error || "切换场景失败。");
      }
    });
  }, [selectedSceneId, socketReady, worldId]);

  useEffect(() => {
    if (!selectedSceneId) {
      setRenameSceneName("");
      return;
    }

    const nextScene = scenes.find((item) => item.id === selectedSceneId);
    setRenameSceneName(nextScene?.name ?? "");
  }, [scenes, selectedSceneId]);

  useEffect(() => {
    if (sceneCombatState?.status === "active" && sceneCombatState.participants.length > 0) {
      setShowBattleBar(true);
      return;
    }

    setShowBattleBar(false);
  }, [sceneCombatState?.participants.length, sceneCombatState?.status]);

  useEffect(() => {
    if (myRole !== "GM" && gmPlayerView) {
      setGmPlayerView(false);
    }
  }, [gmPlayerView, myRole]);

  useEffect(() => {
    if (!focusedWorldMessageId) {
      return;
    }

    const el = document.querySelector<HTMLElement>(`[data-world-message-id="${focusedWorldMessageId}"]`);
    if (!el) {
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedWorldMessageId, worldMessages]);

  useEffect(() => {
    if (visibleTabs.length === 0) {
      return;
    }

    if (!visibleTabs.some((tab) => tab.key === activeSystemTab)) {
      setActiveSystemTab(visibleTabs[0].key);
    }
  }, [activeSystemTab, visibleTabs]);

  useEffect(() => {
    if (myBoundTokenId) {
      setSelectedTokenId(myBoundTokenId);
    }
  }, [myBoundTokenId]);

  useEffect(() => {
    if (!visibleFateClocks.length) {
      setSelectedFateClockId(null);
      return;
    }

    if (!visibleFateClocks.some((clock) => clock.id === selectedFateClockId)) {
      setSelectedFateClockId(visibleFateClocks[0].id);
    }
  }, [selectedFateClockId, visibleFateClocks]);

  const renderHudGeneralTab = (tabId: string) => {
    if (tabId === "character") {
      return (
        <div className="world-stage-hud-general">
          <div className="world-system-window__list">
            <div className="world-system-window__item">
              <strong>{selectedCharacter?.name || "未绑定角色"}</strong>
              <p className="world-system-window__summary">
                {selectedCharacter
                  ? `${selectedCharacter.type} · Lv.${getRecordNumber(selectedCharacter.snapshot, "level", 1)} · ${getRecordString(selectedCharacter.snapshot, "class", "未知职业")}`
                  : "从右侧角色页绑定你的主角色。"}
              </p>
            </div>
            <div className="world-system-window__item">HP {hudResources.hp}/{hudResources.maxHp}</div>
            <div className="world-system-window__item">MP {hudResources.mp}/{hudResources.maxMp}</div>
          </div>
        </div>
      );
    }

    if (tabId === "inventory") {
      return (
        <div className="world-stage-hud-general">
          <div className="world-system-window__list">
            {itemRecords.slice(0, 6).map((item) => (
              <div className="world-system-window__item" key={item.id}>{(item as { name?: string }).name || "未命名物品"}</div>
            ))}
            {itemRecords.length === 0 ? <div className="world-system-window__item">当前世界尚未录入物品。</div> : null}
          </div>
        </div>
      );
    }

    if (tabId === "abilities") {
      return (
        <div className="world-stage-hud-general">
          <div className="world-system-window__list">
            {abilityRecords.slice(0, 6).map((ability) => (
              <div className="world-system-window__item" key={ability.id}>{(ability as { name?: string }).name || "未命名能力"}</div>
            ))}
            {abilityRecords.length === 0 ? <div className="world-system-window__item">当前世界尚未录入能力。</div> : null}
          </div>
        </div>
      );
    }

    return (
      <div className="world-stage-hud-general">
        <div className="world-system-window__list">
          {storyEventCards.slice(0, 4).map((card) => (
            <div className="world-system-window__item" key={card.id}>{card.content}</div>
          ))}
          {storyEventCards.length === 0 ? <div className="world-system-window__item">暂无新的事件卡片。</div> : null}
        </div>
      </div>
    );
  };

  const renderChatTab = () => (
    <div className="sys-tab-pane chat-pane active">
      <div className="chat-channel-bar">
        <button
          type="button"
          className={`sc-btn ${worldChatChannel === "OOC" ? "sc-btn--gold" : ""}`.trim()}
          onClick={() => setWorldChatChannel("OOC")}
        >
          全 体
        </button>
        <button
          type="button"
          className={`sc-btn ${worldChatChannel === "IC" ? "sc-btn--gold" : ""}`.trim()}
          onClick={() => setWorldChatChannel("IC")}
        >
          队 伍
        </button>
        <button
          type="button"
          className={`sc-btn ${worldChatChannel === "SESSION" ? "sc-btn--gold" : ""}`.trim()}
          onClick={() => setWorldChatChannel("SESSION")}
        >
          私 信
        </button>
        <button
          type="button"
          className={`sc-btn ${worldChatChannel === "SYSTEM" ? "sc-btn--gold" : ""}`.trim()}
          onClick={() => setWorldChatChannel("SYSTEM")}
        >
          旁 白
        </button>
      </div>
      <div className="chat-stream">
        <ul className="text-xs">
          {worldMessages.length === 0 ? (
            <li style={{ color: "var(--sc-ink-mute)", textAlign: "center", padding: "20px 0" }}>
              当前频道还没有消息。
            </li>
          ) : null}
          {worldMessages
            .filter((msg) => (msg.channelKey || "OOC") === worldChatChannel)
            .slice(-20)
            .map((msg) => (
              <li key={msg.id} data-world-message-id={msg.id}>
                <b style={{ color: "var(--sc-primary-deep)" }}>{msg.fromUser.displayName || msg.fromUser.username || "未知"}</b>
                <span style={{ color: "var(--sc-ink-mute)" }}> · {new Date(msg.createdAt).toLocaleTimeString()}</span>
                <div style={{ color: "var(--sc-ink-soft)", marginTop: "2px" }}>{msg.content}</div>
              </li>
            ))}
        </ul>
      </div>
      <div className="chat-input-bar">
        <input
          className="sc-input"
          placeholder="说点什么…"
          value={worldChatInput}
          onChange={(e) => setWorldChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSendWorldMessage(e as unknown as FormEvent);
            }
          }}
        />
        <button
          type="button"
          className="sc-btn sc-btn--gold"
          onClick={(e) => void onSendWorldMessage(e as unknown as FormEvent)}
          disabled={worldChatSending || !canSendCurrentChannel}
        >
          {worldChatSending ? "发送中..." : "发 送"}
        </button>
      </div>
    </div>
  );

  const renderBattleTab = () => (
    <div className="sys-tab-pane">
      <div className="sys-section">
        <h5>先 攻 顺 序</h5>
        {sceneCombatState?.participants && sceneCombatState.participants.length > 0 ? (
          <ul className="text-xs space-y-1">
            {sceneCombatState.participants.map((participant, index) => {
              const isCurrent = index === sceneCombatState.turnIndex;
              return (
                <li
                  key={participant.tokenId}
                  className="flex justify-between items-center"
                  style={{
                    background: isCurrent ? "rgba(245,166,35,0.15)" : "transparent",
                    borderRadius: "4px",
                    padding: "4px 6px",
                  }}
                >
                  <span>
                    {isCurrent ? <b style={{ color: "var(--sc-accent-deep)" }}>▶ {participant.name}</b> : participant.name}
                  </span>
                  <span className="pc-lv">{participant.initiative}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-xs" style={{ color: "var(--sc-ink-mute)", padding: "8px 0" }}>
            当前场景没有战斗进行中。
          </div>
        )}
      </div>
      <div className="sys-section">
        <h5>回 合 操 作</h5>
        <div className="sys-row mb-2">
          <button
            type="button"
            className="sc-btn sc-btn--gold"
            onClick={() => void onAdvanceSceneCombatTurn()}
            disabled={!canAdvanceTurn || sceneCombatState?.status !== "active"}
          >
            下 一 回 合
          </button>
          <button type="button" className="sc-btn" disabled={!canManageCombat}>
            回 合 终 止
          </button>
        </div>
        <div className="sys-row">
          <button type="button" className="sc-btn" disabled={!canManageCombat}>
            重 投 先 攻
          </button>
          <button type="button" className="sc-btn sc-btn--danger" disabled={!canManageCombat}>
            结 束 战 斗
          </button>
        </div>
      </div>
      <div className="sys-section">
        <h5>本 回 合 状 态</h5>
        <div className="text-xs" style={{ color: "var(--sc-ink-soft)" }}>
          回合数：<b>{sceneCombatState?.round ?? 0}</b> · 已用动作：<b>移动 + 标准</b> · 剩余：
          <b style={{ color: "var(--sc-success)" }}>附赠动作 ×1</b>
        </div>
      </div>
    </div>
  );

  const renderAbilityExecutionPanel = () => (
      <AbilityExecutionPanel
        abilities={abilityRecords as Array<{
          id: string;
          name: string;
          category?: unknown;
          actionType?: unknown;
          activation?: unknown;
          description?: unknown;
          sourceName?: unknown;
          tags?: unknown;
          resourceCosts?: unknown;
          effects?: unknown;
        }>}
        actorCharacters={abilityActorCharacters}
        targetCharacters={characters}
        selectedAbilityId={selectedBattleAbilityId}
        actorCharacterId={abilityActorCharacterId}
        targetCharacterId={abilityTargetCharacterId}
        automationMode={abilityAutomationMode}
        executing={abilityExecuting}
        latestResult={abilityExecutionResult}
        canExecuteAction={canExecuteAbility}
        readOnlyHint="旁观者只能查看能力说明和最近结算结果，不能代替角色发起动作。"
        onAbilityChange={setSelectedBattleAbilityId}
        onActorChange={setAbilityActorCharacterId}
        onTargetChange={setAbilityTargetCharacterId}
        onAutomationModeChange={setAbilityAutomationMode}
        onExecute={() => {
          void onExecuteSelectedAbility();
        }}
      />
  );

  const renderStoryEventPanel = () => (
      <StoryEventPanel
        myRole={role}
        loading={storyEventLoading}
        events={storyEvents}
        cards={storyEventCards}
        searchKeyword={storySearchKeyword}
        searchEventStatus={storySearchEventStatus}
        searchChannelKey={storySearchChannelKey}
        searchHours={storySearchHours}
        searching={storySearching}
        searchResult={storySearchResult}
        onRefresh={() => {
          void loadStoryEvents();
        }}
        onCreateEvent={(payload) => {
          void onCreateStoryEvent(payload);
        }}
        onAddOption={(eventId, payload) => {
          void onAddStoryEventOption(eventId, payload);
        }}
        onSubmitCheck={(eventId, optionId, payload) => {
          void onSubmitStoryEventCheck(eventId, optionId, payload);
        }}
        onResolveEvent={(eventId, payload) => {
          void onResolveStoryEvent(eventId, payload);
        }}
        onCreateNarrativeRequest={(eventId, payload) => {
          void onCreateStoryNarrativeRequest(eventId, payload);
        }}
        onDecideNarrativeRequest={(eventId, requestId, payload) => {
          void onDecideStoryNarrativeRequest(eventId, requestId, payload);
        }}
        onSearchKeywordChange={setStorySearchKeyword}
        onSearchEventStatusChange={setStorySearchEventStatus}
        onSearchChannelKeyChange={setStorySearchChannelKey}
        onSearchHoursChange={setStorySearchHours}
        onSearch={() => {
          void onSearchStoryEventContext();
        }}
        onClearSearch={onClearStoryEventSearch}
        onLocateMessage={(messageId, channelKey) => {
          void onLocateWorldMessage(messageId, channelKey);
        }}
        focusedEventId={focusedStoryEventId}
        onLocateEvent={onLocateStoryEvent}
      />
  );

  const renderCharacterSheetOverlay = (activeOverlay: Extract<OverlayState, { kind: "character" }>) => {
    const overlayCharacter =
      activeOverlay.characterId
        ? characters.find((item) => item.id === activeOverlay.characterId) ?? selectedCharacter
        : selectedCharacter;
    const canEditOverlayCharacter = Boolean(
      overlayCharacter &&
        (hasPermission(role, PERMISSIONS.CHARACTER_EDIT_ALL) ||
          (hasPermission(role, PERMISSIONS.CHARACTER_EDIT_OWN) && overlayCharacter.userId === user?.id))
    );

    return (
      <div className="world-character-sheet-overlay" data-world-component="character-sheet-overlay" data-world-layer="overlay">
        {activeOverlay.mode === "create" ? (
          <form className="world-character-sheet-overlay__form" onSubmit={(event) => void onCreateCharacter(event, activeOverlay.id)}>
            <div className="world-stage-overlay-toolbar">
              <p className="world-system-window__summary">创建一个新的 PC 或 NPC。详情字段创建后可继续在角色卡中编辑。</p>
            </div>
            <label>
              <span>角色名称</span>
              <input value={newCharacterName} onChange={(event) => setNewCharacterName(event.target.value)} placeholder="角色名称" required />
            </label>
            <label>
              <span>类型</span>
              <select value={newCharacterType} onChange={(event) => setNewCharacterType(event.target.value as "PC" | "NPC")}>
                <option value="PC">PC</option>
                {canCreateNpc ? <option value="NPC">NPC</option> : null}
              </select>
            </label>
            <button type="submit" className="world-system-action-btn" disabled={creatingCharacter || !canCreateCharacter}>
              {creatingCharacter ? "创建中..." : "创建角色"}
            </button>
          </form>
        ) : overlayCharacter ? (
          <>
            <section className="world-character-sheet-overlay__summary">
              <div>
                <strong>{overlayCharacter.name}</strong>
                <p>
                  {overlayCharacter.type} · Lv.{getRecordNumber(overlayCharacter.snapshot, "level", 1)} ·{" "}
                  {getRecordString(overlayCharacter.snapshot, "class", "未知职业")}
                </p>
              </div>
              <div className="world-character-sheet-overlay__actions">
                <button type="button" className="world-stage-header-btn" onClick={() => setSelectedCharacterId(overlayCharacter.id)}>
                  设为当前角色
                </button>
                <button
                  type="button"
                  className="world-stage-header-btn"
                  onClick={() => {
                    setSelectedCharacterId(overlayCharacter.id);
                    onMoveToken(`token:character:${overlayCharacter.id}`, 220, 150, overlayCharacter.userId ?? user?.id ?? null, overlayCharacter.id);
                  }}
                  disabled={!user?.id}
                >
                  投放到舞台
                </button>
              </div>
            </section>

            <div className="world-character-sheet-overlay__stats">
              <span>HP {getRecordNumber(overlayCharacter.stats, "hp", 0)}</span>
              <span>MP {getRecordNumber(overlayCharacter.stats, "mp", 0)}</span>
              <span>AC {getRecordNumber(overlayCharacter.snapshot, "ac", 10)}</span>
              <span>体力 {getRecordNumber(overlayCharacter.stats, "stamina", 0)}</span>
            </div>

            {canEditOverlayCharacter ? (
              <form
                className="world-character-sheet-overlay__form"
                onSubmit={(event) => {
                  setSelectedCharacterId(overlayCharacter.id);
                  void onSaveCharacter(event, overlayCharacter.id);
                }}
              >
                <label>
                  <span>角色名称</span>
                  <input value={editCharacterName} onChange={(event) => setEditCharacterName(event.target.value)} placeholder="角色名称" required />
                </label>
                <div className="world-character-sheet-overlay__grid">
                  <label>
                    <span>HP</span>
                    <input type="number" min={0} value={editHp} onChange={(event) => setEditHp(event.target.value)} />
                  </label>
                  <label>
                    <span>MP</span>
                    <input type="number" min={0} value={editMp} onChange={(event) => setEditMp(event.target.value)} />
                  </label>
                  <label>
                    <span>等级</span>
                    <input type="number" min={1} value={editLevel} onChange={(event) => setEditLevel(event.target.value)} />
                  </label>
                  <label>
                    <span>职业</span>
                    <input value={editClassName} onChange={(event) => setEditClassName(event.target.value)} placeholder="职业" />
                  </label>
                </div>
                <button type="submit" className="world-system-action-btn" disabled={savingCharacter}>
                  {savingCharacter ? "保存中..." : "保存角色详情"}
                </button>
              </form>
            ) : (
              <p className="world-stage-readonly-note">当前身份只能查看这张角色卡，不能改写角色数据。</p>
            )}
          </>
        ) : (
          <div className="world-stage-empty">请选择一个角色，或使用“创建角色”入口新建角色卡。</div>
        )}
      </div>
    );
  };

  const renderSceneTab = () => {
    const tabKey = "scene" as SystemPanelTabKey;
    const currentTreeData = treeData[tabKey] || getDefaultTreeData(tabKey);

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={getDefaultToolbarButtons(tabKey)}
        treeData={currentTreeData}
        footerNote="左键点击场景切换；右键场景 → 场景配置弹窗（网格 / 光照 / 迷雾 / 背景）"
        onTreeNodeClick={(node) => {
          console.log("Scene node clicked:", node);
          // TODO: 实现场景切换逻辑
        }}
        onTreeNodeToggle={(nodeId) => {
          setTreeCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
          setTreeData((prev) => ({
            ...prev,
            [tabKey]: toggleTreeNode(currentTreeData, nodeId),
          }));
        }}
      />
    );
  };

  const renderCharacterTab = () => {
    const tabKey = "char" as SystemPanelTabKey;
    const currentTreeData = treeData[tabKey] || getDefaultTreeData(tabKey);

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={getDefaultToolbarButtons(tabKey)}
        treeData={currentTreeData}
        onTreeNodeClick={(node) => {
          console.log("Character node clicked:", node);
          // TODO: 实现角色选择逻辑
        }}
        onTreeNodeToggle={(nodeId) => {
          setTreeCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
          setTreeData((prev) => ({
            ...prev,
            [tabKey]: toggleTreeNode(currentTreeData, nodeId),
          }));
        }}
      />
    );
  };

  const renderAbilityTab = () => {
    const tabKey = "ability" as SystemPanelTabKey;
    const currentTreeData = buildAbilityLibraryTree(abilityRecords, treeCollapsedNodes);
    const abilityToolbarButtons = [
      {
        label: canEditEntityType(role, "abilities") ? "新 建 能 力" : "查 看 能 力",
        variant: "gold" as const,
        onClick: () => openEntityOverlay("abilities", "能力模板库"),
      },
      {
        label: "能 力 库",
        onClick: () => openEntityOverlay("abilities", "能力模板库"),
      },
      {
        label: "种 族",
        onClick: () => openEntityOverlay("races", "种族模板库"),
      },
      {
        label: "职 业",
        onClick: () => openEntityOverlay("professions", "职业模板库"),
      },
    ];

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={abilityToolbarButtons}
        treeData={currentTreeData}
        footerNote="双击条目在能力库里编辑；种族、职业可以挂接这些能力。"
        onTreeNodeClick={(node) => {
          if (node.type === "leaf") {
            openEntityOverlay("abilities", "能力模板库");
          }
        }}
        onTreeNodeToggle={(nodeId) => {
          setTreeCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
        }}
      />
    );
  };

  const renderItemTab = () => {
    const tabKey = "item" as SystemPanelTabKey;
    const currentTreeData = treeData[tabKey] || getDefaultTreeData(tabKey);

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={getDefaultToolbarButtons(tabKey)}
        treeData={currentTreeData}
        onTreeNodeClick={(node) => {
          console.log("Item node clicked:", node);
        }}
        onTreeNodeToggle={(nodeId) => {
          setTreeCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
          setTreeData((prev) => ({
            ...prev,
            [tabKey]: toggleTreeNode(currentTreeData, nodeId),
          }));
        }}
      />
    );
  };

  const renderRandomTab = () => {
    const tabKey = "random" as SystemPanelTabKey;
    const currentTreeData = treeData[tabKey] || getDefaultTreeData(tabKey);

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={getDefaultToolbarButtons(tabKey)}
        treeData={currentTreeData}
        onTreeNodeClick={(node) => {
          console.log("Random node clicked:", node);
        }}
        onTreeNodeToggle={(nodeId) => {
          setTreeCollapsedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
              next.delete(nodeId);
            } else {
              next.add(nodeId);
            }
            return next;
          });
          setTreeData((prev) => ({
            ...prev,
            [tabKey]: toggleTreeNode(currentTreeData, nodeId),
          }));
        }}
      />
    );
  };

  const renderMusicTab = () => {
    const tabKey = "music" as SystemPanelTabKey;
    const musicToolbarButtons = [
      {
        label: "🎵 导 入 音 乐",
        variant: "gold" as const,
        onClick: () => console.log("Import music"),
      },
      {
        label: "新 建 歌 单",
        onClick: () => console.log("New playlist"),
      },
      {
        label: "导 出 歌 单",
        onClick: () => console.log("Export playlist"),
      },
    ];

    const musicTreeData: TreeNode[] = [
      {
        id: "music-explore",
        type: "dir",
        label: "探 索",
        icon: "📁",
        meta: "4",
        collapsed: false,
        children: [
          { id: "music-1", label: "风之旋律", icon: "🎵", meta: "3:24", type: "leaf" },
          { id: "music-2", label: "静谧之夜", icon: "🎵", meta: "2:46", type: "leaf" },
        ],
      },
      {
        id: "music-battle",
        type: "dir",
        label: "战 斗",
        icon: "📁",
        meta: "3",
        collapsed: false,
        children: [
          { id: "music-3", label: "王都风暴", icon: "🎵", meta: "4:08", type: "leaf" },
        ],
      },
    ];

    return (
      <div className="sys-tab-pane">
        <div className="res-toolbar" style={{ display: "flex", gap: "4px", padding: "6px 8px" }}>
          {musicToolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className={`sc-btn ${btn.variant === "gold" ? "sc-btn--gold" : ""}`.trim()}
              onClick={btn.onClick}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="sys-section">
          <h5>正 在 播 放</h5>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "6px",
                background: "var(--sc-grad-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              🎵
            </span>
            <div style={{ flex: 1 }}>
              <b style={{ color: "var(--sc-primary-deep)" }}>风 之 旋 律</b>
              <div style={{ fontSize: "10px", color: "var(--sc-ink-mute)" }}>环境 · 探索</div>
            </div>
            <button type="button" className="sc-btn">
              ⏯
            </button>
          </div>
          <div style={{ height: "4px", background: "var(--sc-line)", borderRadius: "2px", marginTop: "8px" }}>
            <div style={{ width: "34%", height: "100%", background: "var(--sc-accent)", borderRadius: "2px" }}></div>
          </div>
          <div className="sys-row" style={{ marginTop: "8px" }}>
            <button type="button" className="sc-btn sc-btn--gold" title="列表顺序播放">
              列 表
            </button>
            <button type="button" className="sc-btn" title="列表循环">
              🔁 列表循环
            </button>
            <button type="button" className="sc-btn" title="随机播放">
              🔀 随 机
            </button>
            <button type="button" className="sc-btn" title="单曲循环">
              🔂 单 曲
            </button>
          </div>
        </div>
        <SystemPanelContent
          activeTab={tabKey}
          toolbarButtons={[]}
          treeData={musicTreeData}
          onTreeNodeClick={(node) => {
            console.log("Music node clicked:", node);
          }}
          onTreeNodeToggle={(nodeId) => {
            console.log("Music node toggled:", nodeId);
          }}
        />
      </div>
    );
  };

  const renderCollectTab = () => {
    const tabKey = "collect" as SystemPanelTabKey;
    const collectToolbarButtons = [
      {
        label: "📤 导 出 本 世 界",
        variant: "gold" as const,
        onClick: () => console.log("Export world"),
      },
      {
        label: "📥 导 入 合 集",
        variant: "blue" as const,
        onClick: () => console.log("Import collection"),
      },
      {
        label: "新 建 目 录",
        onClick: () => console.log("New directory"),
      },
    ];

    const collectTreeData: TreeNode[] = [
      {
        id: "collect-world-a",
        type: "dir",
        label: "A 世 界 · 薇 藤 谷",
        icon: "📦",
        meta: "已导入",
        tagType: "ok",
        collapsed: false,
        children: [
          {
            id: "collect-a-scenes",
            type: "dir",
            label: "场 景",
            icon: "🏞️",
            meta: "8",
            collapsed: false,
            children: [
              { id: "collect-a-scene-1", label: "薇藤口入", icon: "🏞️", type: "leaf" },
              { id: "collect-a-scene-2", label: "隐修者之庐", icon: "🏞️", type: "leaf" },
            ],
          },
          {
            id: "collect-a-chars",
            type: "dir",
            label: "角 色",
            icon: "👥",
            meta: "12",
            collapsed: true,
            children: [],
          },
          {
            id: "collect-a-items",
            type: "dir",
            label: "物 品",
            icon: "⚔️",
            meta: "23",
            collapsed: true,
            children: [],
          },
          {
            id: "collect-a-abilities",
            type: "dir",
            label: "能 力",
            icon: "📜",
            meta: "9",
            collapsed: true,
            children: [],
          },
        ],
      },
      {
        id: "collect-world-b",
        type: "dir",
        label: "B 世 界 · 冰 原 传 说",
        icon: "📦",
        meta: "已导入",
        tagType: "ok",
        collapsed: false,
        children: [
          {
            id: "collect-b-scenes",
            type: "dir",
            label: "场 景",
            icon: "🏞️",
            meta: "5",
            collapsed: true,
            children: [],
          },
          {
            id: "collect-b-items",
            type: "dir",
            label: "物 品",
            icon: "⚔️",
            meta: "14",
            collapsed: true,
            children: [],
          },
        ],
      },
      {
        id: "collect-snapshot",
        type: "dir",
        label: "本 世 界 · 快 照",
        icon: "📁",
        meta: "3",
        collapsed: true,
        children: [],
      },
    ];

    return (
      <SystemPanelContent
        activeTab={tabKey}
        toolbarButtons={collectToolbarButtons}
        treeData={collectTreeData}
        footerNote="导出时可选择「场景 / 角色 / 能力 / 物品 / 随机」子资产；导入后作为顶级目录（可重命名）挂在下方。"
        onTreeNodeClick={(node) => {
          console.log("Collection node clicked:", node);
        }}
        onTreeNodeToggle={(nodeId) => {
          console.log("Collection node toggled:", nodeId);
        }}
      />
    );
  };

  const renderPackTab = () => (
    <div className="world-stage-tab-scroll world-stage-tab-scroll--system">
      <CollectionPackPanel worldId={worldId} canEdit={canEditEntityType(role, "abilities")} />
      <div className="world-system-window__list">
        <div className="world-system-window__item">能力 {abilityRecords.length} 条</div>
        <div className="world-system-window__item">物品 {itemRecords.length} 条</div>
        <div className="world-system-window__item">命刻 {fateClocks.length} 条</div>
      </div>
    </div>
  );

  // 辅助函数：切换目录树节点的折叠状态
  const toggleTreeNode = (nodes: TreeNode[], targetId: string): TreeNode[] => {
    return nodes.map((node) => {
      if (node.id === targetId) {
        return { ...node, collapsed: !node.collapsed };
      }
      if (node.children) {
        return { ...node, children: toggleTreeNode(node.children, targetId) };
      }
      return node;
    });
  };

  const themeEffective = useThemeStore((s) => s.effective);
  const themeUserPref = useThemeStore((s) => s.userPreference);
  const themeWorldPack = useThemeStore((s) => s.worldPack);
  const themeWorldForced = useThemeStore((s) => s.worldPackForcedByGM);
  const themeSetUserPref = useThemeStore((s) => s.setUserPreference);
  const themeEnterWorld = useThemeStore((s) => s.enterWorld);

  const onSaveWorldThemePack = async (input: { themePack: ThemePackId | null; forced: boolean }) => {
    if (!worldId) return;
    // 立即在客户端预览（即使后端 API 尚未连通也可看到效果）
    themeEnterWorld({ worldPack: input.themePack, forcedByGM: !!(input.themePack && input.forced) });
    try {
      await http.patch(`/worlds/${worldId}/theme`, {
        themePack: input.themePack,
        themePackForcedByGM: input.forced,
      });
    } catch (err) {
      // 后端尚未实装时静默失败：本地 store 已生效，刷新会回滚。
      console.warn("[theme] 世界级风格保存失败（后端可能尚未实装）", err);
    }
  };

  const renderThemePickerOverlay = () => (
    <ThemePickerOverlay
      effective={themeEffective}
      userPreference={themeUserPref}
      worldPack={themeWorldPack}
      worldPackForcedByGM={themeWorldForced}
      isGm={isGm}
      onPickUserPack={themeSetUserPref}
      onSaveWorldPack={isGm ? onSaveWorldThemePack : undefined}
    />
  );

  const renderSystemTab = () => (
    <div className="world-system-config-page">
      <div className="world-system-section-title">
        <strong>世界设置</strong>
        <span>{worldName} · {selectedScene?.name || "未选中场景"} · 在线 {onlineCount}</span>
      </div>

      <section className="world-system-rule-query" aria-label="规则查询">
        <div className="world-system-rule-query__head">
          <strong>规则查询</strong>
          <span>查询当前世界公开规则资料。玩家只在这里查规则，不会碰到 GM 管理入口。</span>
        </div>
        <div className="world-system-rule-query__grid">
          {canViewEntityType(role, "abilities") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("abilities", "能力规则查询")}>
              <span className="world-system-action-btn__title">能力规则</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "items") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("items", "装备物品查询")}>
              <span className="world-system-action-btn__title">装备物品</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "races") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("races", "种族血脉查询")}>
              <span className="world-system-action-btn__title">种族血脉</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "professions") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("professions", "职业与天赋查询")}>
              <span className="world-system-action-btn__title">职业天赋</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "backgrounds") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("backgrounds", "背景查询")}>
              <span className="world-system-action-btn__title">背景资料</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "decks") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("decks", "牌组查询")}>
              <span className="world-system-action-btn__title">牌组</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          {canViewEntityType(role, "randomTables") ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={() => openEntityOverlay("randomTables", "随机表查询")}>
              <span className="world-system-action-btn__title">随机表</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={openHotkeyOverlay}>
            <span className="world-system-action-btn__title">快捷键设置</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn world-system-action-btn--query" onClick={openThemeOverlay}>
            <span className="world-system-action-btn__title">设计风格</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
        </div>
      </section>

      <p className="world-system-visibility-note">
        常用快捷键：{shortcutPreview || "尚未设置。你可以打开快捷键设置录制键盘、鼠标或组合键。"}
      </p>

      {isGm ? (
        <>
          <div className="world-system-section-title world-system-section-title--help">
            <strong>GM 控制台</strong>
            <span>权限、模板、命刻、资源包与世界模块</span>
          </div>

          <button type="button" className="world-system-action-btn world-system-action-btn--debug" onClick={() => setGmPlayerView(true)}>
            <span className="world-system-action-btn__title">进入玩家视角</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>

          {canManagePlayers ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--setting" onClick={() => void openPlayerOverlay()}>
              <span className="world-system-action-btn__title">玩家权限管理</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}

          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("abilities", "能力模板库")}>
            <span className="world-system-action-btn__title">能力模板库</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("items", "物品与装备库")}>
            <span className="world-system-action-btn__title">物品与装备库</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("races", "种族模板库")}>
            <span className="world-system-action-btn__title">种族模板库</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("professions", "职业模板库")}>
            <span className="world-system-action-btn__title">职业模板库</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("backgrounds", "背景模板库")}>
            <span className="world-system-action-btn__title">背景模板库</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("fateClocks", "命刻编辑器")}>
            <span className="world-system-action-btn__title">命刻编辑器</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("decks", "卡组编辑器")}>
            <span className="world-system-action-btn__title">卡组编辑器</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>
          <button type="button" className="world-system-action-btn" onClick={() => openEntityOverlay("randomTables", "随机表编辑器")}>
            <span className="world-system-action-btn__title">随机表编辑器</span>
            <span className="world-system-action-btn__arrow">›</span>
          </button>

          {visibleTabs.some((tab) => tab.key === "collect") ? (
            <button type="button" className="world-system-action-btn" onClick={() => openTab("collect")}>
              <span className="world-system-action-btn__title">资源包导入导出</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}

          <div className="world-system-section-title world-system-section-title--help">
            <strong>运行状态</strong>
            <span>{runtimeState?.status || "未加载"} · {runtimeLoading ? "刷新中" : "就绪"}</span>
          </div>

          <p className="world-system-window__summary">
            {runtimeState
              ? `世界引擎状态：${runtimeState.status}。${runtimeState.message || "当前没有新的异常摘要。"}`
              : "运行状态尚未拉取。"}
          </p>

          <div className="world-extension-pack-pane">
            <div className="world-extension-pack-grid">
              {runtimeModules.map((module) => {
                const toggling = togglingModuleKey === module.key;
                return (
                  <article className="world-extension-pack-card" key={module.key}>
                    <div className="world-extension-pack-card__head">
                      <div className="world-extension-pack-card__title-wrap">
                        <strong>{module.displayName}</strong>
                        <span>{module.key}</span>
                      </div>
                      <label className="world-extension-pack-card__toggle">
                        <span>{module.status === "enabled" ? "已启用" : "未启用"}</span>
                        <input
                          type="checkbox"
                          checked={module.status === "enabled"}
                          disabled={!canManageModules || toggling}
                          onChange={() => {
                            void onToggleRuntimeModule(module);
                          }}
                        />
                      </label>
                    </div>
                    <p className="world-extension-pack-card__desc">
                      {module.dependencies.length > 0 ? `依赖：${module.dependencies.join(" / ")}` : "独立模块，可单独启用。"}
                    </p>
                    <div className="world-extension-pack-card__meta">
                      <span>{toggling ? "切换中..." : `更新于 ${new Date(module.updatedAt).toLocaleString()}`}</span>
                    </div>
                    <div className="world-extension-pack-card__foot">可直接在当前世界开关。</div>
                  </article>
                );
              })}
              {runtimeModules.length === 0 && !moduleLoading ? <div className="world-system-window__empty">暂无可用模块。</div> : null}
            </div>
          </div>
        </>
      ) : (
        <>
          {isGmPlayerView ? (
            <button type="button" className="world-system-action-btn world-system-action-btn--debug" onClick={() => setGmPlayerView(false)}>
              <span className="world-system-action-btn__title">退出玩家视角</span>
              <span className="world-system-action-btn__arrow">›</span>
            </button>
          ) : null}
          <p className="world-system-visibility-note">当前身份只开放公开规则查询。需要修改世界模板、资源包或玩家权限时，请交给 GM 操作。</p>
        </>
      )}

      <button type="button" className="world-system-lobby-btn" onClick={() => navigate("/lobby")}>
        <span className="world-system-action-btn__title">返回大厅</span>
        <span className="world-system-action-btn__arrow">›</span>
      </button>
    </div>
  );

  const renderActiveSystemTab = () => {
    switch (activeTabMeta.key) {
      case "chat":
        return renderChatTab();
      case "battle":
        return renderBattleTab();
      case "scene":
        return renderSceneTab();
      case "char":
        return renderCharacterTab();
      case "ability":
        return renderAbilityTab();
      case "item":
        return renderItemTab();
      case "random":
        return renderRandomTab();
      case "music":
        return renderMusicTab();
      case "collect":
        return renderCollectTab();
      case "system":
        return renderSystemTab();
      default:
        return renderSystemTab();
    }
  };

  return (
    <HoverInsightProvider entries={hoverInsightEntries}>
    <div className={`world-shell ${isBattleSequenceVisible ? "is-combat-active" : ""}`.trim()}>
      {/* ===== 顶部标题栏 ===== */}
      <div className="area-title">
        <div className="titlebar">
          <span className="title-left">
            <strong>{worldName || "碧空圣典"}</strong>
            {selectedScene?.name ? <span className="title-chapter">· {selectedScene.name}</span> : null}
          </span>
          <span className="title-right">
            <span className="sc-chip">● 在线 {onlineCount}</span>
            {isGmPlayerView ? (
              <button type="button" className="sc-btn sc-btn--ghost" onClick={() => setGmPlayerView(false)}>
                退出玩家视角
              </button>
            ) : null}
          </span>
        </div>
      </div>

      {/* ===== 左侧三段：命刻 / 队伍 / 在线 ===== */}
      <div className="area-left">
        <div className="left-col">
          {/* --- 命刻盘 --- */}
          <section className="fate-dial">
            <div className="fate-dial__inner">
              {currentFateClock ? (
                <div
                  className="world-fate-inline"
                  onClick={() => setSelectedFateClockId(currentFateClock.id)}
                  onContextMenu={(event) => {
                    setSelectedFateClockId(currentFateClock.id);
                    contextMenu.open(event, "fate-clock", currentFateClock.id);
                  }}
                >
                  <FateClockWidget
                    id={currentFateClock.id}
                    name={currentFateClock.name}
                    description={currentFateClock.description}
                    segments={currentFateClock.segments}
                    filledSegments={currentFateClock.filledSegments}
                    direction={currentFateClock.direction}
                    status={currentFateClock.status}
                    successThreshold={currentFateClock.successThreshold}
                    failureThreshold={currentFateClock.failureThreshold}
                    visibleToPlayers={currentFateClock.visibleToPlayers}
                    canEdit={canAdvanceClock}
                    onAdvance={(id, amount, reason) => {
                      void onAdvanceClock(id, amount, reason);
                    }}
                    onDelete={canDeleteClock ? (id) => { void onDeleteClock(id); } : undefined}
                  />
                </div>
              ) : visibleFateClocks.length === 0 ? (
                <div className="world-fate-inline world-fate-inline--demo" aria-hidden="true">
                  <FateClockWidget
                    id="__demo__"
                    name="王都沦陷"
                    description="演示命刻 · 创建第一个命刻后将自动替换"
                    segments={8}
                    filledSegments={5}
                    direction="advance"
                    status="active"
                    visibleToPlayers
                    canEdit={true}
                  />
                </div>
              ) : (
                <div className="world-fate-empty">
                  <strong>{unreadTotal}</strong>
                  <span>命刻枢纽</span>
                </div>
              )}
            </div>
            {visibleFateClocks.length > 1 ? (
              <div className="fate-dial__switcher" role="tablist" aria-label="命刻切换">
                {visibleFateClocks.map((clock) => (
                  <button
                    key={clock.id}
                    type="button"
                    role="tab"
                    aria-selected={clock.id === currentFateClock?.id}
                    className={`fate-dial__dot ${clock.id === currentFateClock?.id ? "is-active" : ""}`.trim()}
                    onClick={() => setSelectedFateClockId(clock.id)}
                    onContextMenu={(event) => {
                      setSelectedFateClockId(clock.id);
                      contextMenu.open(event, "fate-clock", clock.id);
                    }}
                    title={`${clock.name} · ${clock.filledSegments}/${clock.segments}`}
                  >
                    <span aria-hidden="true">{clock.filledSegments}/{clock.segments}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {showFateCreateForm && canCreateClock ? (
              <form className="fate-dial__create-form" onSubmit={onCreateFateClock}>
                <input value={fateClockName} onChange={(e) => setFateClockName(e.target.value)} placeholder="命刻名称" />
                <div className="fate-dial__create-row">
                  <label>
                    <span>刻度</span>
                    <select value={fateClockSegments} onChange={(e) => setFateClockSegments(e.target.value)}>
                      {[4, 6, 8, 10, 12].map((v) => (<option value={v} key={v}>{v}</option>))}
                    </select>
                  </label>
                  <label>
                    <span>方向</span>
                    <select value={fateClockDirection} onChange={(e) => setFateClockDirection(e.target.value as "advance" | "countdown")}>
                      <option value="advance">推进</option>
                      <option value="countdown">倒计时</option>
                    </select>
                  </label>
                </div>
                <label className="fate-dial__create-check">
                  <input type="checkbox" checked={fateClockVisible} onChange={(e) => setFateClockVisible(e.target.checked)} />
                  <span>对玩家可见</span>
                </label>
                <button type="submit" className="sc-btn sc-btn--primary">创建命刻</button>
              </form>
            ) : null}
          </section>

          {/* --- 队伍卡 --- */}
          <section className="party-panel">
            <div className="panel-head">
              <strong>队伍状态</strong>
              <span>{partySummaryCards.length} 人</span>
            </div>
            <div className="panel-body">
              {partySummaryCards.length === 0 ? (
                <div className="panel-empty">还没有已绑定的主要角色。</div>
              ) : null}
              {partySummaryCards.map(({ member, character }) => {
                const hp = getRecordNumber(character.stats, "hp", 0);
                const maxHp = Math.max(hp, getRecordNumber(character.snapshot, "maxHp", hp));
                const mp = getRecordNumber(character.stats, "mp", 0);
                const maxMp = Math.max(mp, getRecordNumber(character.snapshot, "maxMp", mp));
                const ownerMember = member ?? (character.userId ? worldRoster.find((item) => item.userId === character.userId) ?? null : null);
                const className = getRecordString(character.snapshot, "class", ownerMember?.boundCharacterName ?? "");
                const level = getRecordNumber(character.snapshot, "level", 1);
                const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0;
                const mpPct = maxMp > 0 ? Math.max(0, Math.min(100, Math.round((mp / maxMp) * 100))) : 0;
                const isSelf = character.id === selectedCharacterId;
                const hpClass = hpPct > 60 ? "high" : hpPct > 30 ? "mid" : "low";
                return (
                  <button
                    type="button"
                    key={character.id}
                    className={`pc-card ${isSelf ? "self" : ""}`.trim()}
                    onClick={() => setSelectedCharacterId(character.id)}
                  >
                    <div className="pc-row">
                      <div className="pc-avatar" aria-hidden="true">
                        {(character.name?.trim()?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="pc-name">{character.name}{className ? ` · ${className}` : ""}</div>
                      <div className="pc-lv">{level}</div>
                    </div>
                    <div className={`bar hp ${hpClass}`.trim()}>
                      <i style={{ width: `${hpPct}%` }} />
                      <span className="lbl">HP</span>
                      <span className="val">{hp} / {maxHp}</span>
                    </div>
                    <div className="bar mp">
                      <i style={{ width: `${mpPct}%` }} />
                      <span className="lbl">MP</span>
                      <span className="val">{mp} / {maxMp}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* --- 在线玩家 --- */}
          <section className="online-panel">
            <div className="panel-head">
              <strong>在线</strong>
              <span>{onlineMemberUserIds.length}/{onlineRosterMembers.length || worldRoster.length}</span>
            </div>
            <div className="panel-body online-list">
              {onlineRosterMembers.length === 0 ? (
                <div className="panel-empty">当前还没有成员加入这个世界。</div>
              ) : null}
              {onlineRosterMembers.map((member) => {
                const online = onlineMemberUserIds.includes(member.userId);
                const boundCharacter = member.boundCharacterId
                  ? characters.find((item) => item.id === member.boundCharacterId)
                  : null;
                const latency = worldLatencyByUserId[member.userId]?.latencyMs ?? null;
                const roleLabel = member.role === "GM" ? "主" : "玩";
                return (
                  <button
                    type="button"
                    key={member.userId}
                    className={`online-item ${!online ? "offline" : ""} ${member.boundCharacterId === selectedCharacterId ? "is-active" : ""}`.trim()}
                    onClick={() => { if (boundCharacter) setSelectedCharacterId(boundCharacter.id); }}
                  >
                    <span className="online-name">
                      <b>{roleLabel}</b>
                      {getRosterDisplayName(member)}
                    </span>
                    <span className={`ping ${getLatencyClass(latency, online)}`.trim()} aria-hidden="true">
                      <i /><i /><i /><i />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* ===== 中央舞台 ===== */}
      <div className="area-stage">
        <div className="stage">
          {error ? <div className="world-stage-alert">{error}</div> : null}
          {isGmPlayerView ? (
            <div className="world-gm-view-banner" role="status">
              <span>GM 正在以玩家视角调试</span>
              <button type="button" onClick={() => setGmPlayerView(false)}>退出玩家视角</button>
            </div>
          ) : null}

          <BattleSequenceBar
            visible={isBattleSequenceVisible}
            entries={battleEntries}
            roundNumber={sceneCombatState?.round ?? 1}
            canAdvanceTurn={canManageCombat}
            advancing={sceneCombatAdvancing}
            onEndTurn={() => { void onAdvanceSceneCombatTurn(); }}
            onSelectEntry={onSelectTokenFromBattle}
            onEntryContextMenu={(event, id) => contextMenu.open(event, "initiative-entry", id)}
          />

          <div className="stage-canvas">
            <WorldCanvas
              tokens={tokenList}
              onMoveToken={onMoveToken}
              gridEnabled={sceneVisualState?.grid.enabled ?? true}
              gridUnitFeet={sceneVisualState?.grid.unitFeet ?? 5}
              showHeader={false}
              canDragToken={canDragToken}
              selectedTokenId={selectedTokenId}
              onSelectToken={setSelectedTokenId}
              onCanvasContextMenu={(event) => contextMenu.open(event, "canvas")}
              onTokenContextMenu={(event, tokenItem) => {
                setSelectedTokenId(tokenItem.tokenId);
                contextMenu.open(event, "token", tokenItem.tokenId);
              }}
            />
            <div className="stage-token-indicator">
              {selectedTokenId
                ? `已选中 ${tokens[selectedTokenId]?.characterName || selectedTokenId}`
                : `棋子 ${tokenList.length} · 网格 ${sceneVisualState?.grid.enabled ? "开启" : "关闭"}`}
            </div>
          </div>

          {/* HUD 嵌入舞台底部 */}
          <div className="hud-wrap">
            <HUDPanel
              visible={showHUD}
              config={hudConfig}
              resources={hudResources}
              characterName={selectedCharacter?.name}
              characterLevel={getRecordNumber(selectedCharacter?.snapshot, "level", 1)}
              onSlotClick={onHudSlotClick}
              onSlotDrop={onHudSlotDrop}
              onToggleMode={() => {
                setHudConfig((prev) => ({ ...prev, mode: prev.mode === "combat" ? "general" : "combat" }));
              }}
              resolveLabel={resolveHudLabel}
              resolveIcon={resolveHudIcon}
              renderGeneralTab={renderHudGeneralTab}
            />
          </div>
        </div>
      </div>

      {/* ===== 右侧系统面板 ===== */}
      <div className="area-right">
        <div className="sys-panel">
          <div className="sys-tabs" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.key}
                  className={`sys-tab ${activeTabMeta.key === tab.key ? "is-active" : ""}`.trim()}
                  onClick={() => openTab(tab.key)}
                  title={tab.title}
                >
                  <Icon className="ico" />
                </button>
              );
            })}
          </div>
          <div className="sys-body">
            <div className="sys-body__head">
              <div className="sys-body__copy">
                <strong>{activeTabMeta.title}</strong>
                <span>{activeTabMeta.description}</span>
              </div>
              <div className="sys-body__actions">
                <button type="button" className="sc-btn sc-btn--ghost" onClick={() => setError(null)}>
                  清空提示
                </button>
              </div>
            </div>
            <div className={`sys-body__view sys-body__view--${activeTabMeta.view}`.trim()}>
              {renderActiveSystemTab()}
            </div>
          </div>
        </div>
      </div>

      <ContextMenu
        items={currentContextItems}
        position={contextMenu.position}
        area={contextMenu.area}
        role={role}
        targetId={contextMenu.targetId}
        onAction={(action, area, targetId) => { void onContextAction(action, area, targetId); }}
        onClose={contextMenu.close}
      />

      {overlays.map((activeOverlay) => (
        <FloatingToolWindow
          key={activeOverlay.id}
          id={activeOverlay.id}
          title={activeOverlay.title}
          placement={activeOverlay.placement}
          componentName={`overlay-${activeOverlay.kind}`}
          compact={activeOverlay.compact}
          onMove={moveOverlay}
          onFocus={focusOverlay}
          onClose={closeOverlay}
        >
          {activeOverlay.kind === "entity" ? (
            <EntityManager
              worldId={worldId}
              entityType={activeOverlay.entityType}
              label={activeOverlay.title}
              canEdit={canEditEntityType(role, activeOverlay.entityType)}
            />
          ) : activeOverlay.kind === "players" ? (
            <PlayerManagePane
              members={memberManageData?.members ?? []}
              characters={memberManageData?.characters ?? []}
              loading={memberManageLoading}
              error={memberManageError}
              savingUserId={savingMemberUserId}
              currentUserId={user?.id}
              onRefresh={() => { void loadWorldMemberManage(); }}
              onSave={onSaveWorldMemberManage}
            />
          ) : activeOverlay.kind === "ability" ? (
            renderAbilityExecutionPanel()
          ) : activeOverlay.kind === "story" ? (
            renderStoryEventPanel()
          ) : activeOverlay.kind === "hotkeys" ? (
            <HotkeySettingsPanel
              worldId={worldId}
              userId={user?.id}
              bindings={customKeyBindings}
              onChange={(nextBindings) => {
                setCustomKeyBindings(nextBindings);
                saveWorldHotkeyBindings(worldId, user?.id, nextBindings);
              }}
            />
          ) : activeOverlay.kind === "theme" ? (
            renderThemePickerOverlay()
          ) : activeOverlay.kind === "character" ? (
            renderCharacterSheetOverlay(activeOverlay)
          ) : null}
        </FloatingToolWindow>
      ))}
    </div>
    </HoverInsightProvider>
  );
}

type PlayerManagePaneProps = {
  members: WorldMemberManageMember[];
  characters: WorldMemberManageCharacter[];
  loading: boolean;
  error: string | null;
  savingUserId: string | null;
  currentUserId?: string;
  onRefresh: () => void;
  onSave: (memberUserId: string, payload: { worldDisplayName: string | null; role: WorldMemberManageRole; boundCharacterId: string | null }) => void;
};

function PlayerManagePane({
  members,
  characters,
  loading,
  error,
  savingUserId,
  currentUserId,
  onRefresh,
  onSave,
}: PlayerManagePaneProps) {
  const [drafts, setDrafts] = useState<Record<string, { worldDisplayName: string; role: WorldMemberManageRole; boundCharacterId: string }>>({});

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        members.map((member) => [
          member.userId,
          {
            worldDisplayName: member.worldDisplayName ?? "",
            role: member.role,
            boundCharacterId: member.boundCharacterId ?? "",
          },
        ])
      )
    );
  }, [members]);

  return (
    <div className="world-player-manage-pane">
      <div className="world-stage-overlay-toolbar">
        <p className="world-system-window__summary">在这里调整成员世界称呼、角色权限与角色绑定关系。</p>
        <button type="button" className="world-stage-header-btn" onClick={onRefresh}>刷新</button>
      </div>

      {error ? <p className="world-player-manage-error">{error}</p> : null}
      {loading ? <div className="world-player-manage-loading">正在加载成员信息...</div> : null}

      {!loading ? (
        <div className="world-player-manage-table-wrap">
          <table className="world-player-manage-table">
            <thead>
              <tr>
                <th>成员</th>
                <th>世界称呼</th>
                <th>权限角色</th>
                <th>绑定角色</th>
                <th>加入时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const draft = drafts[member.userId] ?? {
                  worldDisplayName: member.worldDisplayName ?? "",
                  role: member.role,
                  boundCharacterId: member.boundCharacterId ?? "",
                };

                return (
                  <tr key={member.userId}>
                    <td>
                      <div className="world-player-manage-user-cell">
                        <strong>{member.worldDisplayName || member.accountDisplayName || member.username}</strong>
                        <span>@{member.username}</span>
                      </div>
                    </td>
                    <td>
                      <input
                        className="world-player-manage-input"
                        value={draft.worldDisplayName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((prev) => ({ ...prev, [member.userId]: { ...draft, worldDisplayName: value } }));
                        }}
                        placeholder="留空则显示账号昵称"
                      />
                    </td>
                    <td>
                      <select
                        className="world-player-manage-select"
                        value={draft.role}
                        disabled={member.userId === currentUserId}
                        onChange={(event) => {
                          const value = event.target.value as WorldMemberManageRole;
                          setDrafts((prev) => ({ ...prev, [member.userId]: { ...draft, role: value } }));
                        }}
                      >
                        {(["PLAYER", "ASSISTANT", "OBSERVER", "GM"] as WorldMemberManageRole[]).map((option) => (
                          <option value={option} key={option}>{option}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="world-player-manage-select"
                        value={draft.boundCharacterId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDrafts((prev) => ({ ...prev, [member.userId]: { ...draft, boundCharacterId: value } }));
                        }}
                      >
                        <option value="">未绑定</option>
                        {characters.map((character) => (
                          <option value={character.id} key={character.id}>{character.name} ({character.type})</option>
                        ))}
                      </select>
                    </td>
                    <td className="world-player-manage-joined-cell">{new Date(member.joinedAt).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="world-player-manage-save-btn"
                        disabled={savingUserId === member.userId}
                        onClick={() =>
                          onSave(member.userId, {
                            worldDisplayName: draft.worldDisplayName.trim() || null,
                            role: draft.role,
                            boundCharacterId: draft.boundCharacterId || null,
                          })
                        }
                      >
                        {savingUserId === member.userId ? "保存中..." : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {members.length === 0 ? <div className="world-player-manage-empty">当前世界还没有活跃成员。</div> : null}
        </div>
      ) : null}
    </div>
  );
}
