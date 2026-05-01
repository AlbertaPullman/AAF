import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  createWorld,
  deleteWorld,
  getWorldDetail,
  getWorldMemberManage,
  getWorldRoster,
  joinWorld,
  listWorlds,
  patchWorldMemberManage,
  patchWorldTheme
} from "../controllers/world.controller";
import { getWorldCharacters, postWorldCharacter, postWorldCharactersReorder, putWorldCharacter } from "../controllers/character.controller";
import { postWorldResourceIcon } from "../controllers/resource-asset.controller";
import {
  deleteWorldFolder,
  getWorldFolders,
  getWorldFolderTree,
  patchWorldFolder,
  postWorldFolder,
  postWorldFoldersReorder,
} from "../controllers/folder.controller";
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
import {
  getWorldChatChannels,
  postWorldChatChannel,
  postWorldChatChannelInvite
} from "../controllers/world-chat-channel.controller";
import {
  getWorldSceneSettlementLogs,
  postWorldSceneSettlementResolve
} from "../controllers/settlement.controller";
import { postWorldSceneAbilityExecute } from "../controllers/ability-engine.controller";
import {
  getWorldTalentInstances,
  postWorldTalentInstance,
  patchWorldTalentInstance,
  deleteWorldTalentInstance,
  getCharacterTalentAllocations,
  postCharacterTalentPreview,
  postCharacterTalentCommit,
  postCharacterTalentReset,
} from "../controllers/talent-allocation.controller";
import {
  getAbilities as getAbilitiesCtrl,
  getAbilityById as getAbilityByIdCtrl,
  postAbility as postAbilityCtrl,
  postAbilityReorder as postAbilityReorderCtrl,
  putAbility as putAbilityCtrl,
  removeAbility as removeAbilityCtrl,
  getRaces as getRacesCtrl,
  postRace as postRaceCtrl,
  postRaceReorder as postRaceReorderCtrl,
  putRace as putRaceCtrl,
  removeRace as removeRaceCtrl,
  getProfessions as getProfessionsCtrl,
  postProfession as postProfessionCtrl,
  postProfessionReorder as postProfessionReorderCtrl,
  putProfession as putProfessionCtrl,
  removeProfession as removeProfessionCtrl,
  getBackgrounds as getBackgroundsCtrl,
  postBackground as postBackgroundCtrl,
  postBackgroundReorder as postBackgroundReorderCtrl,
  putBackground as putBackgroundCtrl,
  removeBackground as removeBackgroundCtrl,
  getItems as getItemsCtrl,
  postItem as postItemCtrl,
  postItemReorder as postItemReorderCtrl,
  putItem as putItemCtrl,
  removeItem as removeItemCtrl,
  getFateClocks as getFateClocksCtrl,
  postFateClock as postFateClockCtrl,
  postFateClockReorder as postFateClockReorderCtrl,
  putFateClock as putFateClockCtrl,
  patchFateClockAdvance as patchFateClockAdvanceCtrl,
  removeFateClock as removeFateClockCtrl,
  getDecks as getDecksCtrl,
  postDeck as postDeckCtrl,
  postDeckReorder as postDeckReorderCtrl,
  putDeck as putDeckCtrl,
  removeDeck as removeDeckCtrl,
  getRandomTables as getRandomTablesCtrl,
  postRandomTable as postRandomTableCtrl,
  postRandomTableReorder as postRandomTableReorderCtrl,
  putRandomTable as putRandomTableCtrl,
  removeRandomTable as removeRandomTableCtrl,
  getCollectionPack as getCollectionPackCtrl,
  postCollectionPack as postCollectionPackCtrl,
} from "../controllers/world-entity.controller";

export const worldRoutes = Router();

worldRoutes.get("/", authMiddleware, listWorlds);
worldRoutes.post("/", authMiddleware, createWorld);
worldRoutes.get("/:worldId", authMiddleware, getWorldDetail);
worldRoutes.patch("/:worldId/theme", authMiddleware, patchWorldTheme);
worldRoutes.post("/:worldId/join", authMiddleware, joinWorld);
worldRoutes.delete("/:worldId", authMiddleware, deleteWorld);
worldRoutes.get("/:worldId/roster", authMiddleware, getWorldRoster);
worldRoutes.get("/:worldId/members/manage", authMiddleware, getWorldMemberManage);
worldRoutes.patch("/:worldId/members/:memberUserId/manage", authMiddleware, patchWorldMemberManage);
worldRoutes.get("/:worldId/characters", authMiddleware, getWorldCharacters);
worldRoutes.post("/:worldId/characters", authMiddleware, postWorldCharacter);
worldRoutes.post("/:worldId/characters/reorder", authMiddleware, postWorldCharactersReorder);
worldRoutes.put("/:worldId/characters/:characterId", authMiddleware, putWorldCharacter);
worldRoutes.post("/:worldId/resource-icons", authMiddleware, postWorldResourceIcon);
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
worldRoutes.get("/:worldId/scenes/:sceneId/settlement/logs", authMiddleware, getWorldSceneSettlementLogs);
worldRoutes.post("/:worldId/scenes/:sceneId/settlement/resolve", authMiddleware, postWorldSceneSettlementResolve);
worldRoutes.post("/:worldId/scenes/:sceneId/abilities/:abilityId/execute", authMiddleware, postWorldSceneAbilityExecute);
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
worldRoutes.get("/:worldId/chat-channels", authMiddleware, getWorldChatChannels);
worldRoutes.post("/:worldId/chat-channels", authMiddleware, postWorldChatChannel);
worldRoutes.post("/:worldId/chat-channels/:channelKey/invite", authMiddleware, postWorldChatChannelInvite);

worldRoutes.get("/:worldId/folders/:type", authMiddleware, getWorldFolders);
worldRoutes.get("/:worldId/folders/:type/tree", authMiddleware, getWorldFolderTree);
worldRoutes.post("/:worldId/folders/:type", authMiddleware, postWorldFolder);
worldRoutes.post("/:worldId/folders/:type/reorder", authMiddleware, postWorldFoldersReorder);
worldRoutes.patch("/:worldId/folders/:folderId", authMiddleware, patchWorldFolder);
worldRoutes.delete("/:worldId/folders/:folderId", authMiddleware, deleteWorldFolder);

// ──── 能力系统实体 CRUD ────
worldRoutes.get("/:worldId/abilities", authMiddleware, getAbilitiesCtrl);
worldRoutes.get("/:worldId/abilities/:id", authMiddleware, getAbilityByIdCtrl);
worldRoutes.post("/:worldId/abilities", authMiddleware, postAbilityCtrl);
worldRoutes.post("/:worldId/abilities/reorder", authMiddleware, postAbilityReorderCtrl);
worldRoutes.put("/:worldId/abilities/:id", authMiddleware, putAbilityCtrl);
worldRoutes.delete("/:worldId/abilities/:id", authMiddleware, removeAbilityCtrl);

worldRoutes.get("/:worldId/races", authMiddleware, getRacesCtrl);
worldRoutes.post("/:worldId/races", authMiddleware, postRaceCtrl);
worldRoutes.post("/:worldId/races/reorder", authMiddleware, postRaceReorderCtrl);
worldRoutes.put("/:worldId/races/:id", authMiddleware, putRaceCtrl);
worldRoutes.delete("/:worldId/races/:id", authMiddleware, removeRaceCtrl);

worldRoutes.get("/:worldId/professions", authMiddleware, getProfessionsCtrl);
worldRoutes.post("/:worldId/professions", authMiddleware, postProfessionCtrl);
worldRoutes.post("/:worldId/professions/reorder", authMiddleware, postProfessionReorderCtrl);
worldRoutes.put("/:worldId/professions/:id", authMiddleware, putProfessionCtrl);
worldRoutes.delete("/:worldId/professions/:id", authMiddleware, removeProfessionCtrl);

worldRoutes.get("/:worldId/backgrounds", authMiddleware, getBackgroundsCtrl);
worldRoutes.post("/:worldId/backgrounds", authMiddleware, postBackgroundCtrl);
worldRoutes.post("/:worldId/backgrounds/reorder", authMiddleware, postBackgroundReorderCtrl);
worldRoutes.put("/:worldId/backgrounds/:id", authMiddleware, putBackgroundCtrl);
worldRoutes.delete("/:worldId/backgrounds/:id", authMiddleware, removeBackgroundCtrl);

worldRoutes.get("/:worldId/items", authMiddleware, getItemsCtrl);
worldRoutes.post("/:worldId/items", authMiddleware, postItemCtrl);
worldRoutes.post("/:worldId/items/reorder", authMiddleware, postItemReorderCtrl);
worldRoutes.put("/:worldId/items/:id", authMiddleware, putItemCtrl);
worldRoutes.delete("/:worldId/items/:id", authMiddleware, removeItemCtrl);

worldRoutes.get("/:worldId/fate-clocks", authMiddleware, getFateClocksCtrl);
worldRoutes.post("/:worldId/fate-clocks", authMiddleware, postFateClockCtrl);
worldRoutes.post("/:worldId/fate-clocks/reorder", authMiddleware, postFateClockReorderCtrl);
worldRoutes.put("/:worldId/fate-clocks/:id", authMiddleware, putFateClockCtrl);
worldRoutes.patch("/:worldId/fate-clocks/:id/advance", authMiddleware, patchFateClockAdvanceCtrl);
worldRoutes.delete("/:worldId/fate-clocks/:id", authMiddleware, removeFateClockCtrl);

worldRoutes.get("/:worldId/decks", authMiddleware, getDecksCtrl);
worldRoutes.post("/:worldId/decks", authMiddleware, postDeckCtrl);
worldRoutes.post("/:worldId/decks/reorder", authMiddleware, postDeckReorderCtrl);
worldRoutes.put("/:worldId/decks/:id", authMiddleware, putDeckCtrl);
worldRoutes.delete("/:worldId/decks/:id", authMiddleware, removeDeckCtrl);

worldRoutes.get("/:worldId/random-tables", authMiddleware, getRandomTablesCtrl);
worldRoutes.post("/:worldId/random-tables", authMiddleware, postRandomTableCtrl);
worldRoutes.post("/:worldId/random-tables/reorder", authMiddleware, postRandomTableReorderCtrl);
worldRoutes.put("/:worldId/random-tables/:id", authMiddleware, putRandomTableCtrl);
worldRoutes.delete("/:worldId/random-tables/:id", authMiddleware, removeRandomTableCtrl);

worldRoutes.get("/:worldId/collection-pack", authMiddleware, getCollectionPackCtrl);
worldRoutes.post("/:worldId/collection-pack/import", authMiddleware, postCollectionPackCtrl);

// ──── 世界天赋树实例 & 角色天赋分配 ────
worldRoutes.get("/:worldId/talent-instances", authMiddleware, getWorldTalentInstances);
worldRoutes.post("/:worldId/talent-instances", authMiddleware, postWorldTalentInstance);
worldRoutes.patch("/:worldId/talent-instances/:instanceId", authMiddleware, patchWorldTalentInstance);
worldRoutes.delete("/:worldId/talent-instances/:instanceId", authMiddleware, deleteWorldTalentInstance);

worldRoutes.get("/:worldId/characters/:characterId/talent-allocations", authMiddleware, getCharacterTalentAllocations);
worldRoutes.post("/:worldId/characters/:characterId/talent-allocations/preview", authMiddleware, postCharacterTalentPreview);
worldRoutes.post("/:worldId/characters/:characterId/talent-allocations/commit", authMiddleware, postCharacterTalentCommit);
worldRoutes.post("/:worldId/characters/:characterId/talent-allocations/reset", authMiddleware, postCharacterTalentReset);
