import type { Request, Response } from "express";
import { WorldVisibility } from "@prisma/client";
import { prisma } from "../lib/prisma";
import * as worldService from "../services/world.service";

function parseVisibility(value: unknown): WorldVisibility {
  const candidate = typeof value === "string" ? value.toUpperCase() : "PUBLIC";
  if (candidate === "PUBLIC" || candidate === "PASSWORD" || candidate === "FRIENDS" || candidate === "PRIVATE") {
    return candidate;
  }
  return WorldVisibility.PUBLIC;
}

export async function createWorld(req: Request, res: Response) {
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

    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { platformRole: true }
    });

    if (!currentUser) {
      res.status(404).json({
        success: false,
        data: null,
        error: { code: "USER_NOT_FOUND", message: "user not found" },
        requestId: req.requestId
      });
      return;
    }

    const visibility = parseVisibility(req.body?.visibility);
    const allowed = worldService.getAvailableCreateVisibilities(currentUser.platformRole);
    if (!allowed.includes(visibility)) {
      res.status(403).json({
        success: false,
        data: null,
        error: { code: "WORLD_VISIBILITY_FORBIDDEN", message: "visibility is not allowed for current role" },
        requestId: req.requestId
      });
      return;
    }

    const world = await worldService.createWorld({
      ownerId: req.userId,
      name: req.body?.name,
      description: req.body?.description,
      visibility,
      password: req.body?.password,
      coverImageDataUrl: req.body?.coverImageDataUrl
    });

    res.status(201).json({
      success: true,
      data: world,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(400).json({
      success: false,
      data: null,
      error: { code: "WORLD_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function listWorlds(req: Request, res: Response) {
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

    const scope = req.query.scope;
    if (scope === "mine") {
      const worlds = await worldService.listMyWorlds(req.userId);
      res.status(200).json({
        success: true,
        data: worlds,
        error: null,
        requestId: req.requestId
      });
      return;
    }

    const visibility = typeof req.query.visibility === "string" ? parseVisibility(req.query.visibility) : undefined;
    const sortBy = req.query.sortBy === "activeMembers" ? "activeMembers" : "createdAt";
    const order = req.query.order === "asc" ? "asc" : "desc";
    const enforceAccess = scope !== "all";

    const worlds = await worldService.listVisibleWorlds(req.userId, visibility, sortBy, order, enforceAccess);

    res.status(200).json({
      success: true,
      data: worlds,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({
      success: false,
      data: null,
      error: { code: "WORLD_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function joinWorld(req: Request, res: Response) {
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

    const joined = await worldService.joinWorld(req.params.worldId, req.userId, req.body?.inviteCode);

    res.status(200).json({
      success: true,
      data: joined,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_JOIN_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function deleteWorld(req: Request, res: Response) {
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

    const result = await worldService.deleteWorld(req.params.worldId, req.userId);
    res.status(200).json({
      success: true,
      data: result,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_DELETE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldDetail(req: Request, res: Response) {
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

    const world = await worldService.getWorldDetail(req.params.worldId, req.userId);
    res.status(200).json({
      success: true,
      data: world,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_GET_ERROR", message },
      requestId: req.requestId
    });
  }
}
