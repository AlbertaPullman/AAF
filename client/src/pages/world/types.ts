/**
 * 世界页面共享类型定义
 * 避免在多个组件中重复定义相同的类型
 */

export type TokenItem = {
  tokenId: string;
  x: number;
  y: number;
  updatedAt: string;
  updatedBy: string;
  ownerUserId?: string | null;
  characterId?: string | null;
  characterName?: string | null;
};

export type CharacterItem = {
  id: string;
  worldId: string;
  userId: string | null;
  name: string;
  type: "PC" | "NPC";
  stats?: unknown;
  snapshot?: unknown;
};

export type SceneItem = {
  id: string;
  worldId: string;
  name: string;
  sortOrder: number;
};

export type ChatMessage = {
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

export type WorldDetail = {
  name: string;
  myRole: "GM" | "PLAYER" | "OBSERVER" | "ASSISTANT" | null;
  /** GM-defined visual theme pack for this world. null = use system default + player preference. */
  themePack?: string | null;
  /** When true, the world's themePack is forced on every member (overrides player preference). */
  themePackForcedByGM?: boolean;
};

export type WorldRuntimeState = {
  worldId: string;
  status: "loading" | "active" | "sleeping" | "error";
  message: string | null;
  updatedAt: string;
};

export type RuntimeModuleState = {
  worldId: string;
  key: string;
  displayName: string;
  dependencies: string[];
  status: "enabled" | "disabled";
  updatedAt: string;
};

export type WorldChatChannel = "SESSION" | "COMBAT" | string;
export type ChannelUnreadMap = Record<string, number>;
