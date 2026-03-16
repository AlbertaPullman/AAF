export type StoryOptionCheckMode = "SINGLE" | "PER_PLAYER" | "UNLIMITED";
export type StoryEventScopeView = "ALL" | "PLAYER";
export type StoryEventStatusView = "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED";

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

export type StoryEventSearchInput = {
  sceneId?: string;
  limit?: number;
  eventStatus?: StoryEventStatusView | "ALL";
  channelKey?: "OOC" | "IC" | "SYSTEM" | "ALL";
  hours?: number;
};

export type StoryEventSearchNormalizedInput = {
  sceneId?: string;
  limit: number;
  eventStatus: StoryEventStatusView | "ALL";
  channelKey: "OOC" | "IC" | "SYSTEM" | "ALL";
  hours?: number;
  sinceDate?: Date;
};

export function includesKeyword(value: string | undefined, keywordLower: string): boolean {
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes(keywordLower);
}

export function toStoryEventSearchText(event: StoryEventItem): string {
  const parts: string[] = [event.title, event.description];
  for (const option of event.options) {
    parts.push(option.label, option.successOutcome ?? "", option.failureOutcome ?? "", option.check?.skillKey ?? "");
  }
  for (const request of event.narrativeRequests) {
    parts.push(request.reason, request.gmNote ?? "", request.status);
  }
  return parts.join("\n");
}

export function extractLinkedStoryEventIdFromMessageMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const candidate = metadata as {
    storyEventCheckTag?: { eventId?: unknown };
    storyEventCard?: { eventId?: unknown };
    storyPointProposalTag?: { eventId?: unknown };
    storyPointProposalDecisionTag?: { eventId?: unknown };
  };

  const ids = [
    candidate.storyEventCheckTag?.eventId,
    candidate.storyEventCard?.eventId,
    candidate.storyPointProposalTag?.eventId,
    candidate.storyPointProposalDecisionTag?.eventId
  ];

  for (const id of ids) {
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }

  return undefined;
}

export function normalizeStoryEventSearchInput(input: StoryEventSearchInput = {}): StoryEventSearchNormalizedInput {
  const sceneId = input.sceneId?.trim() || undefined;
  const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);

  const eventStatus = (input.eventStatus ?? "ALL") as StoryEventStatusView | "ALL";
  if (!["ALL", "DRAFT", "OPEN", "RESOLVED", "CLOSED"].includes(eventStatus)) {
    throw new Error("search event status is invalid");
  }

  const channelKey = (input.channelKey ?? "ALL") as "OOC" | "IC" | "SYSTEM" | "ALL";
  if (!["ALL", "OOC", "IC", "SYSTEM"].includes(channelKey)) {
    throw new Error("search channel key is invalid");
  }

  const hoursRaw = Number(input.hours);
  const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(Math.floor(hoursRaw), 24 * 30) : undefined;
  const sinceDate = hours ? new Date(Date.now() - hours * 60 * 60 * 1000) : undefined;

  return {
    sceneId,
    limit,
    eventStatus,
    channelKey,
    hours,
    sinceDate
  };
}

export function toStoryEventStatus(status: StoryEventStatusView | "ALL"): StoryEventStatusView | undefined {
  if (status === "ALL") {
    return undefined;
  }
  return status;
}

export function toMessageChannelKey(channelKey: "OOC" | "IC" | "SYSTEM" | "ALL"): "OOC" | "IC" | "SYSTEM" | undefined {
  if (channelKey === "ALL") {
    return undefined;
  }
  return channelKey;
}
