import { Router } from "express";
import { healthRoutes } from "./health.routes";
import { tavernRoutes } from "../modules/tavern/tavern.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use("/tavern", tavernRoutes);