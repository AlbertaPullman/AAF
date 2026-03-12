import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

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

  const token = authorization.replace(/^Bearer\s+/i, "");
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: "INVALID_TOKEN", message: "invalid or expired token" },
      requestId: req.requestId
    });
  }
}