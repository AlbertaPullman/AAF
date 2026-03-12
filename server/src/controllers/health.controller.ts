import type { Request, Response } from "express";
import { getHealthSnapshot } from "../services/health.service";

export async function getHealth(req: Request, res: Response) {
  const snapshot = await getHealthSnapshot();

  res.status(snapshot.status === "ok" ? 200 : 503).json({
    success: true,
    data: snapshot,
    error: null,
    requestId: req.requestId
  });
}