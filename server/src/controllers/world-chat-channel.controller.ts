import type { Request, Response } from "express";
import {
  createWorldChatChannel,
  inviteWorldChatChannelMember,
  listWorldChatChannels
} from "../services/world-chat-channel.service";

export async function getWorldChatChannels(req: Request, res: Response) {
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

    const data = await listWorldChatChannels(req.params.worldId, req.userId);
    res.status(200).json({
      success: true,
      data,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "not a member of world" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_CHAT_CHANNEL_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldChatChannel(req: Request, res: Response) {
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

    const channel = await createWorldChatChannel(req.params.worldId, req.userId, String(req.body?.name ?? ""));
    res.status(201).json({
      success: true,
      data: channel,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" ? 404 : message === "not a member of world" || message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_CHAT_CHANNEL_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldChatChannelInvite(req: Request, res: Response) {
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

    const targetUserId = String(req.body?.userId ?? "").trim();
    const channel = await inviteWorldChatChannelMember(req.params.worldId, req.userId, req.params.channelKey, targetUserId);
    res.status(200).json({
      success: true,
      data: channel,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "world not found" || message === "channel not found" ? 404 : message === "not a member of world" || message === "forbidden" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "WORLD_CHAT_CHANNEL_INVITE_ERROR", message },
      requestId: req.requestId
    });
  }
}
