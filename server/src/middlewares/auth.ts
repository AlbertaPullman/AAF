import type { NextFunction, Request, Response } from "express";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "missing authorization header" },
      requestId: req.requestId
    });
    return;
  }

  next();
}