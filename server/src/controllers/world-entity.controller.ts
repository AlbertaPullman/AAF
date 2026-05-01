import type { Request, Response } from "express";
import {
  listAbilities, getAbility, createAbility, updateAbility, deleteAbility,
  listRaces, createRace, updateRace, deleteRace,
  listProfessions, createProfession, updateProfession, deleteProfession,
  listBackgrounds, createBackground, updateBackground, deleteBackground,
  listItems, createItem, updateItem, deleteItem,
  listFateClocks, createFateClock, updateFateClock, advanceFateClock, deleteFateClock,
  listDecks, createDeck, updateDeck, deleteDeck,
  listRandomTables, createRandomTable, updateRandomTable, deleteRandomTable,
  exportCollectionPack, importCollectionPack,
  reorderEntities, type WorldResourceEntityType,
} from "../services/world-entity.service";

/* ──── 辅助 ──── */

function ok(res: Response, req: Request, data: unknown, status = 200) {
  res.status(status).json({ success: true, data, error: null, requestId: req.requestId });
}

function fail(res: Response, req: Request, code: string, message: string, status = 400) {
  res.status(status).json({ success: false, data: null, error: { code, message }, requestId: req.requestId });
}

function guardAuth(req: Request, res: Response): boolean {
  if (!req.userId) {
    fail(res, req, "UNAUTHORIZED", "User not authenticated", 401);
    return false;
  }
  return true;
}

async function handleCrud(
  req: Request,
  res: Response,
  fn: () => Promise<unknown>,
  errorCode: string
) {
  if (!guardAuth(req, res)) return;
  try {
    const result = await fn();
    ok(res, req, result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    const status = msg === "permission denied" ? 403 : msg.includes("not found") ? 404 : 400;
    fail(res, req, errorCode, msg, status);
  }
}

function reorderHandler(type: WorldResourceEntityType, errorCode: string) {
  return (req: Request, res: Response) =>
    handleCrud(
      req,
      res,
      () => reorderEntities(req.params.worldId, req.userId!, type, {
        ...(Object.prototype.hasOwnProperty.call(req.body ?? {}, "folderId") && { folderId: req.body.folderId }),
        ...(Object.prototype.hasOwnProperty.call(req.body ?? {}, "folderPath") && { folderPath: req.body.folderPath }),
        orderedIds: req.body?.orderedIds,
      }),
      errorCode,
    );
}

/* ──── Abilities ──── */

export const getAbilities = (req: Request, res: Response) =>
  handleCrud(req, res, () => listAbilities(req.params.worldId, req.userId!), "ABILITY_LIST_ERROR");

export const getAbilityById = (req: Request, res: Response) =>
  handleCrud(req, res, () => getAbility(req.params.worldId, req.params.id, req.userId!), "ABILITY_GET_ERROR");

export const postAbility = (req: Request, res: Response) =>
  handleCrud(req, res, () => createAbility(req.params.worldId, req.userId!, req.body ?? {}), "ABILITY_CREATE_ERROR");

export const putAbility = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateAbility(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "ABILITY_UPDATE_ERROR");

export const removeAbility = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteAbility(req.params.worldId, req.params.id, req.userId!), "ABILITY_DELETE_ERROR");

export const postAbilityReorder = reorderHandler("abilities", "ABILITY_REORDER_ERROR");

/* ──── Races ──── */

export const getRaces = (req: Request, res: Response) =>
  handleCrud(req, res, () => listRaces(req.params.worldId, req.userId!), "RACE_LIST_ERROR");

export const postRace = (req: Request, res: Response) =>
  handleCrud(req, res, () => createRace(req.params.worldId, req.userId!, req.body ?? {}), "RACE_CREATE_ERROR");

export const putRace = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateRace(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "RACE_UPDATE_ERROR");

export const removeRace = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteRace(req.params.worldId, req.params.id, req.userId!), "RACE_DELETE_ERROR");

export const postRaceReorder = reorderHandler("races", "RACE_REORDER_ERROR");

/* ──── Professions ──── */

export const getProfessions = (req: Request, res: Response) =>
  handleCrud(req, res, () => listProfessions(req.params.worldId, req.userId!), "PROFESSION_LIST_ERROR");

export const postProfession = (req: Request, res: Response) =>
  handleCrud(req, res, () => createProfession(req.params.worldId, req.userId!, req.body ?? {}), "PROFESSION_CREATE_ERROR");

export const putProfession = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateProfession(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "PROFESSION_UPDATE_ERROR");

export const removeProfession = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteProfession(req.params.worldId, req.params.id, req.userId!), "PROFESSION_DELETE_ERROR");

export const postProfessionReorder = reorderHandler("professions", "PROFESSION_REORDER_ERROR");

/* ──── Backgrounds ──── */

export const getBackgrounds = (req: Request, res: Response) =>
  handleCrud(req, res, () => listBackgrounds(req.params.worldId, req.userId!), "BACKGROUND_LIST_ERROR");

export const postBackground = (req: Request, res: Response) =>
  handleCrud(req, res, () => createBackground(req.params.worldId, req.userId!, req.body ?? {}), "BACKGROUND_CREATE_ERROR");

export const putBackground = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateBackground(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "BACKGROUND_UPDATE_ERROR");

export const removeBackground = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteBackground(req.params.worldId, req.params.id, req.userId!), "BACKGROUND_DELETE_ERROR");

export const postBackgroundReorder = reorderHandler("backgrounds", "BACKGROUND_REORDER_ERROR");

/* ──── Items ──── */

export const getItems = (req: Request, res: Response) =>
  handleCrud(req, res, () => listItems(req.params.worldId, req.userId!), "ITEM_LIST_ERROR");

export const postItem = (req: Request, res: Response) =>
  handleCrud(req, res, () => createItem(req.params.worldId, req.userId!, req.body ?? {}), "ITEM_CREATE_ERROR");

export const putItem = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateItem(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "ITEM_UPDATE_ERROR");

export const removeItem = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteItem(req.params.worldId, req.params.id, req.userId!), "ITEM_DELETE_ERROR");

export const postItemReorder = reorderHandler("items", "ITEM_REORDER_ERROR");

/* ──── FateClocks ──── */

export const getFateClocks = (req: Request, res: Response) =>
  handleCrud(req, res, () => listFateClocks(req.params.worldId, req.userId!), "FATE_CLOCK_LIST_ERROR");

export const postFateClock = (req: Request, res: Response) =>
  handleCrud(req, res, () => createFateClock(req.params.worldId, req.userId!, req.body ?? {}), "FATE_CLOCK_CREATE_ERROR");

export const putFateClock = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateFateClock(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "FATE_CLOCK_UPDATE_ERROR");

export const patchFateClockAdvance = (req: Request, res: Response) =>
  handleCrud(req, res, () => {
    const amount = Number(req.body?.amount ?? 1);
    const reason = String(req.body?.reason ?? "");
    return advanceFateClock(req.params.worldId, req.params.id, req.userId!, amount, reason);
  }, "FATE_CLOCK_ADVANCE_ERROR");

export const removeFateClock = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteFateClock(req.params.worldId, req.params.id, req.userId!), "FATE_CLOCK_DELETE_ERROR");

export const postFateClockReorder = reorderHandler("fateClocks", "FATE_CLOCK_REORDER_ERROR");

/* ──── Decks ──── */

export const getDecks = (req: Request, res: Response) =>
  handleCrud(req, res, () => listDecks(req.params.worldId, req.userId!), "DECK_LIST_ERROR");

export const postDeck = (req: Request, res: Response) =>
  handleCrud(req, res, () => createDeck(req.params.worldId, req.userId!, req.body ?? {}), "DECK_CREATE_ERROR");

export const putDeck = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateDeck(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "DECK_UPDATE_ERROR");

export const removeDeck = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteDeck(req.params.worldId, req.params.id, req.userId!), "DECK_DELETE_ERROR");

export const postDeckReorder = reorderHandler("decks", "DECK_REORDER_ERROR");

/* ──── RandomTables ──── */

export const getRandomTables = (req: Request, res: Response) =>
  handleCrud(req, res, () => listRandomTables(req.params.worldId, req.userId!), "RANDOM_TABLE_LIST_ERROR");

export const postRandomTable = (req: Request, res: Response) =>
  handleCrud(req, res, () => createRandomTable(req.params.worldId, req.userId!, req.body ?? {}), "RANDOM_TABLE_CREATE_ERROR");

export const putRandomTable = (req: Request, res: Response) =>
  handleCrud(req, res, () => updateRandomTable(req.params.worldId, req.params.id, req.userId!, req.body ?? {}), "RANDOM_TABLE_UPDATE_ERROR");

export const removeRandomTable = (req: Request, res: Response) =>
  handleCrud(req, res, () => deleteRandomTable(req.params.worldId, req.params.id, req.userId!), "RANDOM_TABLE_DELETE_ERROR");

export const postRandomTableReorder = reorderHandler("randomTables", "RANDOM_TABLE_REORDER_ERROR");

/* ──── Collection Pack ──── */

export const getCollectionPack = (req: Request, res: Response) =>
  handleCrud(req, res, () => exportCollectionPack(req.params.worldId, req.userId!), "EXPORT_ERROR");

export const postCollectionPack = (req: Request, res: Response) =>
  handleCrud(req, res, () => importCollectionPack(req.params.worldId, req.userId!, req.body ?? {}), "IMPORT_ERROR");
