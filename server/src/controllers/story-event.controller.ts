import type { Request, Response } from "express";
import {
  addStoryEventOption,
  createStoryNarrativeRequest,
  createStoryEvent,
  decideStoryNarrativeRequest,
  listStoryEventCards,
  listStoryEvents,
  searchStoryEventsAndMessages,
  resolveStoryEvent,
  submitStoryEventCheck,
  updateStoryEvent
} from "../services/story-event.service";

function toStatus(errorMessage: string): number {
  if (errorMessage === "not a member of world") {
    return 403;
  }
  if (errorMessage === "only gm can manage story event") {
    return 403;
  }
  if (
    errorMessage.includes("not found") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("required") ||
    errorMessage.includes("cannot be attempted") ||
    errorMessage.includes("not open") ||
    errorMessage.includes("closed")
  ) {
    return 400;
  }
  return 500;
}

export async function getWorldStoryEvents(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "User not authenticated" },
        requestId: req.requestId
      });
      return;
    }

    const data = await listStoryEvents(req.params.worldId, req.userId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEvent(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await createStoryEvent(req.params.worldId, req.userId, req.body ?? {});
    res.status(201).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function patchWorldStoryEvent(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await updateStoryEvent(req.params.worldId, req.params.eventId, req.userId, req.body ?? {});
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_UPDATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEventOption(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await addStoryEventOption(req.params.worldId, req.params.eventId, req.userId, req.body ?? {});
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_OPTION_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEventCheck(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await submitStoryEventCheck(
      req.params.worldId,
      req.params.eventId,
      req.params.optionId,
      req.userId,
      req.body ?? {}
    );
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_CHECK_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEventResolve(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await resolveStoryEvent(req.params.worldId, req.params.eventId, req.userId, req.body ?? {});
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_RESOLVE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEventNarrativeRequest(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await createStoryNarrativeRequest(req.params.worldId, req.params.eventId, req.userId, req.body ?? {});
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_NARRATIVE_REQUEST_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldStoryEventNarrativeRequestDecision(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await decideStoryNarrativeRequest(
      req.params.worldId,
      req.params.eventId,
      req.params.requestId,
      req.userId,
      req.body ?? {}
    );
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_NARRATIVE_REQUEST_DECISION_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldStoryEventCards(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const data = await listStoryEventCards(req.params.worldId, req.userId, Number(req.query.limit ?? 20));
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_CARD_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldStoryEventSearch(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    const keyword = String(req.query.q ?? req.query.keyword ?? "");
    const sceneId = typeof req.query.sceneId === "string" ? req.query.sceneId : undefined;
    const eventStatus = typeof req.query.eventStatus === "string" ? req.query.eventStatus : undefined;
    const channelKey = typeof req.query.channelKey === "string" ? req.query.channelKey : undefined;
    const limit = Number(req.query.limit ?? 20);
    const hours = Number(req.query.hours);
    const data = await searchStoryEventsAndMessages(req.params.worldId, req.userId, keyword, {
      sceneId,
      eventStatus: eventStatus as "ALL" | "DRAFT" | "OPEN" | "RESOLVED" | "CLOSED" | undefined,
      channelKey: channelKey as "ALL" | "OOC" | "IC" | "SYSTEM" | undefined,
      limit,
      hours
    });
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "STORY_EVENT_SEARCH_ERROR", message },
      requestId: req.requestId
    });
  }
}
