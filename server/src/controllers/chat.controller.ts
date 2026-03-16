import type { Request, Response } from "express";
import { getWorldMessageById, listRecentGlobalMessages, listRecentWorldMessages } from "../services/chat.service";

export async function getRecentGlobalMessages(req: Request, res: Response) {
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

    const limit = Number(req.query.limit ?? 30);
    const messages = await listRecentGlobalMessages(req.userId, limit);

    res.status(200).json({
      success: true,
      data: messages,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({
      success: false,
      data: null,
      error: { code: "CHAT_RECENT_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getRecentWorldMessages(req: Request, res: Response) {
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

    const limit = Number(req.query.limit ?? 30);
    const channelKey = typeof req.query.channelKey === "string" ? req.query.channelKey : undefined;
    const sceneId = typeof req.query.sceneId === "string" ? req.query.sceneId : undefined;
    const messages = await listRecentWorldMessages(req.params.worldId, req.userId, limit, channelKey, sceneId);

    res.status(200).json({
      success: true,
      data: messages,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : message === "invalid world chat channel" || message === "scene not found in world" ? 400 : 500;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "CHAT_WORLD_RECENT_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getWorldMessage(req: Request, res: Response) {
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

    const message = await getWorldMessageById(req.params.worldId, req.userId, req.params.messageId);
    res.status(200).json({
      success: true,
      data: message,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : message === "world message not found" ? 404 : 500;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "CHAT_WORLD_MESSAGE_ERROR", message },
      requestId: req.requestId
    });
  }
}
