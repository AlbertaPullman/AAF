import type { Request, Response } from "express";
import {
  createFriendRequest,
  handleFriendRequest,
  listFriends,
  listIncomingFriendRequests
} from "../services/social.service";

function unauthorized(res: Response, requestId?: string) {
  res.status(401).json({
    success: false,
    data: null,
    error: { code: "UNAUTHORIZED", message: "User not authenticated" },
    requestId
  });
}

export async function getFriendsController(req: Request, res: Response) {
  try {
    if (!req.userId) {
      unauthorized(res, req.requestId);
      return;
    }

    const friends = await listFriends(req.userId);
    res.status(200).json({ success: true, data: friends, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, data: null, error: { code: "FRIEND_LIST_ERROR", message }, requestId: req.requestId });
  }
}

export async function getIncomingFriendRequestsController(req: Request, res: Response) {
  try {
    if (!req.userId) {
      unauthorized(res, req.requestId);
      return;
    }

    const requests = await listIncomingFriendRequests(req.userId);
    res.status(200).json({ success: true, data: requests, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, data: null, error: { code: "FRIEND_REQUEST_LIST_ERROR", message }, requestId: req.requestId });
  }
}

export async function postFriendRequestController(req: Request, res: Response) {
  try {
    if (!req.userId) {
      unauthorized(res, req.requestId);
      return;
    }

    const query = typeof req.body?.query === "string" ? req.body.query : "";
    const result = await createFriendRequest(req.userId, query);
    res.status(201).json({ success: true, data: result, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "target user not found" ||
      message === "already friends" ||
      message === "friend request already sent" ||
      message === "friend query is required"
        ? 400
        : 500;
    res.status(status).json({ success: false, data: null, error: { code: "FRIEND_REQUEST_CREATE_ERROR", message }, requestId: req.requestId });
  }
}

export async function patchFriendRequestController(req: Request, res: Response) {
  try {
    if (!req.userId) {
      unauthorized(res, req.requestId);
      return;
    }

    const action = req.body?.action === "accept" ? "accept" : req.body?.action === "reject" ? "reject" : null;
    if (!action) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: "INVALID_ACTION", message: "action must be accept or reject" },
        requestId: req.requestId
      });
      return;
    }

    const result = await handleFriendRequest(req.userId, req.params.requestId, action);
    res.status(200).json({ success: true, data: result, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "friend request not found" ? 404 : message.includes("cannot handle") || message.includes("already handled") ? 400 : 500;
    res.status(status).json({ success: false, data: null, error: { code: "FRIEND_REQUEST_UPDATE_ERROR", message }, requestId: req.requestId });
  }
}