import type { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function register(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    const result = await authService.register(username, password);

    res.status(201).json({
      success: true,
      data: result,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({
      success: false,
      data: null,
      error: { code: "REGISTRATION_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    const result = await authService.login(username, password);

    res.status(200).json({
      success: true,
      data: result,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(401).json({
      success: false,
      data: null,
      error: { code: "LOGIN_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "User not authenticated" },
        requestId: req.requestId
      });
      return;
    }

    const user = await authService.getCurrentUser(req.userId);

    res.status(200).json({
      success: true,
      data: user,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(404).json({
      success: false,
      data: null,
      error: { code: "USER_NOT_FOUND", message },
      requestId: req.requestId
    });
  }
}
