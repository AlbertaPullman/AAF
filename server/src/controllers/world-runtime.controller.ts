import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getWorldRuntimeState, setWorldRuntimeState } from "../modules/world-runtime/world-runtime.service";
import {
  ModuleRegistryError,
  RuntimeModuleState
} from "../modules/runtime/module.types";
import {
  disableRuntimeModule,
  enableRuntimeModule,
  ensureDefaultRuntimeModules,
  listRuntimeModules
} from "../modules/runtime/module-registry";

async function assertCanViewWorldRuntime(worldId: string, userId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { id: true, ownerId: true }
  });

  if (!world) {
    throw new Error("world not found");
  }

  if (world.ownerId === userId) {
    return;
  }

  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    },
    select: {
      status: true
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("forbidden");
  }
}

async function assertCanManageWorldRuntime(worldId: string, userId: string) {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { id: true }
  });

  if (!world) {
    throw new Error("world not found");
  }

  const membership = await prisma.worldMember.findUnique({
    where: {
      worldId_userId: {
        worldId,
        userId
      }
    },
    select: {
      role: true,
      status: true
    }
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("forbidden");
  }

  if (membership.role !== "GM" && membership.role !== "ASSISTANT") {
    throw new Error("permission denied");
  }
}

function mapModuleRegistryErrorStatus(error: ModuleRegistryError): number {
  if (error.code === "MODULE_NOT_FOUND") {
    return 404;
  }
  if (error.code === "MODULE_ARGUMENT_INVALID" || error.code === "MODULE_DEPENDENCY_INVALID") {
    return 400;
  }
  return 400;
}

function parseModuleStatus(input: unknown): "enabled" | "disabled" {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (normalized === "enabled") {
    return "enabled";
  }
  if (normalized === "disabled") {
    return "disabled";
  }
  throw new Error("module status must be enabled or disabled");
}

export async function getWorldRuntime(req: Request, res: Response) {
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

    const worldId = req.params.worldId;
    await assertCanViewWorldRuntime(worldId, req.userId);
    const runtime = getWorldRuntimeState(worldId);

    res.status(200).json({
      success: true,
      data: runtime,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_RUNTIME_GET_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function patchWorldRuntime(req: Request, res: Response) {
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

    const worldId = req.params.worldId;
    await assertCanManageWorldRuntime(worldId, req.userId);
    const runtime = setWorldRuntimeState({
      worldId,
      status: String(req.body?.status ?? ""),
      message: typeof req.body?.message === "string" ? req.body.message : null
    });

    res.status(200).json({
      success: true,
      data: runtime,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "world not found"
        ? 404
        : message === "forbidden" || message === "permission denied"
        ? 403
        : message === "invalid world runtime status"
          ? 400
          : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_RUNTIME_PATCH_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldRuntimeModules(req: Request, res: Response) {
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

    const worldId = req.params.worldId;
    await assertCanViewWorldRuntime(worldId, req.userId);
    ensureDefaultRuntimeModules(worldId);
    const modules = listRuntimeModules(worldId);

    res.status(200).json({
      success: true,
      data: modules,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_RUNTIME_MODULE_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function patchWorldRuntimeModule(req: Request, res: Response) {
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

    const worldId = req.params.worldId;
    const moduleKey = String(req.params.moduleKey ?? "");
    await assertCanManageWorldRuntime(worldId, req.userId);
    ensureDefaultRuntimeModules(worldId);

    const status = parseModuleStatus(req.body?.status);
    let moduleState: RuntimeModuleState;
    if (status === "enabled") {
      moduleState = enableRuntimeModule({ worldId, moduleKey });
    } else {
      moduleState = disableRuntimeModule({ worldId, moduleKey });
    }

    res.status(200).json({
      success: true,
      data: moduleState,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    if (error instanceof ModuleRegistryError) {
      const status = mapModuleRegistryErrorStatus(error);
      res.status(status).json({
        success: false,
        data: null,
        error: { code: "WORLD_RUNTIME_MODULE_PATCH_ERROR", message: error.message },
        requestId: req.requestId
      });
      return;
    }

    const message = error instanceof Error ? error.message : "unknown error";
    const status =
      message === "world not found"
        ? 404
        : message === "forbidden" || message === "permission denied"
        ? 403
        : 400;

    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_RUNTIME_MODULE_PATCH_ERROR", message },
      requestId: req.requestId
    });
  }
}
