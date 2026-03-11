import { Router } from "express";
import { getTavernStatus } from "./tavern.service";

export const tavernRoutes = Router();

tavernRoutes.get("/status", (_req, res) => {
  res.json({
    success: true,
    data: getTavernStatus(),
    error: null
  });
});