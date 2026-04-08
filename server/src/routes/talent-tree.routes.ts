import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  deleteTalentTreeTemplateById,
  getTalentTreeTemplates,
  postTalentTreeTemplate,
  postTalentTreeTemplatePublish,
  putTalentTreeTemplate
} from "../controllers/talent-tree.controller";

export const talentTreeRoutes = Router();

talentTreeRoutes.get("/templates", authMiddleware, getTalentTreeTemplates);
talentTreeRoutes.post("/templates", authMiddleware, postTalentTreeTemplate);
talentTreeRoutes.put("/templates/:templateId", authMiddleware, putTalentTreeTemplate);
talentTreeRoutes.post("/templates/:templateId/publish", authMiddleware, postTalentTreeTemplatePublish);
talentTreeRoutes.delete("/templates/:templateId", authMiddleware, deleteTalentTreeTemplateById);
