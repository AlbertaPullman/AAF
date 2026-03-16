import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { createWorld, getWorldDetail, joinWorld, listWorlds } from "../controllers/world.controller";
import { getWorldCharacters, postWorldCharacter, putWorldCharacter } from "../controllers/character.controller";
import {
  deleteWorldScene,
  getWorldSceneCombat,
  getWorldSceneVisual,
  getWorldScenes,
  patchWorldSceneSort,
  patchWorldSceneVisual,
  postWorldScene,
  postWorldSceneCombatNextTurn,
  putWorldScene,
  putWorldSceneCombat
} from "../controllers/scene.controller";
import {
  getWorldRuntime,
  getWorldRuntimeModules,
  patchWorldRuntime,
  patchWorldRuntimeModule
} from "../controllers/world-runtime.controller";
import {
  getWorldStoryEventSearch,
  getWorldStoryEventCards,
  getWorldStoryEvents,
  patchWorldStoryEvent,
  postWorldStoryEventNarrativeRequest,
  postWorldStoryEventNarrativeRequestDecision,
  postWorldStoryEvent,
  postWorldStoryEventCheck,
  postWorldStoryEventOption,
  postWorldStoryEventResolve
} from "../controllers/story-event.controller";
import { getWorldAssistantContextController } from "../controllers/assistant-context.controller";
import { postWorldAssistantResponseController } from "../controllers/assistant-response.controller";

export const worldRoutes = Router();

worldRoutes.get("/", authMiddleware, listWorlds);
worldRoutes.post("/", authMiddleware, createWorld);
worldRoutes.get("/:worldId", authMiddleware, getWorldDetail);
worldRoutes.post("/:worldId/join", authMiddleware, joinWorld);
worldRoutes.get("/:worldId/characters", authMiddleware, getWorldCharacters);
worldRoutes.post("/:worldId/characters", authMiddleware, postWorldCharacter);
worldRoutes.put("/:worldId/characters/:characterId", authMiddleware, putWorldCharacter);
worldRoutes.get("/:worldId/scenes", authMiddleware, getWorldScenes);
worldRoutes.post("/:worldId/scenes", authMiddleware, postWorldScene);
worldRoutes.put("/:worldId/scenes/:sceneId", authMiddleware, putWorldScene);
worldRoutes.delete("/:worldId/scenes/:sceneId", authMiddleware, deleteWorldScene);
worldRoutes.patch("/:worldId/scenes/:sceneId/sort", authMiddleware, patchWorldSceneSort);
worldRoutes.get("/:worldId/scenes/:sceneId/visual", authMiddleware, getWorldSceneVisual);
worldRoutes.patch("/:worldId/scenes/:sceneId/visual", authMiddleware, patchWorldSceneVisual);
worldRoutes.get("/:worldId/scenes/:sceneId/combat", authMiddleware, getWorldSceneCombat);
worldRoutes.put("/:worldId/scenes/:sceneId/combat", authMiddleware, putWorldSceneCombat);
worldRoutes.post("/:worldId/scenes/:sceneId/combat/next-turn", authMiddleware, postWorldSceneCombatNextTurn);
worldRoutes.get("/:worldId/runtime", authMiddleware, getWorldRuntime);
worldRoutes.patch("/:worldId/runtime", authMiddleware, patchWorldRuntime);
worldRoutes.get("/:worldId/runtime/modules", authMiddleware, getWorldRuntimeModules);
worldRoutes.patch("/:worldId/runtime/modules/:moduleKey", authMiddleware, patchWorldRuntimeModule);
worldRoutes.get("/:worldId/story-events", authMiddleware, getWorldStoryEvents);
worldRoutes.get("/:worldId/story-events/search", authMiddleware, getWorldStoryEventSearch);
worldRoutes.post("/:worldId/story-events", authMiddleware, postWorldStoryEvent);
worldRoutes.patch("/:worldId/story-events/:eventId", authMiddleware, patchWorldStoryEvent);
worldRoutes.post("/:worldId/story-events/:eventId/options", authMiddleware, postWorldStoryEventOption);
worldRoutes.post("/:worldId/story-events/:eventId/options/:optionId/check", authMiddleware, postWorldStoryEventCheck);
worldRoutes.post("/:worldId/story-events/:eventId/narrative-requests", authMiddleware, postWorldStoryEventNarrativeRequest);
worldRoutes.post("/:worldId/story-events/:eventId/narrative-requests/:requestId/decision", authMiddleware, postWorldStoryEventNarrativeRequestDecision);
worldRoutes.post("/:worldId/story-events/:eventId/resolve", authMiddleware, postWorldStoryEventResolve);
worldRoutes.get("/:worldId/story-events/cards", authMiddleware, getWorldStoryEventCards);
worldRoutes.get("/:worldId/assistant/context", authMiddleware, getWorldAssistantContextController);
worldRoutes.post("/:worldId/assistant/respond", authMiddleware, postWorldAssistantResponseController);
