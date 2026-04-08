import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  deleteRulebookDirectoryByPath,
  deleteRulebookEntryById,
  getRulebookExportPdf,
  postRulebookDirectory,
  postRulebookDirectoriesReorder,
  postRulebookTreeReorder,
  postRulebookEntriesReorder,
  getRulebookEntries,
  postRulebookEntry,
  postRulebookEntryPublish,
  putRulebookEntry
} from "../controllers/rulebook.controller";

export const rulebookRoutes = Router();

rulebookRoutes.get("/entries", authMiddleware, getRulebookEntries);
rulebookRoutes.get("/export/pdf", authMiddleware, getRulebookExportPdf);
rulebookRoutes.post("/directories", authMiddleware, postRulebookDirectory);
rulebookRoutes.post("/directories/reorder", authMiddleware, postRulebookDirectoriesReorder);
rulebookRoutes.post("/tree/reorder", authMiddleware, postRulebookTreeReorder);
rulebookRoutes.delete("/directories", authMiddleware, deleteRulebookDirectoryByPath);
rulebookRoutes.post("/entries", authMiddleware, postRulebookEntry);
rulebookRoutes.post("/entries/reorder", authMiddleware, postRulebookEntriesReorder);
rulebookRoutes.put("/entries/:entryId", authMiddleware, putRulebookEntry);
rulebookRoutes.post("/entries/:entryId/publish", authMiddleware, postRulebookEntryPublish);
rulebookRoutes.delete("/entries/:entryId", authMiddleware, deleteRulebookEntryById);
