import assert from "node:assert/strict";
import test from "node:test";
import {
  __resetRuntimeModuleRegistryForTest,
  disableRuntimeModule,
  ensureDefaultRuntimeModules,
  enableRuntimeModule,
  getRuntimeModule,
  invokeRuntimeModuleLazyLoader,
  listRuntimeModules,
  registerRuntimeModule
} from "./module-registry";
import { ModuleRegistryError } from "./module.types";

test("registerRuntimeModule and listRuntimeModules return sorted states", () => {
  __resetRuntimeModuleRegistryForTest();

  registerRuntimeModule({
    worldId: "world-1",
    module: { key: "z-combat", displayName: "Combat" }
  });
  registerRuntimeModule({
    worldId: "world-1",
    module: { key: "a-light", displayName: "Light" }
  });

  const modules = listRuntimeModules("world-1");
  assert.equal(modules.length, 2);
  assert.equal(modules[0].key, "a-light");
  assert.equal(modules[1].key, "z-combat");
  assert.equal(modules[0].status, "disabled");
});

test("enableRuntimeModule throws when dependencies are missing or disabled", () => {
  __resetRuntimeModuleRegistryForTest();

  registerRuntimeModule({
    worldId: "world-2",
    module: {
      key: "world-chat",
      displayName: "World Chat",
      dependencies: ["dice-core"]
    }
  });

  assert.throws(
    () => enableRuntimeModule({ worldId: "world-2", moduleKey: "world-chat" }),
    (error: unknown) => {
      assert.ok(error instanceof ModuleRegistryError);
      assert.equal(error.code, "MODULE_DEPENDENCY_INVALID");
      assert.deepEqual(error.details, ["dice-core"]);
      return true;
    }
  );
});

test("enableRuntimeModule succeeds after dependencies are enabled", () => {
  __resetRuntimeModuleRegistryForTest();

  registerRuntimeModule({
    worldId: "world-3",
    module: { key: "dice-core", displayName: "Dice Core" }
  });
  registerRuntimeModule({
    worldId: "world-3",
    module: {
      key: "world-chat",
      displayName: "World Chat",
      dependencies: ["dice-core"]
    }
  });

  enableRuntimeModule({ worldId: "world-3", moduleKey: "dice-core" });
  const state = enableRuntimeModule({ worldId: "world-3", moduleKey: "world-chat" });

  assert.equal(state.status, "enabled");
  const queried = getRuntimeModule("world-3", "world-chat");
  assert.equal(queried.status, "enabled");

  const disabled = disableRuntimeModule({ worldId: "world-3", moduleKey: "world-chat" });
  assert.equal(disabled.status, "disabled");
});

test("invokeRuntimeModuleLazyLoader executes once and caches result", async () => {
  __resetRuntimeModuleRegistryForTest();

  let callCount = 0;
  registerRuntimeModule({
    worldId: "world-4",
    module: {
      key: "rule-engine",
      displayName: "Rule Engine",
      lazyLoader: async () => {
        callCount += 1;
        return { loaded: true };
      }
    }
  });

  const first = await invokeRuntimeModuleLazyLoader({
    worldId: "world-4",
    moduleKey: "rule-engine"
  });
  const second = await invokeRuntimeModuleLazyLoader({
    worldId: "world-4",
    moduleKey: "rule-engine"
  });

  assert.deepEqual(first, { loaded: true });
  assert.deepEqual(second, { loaded: true });
  assert.equal(callCount, 1);
});

test("ensureDefaultRuntimeModules seeds initial module definitions", () => {
  __resetRuntimeModuleRegistryForTest();

  const modules = ensureDefaultRuntimeModules("world-5");
  assert.equal(modules.length, 4);
  assert.equal(modules.some((item) => item.key === "runtime-core"), true);
  assert.equal(modules.some((item) => item.key === "scene-sync"), true);
  assert.equal(modules.some((item) => item.key === "world-chat"), true);
  assert.equal(modules.some((item) => item.key === "rule-engine"), true);
});
