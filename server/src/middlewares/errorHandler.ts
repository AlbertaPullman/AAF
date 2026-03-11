import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "internal server error";
  res.status(500).json({
    success: false,
    data: null,
    error: {
      code: "INTERNAL_ERROR",
      message
    },
    requestId: req.requestId
  });
}