import type { Request, Response } from "express";
import {
  listSceneSettlementLogs,
  resolveSceneSettlementAction,
  type SettlementResolveInput
} from "../services/settlement.service";

function mapSettlementErrorStatus(message: string): number {
  if (message === "not a member of world" || message === "permission denied") {
    return 403;
  }
  if (message === "scene not found in world" || message === "scene not found for world") {
    return 404;
  }
  if (
    message.includes("is required") ||
    message.includes("invalid") ||
    message.includes("must be")
  ) {
    return 400;
  }
  return 400;
}

export async function postWorldSceneSettlementResolve(req: Request, res: Response) {
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

    const data = await resolveSceneSettlementAction(
      req.params.worldId,
      req.params.sceneId,
      req.userId,
      (req.body ?? {}) as SettlementResolveInput
    );

    res.status(200).json({
      success: true,
      data,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(mapSettlementErrorStatus(message)).json({
      success: false,
      data: null,
      error: { code: "SCENE_SETTLEMENT_RESOLVE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldSceneSettlementLogs(req: Request, res: Response) {
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

    const logs = await listSceneSettlementLogs(req.params.worldId, req.params.sceneId, req.userId);

    res.status(200).json({
      success: true,
      data: logs,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(mapSettlementErrorStatus(message)).json({
      success: false,
      data: null,
      error: { code: "SCENE_SETTLEMENT_LOGS_GET_ERROR", message },
      requestId: req.requestId
    });
  }
}
