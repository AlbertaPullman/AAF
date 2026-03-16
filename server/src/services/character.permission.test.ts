import assert from "node:assert/strict";
import test from "node:test";
import { CharacterType, WorldRole } from "@prisma/client";
import { canCreateCharacterByRole, canEditCharacterByRole } from "./character.service";

test("GM can create PC and NPC", () => {
  assert.equal(canCreateCharacterByRole(WorldRole.GM, CharacterType.PC), true);
  assert.equal(canCreateCharacterByRole(WorldRole.GM, CharacterType.NPC), true);
});

test("PLAYER can only create PC", () => {
  assert.equal(canCreateCharacterByRole(WorldRole.PLAYER, CharacterType.PC), true);
  assert.equal(canCreateCharacterByRole(WorldRole.PLAYER, CharacterType.NPC), false);
});

test("GM can edit any character", () => {
  assert.equal(canEditCharacterByRole(WorldRole.GM, "owner-1", "requester-2"), true);
  assert.equal(canEditCharacterByRole(WorldRole.GM, null, "requester-2"), true);
});

test("Non-GM can only edit self-owned character", () => {
  assert.equal(canEditCharacterByRole(WorldRole.PLAYER, "u1", "u1"), true);
  assert.equal(canEditCharacterByRole(WorldRole.PLAYER, "u1", "u2"), false);
  assert.equal(canEditCharacterByRole(WorldRole.PLAYER, null, "u2"), false);
});
