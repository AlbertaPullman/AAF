import type { Request, Response } from "express";
import { getWorldAssistantContext } from "../services/assistant-context.service";

function toStatus(message: string): number {
  if (message === "not a member of world") {
    return 403;
  }
  if (message === "scene not found in world") {
    return 400;
  }
  return 500;
}

export async function getWorldAssistantContextController(req: Request, res: Response) {
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

    const data = await getWorldAssistantContext(req.params.worldId, req.userId, {
      sceneId: typeof req.query.sceneId === "string" ? req.query.sceneId : undefined,
      hours: Number(req.query.hours),
      cardLimit: Number(req.query.cardLimit),
      messageLimit: Number(req.query.messageLimit)
    });

    res.status(200).json({
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
      error: { code: "WORLD_ASSISTANT_CONTEXT_ERROR", message },
      requestId: req.requestId
    });
  }
}
