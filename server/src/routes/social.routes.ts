import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  getFriendsController,
  getIncomingFriendRequestsController,
  patchFriendRequestController,
  postFriendRequestController
} from "../controllers/social.controller";

export const socialRoutes = Router();

socialRoutes.get("/friends", authMiddleware, getFriendsController);
socialRoutes.get("/requests/incoming", authMiddleware, getIncomingFriendRequestsController);
socialRoutes.post("/requests", authMiddleware, postFriendRequestController);
socialRoutes.patch("/requests/:requestId", authMiddleware, patchFriendRequestController);