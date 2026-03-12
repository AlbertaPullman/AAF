import { Router } from "express";
import { register, login, getCurrentUser } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth";

export const authRoutes = Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.get("/me", authMiddleware, getCurrentUser);
