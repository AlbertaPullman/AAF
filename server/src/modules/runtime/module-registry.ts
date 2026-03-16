import {
  ModuleRegistryError,
  RegisterRuntimeModuleInput,
  RuntimeModuleLazyLoader,
  RuntimeModuleState,
  ToggleRuntimeModuleInput
} from "./module.types";

interface StoredRuntimeModule {
  state: RuntimeModuleState;
  lazyLoader?: RuntimeModuleLazyLoader;
  loaded: boolean;
  loadedValue?: unknown;
}

const DEFAULT_RUNTIME_MODULES: Array<{
  key: string;
  displayName: string;
  dependencies?: string[];
}> = [
  { key: "runtime-core", displayName: "运行时核心" },
  { key: "scene-sync", displayName: "场景同步", dependencies: ["runtime-core"] },
  { key: "world-chat", displayName: "世界聊天", dependencies: ["runtime-core"] },
  { key: "rule-engine", displayName: "规则引擎", dependencies: ["runtime-core"] }
];

const registryStore = new Map<string, Map<string, StoredRuntimeModule>>();

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ModuleRegistryError("MODULE_ARGUMENT_INVALID", `${field} is required`);
  }
  return normalized;
}

function normalizeDependencies(input: string[] | undefined): string[] {
  if (!input || input.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function getOrCreateWorldStore(worldId: string): Map<string, StoredRuntimeModule> {
  const existing = registryStore.get(worldId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, StoredRuntimeModule>();
  registryStore.set(worldId, created);
  return created;
}

function getWorldStore(worldId: string): Map<string, StoredRuntimeModule> {
  return registryStore.get(worldId) ?? new Map<string, StoredRuntimeModule>();
}

function requireStoredModule(worldId: string, moduleKey: string): StoredRuntimeModule {
  const worldStore = getWorldStore(worldId);
  const stored = worldStore.get(moduleKey);
  if (!stored) {
    throw new ModuleRegistryError("MODULE_NOT_FOUND", `module not found: ${moduleKey}`);
  }
  return stored;
}

export function registerRuntimeModule(input: RegisterRuntimeModuleInput): RuntimeModuleState {
  const worldId = normalizeRequired(input.worldId, "worldId");
  const key = normalizeRequired(input.module.key, "module.key");
  const displayName = normalizeRequired(input.module.displayName, "module.displayName");
  const dependencies = normalizeDependencies(input.module.dependencies);

  if (dependencies.includes(key)) {
    throw new ModuleRegistryError(
      "MODULE_DEPENDENCY_INVALID",
      "module dependencies cannot include itself",
      [key]
    );
  }

  const worldStore = getOrCreateWorldStore(worldId);
  if (worldStore.has(key)) {
    throw new ModuleRegistryError("MODULE_DUPLICATED", `module already registered: ${key}`);
  }

  const state: RuntimeModuleState = {
    worldId,
    key,
    displayName,
    dependencies,
    status: "disabled",
    updatedAt: toIsoNow()
  };

  worldStore.set(key, {
    state,
    lazyLoader: input.module.lazyLoader,
    loaded: false,
    loadedValue: undefined
  });

  return state;
}

export function enableRuntimeModule(input: ToggleRuntimeModuleInput): RuntimeModuleState {
  const worldId = normalizeRequired(input.worldId, "worldId");
  const moduleKey = normalizeRequired(input.moduleKey, "moduleKey");

  const worldStore = getWorldStore(worldId);
  const target = worldStore.get(moduleKey);
  if (!target) {
    throw new ModuleRegistryError("MODULE_NOT_FOUND", `module not found: ${moduleKey}`);
  }

  const invalidDependencies = target.state.dependencies.filter((dependencyKey) => {
    const dependency = worldStore.get(dependencyKey);
    return !dependency || dependency.state.status !== "enabled";
  });

  if (invalidDependencies.length > 0) {
    throw new ModuleRegistryError(
      "MODULE_DEPENDENCY_INVALID",
      `missing or disabled dependencies: ${invalidDependencies.join(", ")}`,
      invalidDependencies
    );
  }

  target.state = {
    ...target.state,
    status: "enabled",
    updatedAt: toIsoNow()
  };

  return target.state;
}

export function disableRuntimeModule(input: ToggleRuntimeModuleInput): RuntimeModuleState {
  const worldId = normalizeRequired(input.worldId, "worldId");
  const moduleKey = normalizeRequired(input.moduleKey, "moduleKey");
  const target = requireStoredModule(worldId, moduleKey);

  target.state = {
    ...target.state,
    status: "disabled",
    updatedAt: toIsoNow()
  };

  return target.state;
}

export function getRuntimeModule(worldId: string, moduleKey: string): RuntimeModuleState {
  const normalizedWorldId = normalizeRequired(worldId, "worldId");
  const normalizedModuleKey = normalizeRequired(moduleKey, "moduleKey");
  const target = requireStoredModule(normalizedWorldId, normalizedModuleKey);
  return target.state;
}

export function listRuntimeModules(worldId: string): RuntimeModuleState[] {
  const normalizedWorldId = normalizeRequired(worldId, "worldId");
  const worldStore = getWorldStore(normalizedWorldId);
  return Array.from(worldStore.values())
    .map((item) => item.state)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function ensureDefaultRuntimeModules(worldId: string): RuntimeModuleState[] {
  const normalizedWorldId = normalizeRequired(worldId, "worldId");
  const worldStore = getOrCreateWorldStore(normalizedWorldId);

  for (const definition of DEFAULT_RUNTIME_MODULES) {
    if (worldStore.has(definition.key)) {
      continue;
    }

    registerRuntimeModule({
      worldId: normalizedWorldId,
      module: {
        key: definition.key,
        displayName: definition.displayName,
        dependencies: definition.dependencies
      }
    });
  }

  return listRuntimeModules(normalizedWorldId);
}

export async function invokeRuntimeModuleLazyLoader(input: ToggleRuntimeModuleInput): Promise<unknown> {
  const worldId = normalizeRequired(input.worldId, "worldId");
  const moduleKey = normalizeRequired(input.moduleKey, "moduleKey");
  const target = requireStoredModule(worldId, moduleKey);

  if (!target.lazyLoader) {
    return null;
  }

  if (target.loaded) {
    return target.loadedValue;
  }

  const loadedValue = await target.lazyLoader();
  target.loaded = true;
  target.loadedValue = loadedValue;
  return loadedValue;
}

export function __resetRuntimeModuleRegistryForTest() {
  registryStore.clear();
}
