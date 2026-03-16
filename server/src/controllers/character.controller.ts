import type { Request, Response } from "express";
import { CharacterType } from "@prisma/client";
import { createCharacter, listCharacters, updateCharacter } from "../services/character.service";

function parseCharacterType(value: unknown): CharacterType {
  const candidate = typeof value === "string" ? value.toUpperCase() : "PC";
  return candidate === "NPC" ? CharacterType.NPC : CharacterType.PC;
}

export async function getWorldCharacters(req: Request, res: Response) {
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

    const characters = await listCharacters(req.params.worldId, req.userId);
    res.status(200).json({
      success: true,
      data: characters,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "CHARACTER_LIST_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function postWorldCharacter(req: Request, res: Response) {
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

    const created = await createCharacter({
      worldId: req.params.worldId,
      requesterId: req.userId,
      name: String(req.body?.name ?? ""),
      type: parseCharacterType(req.body?.type),
      userId: typeof req.body?.userId === "string" ? req.body.userId : null
    });

    res.status(201).json({
      success: true,
      data: created,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "CHARACTER_CREATE_ERROR", message },
      requestId: req.requestId
    });
  }
}

export async function putWorldCharacter(req: Request, res: Response) {
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

    const updated = await updateCharacter({
      worldId: req.params.worldId,
      characterId: req.params.characterId,
      requesterId: req.userId,
      name: typeof req.body?.name === "string" ? req.body.name : undefined,
      stats: req.body?.stats,
      snapshot: req.body?.snapshot
    });

    res.status(200).json({
      success: true,
      data: updated,
      error: null,
      requestId: req.requestId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const status = message === "not a member of world" ? 403 : message === "character not found" ? 404 : 400;
    res.status(status).json({
      success: false,
      data: null,
      error: { code: "CHARACTER_UPDATE_ERROR", message },
      requestId: req.requestId
    });
  }
}
