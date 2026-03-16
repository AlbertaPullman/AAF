import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../lib/http";
import { connectSocket, disconnectSocket, socket, SOCKET_EVENTS } from "../../lib/socket";
import { useAuthStore } from "../../store/authStore";
import { WorldCanvas } from "../../world/components/WorldCanvas";
import { MeasurePanel } from "../../world/components/MeasurePanel";
import { DrawPanel } from "../../world/components/DrawPanel";
import { TokenPanel } from "../../world/components/TokenPanel";
import { CharacterPanel } from "../../world/components/CharacterPanel";
import { ScenePanel } from "../../world/components/ScenePanel";
import { RuntimePanel } from "../../world/components/RuntimePanel";
import { ModulePanel } from "../../world/components/ModulePanel";
import { SceneVisualPanel } from "../../world/components/SceneVisualPanel";
import { SceneCombatPanel } from "../../world/components/SceneCombatPanel";
import { StoryEventPanel } from "../../world/components/StoryEventPanel";
import { mapWorldRuntimeErrorMessage } from "../../world/i18n/messages";

type TokenItem = {
  tokenId: string;
  x: number;
  y: number;
  updatedAt: string;
  updatedBy: string;
  ownerUserId?: string | null;
  characterId?: string | null;
  characterName?: string | null;
};

type CharacterItem = {
  id: string;
  worldId: string;
  userId: string | null;
  name: string;
  type: "PC" | "NPC";
  stats?: unknown;
  snapshot?: unknown;
};

type SceneItem = {
  id: string;
  worldId: string;
  name: string;
  sortOrder: number;
};

type ChatMessage = {
  id: string;
  worldId?: string;
  channelKey?: string;
  sceneId?: string;
  content: string;
  metadata?: {
    sceneId?: string;
    storyEventCheckTag?: {
      eventId: string;
      optionId: string;
      eventTitle: string;
      optionLabel: string;
      skillKey?: string;
      dc?: number;
      finalTotal?: number;
      success?: boolean;
    };
    storyEventCard?: {
      eventId: string;
      title: string;
      summary: string;
      timeline?: string[];
      finalOutcome?: string | null;
      resolvedAt?: string;
    };
    storyPointProposalTag?: {
      eventId: string;
      eventTitle: string;
      proposerUserId: string;
      cost: number;
      reason: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
    };
    storyPointProposalDecisionTag?: {
      eventId: string;
      requestId: string;
      status: "APPROVED" | "REJECTED";
      gmNote?: string | null;
    };
    aiAssistantContextTag?: {
      mode: "local-fallback";
      instruction?: string | null;
      storyEventCardCount: number;
      recentMessageCount: number;
      generatedAt: string;
    };
  };
  createdAt: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

type WorldDetail = {
  name: string;
  myRole: "GM" | "PLAYER" | "OBSERVER" | "ASSISTANT" | null;
};

type WorldRuntimeState = {
  worldId: string;
  status: "loading" | "active" | "sleeping" | "error";
  message: string | null;
  updatedAt: string;
};

type RuntimeModuleState = {
  worldId: string;
  key: string;
  displayName: string;
  dependencies: string[];
  status: "enabled" | "disabled";
  updatedAt: string;
};

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
  revealedAreas: SceneFogRevealedArea[];
};

type SceneVisualState = {
  sceneId: string;
  grid: {
    enabled: boolean;
    unitFeet: number;
  };
  lights: SceneLightSourceState[];
  fog: SceneFogState;
  updatedAt: string;
};

type SceneVisualPatchInput = {
  grid?: {
    enabled?: boolean;
    unitFeet?: number;
  };
  lights?: SceneLightSourceState[];
  fog?: SceneFogState;
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

type WorldChatChannel = "OOC" | "IC" | "SYSTEM";
type ChannelUnreadMap = Record<WorldChatChannel, number>;

function getWorldUnreadStorageKey(worldId: string, sceneId: string, userId?: string) {
  return `world-chat-unread:${worldId}:${sceneId}:${userId ?? "anonymous"}`;
}

function parseUnread(raw: string | null): ChannelUnreadMap {
  if (!raw) {
    return { OOC: 0, IC: 0, SYSTEM: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ChannelUnreadMap>;
    return {
      OOC: Number(parsed.OOC) || 0,
      IC: Number(parsed.IC) || 0,
      SYSTEM: Number(parsed.SYSTEM) || 0
    };
  } catch {
    return { OOC: 0, IC: 0, SYSTEM: 0 };
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

export default function WorldPage() {
  const navigate = useNavigate();
  const { worldId = "" } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

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
  const [worldChatUnread, setWorldChatUnread] = useState<ChannelUnreadMap>({ OOC: 0, IC: 0, SYSTEM: 0 });
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

  const tokenList = useMemo(() => Object.values(tokens), [tokens]);
  const selectedCharacter = useMemo(
    () => characters.find((item) => item.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );
  const canSendCurrentChannel = useMemo(
    () => canCurrentRoleSendChannel(myRole, worldChatChannel),
    [myRole, worldChatChannel]
  );
  const canUseAssistant = myRole === "GM" || myRole === "ASSISTANT";
  const canManageSceneRuntime = myRole === "GM";
  const selectedSceneIndex = useMemo(() => scenes.findIndex((item) => item.id === selectedSceneId), [scenes, selectedSceneId]);
  const canMoveSceneUp = selectedSceneIndex > 0;
  const canMoveSceneDown = selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1;

  const loadRuntimeState = async () => {
    if (!worldId) {
      return;
    }

    setRuntimeLoading(true);
    try {
      const resp = await http.get(`/worlds/${worldId}/runtime`);
      setRuntimeState((resp.data?.data ?? null) as WorldRuntimeState | null);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "加载运行状态失败"));
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "加载模块列表失败"));
    } finally {
      setModuleLoading(false);
    }
  };

  const onToggleRuntimeModule = async (module: RuntimeModuleState) => {
    if (!worldId) {
      return;
    }

    const nextStatus = module.status === "enabled" ? "disabled" : "enabled";
    setTogglingModuleKey(module.key);
    try {
      const resp = await http.patch(`/worlds/${worldId}/runtime/modules/${module.key}`, {
        status: nextStatus
      });
      const updated = resp.data?.data as RuntimeModuleState;
      setRuntimeModules((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "切换模块状态失败"));
    } finally {
      setTogglingModuleKey(null);
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "加载视觉状态失败"));
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "更新视觉状态失败"));
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "加载战斗状态失败"));
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "保存战斗状态失败"));
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
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "推进回合失败"));
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
        http.get(`/worlds/${worldId}/story-events/cards`, { params: { limit: 20 } })
      ]);
      setStoryEvents((eventsResp.data?.data ?? []) as StoryEventItem[]);
      setStoryEventCards((cardsResp.data?.data ?? []) as StoryEventCardItem[]);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "加载剧情事件失败"));
    } finally {
      setStoryEventLoading(false);
    }
  };

  const onCreateStoryEvent = async (payload: { title: string; description: string }) => {
    if (!worldId) {
      return;
    }
    try {
      await http.post(`/worlds/${worldId}/story-events`, payload);
      await loadStoryEvents();
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "创建剧情事件失败"));
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
          checkMode: payload.checkMode
        }
      });
      await loadStoryEvents();
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "新增剧情选项失败"));
    }
  };

  const onSubmitStoryEventCheck = async (eventId: string, optionId: string, payload: { finalTotal: number; chatContent: string }) => {
    if (!worldId) {
      return;
    }
    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/options/${optionId}/check`, payload);
      await Promise.all([loadStoryEvents(), http.get(`/chat/worlds/${worldId}/recent`, { params: { limit: 40, channelKey: worldChatChannel, sceneId: selectedSceneId } }).then((chatResp) => setWorldMessages(chatResp.data?.data ?? []))]);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "提交检定失败"));
    }
  };

  const onResolveStoryEvent = async (eventId: string, payload: { summary: string; finalOutcome: string }) => {
    if (!worldId) {
      return;
    }
    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/resolve`, payload);
      await Promise.all([loadStoryEvents(), http.get(`/chat/worlds/${worldId}/recent`, { params: { limit: 40, channelKey: worldChatChannel, sceneId: selectedSceneId } }).then((chatResp) => setWorldMessages(chatResp.data?.data ?? []))]);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "结算剧情事件失败"));
    }
  };

  const onCreateStoryNarrativeRequest = async (eventId: string, payload: { cost: number; reason: string }) => {
    if (!worldId) {
      return;
    }
    try {
      await http.post(`/worlds/${worldId}/story-events/${eventId}/narrative-requests`, payload);
      await Promise.all([
        loadStoryEvents(),
        http
          .get(`/chat/worlds/${worldId}/recent`, { params: { limit: 40, channelKey: worldChatChannel, sceneId: selectedSceneId } })
          .then((chatResp) => setWorldMessages(chatResp.data?.data ?? []))
      ]);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "提交物语点提案失败"));
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
      await Promise.all([
        loadStoryEvents(),
        http
          .get(`/chat/worlds/${worldId}/recent`, { params: { limit: 40, channelKey: worldChatChannel, sceneId: selectedSceneId } })
          .then((chatResp) => setWorldMessages(chatResp.data?.data ?? []))
      ]);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "裁决物语点提案失败"));
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
          limit: 20
        }
      });
      setStorySearchResult((resp.data?.data ?? null) as StoryEventSearchResult | null);
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "检索剧情事件失败"));
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

  const onLocateStoryEvent = (eventId: string) => {
    setFocusedStoryEventId(eventId);
  };

  const onLocateWorldMessage = async (messageId: string, channelKey?: string) => {
    if (!worldId) {
      return;
    }

    try {
      const exactResp = await http.get(`/chat/worlds/${worldId}/messages/${messageId}`);
      const exact = (exactResp.data?.data ?? null) as ChatMessage | null;
      if (!exact) {
        setError("定位消息失败：目标消息不存在");
        return;
      }

      const targetChannel = exact.channelKey === "IC" || exact.channelKey === "SYSTEM" ? exact.channelKey : "OOC";
      const targetSceneId = exact.sceneId || selectedSceneId;

      setFocusedWorldMessageId(exact.id);

      if (targetSceneId && targetSceneId !== selectedSceneId) {
        setSelectedSceneId(targetSceneId);
      }
      if (worldChatChannel !== targetChannel) {
        setWorldChatChannel(targetChannel);
      }

      const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
        params: { limit: 100, channelKey: targetChannel, sceneId: targetSceneId }
      });
      const recentList = (chatResp.data?.data ?? []) as ChatMessage[];
      const merged = mergeLocatedMessageIntoList(recentList, exact);
      setWorldMessages(merged);
    } catch {
      setError("定位聊天消息失败");
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
        instruction: assistantInstruction.trim() || undefined
      });

      const created = (resp.data?.data?.message ?? null) as ChatMessage | null;
      if (!created) {
        setError("AI 助手生成失败：未返回消息");
        return;
      }

      setFocusedWorldMessageId(created.id);
      setWorldChatChannel("SYSTEM");
      const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
        params: { limit: 100, channelKey: "SYSTEM", sceneId: created.sceneId || selectedSceneId }
      });
      const recentList = (chatResp.data?.data ?? []) as ChatMessage[];
      setWorldMessages(mergeLocatedMessageIntoList(recentList, created));
      setAssistantInstruction("");
    } catch (err: any) {
      setError(mapWorldRuntimeErrorMessage(err?.response?.data?.error?.message || "生成 AI 助手草案失败"));
    } finally {
      setAssistantGenerating(false);
    }
  };

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    const key = getWorldUnreadStorageKey(worldId, selectedSceneId, user?.id);
    const raw = localStorage.getItem(key);
    setWorldChatUnread(parseUnread(raw));
  }, [worldId, selectedSceneId, user?.id]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    const key = getWorldUnreadStorageKey(worldId, selectedSceneId, user?.id);
    localStorage.setItem(key, JSON.stringify(worldChatUnread));
  }, [worldId, selectedSceneId, user?.id, worldChatUnread]);

  useEffect(() => {
    if (!selectedCharacter) {
      setEditCharacterName("");
      setEditHp("0");
      setEditMp("0");
      setEditLevel("1");
      setEditClassName("");
      return;
    }

    const stats = selectedCharacter.stats as { hp?: unknown; mp?: unknown } | undefined;
    const snapshot = selectedCharacter.snapshot as { level?: unknown; class?: unknown } | undefined;

    setEditCharacterName(selectedCharacter.name);
    setEditHp(typeof stats?.hp === "number" ? String(stats.hp) : "0");
    setEditMp(typeof stats?.mp === "number" ? String(stats.mp) : "0");
    setEditLevel(typeof snapshot?.level === "number" ? String(snapshot.level) : "1");
    setEditClassName(typeof snapshot?.class === "string" ? snapshot.class : "");
  }, [selectedCharacter]);

  useEffect(() => {
    if (!worldId) {
      navigate("/lobby");
      return;
    }

    void (async () => {
      try {
        const resp = await http.get(`/worlds/${worldId}`);
        const data = resp.data?.data as WorldDetail | undefined;
        if (data?.name) {
          setWorldName(data.name);
          setMyRole(data.myRole);
        }

        const characterResp = await http.get(`/worlds/${worldId}/characters`);
        const characterItems = (characterResp.data?.data ?? []) as CharacterItem[];
        setCharacters(characterItems);
        if (characterItems.length > 0) {
          const preferred = user?.id ? characterItems.find((item) => item.userId === user.id) : undefined;
          setSelectedCharacterId((preferred ?? characterItems[0]).id);
        }

        const sceneResp = await http.get(`/worlds/${worldId}/scenes`);
        const sceneItems = (sceneResp.data?.data ?? []) as SceneItem[];
        setScenes(sceneItems);
        if (sceneItems.length > 0) {
          setSelectedSceneId(sceneItems[0].id);
          setRenameSceneName(sceneItems[0].name);
        }

        const runtimeResp = await http.get(`/worlds/${worldId}/runtime`);
        setRuntimeState((runtimeResp.data?.data ?? null) as WorldRuntimeState | null);

        const modulesResp = await http.get(`/worlds/${worldId}/runtime/modules`);
        setRuntimeModules((modulesResp.data?.data ?? []) as RuntimeModuleState[]);
      } catch {
        setError("加载世界信息失败");
      }
    })();
  }, [navigate, worldId, user?.id]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    void loadSceneVisualState();
    void loadSceneCombatState();
    void loadStoryEvents();
  }, [worldId, selectedSceneId]);

  useEffect(() => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    void (async () => {
      try {
        const chatResp = await http.get(`/chat/worlds/${worldId}/recent`, {
          params: { limit: 100, channelKey: worldChatChannel, sceneId: selectedSceneId }
        });
        setWorldMessages(chatResp.data?.data ?? []);
        setWorldChatUnread((prev) => ({ ...prev, [worldChatChannel]: 0 }));
      } catch {
        setError("加载世界聊天历史失败");
      }
    })();
  }, [worldId, worldChatChannel, selectedSceneId]);

  useEffect(() => {
    if (!token || !worldId) {
      return;
    }

    connectSocket(token);

    const onAck = () => {
      setSocketReady(true);
      socket.emit(SOCKET_EVENTS.worldJoin, { worldId }, (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "加入世界房间失败");
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

    const onWorldMembersUpdate = (payload: { worldId: string; onlineCount: number }) => {
      if (payload.worldId === worldId) {
        setOnlineCount(payload.onlineCount);
      }
    };

    const onTokenMoved = (payload: { worldId: string; sceneId?: string; tokens: TokenItem[] }) => {
      if (payload.worldId !== worldId) {
        return;
      }
      if (payload.sceneId && selectedSceneId && payload.sceneId !== selectedSceneId) {
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
      if (selectedSceneId && message.sceneId !== selectedSceneId) {
        return;
      }

      const messageChannel = ((message.channelKey ?? "OOC") as WorldChatChannel);
      if (messageChannel !== worldChatChannel) {
        setWorldChatUnread((prev) => ({
          ...prev,
          [messageChannel]: prev[messageChannel] + 1
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
    socket.on(SOCKET_EVENTS.sceneTokenMoved, onTokenMoved);
    socket.on(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);

    return () => {
      socket.emit(SOCKET_EVENTS.worldLeave, { worldId });
      socket.off(SOCKET_EVENTS.connectionAck, onAck);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.worldMembersUpdate, onWorldMembersUpdate);
      socket.off(SOCKET_EVENTS.sceneTokenMoved, onTokenMoved);
      socket.off(SOCKET_EVENTS.worldMessageNew, onWorldMessageNew);
      disconnectSocket();
    };
  }, [token, worldId, worldChatChannel, selectedSceneId]);

  useEffect(() => {
    if (!worldId || !selectedSceneId || !socketReady) {
      return;
    }

    setTokens({});
    socket.emit(SOCKET_EVENTS.sceneSelect, { worldId, sceneId: selectedSceneId }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) {
        setError(result.error || "切换场景失败");
      }
    });
  }, [worldId, selectedSceneId, socketReady]);

  useEffect(() => {
    if (!selectedSceneId) {
      setRenameSceneName("");
      return;
    }

    const selected = scenes.find((item) => item.id === selectedSceneId);
    setRenameSceneName(selected?.name ?? "");
  }, [scenes, selectedSceneId]);

  const onMoveToken = (tokenId: string, x: number, y: number, ownerUserId?: string | null, characterId?: string | null) => {
    if (!worldId) {
      return;
    }
    if (!selectedSceneId) {
      setError("请先选择场景");
      return;
    }

    socket.emit(
      SOCKET_EVENTS.sceneTokenMove,
      { worldId, sceneId: selectedSceneId, tokenId, x, y, ownerUserId, characterId },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setError(result.error || "同步 token 失败");
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
  };

  const onAddMyToken = () => {
    if (!user?.id) {
      return;
    }

    const myTokenId = selectedCharacter ? `token:character:${selectedCharacter.id}` : getMyTokenId(user.id);
    const randomX = 60 + Math.floor(Math.random() * 480);
    const randomY = 50 + Math.floor(Math.random() * 220);
    onMoveToken(myTokenId, randomX, randomY, selectedCharacter?.userId ?? user.id, selectedCharacter?.id ?? null);
  };

  const onCreateCharacter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !newCharacterName.trim()) {
      return;
    }

    setCreatingCharacter(true);
    try {
      const resp = await http.post(`/worlds/${worldId}/characters`, {
        name: newCharacterName,
        type: newCharacterType
      });

      const created = resp.data?.data as CharacterItem;
      setCharacters((prev) => [...prev, created]);
      setSelectedCharacterId(created.id);
      setNewCharacterName("");
      setNewCharacterType("PC");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "创建角色失败");
    } finally {
      setCreatingCharacter(false);
    }
  };

  const onSaveCharacter = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !selectedCharacterId) {
      return;
    }

    const hp = Math.max(0, Number(editHp) || 0);
    const mp = Math.max(0, Number(editMp) || 0);
    const level = Math.max(1, Number(editLevel) || 1);
    const className = editClassName.trim() || "unknown";

    setSavingCharacter(true);
    try {
      const resp = await http.put(`/worlds/${worldId}/characters/${selectedCharacterId}`, {
        name: editCharacterName,
        stats: {
          hp,
          mp
        },
        snapshot: {
          level,
          class: className
        }
      });

      const updated = resp.data?.data as CharacterItem;
      setCharacters((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "保存角色失败");
    } finally {
      setSavingCharacter(false);
    }
  };

  const onCreateScene = async (event: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "创建场景失败");
    } finally {
      setCreatingScene(false);
    }
  };

  const onRenameScene = async (event: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "重命名场景失败");
    } finally {
      setRenamingScene(false);
    }
  };

  const onDeleteScene = async () => {
    if (!worldId || !selectedSceneId) {
      return;
    }

    if (scenes.length <= 1) {
      setError("至少保留一个场景");
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
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "删除场景失败");
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
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "调整场景顺序失败");
    } finally {
      setSortingScene(false);
    }
  };

  const onSendWorldMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !worldChatInput.trim()) {
      return;
    }
    if (!selectedSceneId) {
      setError("请先选择场景");
      return;
    }
    if (!canSendCurrentChannel) {
      setError("当前频道仅 GM 可发送消息");
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
          setError(result.error || "发送世界聊天失败");
          setWorldChatInput(content);
        }
        setWorldChatSending(false);
      }
    );
  };

  return (
    <section className="world-page">
      <div className="world-hero">
        <div className="world-hero__copy">
          <h1>{worldName}</h1>
          <p>JRPG 式奇幻冒险舞台。这里是场景、角色、事件与战斗的总控制台。</p>
          <div className="world-hero__actions">
            <button
              className="world-hero__back"
              onClick={() => {
                navigate("/lobby");
              }}
              type="button"
            >
              返回大厅
            </button>
            <span className="world-hero__hint">当前世界的所有操作都会保留在这一页，离开后也能从大厅重新进入。</span>
          </div>
        </div>
        <div className="world-status-bar">
          <span className="world-status-pill">联机：{socketReady ? "已连接" : "未连接"}</span>
          <span className="world-status-pill">在线：{onlineCount}</span>
          <span className="world-status-pill">身份：{myRole || "未知"}</span>
          <span className="world-status-pill">场景：{scenes.length}</span>
        </div>
      </div>
      {error ? <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      <div className="world-layout">
        <aside className="world-column world-column--left">
          <ScenePanel
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            createName={newSceneName}
            renameName={renameSceneName}
            creating={creatingScene}
            renaming={renamingScene}
            deleting={deletingScene}
            sorting={sortingScene}
            canMoveUp={canMoveSceneUp}
            canMoveDown={canMoveSceneDown}
            onSelectScene={setSelectedSceneId}
            onCreateNameChange={setNewSceneName}
            onRenameNameChange={setRenameSceneName}
            onCreateScene={onCreateScene}
            onRenameScene={onRenameScene}
            onDeleteScene={onDeleteScene}
            onMoveSceneUp={() => void onMoveScene("UP")}
            onMoveSceneDown={() => void onMoveScene("DOWN")}
          />
          <TokenPanel
            tokenCount={tokenList.length}
            selectedCharacterName={selectedCharacter?.name ?? ""}
            onAddMyToken={onAddMyToken}
            onCenterToken={onCenterToken}
          />
          <CharacterPanel
            characters={characters}
            selectedCharacterId={selectedCharacterId}
            onSelectCharacter={setSelectedCharacterId}
            creating={creatingCharacter}
            createName={newCharacterName}
            createType={newCharacterType}
            onCreateNameChange={setNewCharacterName}
            onCreateTypeChange={setNewCharacterType}
            onCreateCharacter={onCreateCharacter}
            editName={editCharacterName}
            editHp={editHp}
            editMp={editMp}
            editLevel={editLevel}
            editClassName={editClassName}
            saving={savingCharacter}
            onEditNameChange={setEditCharacterName}
            onEditHpChange={setEditHp}
            onEditMpChange={setEditMp}
            onEditLevelChange={setEditLevel}
            onEditClassNameChange={setEditClassName}
            onSaveCharacter={onSaveCharacter}
          />
          <MeasurePanel />
          <DrawPanel />
        </aside>

        <div className="world-column world-column--center">
          <WorldCanvas
            tokens={tokenList}
            onMoveToken={onMoveToken}
            gridEnabled={sceneVisualState?.grid.enabled ?? true}
            gridUnitFeet={sceneVisualState?.grid.unitFeet ?? 5}
          />
          <SceneVisualPanel
            visualState={sceneVisualState}
            loading={sceneVisualLoading}
            saving={sceneVisualSaving}
            canManage={canManageSceneRuntime}
            onRefresh={() => {
              void loadSceneVisualState();
            }}
            onPatch={(input) => {
              void onPatchSceneVisualState(input);
            }}
          />
          <SceneCombatPanel
            combatState={sceneCombatState}
            loading={sceneCombatLoading}
            saving={sceneCombatSaving}
            advancing={sceneCombatAdvancing}
            canManage={canManageSceneRuntime}
            onRefresh={() => {
              void loadSceneCombatState();
            }}
            onSave={(input) => {
              void onSaveSceneCombatState(input);
            }}
            onNextTurn={() => {
              void onAdvanceSceneCombatTurn();
            }}
          />
        </div>

        <aside className="world-column world-column--right">
          <RuntimePanel
            runtimeState={runtimeState}
            moduleCount={runtimeModules.length}
            loading={runtimeLoading}
            errorSummary={runtimeState?.status === "error" ? runtimeState.message || "运行时异常" : null}
            onRefresh={() => {
              void loadRuntimeState();
            }}
          />
          <ModulePanel
            modules={runtimeModules}
            myRole={myRole}
            loading={moduleLoading}
            togglingModuleKey={togglingModuleKey}
            onRefresh={() => {
              void loadRuntimeModules();
            }}
            onToggle={(module) => {
              void onToggleRuntimeModule(module);
            }}
          />
          <StoryEventPanel
            myRole={myRole}
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
        </aside>
      </div>

      <article className="world-card world-chat-card">
        <div className="mb-2 flex items-center justify-between">
          <strong>世界内聊天</strong>
          <div className="flex items-center gap-2 world-chat-card__toolbar">
            <select
              className="rounded border px-2 py-1 text-xs"
              value={worldChatChannel}
              onChange={(e) => setWorldChatChannel(e.target.value as WorldChatChannel)}
            >
              <option value="OOC">OOC{worldChatUnread.OOC > 0 ? ` (${worldChatUnread.OOC})` : ""}</option>
              <option value="IC">IC{worldChatUnread.IC > 0 ? ` (${worldChatUnread.IC})` : ""}</option>
              <option value="SYSTEM">SYSTEM{worldChatUnread.SYSTEM > 0 ? ` (${worldChatUnread.SYSTEM})` : ""}</option>
            </select>
            <span className="text-xs text-gray-500 world-chat-card__count">{worldMessages.length} 条</span>
          </div>
        </div>
        {canUseAssistant ? (
          <div className="mb-3 rounded border border-cyan-200 bg-cyan-50 p-2">
            <p className="mb-1 text-xs font-semibold text-cyan-900">AI 助手草案生成</p>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-2 py-1 text-xs"
                value={assistantInstruction}
                onChange={(e) => setAssistantInstruction(e.target.value)}
                placeholder="可选：补充本次总结指令，例如“总结本场景冲突与结局”"
                maxLength={120}
              />
              <button
                className="rounded border px-3 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={() => {
                  void onGenerateAssistantResponse();
                }}
                disabled={assistantGenerating}
              >
                {assistantGenerating ? "生成中..." : "生成草案"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mb-3 max-h-60 space-y-2 overflow-y-auto rounded border bg-gray-50 p-2 world-chat-feed">
          {worldMessages.length === 0 ? <p className="text-sm text-gray-500">暂无世界消息</p> : null}
          {worldMessages.map((message) => (
            <div className={`rounded p-2 text-sm world-chat-message ${focusedWorldMessageId === message.id ? "bg-yellow-100 ring-1 ring-yellow-400" : "bg-white"}`} key={message.id}>
              <p className="text-xs text-gray-500 world-chat-message__meta">
                <span className="world-channel-badge">{message.channelKey || "OOC"}</span> {message.fromUser.displayName || message.fromUser.username} · {new Date(message.createdAt).toLocaleTimeString()}
              </p>
              {message.metadata?.storyEventCheckTag ? (
                <p
                  className="mb-1 inline-block rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                  title={`事件：${message.metadata.storyEventCheckTag.eventTitle}｜选项：${message.metadata.storyEventCheckTag.optionLabel}｜DC：${message.metadata.storyEventCheckTag.dc ?? "-"}`}
                >
                  [技能检定-{message.metadata.storyEventCheckTag.optionLabel}-结果{message.metadata.storyEventCheckTag.finalTotal ?? "?"}]
                </p>
              ) : null}
              {message.metadata?.storyEventCard ? (
                <div className="mb-1 rounded border border-amber-300 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-800">事件结算卡片</p>
                  <p className="text-xs text-amber-700">{message.metadata.storyEventCard.title}</p>
                  <p className="text-xs text-amber-700">{message.metadata.storyEventCard.summary}</p>
                  {Array.isArray(message.metadata.storyEventCard.timeline) && message.metadata.storyEventCard.timeline.length > 0 ? (
                    <p className="text-xs text-amber-700">经过：{message.metadata.storyEventCard.timeline.join("；")}</p>
                  ) : null}
                  {message.metadata.storyEventCard.finalOutcome ? <p className="text-xs text-amber-700">后果：{message.metadata.storyEventCard.finalOutcome}</p> : null}
                </div>
              ) : null}
              {message.metadata?.storyPointProposalTag ? (
                <div className="mb-1 rounded border border-emerald-300 bg-emerald-50 p-2">
                  <p className="text-xs font-semibold text-emerald-800">物语点提案</p>
                  <p className="text-xs text-emerald-700">事件：{message.metadata.storyPointProposalTag.eventTitle}</p>
                  <p className="text-xs text-emerald-700">提案人：{message.metadata.storyPointProposalTag.proposerUserId}</p>
                  <p className="text-xs text-emerald-700">消耗：{message.metadata.storyPointProposalTag.cost} · 状态：{message.metadata.storyPointProposalTag.status}</p>
                  <p className="text-xs text-emerald-700">理由：{message.metadata.storyPointProposalTag.reason}</p>
                </div>
              ) : null}
              {message.metadata?.storyPointProposalDecisionTag ? (
                <div className="mb-1 rounded border border-cyan-300 bg-cyan-50 p-2">
                  <p className="text-xs font-semibold text-cyan-800">物语点提案裁决</p>
                  <p className="text-xs text-cyan-700">结果：{message.metadata.storyPointProposalDecisionTag.status}</p>
                  {message.metadata.storyPointProposalDecisionTag.gmNote ? (
                    <p className="text-xs text-cyan-700">GM备注：{message.metadata.storyPointProposalDecisionTag.gmNote}</p>
                  ) : null}
                </div>
              ) : null}
              {message.metadata?.aiAssistantContextTag ? (
                <div className="mb-1 rounded border border-violet-300 bg-violet-50 p-2">
                  <p className="text-xs font-semibold text-violet-800">AI 助手草案</p>
                  <p className="text-xs text-violet-700">
                    模式：{message.metadata.aiAssistantContextTag.mode} · 事件卡 {message.metadata.aiAssistantContextTag.storyEventCardCount} · 最近聊天 {message.metadata.aiAssistantContextTag.recentMessageCount}
                  </p>
                  {message.metadata.aiAssistantContextTag.instruction ? (
                    <p className="text-xs text-violet-700">指令：{message.metadata.aiAssistantContextTag.instruction}</p>
                  ) : null}
                </div>
              ) : null}
              <p className="world-chat-message__content">{message.content}</p>
            </div>
          ))}
        </div>
        <form className="flex gap-2 world-chat-form" onSubmit={onSendWorldMessage}>
          <input
            className="flex-1 rounded border px-3 py-2"
            value={worldChatInput}
            onChange={(e) => setWorldChatInput(e.target.value)}
            placeholder={canSendCurrentChannel ? "输入世界频道消息" : "当前频道仅 GM 可发送"}
            maxLength={1000}
            disabled={!canSendCurrentChannel}
          />
          <button className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-60" disabled={worldChatSending || !socketReady || !canSendCurrentChannel} type="submit">
            {worldChatSending ? "发送中..." : "发送"}
          </button>
        </form>
      </article>
    </section>
  );
}