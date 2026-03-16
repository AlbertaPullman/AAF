import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { worldRoutes } from "./world.routes";
import { chatRoutes } from "./chat.routes";
import { tavernRoutes } from "../modules/tavern/tavern.routes";
import { socialRoutes } from "./social.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use("/auth", authRoutes);
routes.use("/worlds", worldRoutes);
routes.use("/chat", chatRoutes);
routes.use("/social", socialRoutes);
routes.use("/tavern", tavernRoutes);