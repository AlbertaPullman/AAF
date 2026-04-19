import type { Request, Response } from "express";
import { executeWorldAbility, type ExecuteWorldAbilityInput } from "../services/ability-engine.service";

function mapAbilityExecutionErrorStatus(message: string): number {
  if (message === "not a member of world" || message === "permission denied") {
    return 403;
  }

  if (
    message === "ability not found" ||
    message === "actor character not found" ||
    message === "scene not found in world" ||
    message === "scene not found for world"
  ) {
    return 404;
  }

  if (
    message.includes("is required") ||
    message.includes("not met") ||
    message.includes("invalid")
  ) {
    return 400;
  }

  return 400;
}

export async function postWorldSceneAbilityExecute(req: Request, res: Response) {
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

    const data = await executeWorldAbility(
      req.params.worldId,
      req.params.sceneId,
      req.params.abilityId,
      req.userId,
      (req.body ?? {}) as ExecuteWorldAbilityInput
    );

    res.status(200).json({
      success: true,
      data,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(mapAbilityExecutionErrorStatus(message)).json({
      success: false,
      data: null,
      error: { code: "WORLD_ABILITY_EXECUTE_ERROR", message },
      requestId: req.requestId
    });
  }
}
