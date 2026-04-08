import type { Request, Response } from "express";
import {
  createRulebookDirectory,
  createRulebookEntry,
  deleteRulebookDirectory,
  deleteRulebookEntry,
  exportRulebookPdf,
  listRulebookEntries,
  reorderRulebookDirectories,
  reorderRulebookTreeNodes,
  publishRulebookEntry,
  reorderRulebookEntries,
  updateRulebookEntry
} from "../services/rulebook-entry.service";

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

export async function getRulebookEntries(req: Request, res: Response) {
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

    const data = await listRulebookEntries(req.userId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookEntry(req: Request, res: Response) {
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

    const data = await createRulebookEntry(req.userId, {
      title: String(req.body?.title ?? ""),
      summary: req.body?.summary,
      directoryPath: req.body?.directoryPath,
      contentHtml: req.body?.contentHtml
    });

    res.status(201).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function putRulebookEntry(req: Request, res: Response) {
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

    const data = await updateRulebookEntry(req.userId, req.params.entryId, {
      title: req.body?.title,
      summary: req.body?.summary,
      directoryPath: req.body?.directoryPath,
      contentHtml: req.body?.contentHtml,
      sortOrder: req.body?.sortOrder
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_UPDATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookDirectory(req: Request, res: Response) {
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

    const data = await createRulebookDirectory(req.userId, {
      path: req.body?.path
    });

    res.status(201).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_DIRECTORY_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookEntriesReorder(req: Request, res: Response) {
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

    const data = await reorderRulebookEntries(req.userId, {
      entryIds: req.body?.entryIds
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_REORDER_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookDirectoriesReorder(req: Request, res: Response) {
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

    const data = await reorderRulebookDirectories(req.userId, {
      directoryIds: req.body?.directoryIds
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_DIRECTORY_REORDER_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookTreeReorder(req: Request, res: Response) {
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

    const data = await reorderRulebookTreeNodes(req.userId, {
      parentPath: req.body?.parentPath,
      items: req.body?.items
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_TREE_REORDER_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function deleteRulebookDirectoryByPath(req: Request, res: Response) {
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

    const data = await deleteRulebookDirectory(req.userId, {
      path: req.body?.path
    });

    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_DIRECTORY_DELETE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getRulebookExportPdf(req: Request, res: Response) {
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

    const data = await exportRulebookPdf(req.userId);
    res.setHeader("Content-Type", data.contentType);
    res.setHeader("Content-Disposition", `attachment; filename=\"${data.fileName}\"`);
    res.status(200).send(data.buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_EXPORT_PDF_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postRulebookEntryPublish(req: Request, res: Response) {
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

    const data = await publishRulebookEntry(req.userId, req.params.entryId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_PUBLISH_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function deleteRulebookEntryById(req: Request, res: Response) {
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

    const data = await deleteRulebookEntry(req.userId, req.params.entryId);
    res.status(200).json({ success: true, data, error: null, requestId: req.requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(toStatus(message)).json({
      success: false,
      data: null,
      error: { code: "RULEBOOK_ENTRY_DELETE_ERROR", message },
      requestId: req.requestId
    });
  }
}
