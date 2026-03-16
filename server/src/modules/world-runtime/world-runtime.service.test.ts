import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetWorldRuntimeStateStoreForTest,
  getWorldRuntimeState,
  listWorldRuntimeStates,
  setWorldRuntimeState
} from "./world-runtime.service";

test("getWorldRuntimeState returns default sleeping state", () => {
  __resetWorldRuntimeStateStoreForTest();
  const state = getWorldRuntimeState("world-1");

  assert.equal(state.worldId, "world-1");
  assert.equal(state.status, "sleeping");
  assert.equal(state.message, null);
  assert.ok(state.updatedAt.length > 0);
});

test("setWorldRuntimeState updates status and message", () => {
  __resetWorldRuntimeStateStoreForTest();
  const updated = setWorldRuntimeState({
    worldId: "world-2",
    status: "active",
    message: "world is running"
  });

  assert.equal(updated.status, "active");
  assert.equal(updated.message, "world is running");

  const queried = getWorldRuntimeState("world-2");
  assert.equal(queried.status, "active");
  assert.equal(queried.message, "world is running");
});

test("setWorldRuntimeState throws for invalid status", () => {
  __resetWorldRuntimeStateStoreForTest();
  assert.throws(
    () =>
      setWorldRuntimeState({
        worldId: "world-3",
        status: "unknown"
      }),
    /invalid world runtime status/
  );
});

test("listWorldRuntimeStates returns sorted states", () => {
  __resetWorldRuntimeStateStoreForTest();
  setWorldRuntimeState({ worldId: "w-b", status: "active" });
  setWorldRuntimeState({ worldId: "w-a", status: "loading" });

  const states = listWorldRuntimeStates();
  assert.equal(states.length, 2);
  assert.equal(states[0].worldId, "w-a");
  assert.equal(states[1].worldId, "w-b");
});
