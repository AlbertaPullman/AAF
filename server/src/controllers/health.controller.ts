import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString()
    },
    error: null,
    requestId: _req.requestId
  });
}