import type { Request, Response } from "express";
import {
  createTalentTreeTemplate,
  deleteTalentTreeTemplate,
  listTalentTreeTemplates,
  publishTalentTreeTemplate,
  updateTalentTreeTemplate
} from "../services/talent-tree.service";

function toStatus(message: string) {
  if (message === "forbidden") {
    return 403;
  }
  if (message === "user not found") {
    return 404;
  }
  if (message.includes("not found") || message.includes("required") || message.includes("exists")) {
    return 400;
  }
  return 500;
}

export async function getTalentTreeTemplates(req: Request, res: Response) {
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

    const data = await listTalentTreeTemplates(req.userId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "TALENT_TREE_TEMPLATE_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postTalentTreeTemplate(req: Request, res: Response) {
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

    const data = await createTalentTreeTemplate(req.userId, {
      name: String(req.body?.name ?? ""),
      treeType: req.body?.treeType,
      description: req.body?.description,
      category: req.body?.category
    });

    res.status(201).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "TALENT_TREE_TEMPLATE_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function putTalentTreeTemplate(req: Request, res: Response) {
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

    const data = await updateTalentTreeTemplate(req.userId, req.params.templateId, {
      name: req.body?.name,
      description: req.body?.description,
      treeType: req.body?.treeType,
      category: req.body?.category,
      graphData: req.body?.graphData
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "TALENT_TREE_TEMPLATE_UPDATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postTalentTreeTemplatePublish(req: Request, res: Response) {
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

    const data = await publishTalentTreeTemplate(req.userId, req.params.templateId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "TALENT_TREE_TEMPLATE_PUBLISH_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function deleteTalentTreeTemplateById(req: Request, res: Response) {
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

    const data = await deleteTalentTreeTemplate(req.userId, req.params.templateId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "TALENT_TREE_TEMPLATE_DELETE_ERROR", message },
      requestId: req.requestId
    });
  }
}
