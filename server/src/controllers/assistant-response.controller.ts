import type { Request, Response } from "express";
import { createWorldAssistantResponse } from "../services/assistant-response.service";

function toStatus(message: string): number {
  if (message === "not a member of world" || message === "only gm or assistant can trigger ai assistant") {
    return 403;
  }
  if (message === "scene not found in world") {
    return 400;
  }
  return 500;
}

export async function postWorldAssistantResponseController(req: Request, res: Response) {
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

    const data = await createWorldAssistantResponse(req.params.worldId, req.userId, req.body ?? {});
    res.status(201).json({
      success: true,
      data,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "WORLD_ASSISTANT_RESPONSE_ERROR", message },
      requestId: req.requestId
    });
  }
}
