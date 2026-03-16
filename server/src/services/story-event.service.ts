import { randomUUID } from "node:crypto";
import { MessageType, StoryEventScope, StoryEventStatus, WorldMemberStatus, WorldRole, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createWorldMessage, extractSceneIdFromMetadata, type GlobalMessagePayload } from "./chat.service";
import {
  extractLinkedStoryEventIdFromMessageMetadata,
  includesKeyword,
  normalizeStoryEventSearchInput,
  toMessageChannelKey,
  toStoryEventSearchText,
  toStoryEventStatus
} from "./story-event.search";

export type StoryEventScopeView = "ALL" | "PLAYER";
export type StoryEventStatusView = "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED";
export type StoryOptionCheckMode = "SINGLE" | "PER_PLAYER" | "UNLIMITED";

export type StoryEventCheckConfig = {
  skillKey: string;
  dc: number;
  checkMode: StoryOptionCheckMode;
};

export type StoryEventOptionAttempt = {
  id: string;
  userId: string;
  finalTotal: number;
  success: boolean;
  createdAt: string;
  chatMessageId?: string;
};

export type StoryEventOption = {
  id: string;
  label: string;
  check?: StoryEventCheckConfig;
  successOutcome?: string;
  failureOutcome?: string;
  closed: boolean;
  attempts: StoryEventOptionAttempt[];
};

export type StoryEventItem = {
  id: string;
  worldId: string;
  title: string;
  description: string;
  scope: StoryEventScopeView;
  targetUserId?: string;
  sceneId?: string;
  status: StoryEventStatusView;
  options: StoryEventOption[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  narrativeRequests: StoryNarrativeRequest[];
};

export type StoryNarrativeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type StoryNarrativeRequest = {
  id: string;
  eventId: string;
  userId: string;
  cost: number;
  reason: string;
  status: StoryNarrativeRequestStatus;
  gmNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoryEventSearchMessageItem = GlobalMessagePayload & {
  linkedEventId?: string;
  matchedBy: Array<"CHAT_CONTENT" | "EVENT_LINK">;
};

export type StoryEventSearchResult = {
  keyword: string;
  filters: {
    sceneId?: string;
    eventStatus: StoryEventStatusView | "ALL";
    channelKey: "OOC" | "IC" | "SYSTEM" | "ALL";
    hours?: number;
  };
  events: StoryEventItem[];
  messages: StoryEventSearchMessageItem[];
};

export type StoryEventSearchInput = {
  sceneId?: string;
  limit?: number;
  eventStatus?: StoryEventStatusView | "ALL";
  channelKey?: "OOC" | "IC" | "SYSTEM" | "ALL";
  hours?: number;
};

type StoryEventCreateInput = {
  title: string;
  description?: string;
  scope?: StoryEventScopeView;
  targetUserId?: string;
  sceneId?: string;
};

type StoryEventUpdateInput = {
  title?: string;
  description?: string;
  status?: "DRAFT" | "OPEN" | "CLOSED";
};

type StoryEventCreateOptionInput = {
  label: string;
  check?: StoryEventCheckConfig;
  successOutcome?: string;
  failureOutcome?: string;
};

type StoryEventSubmitCheckInput = {
  finalTotal: number;
  chatContent?: string;
};

type StoryEventResolveInput = {
  summary: string;
  processTimeline?: string[];
  finalOutcome?: string;
};

type StoryNarrativeRequestCreateInput = {
  cost?: number;
  reason: string;
};

type StoryNarrativeRequestDecisionInput = {
  status: "APPROVED" | "REJECTED";
  gmNote?: string;
};

type StoryEventRow = Awaited<ReturnType<typeof getStoryEventById>>;

function nowIso() {
  return new Date().toISOString();
}

function toScope(scope: StoryEventScopeView | undefined): StoryEventScope {
  return scope === "PLAYER" ? StoryEventScope.PLAYER : StoryEventScope.ALL;
}

function toStatus(status: StoryEventStatusView | undefined): StoryEventStatus {
  if (status === "DRAFT") {
    return StoryEventStatus.DRAFT;
  }
  if (status === "RESOLVED") {
    return StoryEventStatus.RESOLVED;
  }
  if (status === "CLOSED") {
    return StoryEventStatus.CLOSED;
  }
  return StoryEventStatus.OPEN;
}

function parseOptions(value: unknown): StoryEventOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const options: StoryEventOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<StoryEventOption>;
    const id = String(candidate.id ?? "").trim();
    const label = String(candidate.label ?? "").trim();
    if (!id || !label) {
      continue;
    }

    const checkRaw = candidate.check;
    let check: StoryEventCheckConfig | undefined;
    if (checkRaw && typeof checkRaw === "object") {
      const skillKey = String((checkRaw as any).skillKey ?? "").trim();
      const dc = Number((checkRaw as any).dc);
      const checkMode = String((checkRaw as any).checkMode ?? "") as StoryOptionCheckMode;
      if (skillKey && Number.isFinite(dc) && ["SINGLE", "PER_PLAYER", "UNLIMITED"].includes(checkMode)) {
        check = { skillKey, dc, checkMode };
      }
    }

    const attemptsRaw = Array.isArray(candidate.attempts) ? candidate.attempts : [];
    const attempts: StoryEventOptionAttempt[] = [];
    for (const attempt of attemptsRaw) {
      if (!attempt || typeof attempt !== "object") {
        continue;
      }

      const obj = attempt as Partial<StoryEventOptionAttempt>;
      const attemptId = String(obj.id ?? "").trim();
      const userId = String(obj.userId ?? "").trim();
      const finalTotal = Number(obj.finalTotal);
      const success = Boolean(obj.success);
      const createdAt = String(obj.createdAt ?? "").trim() || nowIso();
      if (!attemptId || !userId || !Number.isFinite(finalTotal)) {
        continue;
      }

      const chatMessageId = typeof obj.chatMessageId === "string" && obj.chatMessageId.trim() ? obj.chatMessageId.trim() : undefined;
      attempts.push({
        id: attemptId,
        userId,
        finalTotal,
        success,
        createdAt,
        chatMessageId
      });
    }

    options.push({
      id,
      label,
      check,
      successOutcome: typeof candidate.successOutcome === "string" && candidate.successOutcome.trim() ? candidate.successOutcome.trim() : undefined,
      failureOutcome: typeof candidate.failureOutcome === "string" && candidate.failureOutcome.trim() ? candidate.failureOutcome.trim() : undefined,
      closed: Boolean(candidate.closed),
      attempts
    });
  }

  return options;
}

function parseNarrativeRequests(value: unknown): StoryNarrativeRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const requests: StoryNarrativeRequest[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<StoryNarrativeRequest>;
    const id = String(candidate.id ?? "").trim();
    const eventId = String(candidate.eventId ?? "").trim();
    const userId = String(candidate.userId ?? "").trim();
    const cost = Number(candidate.cost);
    const reason = String(candidate.reason ?? "").trim();
    const status = String(candidate.status ?? "").trim() as StoryNarrativeRequestStatus;
    const createdAt = String(candidate.createdAt ?? "").trim() || nowIso();
    const updatedAt = String(candidate.updatedAt ?? "").trim() || createdAt;

    if (!id || !eventId || !userId || !Number.isFinite(cost) || !reason) {
      continue;
    }
    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      continue;
    }

    requests.push({
      id,
      eventId,
      userId,
      cost,
      reason,
      status,
      gmNote: typeof candidate.gmNote === "string" && candidate.gmNote.trim() ? candidate.gmNote.trim() : undefined,
      createdAt,
      updatedAt
    });
  }

  return requests;
}

function toStoryEventItem(row: NonNullable<StoryEventRow>): StoryEventItem {
  return {
    id: row.id,
    worldId: row.worldId,
    title: row.title,
    description: row.description,
    scope: row.scope,
    targetUserId: row.targetUserId ?? undefined,
    sceneId: row.sceneId ?? undefined,
    status: row.status,
    options: parseOptions(row.options),
    narrativeRequests: parseNarrativeRequests(row.narrativeRequests),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString()
  };
}

async function assertSceneInWorld(worldId: string, sceneId: string) {
  const found = await prisma.scene.findFirst({
    where: {
      id: sceneId,
      worldId
    },
    select: { id: true }
  });

  if (!found) {
    throw new Error("scene not found in world");
  }
}

async function assertActiveMember(worldId: string, userId: string) {
  const member = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    }
  });

  if (!member || member.status !== WorldMemberStatus.ACTIVE) {
    throw new Error("not a member of world");
  }

  return member;
}

async function assertGm(worldId: string, userId: string) {
  const member = await assertActiveMember(worldId, userId);
  if (member.role !== WorldRole.GM) {
    throw new Error("only gm can manage story event");
  }
}

async function getStoryEventById(worldId: string, eventId: string) {
  return prisma.storyEvent.findFirst({
    where: {
      id: eventId,
      worldId
    }
  });
}

async function getStoryEventOrThrow(worldId: string, eventId: string) {
  const found = await getStoryEventById(worldId, eventId);
  if (!found) {
    throw new Error("story event not found");
  }
  return found;
}

function validateCheckConfig(check?: StoryEventCheckConfig) {
  if (!check) {
    return;
  }

  const skillKey = String(check.skillKey ?? "").trim();
  const dc = Number(check.dc);
  if (!skillKey) {
    throw new Error("story option skillKey is required");
  }
  if (!Number.isFinite(dc) || dc < 0 || dc > 99) {
    throw new Error("story option dc is invalid");
  }
  if (!["SINGLE", "PER_PLAYER", "UNLIMITED"].includes(String(check.checkMode))) {
    throw new Error("story option checkMode is invalid");
  }
}

export async function createStoryEvent(worldId: string, userId: string, input: StoryEventCreateInput): Promise<StoryEventItem> {
  await assertGm(worldId, userId);

  const title = String(input.title ?? "").trim();
  if (!title) {
    throw new Error("story event title is required");
  }

  const scope = toScope(input.scope);
  const targetUserId = input.targetUserId?.trim();
  if (scope === StoryEventScope.PLAYER && !targetUserId) {
    throw new Error("target user is required for player scope");
  }

  if (targetUserId) {
    await assertActiveMember(worldId, targetUserId);
  }

  const sceneId = input.sceneId?.trim();
  if (sceneId) {
    await assertSceneInWorld(worldId, sceneId);
  }

  const created = await prisma.storyEvent.create({
    data: {
      worldId,
      title,
      description: String(input.description ?? "").trim(),
      scope,
      targetUserId,
      sceneId,
      status: StoryEventStatus.OPEN,
      options: [],
      narrativeRequests: [],
      createdBy: userId
    }
  });

  return toStoryEventItem(created);
}

export async function listStoryEvents(worldId: string, userId: string): Promise<StoryEventItem[]> {
  const member = await assertActiveMember(worldId, userId);
  const isGm = member.role === WorldRole.GM;

  const where: Prisma.StoryEventWhereInput = {
    worldId
  };

  if (!isGm) {
    where.OR = [{ scope: StoryEventScope.ALL }, { targetUserId: userId }];
  }

  const rows = await prisma.storyEvent.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    }
  });

  return rows.map(toStoryEventItem);
}

export async function updateStoryEvent(worldId: string, eventId: string, userId: string, input: StoryEventUpdateInput): Promise<StoryEventItem> {
  await assertGm(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);

  const data: Prisma.StoryEventUpdateInput = {};
  if (typeof input.title === "string") {
    const nextTitle = input.title.trim();
    if (!nextTitle) {
      throw new Error("story event title is required");
    }
    data.title = nextTitle;
  }

  if (typeof input.description === "string") {
    data.description = input.description.trim();
  }

  if (typeof input.status === "string") {
    if (!["DRAFT", "OPEN", "CLOSED"].includes(input.status)) {
      throw new Error("story event status is invalid");
    }
    data.status = toStatus(input.status);
  }

  const updated = await prisma.storyEvent.update({
    where: { id: found.id },
    data
  });

  return toStoryEventItem(updated);
}

export async function addStoryEventOption(worldId: string, eventId: string, userId: string, input: StoryEventCreateOptionInput): Promise<StoryEventItem> {
  await assertGm(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);

  if (found.status === StoryEventStatus.CLOSED || found.status === StoryEventStatus.RESOLVED) {
    throw new Error("story event is closed");
  }

  const label = String(input.label ?? "").trim();
  if (!label) {
    throw new Error("story option label is required");
  }
  validateCheckConfig(input.check);

  const options = parseOptions(found.options);
  options.push({
    id: `seo_${randomUUID()}`,
    label,
    check: input.check
      ? {
          skillKey: input.check.skillKey.trim(),
          dc: Number(input.check.dc),
          checkMode: input.check.checkMode
        }
      : undefined,
    successOutcome: typeof input.successOutcome === "string" ? input.successOutcome.trim() : undefined,
    failureOutcome: typeof input.failureOutcome === "string" ? input.failureOutcome.trim() : undefined,
    closed: false,
    attempts: []
  });

  const updated = await prisma.storyEvent.update({
    where: { id: found.id },
    data: {
      options
    }
  });

  return toStoryEventItem(updated);
}

function canAttemptOption(option: StoryEventOption, userId: string): boolean {
  if (option.closed) {
    return false;
  }

  const mode = option.check?.checkMode;
  if (!mode) {
    return option.attempts.length === 0;
  }

  if (mode === "UNLIMITED") {
    return true;
  }

  if (mode === "SINGLE") {
    return option.attempts.length === 0;
  }

  return !option.attempts.some((item) => item.userId === userId);
}

export async function submitStoryEventCheck(worldId: string, eventId: string, optionId: string, userId: string, input: StoryEventSubmitCheckInput): Promise<StoryEventItem> {
  await assertActiveMember(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);
  const event = toStoryEventItem(found);

  if (event.scope === "PLAYER" && event.targetUserId && event.targetUserId !== userId) {
    throw new Error("story event is not visible to current player");
  }

  if (event.status !== "OPEN") {
    throw new Error("story event is not open");
  }

  const option = event.options.find((item) => item.id === optionId);
  if (!option) {
    throw new Error("story option not found");
  }

  if (!canAttemptOption(option, userId)) {
    throw new Error("story option cannot be attempted");
  }

  const finalTotal = Number(input.finalTotal);
  if (!Number.isFinite(finalTotal) || finalTotal < -99 || finalTotal > 999) {
    throw new Error("final check total is invalid");
  }

  const dc = option.check?.dc ?? 0;
  const success = finalTotal >= dc;

  const attempt: StoryEventOptionAttempt = {
    id: `seat_${randomUUID()}`,
    userId,
    finalTotal,
    success,
    createdAt: nowIso()
  };

  if (typeof input.chatContent === "string" && input.chatContent.trim()) {
    const tagged = await createWorldMessage(userId, worldId, input.chatContent.trim(), "OOC", event.sceneId);
    attempt.chatMessageId = tagged.id;

    await prisma.message.update({
      where: { id: tagged.id },
      data: {
        metadata: {
          sceneId: event.sceneId,
          storyEventCheckTag: {
            eventId: event.id,
            optionId: option.id,
            eventTitle: event.title,
            optionLabel: option.label,
            skillKey: option.check?.skillKey,
            dc,
            finalTotal,
            success
          }
        }
      }
    });
  }

  option.attempts.push(attempt);
  if (option.check?.checkMode === "SINGLE") {
    option.closed = true;
  }

  const updated = await prisma.storyEvent.update({
    where: { id: event.id },
    data: {
      options: event.options
    }
  });

  return toStoryEventItem(updated);
}

export async function resolveStoryEvent(worldId: string, eventId: string, userId: string, input: StoryEventResolveInput): Promise<StoryEventItem> {
  await assertGm(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);
  const event = toStoryEventItem(found);

  const summary = String(input.summary ?? "").trim();
  if (!summary) {
    throw new Error("story event summary is required");
  }

  const timeline = Array.isArray(input.processTimeline)
    ? input.processTimeline.map((item) => String(item).trim()).filter(Boolean)
    : [];

  const resolvedAt = new Date();
  const updated = await prisma.storyEvent.update({
    where: { id: event.id },
    data: {
      status: StoryEventStatus.RESOLVED,
      resolvedAt,
      summary,
      finalOutcome: input.finalOutcome?.trim() || null,
      processTimeline: timeline
    }
  });

  const cardText = [
    `[事件结算卡片] ${event.title}`,
    summary,
    timeline.length > 0 ? `经过：${timeline.join("；")}` : "",
    input.finalOutcome?.trim() ? `后果：${input.finalOutcome.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const created = await createWorldMessage(userId, worldId, cardText, "SYSTEM", event.sceneId);
  await prisma.message.update({
    where: { id: created.id },
    data: {
      metadata: {
        sceneId: event.sceneId,
        storyEventCard: {
          eventId: event.id,
          title: event.title,
          summary,
          timeline,
          finalOutcome: input.finalOutcome?.trim() || null,
          resolvedAt: resolvedAt.toISOString()
        }
      }
    }
  });

  return toStoryEventItem(updated);
}

export async function createStoryNarrativeRequest(
  worldId: string,
  eventId: string,
  userId: string,
  input: StoryNarrativeRequestCreateInput
): Promise<StoryEventItem> {
  await assertActiveMember(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);
  const event = toStoryEventItem(found);

  if (event.scope === "PLAYER" && event.targetUserId && event.targetUserId !== userId) {
    throw new Error("story event is not visible to current player");
  }
  if (event.status !== "OPEN") {
    throw new Error("story event is not open");
  }

  const reason = String(input.reason ?? "").trim();
  if (!reason) {
    throw new Error("narrative request reason is required");
  }

  const cost = Math.max(1, Math.floor(Number(input.cost) || 1));
  const requests = [...event.narrativeRequests];
  requests.push({
    id: `snr_${randomUUID()}`,
    eventId: event.id,
    userId,
    cost,
    reason,
    status: "PENDING",
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  const updated = await prisma.storyEvent.update({
    where: { id: event.id },
    data: {
      narrativeRequests: requests
    }
  });

  const tagged = await createWorldMessage(userId, worldId, `提交物语点提案（消耗${cost}）：${reason}`, "OOC", event.sceneId);
  await prisma.message.update({
    where: { id: tagged.id },
    data: {
      metadata: {
        sceneId: event.sceneId,
        storyPointProposalTag: {
          eventId: event.id,
          eventTitle: event.title,
          proposerUserId: userId,
          cost,
          reason,
          status: "PENDING"
        }
      }
    }
  });

  return toStoryEventItem(updated);
}

export async function decideStoryNarrativeRequest(
  worldId: string,
  eventId: string,
  requestId: string,
  userId: string,
  input: StoryNarrativeRequestDecisionInput
): Promise<StoryEventItem> {
  await assertGm(worldId, userId);
  const found = await getStoryEventOrThrow(worldId, eventId);
  const event = toStoryEventItem(found);

  const status = input.status;
  if (status !== "APPROVED" && status !== "REJECTED") {
    throw new Error("narrative request status is invalid");
  }

  const requests = [...event.narrativeRequests];
  const idx = requests.findIndex((item) => item.id === requestId);
  if (idx < 0) {
    throw new Error("narrative request not found");
  }
  if (requests[idx].status !== "PENDING") {
    throw new Error("narrative request is not pending");
  }

  const gmNote = String(input.gmNote ?? "").trim();
  requests[idx] = {
    ...requests[idx],
    status,
    gmNote: gmNote || undefined,
    updatedAt: nowIso()
  };

  const updated = await prisma.storyEvent.update({
    where: { id: event.id },
    data: {
      narrativeRequests: requests
    }
  });

  const decisionText = status === "APPROVED" ? "通过" : "驳回";
  const detail = gmNote ? `（GM备注：${gmNote}）` : "";
  const card = `【物语点提案裁决】${event.title}\n提案人：${requests[idx].userId}\n结果：${decisionText}${detail}`;
  const created = await createWorldMessage(userId, worldId, card, "SYSTEM", event.sceneId);
  await prisma.message.update({
    where: { id: created.id },
    data: {
      metadata: {
        sceneId: event.sceneId,
        storyPointProposalDecisionTag: {
          eventId: event.id,
          requestId,
          status,
          gmNote: gmNote || null
        }
      }
    }
  });

  return toStoryEventItem(updated);
}

export async function listStoryEventCards(worldId: string, userId: string, limit = 20) {
  await assertActiveMember(worldId, userId);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const rows = await prisma.message.findMany({
    where: {
      type: MessageType.WORLD,
      worldId,
      channelKey: "SYSTEM"
    },
    include: {
      fromUser: {
        select: { id: true, username: true, displayName: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(safeLimit * 5, 300)
  });

  return rows
    .filter((item) => {
      const metadata = item.metadata as { storyEventCard?: unknown } | null;
      return Boolean(metadata?.storyEventCard);
    })
    .slice(0, safeLimit)
    .map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      fromUser: item.fromUser,
      metadata: item.metadata
    }));
}

export async function searchStoryEventsAndMessages(
  worldId: string,
  userId: string,
  keyword: string,
  input: StoryEventSearchInput = {}
): Promise<StoryEventSearchResult> {
  const member = await assertActiveMember(worldId, userId);
  const isGm = member.role === WorldRole.GM;

  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    throw new Error("search keyword is required");
  }
  if (normalizedKeyword.length > 80) {
    throw new Error("search keyword is too long");
  }

  const normalized = normalizeStoryEventSearchInput(input);
  const normalizedSceneId = normalized.sceneId;
  if (normalizedSceneId) {
    await assertSceneInWorld(worldId, normalizedSceneId);
  }

  const safeLimit = normalized.limit;
  const keywordLower = normalizedKeyword.toLowerCase();
  const normalizedEventStatus = normalized.eventStatus;
  const normalizedChannelKey = normalized.channelKey;
  const normalizedHours = normalized.hours;
  const sinceDate = normalized.sinceDate;

  const where: Prisma.StoryEventWhereInput = {
    worldId
  };
  const eventStatus = toStoryEventStatus(normalizedEventStatus);
  if (eventStatus) {
    where.status = toStatus(eventStatus);
  }

  const messageChannelKey = toMessageChannelKey(normalizedChannelKey);
  if (!isGm) {
    where.OR = [{ scope: StoryEventScope.ALL }, { targetUserId: userId }];
  }

  const eventRows = await prisma.storyEvent.findMany({
    where,
    orderBy: {
      updatedAt: "desc"
    },
    take: 200
  });

  const allVisibleEvents = eventRows.map(toStoryEventItem);
  const matchedEventMap = new Map<string, StoryEventItem>();
  const matchedEventIds = new Set<string>();

  for (const event of allVisibleEvents) {
    if (includesKeyword(toStoryEventSearchText(event), keywordLower)) {
      matchedEventMap.set(event.id, event);
      matchedEventIds.add(event.id);
    }
  }

  const rawMessages = await prisma.message.findMany({
    where: {
      type: MessageType.WORLD,
      worldId,
      ...(messageChannelKey ? { channelKey: messageChannelKey } : {}),
      ...(sinceDate ? { createdAt: { gte: sinceDate } } : {})
    },
    include: {
      fromUser: {
        select: { id: true, username: true, displayName: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(safeLimit * 20, 800)
  });

  const mappedMessages: StoryEventSearchMessageItem[] = [];
  const linkedEventIds = new Set<string>();

  for (const row of rawMessages) {
    const messageSceneId = extractSceneIdFromMetadata(row.metadata);
    if (normalizedSceneId && messageSceneId !== normalizedSceneId) {
      continue;
    }

    const linkedEventId = extractLinkedStoryEventIdFromMessageMetadata(row.metadata);
    const matchedBy: Array<"CHAT_CONTENT" | "EVENT_LINK"> = [];
    if (includesKeyword(row.content, keywordLower)) {
      matchedBy.push("CHAT_CONTENT");
    }
    if (linkedEventId && matchedEventIds.has(linkedEventId)) {
      matchedBy.push("EVENT_LINK");
    }

    if (matchedBy.length === 0) {
      continue;
    }

    if (linkedEventId) {
      linkedEventIds.add(linkedEventId);
    }

    mappedMessages.push({
      id: row.id,
      worldId: row.worldId ?? undefined,
      channelKey: row.channelKey ?? undefined,
      sceneId: messageSceneId,
      content: row.content,
      metadata: row.metadata ?? undefined,
      createdAt: row.createdAt.toISOString(),
      fromUser: row.fromUser,
      linkedEventId,
      matchedBy
    });
  }

  for (const linkedEventId of linkedEventIds) {
    const event = allVisibleEvents.find((item) => item.id === linkedEventId);
    if (event) {
      matchedEventMap.set(event.id, event);
    }
  }

  const events = Array.from(matchedEventMap.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, safeLimit);
  const messages = mappedMessages.slice(0, safeLimit);

  return {
    keyword: normalizedKeyword,
    filters: {
      sceneId: normalizedSceneId,
      eventStatus: normalizedEventStatus,
      channelKey: normalizedChannelKey,
      hours: normalizedHours
    },
    events,
    messages
  };
}
