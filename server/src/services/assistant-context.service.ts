import { MessageType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { extractSceneIdFromMetadata } from "./chat.service";
import { extractLinkedStoryEventIdFromMessageMetadata } from "./story-event.search";

export type AssistantContextInput = {
  sceneId?: string;
  hours?: number;
  cardLimit?: number;
  messageLimit?: number;
};

export type AssistantContextCard = {
  messageId: string;
  createdAt: string;
  sceneId?: string;
  eventId?: string;
  title?: string;
  summary?: string;
  timeline?: string[];
  finalOutcome?: string | null;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export type AssistantContextMessage = {
  messageId: string;
  createdAt: string;
  sceneId?: string;
  channelKey?: string;
  content: string;
  linkedEventId?: string;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
};

export type AssistantContextResult = {
  worldId: string;
  sceneId?: string;
  generatedAt: string;
  policy: {
    eventCardsFirst: true;
    sourceOrder: ["storyEventCards", "recentMessages"];
  };
  storyEventCards: AssistantContextCard[];
  recentMessages: AssistantContextMessage[];
  hints: string[];
};

type NormalizedAssistantContextInput = {
  sceneId?: string;
  cardLimit: number;
  messageLimit: number;
  hours?: number;
  sinceDate?: Date;
};

function normalizeAssistantContextInput(input: AssistantContextInput = {}): NormalizedAssistantContextInput {
  const sceneId = input.sceneId?.trim() || undefined;
  const cardLimit = Math.min(Math.max(Number(input.cardLimit) || 8, 1), 30);
  const messageLimit = Math.min(Math.max(Number(input.messageLimit) || 40, 1), 120);

  const hoursRaw = Number(input.hours);
  const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(Math.floor(hoursRaw), 24 * 30) : undefined;
  const sinceDate = hours ? new Date(Date.now() - hours * 60 * 60 * 1000) : undefined;

  return {
    sceneId,
    cardLimit,
    messageLimit,
    hours,
    sinceDate
  };
}

function extractStoryEventCardMetadata(metadata: unknown):
  | {
      eventId?: string;
      title?: string;
      summary?: string;
      timeline?: string[];
      finalOutcome?: string | null;
    }
  | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const candidate = (metadata as { storyEventCard?: unknown }).storyEventCard;
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const card = candidate as {
    eventId?: unknown;
    title?: unknown;
    summary?: unknown;
    timeline?: unknown;
    finalOutcome?: unknown;
  };

  return {
    eventId: typeof card.eventId === "string" ? card.eventId : undefined,
    title: typeof card.title === "string" ? card.title : undefined,
    summary: typeof card.summary === "string" ? card.summary : undefined,
    timeline: Array.isArray(card.timeline) ? card.timeline.filter((item): item is string => typeof item === "string") : undefined,
    finalOutcome:
      typeof card.finalOutcome === "string" || card.finalOutcome === null ? (card.finalOutcome as string | null) : undefined
  };
}

function toHints(cardCount: number, messageCount: number, sceneId?: string): string[] {
  const hints = [
    "读取顺序：先消费剧情事件结算卡片，再补充最近原始聊天。",
    "如卡片与原始消息冲突，以卡片中的最终后果描述为优先参考。"
  ];

  if (sceneId) {
    hints.push("当前上下文已按 sceneId 过滤，可避免跨场景串线。");
  }
  if (cardCount === 0) {
    hints.push("未找到剧情事件卡片，建议降级为最近聊天+事件检索结果。");
  }
  if (messageCount === 0) {
    hints.push("最近聊天为空，建议提示主持人扩大时间范围。");
  }

  return hints;
}

async function assertActiveMember(worldId: string, userId: string) {
  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("not a member of world");
  }
}

async function assertSceneInWorld(worldId: string, sceneId: string) {
  const exists = await prisma.scene.findFirst({
    where: {
      id: sceneId,
      worldId
    },
    select: { id: true }
  });

  if (!exists) {
    throw new Error("scene not found in world");
  }
}

export async function getWorldAssistantContext(worldId: string, userId: string, input: AssistantContextInput = {}): Promise<AssistantContextResult> {
  await assertActiveMember(worldId, userId);
  const normalized = normalizeAssistantContextInput(input);

  if (normalized.sceneId) {
    await assertSceneInWorld(worldId, normalized.sceneId);
  }

  const cardRows = await prisma.message.findMany({
    where: {
      type: MessageType.WORLD,
      worldId,
      channelKey: "SYSTEM",
      ...(normalized.sinceDate ? { createdAt: { gte: normalized.sinceDate } } : {})
    },
    include: {
      fromUser: {
        select: { id: true, username: true, displayName: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(normalized.cardLimit * 6, 360)
  });

  const storyEventCards = cardRows
    .map((row: any) => {
      const sceneId = extractSceneIdFromMetadata(row.metadata);
      if (normalized.sceneId && sceneId !== normalized.sceneId) {
        return null;
      }

      const card = extractStoryEventCardMetadata(row.metadata);
      if (!card) {
        return null;
      }

      return {
        messageId: row.id,
        createdAt: row.createdAt.toISOString(),
        sceneId,
        eventId: card.eventId,
        title: card.title,
        summary: card.summary,
        timeline: card.timeline,
        finalOutcome: card.finalOutcome,
        fromUser: row.fromUser
      } as AssistantContextCard;
    })
    .filter((item: AssistantContextCard | null): item is AssistantContextCard => Boolean(item))
    .slice(0, normalized.cardLimit);

  const messageRows = await prisma.message.findMany({
    where: {
      type: MessageType.WORLD,
      worldId,
      ...(normalized.sinceDate ? { createdAt: { gte: normalized.sinceDate } } : {})
    },
    include: {
      fromUser: {
        select: { id: true, username: true, displayName: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(normalized.messageLimit * 4, 480)
  });

  const recentMessages = messageRows
    .filter((row: any) => {
      const sceneId = extractSceneIdFromMetadata(row.metadata);
      if (normalized.sceneId && sceneId !== normalized.sceneId) {
        return false;
      }
      return true;
    })
    .map((row: any) => ({
      messageId: row.id,
      createdAt: row.createdAt.toISOString(),
      sceneId: extractSceneIdFromMetadata(row.metadata),
      channelKey: row.channelKey ?? undefined,
      content: row.content,
      linkedEventId: extractLinkedStoryEventIdFromMessageMetadata(row.metadata),
      fromUser: row.fromUser
    }))
    .slice(0, normalized.messageLimit);

  return {
    worldId,
    sceneId: normalized.sceneId,
    generatedAt: new Date().toISOString(),
    policy: {
      eventCardsFirst: true,
      sourceOrder: ["storyEventCards", "recentMessages"]
    },
    storyEventCards,
    recentMessages,
    hints: toHints(storyEventCards.length, recentMessages.length, normalized.sceneId)
  };
}
