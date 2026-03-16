import { Router } from "express";
import { register, login, getCurrentUser, updateCurrentUser } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.get("/me", authMiddleware, getCurrentUser);
authRoutes.patch("/me", authMiddleware, updateCurrentUser);
