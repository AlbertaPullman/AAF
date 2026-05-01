import type { Request, Response } from "express";
import { saveResourceIconUpload } from "../services/resource-asset.service";
import { ensureWorldGM } from "../services/world-entity.service";

function absoluteUrl(req: Request, url: string) {
  return `${req.protocol}://${req.get("host")}${url}`;
}

export async function postWorldResourceIcon(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, data: null, error: { code: "UNAUTHORIZED", message: "User not authenticated" }, requestId: req.requestId });
      return;
    }

    await ensureWorldGM(req.params.worldId, req.userId);
    const saved = await saveResourceIconUpload({ dataUrl: req.body?.dataUrl, dataBase64: req.body?.dataBase64, mimeType: req.body?.mimeType });
    res.status(201).json({
      success: true,
      data: { ...saved, publicUrl: absoluteUrl(req, saved.url) },
      error: null,
      requestId: req.requestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "permission denied" ? 403 : message.includes("not found") ? 404 : 400;
    res.status(status).json({ success: false, data: null, error: { code: "RESOURCE_ICON_UPLOAD_ERROR", message }, requestId: req.requestId });
  }
}