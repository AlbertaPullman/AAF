import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { getRecentGlobalMessages, getRecentWorldMessages, getWorldMessage } from "../controllers/chat.controller";

export const chatRoutes = Router();

chatRoutes.get("/global/recent", authMiddleware, getRecentGlobalMessages);
chatRoutes.get("/worlds/:worldId/recent", authMiddleware, getRecentWorldMessages);
chatRoutes.get("/worlds/:worldId/messages/:messageId", authMiddleware, getWorldMessage);
