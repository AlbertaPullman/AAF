import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { createWorld, getWorldDetail, joinWorld, listWorlds } from "../controllers/world.controller";

export const worldRoutes = Router();

worldRoutes.get("/", authMiddleware, listWorlds);
worldRoutes.post("/", authMiddleware, createWorld);
worldRoutes.get("/:worldId", authMiddleware, getWorldDetail);
worldRoutes.post("/:worldId/join", authMiddleware, joinWorld);
