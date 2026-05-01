import type { Request, Response } from "express";
import type { FolderType } from "../../../shared/types/world-entities";
import {
  createFolder,
  deleteFolderInWorld,
  listFolders,
  listFolderTree,
  reorderFolders,
  updateFolder,
} from "../services/folder.service";
import { ensureWorldGM, ensureWorldMember } from "../services/world-entity.service";

const FOLDER_TYPES = new Set<FolderType>([
  "SCENE",
  "CHARACTER",
  "ABILITY",
  "ITEM",
  "PROFESSION",
  "RACE",
  "BACKGROUND",
  "FATE_CLOCK",
  "DECK",
  "RANDOM_TABLE",
]);

function ok(res: Response, req: Request, data: unknown, status = 200) {
  res.status(status).json({ success: true, data, error: null, requestId: req.requestId });
}

function fail(res: Response, req: Request, code: string, message: string, status = 400) {
  res.status(status).json({ success: false, data: null, error: { code, message }, requestId: req.requestId });
}

function guardAuth(req: Request, res: Response): boolean {
  if (!req.userId) {
    fail(res, req, "UNAUTHORIZED", "User not authenticated", 401);
    return false;
  }
  return true;
}

function parseFolderType(value: string): FolderType {
  const normalized = value.trim().toUpperCase().replace(/-/g, "_") as FolderType;
  if (!FOLDER_TYPES.has(normalized)) throw new Error("invalid folder type");
  return normalized;
}

async function handleFolder(req: Request, res: Response, fn: () => Promise<unknown>, errorCode: string) {
  if (!guardAuth(req, res)) return;
  try {
    const result = await fn();
    ok(res, req, result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    const status = msg === "permission denied" ? 403 : msg.includes("not found") ? 404 : 400;
    fail(res, req, errorCode, msg, status);
  }
}

export const getWorldFolders = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    const type = parseFolderType(req.params.type);
    await ensureWorldMember(req.params.worldId, req.userId!);
    return listFolders(req.params.worldId, type);
  }, "FOLDER_LIST_ERROR");

export const getWorldFolderTree = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    const type = parseFolderType(req.params.type);
    await ensureWorldMember(req.params.worldId, req.userId!);
    return listFolderTree(req.params.worldId, type);
  }, "FOLDER_TREE_ERROR");

export const postWorldFolder = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    const type = parseFolderType(req.params.type);
    await ensureWorldGM(req.params.worldId, req.userId!);
    return createFolder({
      worldId: req.params.worldId,
      type,
      name: String(req.body?.name ?? ""),
      parentId: req.body?.parentId ? String(req.body.parentId) : null,
      color: req.body?.color ? String(req.body.color) : null,
      icon: req.body?.icon ? String(req.body.icon) : null,
      sortOrder: req.body?.sortOrder != null ? Number(req.body.sortOrder) : undefined,
      permissionMode: req.body?.permissionMode ? String(req.body.permissionMode) : undefined,
    });
  }, "FOLDER_CREATE_ERROR");

export const patchWorldFolder = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    await ensureWorldGM(req.params.worldId, req.userId!);
    return updateFolder({
      worldId: req.params.worldId,
      folderId: req.params.folderId,
      ...(req.body?.name !== undefined && { name: String(req.body.name) }),
      ...(req.body?.parentId !== undefined && { parentId: req.body.parentId ? String(req.body.parentId) : null }),
      ...(req.body?.color !== undefined && { color: req.body.color ? String(req.body.color) : null }),
      ...(req.body?.icon !== undefined && { icon: req.body.icon ? String(req.body.icon) : null }),
      ...(req.body?.sortOrder !== undefined && { sortOrder: Number(req.body.sortOrder) }),
      ...(req.body?.collapsed !== undefined && { collapsed: Boolean(req.body.collapsed) }),
      ...(req.body?.permissionMode !== undefined && { permissionMode: String(req.body.permissionMode) }),
    });
  }, "FOLDER_UPDATE_ERROR");

export const deleteWorldFolder = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    await ensureWorldGM(req.params.worldId, req.userId!);
    await deleteFolderInWorld(req.params.worldId, req.params.folderId);
    return { deleted: true };
  }, "FOLDER_DELETE_ERROR");

export const postWorldFoldersReorder = (req: Request, res: Response) =>
  handleFolder(req, res, async () => {
    const type = parseFolderType(req.params.type);
    await ensureWorldGM(req.params.worldId, req.userId!);
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds.map((item: unknown) => String(item)) : [];
    return reorderFolders({
      worldId: req.params.worldId,
      type,
      parentId: req.body?.parentId ? String(req.body.parentId) : null,
      orderedIds,
    });
  }, "FOLDER_REORDER_ERROR");