import type { Request, Response } from "express";
import {
  listWorldTalentInstances,
  importTalentTreeToWorld,
  toggleTalentTreeInstance,
  removeTalentTreeInstance,
  getCharacterAllocations,
  previewLearnNode,
  commitTalentAllocation,
  resetTalentAllocation,
} from "../services/talent-allocation.service";

/* ──── 辅助 ──── */

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

async function handleCrud(
  req: Request,
  res: Response,
  fn: () => Promise<unknown>,
  errorCode: string
) {
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

/* ──── 世界天赋树实例 ──── */

export const getWorldTalentInstances = (req: Request, res: Response) =>
  handleCrud(req, res, () => listWorldTalentInstances(req.params.worldId, req.userId!), "TALENT_INSTANCE_LIST_ERROR");

export const postWorldTalentInstance = (req: Request, res: Response) =>
  handleCrud(req, res, () => importTalentTreeToWorld(req.params.worldId, req.userId!, String(req.body?.templateId ?? "")), "TALENT_INSTANCE_IMPORT_ERROR");

export const patchWorldTalentInstance = (req: Request, res: Response) =>
  handleCrud(req, res, () => toggleTalentTreeInstance(req.params.worldId, req.userId!, req.params.instanceId, Boolean(req.body?.enabled)), "TALENT_INSTANCE_TOGGLE_ERROR");

export const deleteWorldTalentInstance = (req: Request, res: Response) =>
  handleCrud(req, res, () => removeTalentTreeInstance(req.params.worldId, req.userId!, req.params.instanceId), "TALENT_INSTANCE_DELETE_ERROR");

/* ──── 角色天赋分配 ──── */

export const getCharacterTalentAllocations = (req: Request, res: Response) =>
  handleCrud(req, res, () => getCharacterAllocations(req.params.worldId, req.params.characterId, req.userId!), "TALENT_ALLOC_LIST_ERROR");

export const postCharacterTalentPreview = (req: Request, res: Response) =>
  handleCrud(req, res, () => {
    const body = req.body ?? {};
    return previewLearnNode(
      req.params.worldId,
      req.params.characterId,
      req.userId!,
      String(body.instanceId ?? ""),
      String(body.nodeId ?? ""),
      (body.professionLevels ?? {}) as Record<string, number>,
      Number(body.availablePoints ?? 0)
    );
  }, "TALENT_ALLOC_PREVIEW_ERROR");

export const postCharacterTalentCommit = (req: Request, res: Response) =>
  handleCrud(req, res, () => {
    const body = req.body ?? {};
    return commitTalentAllocation(
      req.params.worldId,
      req.params.characterId,
      req.userId!,
      String(body.instanceId ?? ""),
      (body.ranks ?? {}) as Record<string, number>,
      (body.professionLevels ?? {}) as Record<string, number>
    );
  }, "TALENT_ALLOC_COMMIT_ERROR");

export const postCharacterTalentReset = (req: Request, res: Response) =>
  handleCrud(req, res, () => {
    const body = req.body ?? {};
    return resetTalentAllocation(
      req.params.worldId,
      req.params.characterId,
      req.userId!,
      String(body.instanceId ?? "")
    );
  }, "TALENT_ALLOC_RESET_ERROR");
