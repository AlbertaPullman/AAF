import assert from "node:assert/strict";
import test from "node:test";
import { WorldRole } from "@prisma/client";
import { canManageSceneByRole, resolveSceneMoveTargetId, type SceneOrderItem } from "./scene.service";

const baseScenes: SceneOrderItem[] = [
  { id: "s1", sortOrder: 0 },
  { id: "s2", sortOrder: 1 },
  { id: "s3", sortOrder: 2 }
];

test("GM can manage scenes", () => {
  assert.equal(canManageSceneByRole(WorldRole.GM), true);
});

test("Non-GM cannot manage scenes", () => {
  assert.equal(canManageSceneByRole(WorldRole.PLAYER), false);
  assert.equal(canManageSceneByRole(WorldRole.OBSERVER), false);
  assert.equal(canManageSceneByRole(WorldRole.ASSISTANT), false);
});

test("resolveSceneMoveTargetId returns previous id for UP", () => {
  assert.equal(resolveSceneMoveTargetId(baseScenes, "s2", "UP"), "s1");
});

test("resolveSceneMoveTargetId returns next id for DOWN", () => {
  assert.equal(resolveSceneMoveTargetId(baseScenes, "s2", "DOWN"), "s3");
});

test("resolveSceneMoveTargetId returns null at list boundaries", () => {
  assert.equal(resolveSceneMoveTargetId(baseScenes, "s1", "UP"), null);
  assert.equal(resolveSceneMoveTargetId(baseScenes, "s3", "DOWN"), null);
});

test("resolveSceneMoveTargetId throws for unknown scene", () => {
  assert.throws(() => resolveSceneMoveTargetId(baseScenes, "missing", "UP"), /scene not found in world/);
});
