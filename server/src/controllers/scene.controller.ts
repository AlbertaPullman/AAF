import type { Request, Response } from "express";
import {
  advanceSceneCombatTurn,
  createScene,
  deleteScene,
  getSceneCombatState,
  getSceneVisualState,
  listScenes,
  moveSceneSort,
  patchSceneVisualState,
  putSceneCombatState,
  renameScene,
  type SceneCombatInput,
  type SceneVisualInput
} from "../services/scene.service";

export async function getWorldScenes(req: Request, res: Response) {
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

    const scenes = await listScenes(req.params.worldId, req.userId);
    res.status(200).json({
      success: true,
      data: scenes,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldScene(req: Request, res: Response) {
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

    const scene = await createScene(req.params.worldId, req.userId, String(req.body?.name ?? ""));
    res.status(201).json({
      success: true,
      data: scene,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : message === "only gm can create scene" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function putWorldScene(req: Request, res: Response) {
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

    const scene = await renameScene(req.params.worldId, req.params.sceneId, req.userId, String(req.body?.name ?? ""));
    res.status(200).json({
      success: true,
      data: scene,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can rename scene"
        ? 403
        : message === "scene not found in world"
        ? 404
        : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_RENAME_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function deleteWorldScene(req: Request, res: Response) {
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

    await deleteScene(req.params.worldId, req.params.sceneId, req.userId);
    res.status(200).json({
      success: true,
      data: { deleted: true, sceneId: req.params.sceneId },
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can delete scene"
        ? 403
        : message === "scene not found in world"
        ? 404
        : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_DELETE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function patchWorldSceneSort(req: Request, res: Response) {
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

    const rawDirection = String(req.body?.direction ?? "").toUpperCase();
    const direction = rawDirection === "UP" || rawDirection === "DOWN" ? rawDirection : null;
    if (!direction) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: "SCENE_SORT_ERROR", message: "direction must be UP or DOWN" },
        requestId: req.requestId
      });
      return;
    }

    const scenes = await moveSceneSort(req.params.worldId, req.params.sceneId, req.userId, direction);
    res.status(200).json({
      success: true,
      data: scenes,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can sort scene"
        ? 403
        : message === "scene not found in world"
        ? 404
        : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_SORT_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldSceneVisual(req: Request, res: Response) {
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

    const visual = await getSceneVisualState(req.params.worldId, req.params.sceneId, req.userId);
    res.status(200).json({
      success: true,
      data: visual,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world"
        ? 403
        : message === "scene not found in world" || message === "scene not found for world"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_VISUAL_GET_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function patchWorldSceneVisual(req: Request, res: Response) {
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

    const visual = await patchSceneVisualState(
      req.params.worldId,
      req.params.sceneId,
      req.userId,
      (req.body ?? {}) as SceneVisualInput
    );

    res.status(200).json({
      success: true,
      data: visual,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can manage scene battle state"
        ? 403
        : message === "scene not found in world" || message === "scene not found for world"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_VISUAL_PATCH_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldSceneCombat(req: Request, res: Response) {
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

    const combat = await getSceneCombatState(req.params.worldId, req.params.sceneId, req.userId);
    res.status(200).json({
      success: true,
      data: combat,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world"
        ? 403
        : message === "scene not found in world" || message === "scene not found for world"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_COMBAT_GET_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function putWorldSceneCombat(req: Request, res: Response) {
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

    const combat = await putSceneCombatState(
      req.params.worldId,
      req.params.sceneId,
      req.userId,
      (req.body ?? {}) as SceneCombatInput
    );

    res.status(200).json({
      success: true,
      data: combat,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can manage scene battle state"
        ? 403
        : message === "scene not found in world" || message === "scene not found for world"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_COMBAT_PUT_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldSceneCombatNextTurn(req: Request, res: Response) {
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

    const combat = await advanceSceneCombatTurn(req.params.worldId, req.params.sceneId, req.userId);
    res.status(200).json({
      success: true,
      data: combat,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "not a member of world" || message === "only gm can manage scene battle state"
        ? 403
        : message === "scene not found in world" || message === "scene not found for world"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "SCENE_COMBAT_NEXT_TURN_ERROR", message },
      requestId: req.requestId
    });
  }
}
