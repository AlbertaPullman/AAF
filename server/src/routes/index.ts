import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { authRoutes } from "./auth.routes";
import { worldRoutes } from "./world.routes";
import { tavernRoutes } from "../modules/tavern/tavern.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use("/auth", authRoutes);
routes.use("/worlds", worldRoutes);
routes.use("/tavern", tavernRoutes);