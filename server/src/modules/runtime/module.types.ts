export type RuntimeModuleStatus = "enabled" | "disabled";

export type RuntimeModuleLazyLoader = () => Promise<unknown> | unknown;

export interface RuntimeModuleDefinition {
  key: string;
  displayName: string;
  dependencies?: string[];
  lazyLoader?: RuntimeModuleLazyLoader;
}

export interface RuntimeModuleState {
  worldId: string;
  key: string;
  displayName: string;
  dependencies: string[];
  status: RuntimeModuleStatus;
  updatedAt: string;
}

export interface RegisterRuntimeModuleInput {
  worldId: string;
  module: RuntimeModuleDefinition;
}

export interface ToggleRuntimeModuleInput {
  worldId: string;
  moduleKey: string;
}

export class ModuleRegistryError extends Error {
  code: "MODULE_NOT_FOUND" | "MODULE_DUPLICATED" | "MODULE_DEPENDENCY_INVALID" | "MODULE_ARGUMENT_INVALID";
  details: string[];

  constructor(
    code: "MODULE_NOT_FOUND" | "MODULE_DUPLICATED" | "MODULE_DEPENDENCY_INVALID" | "MODULE_ARGUMENT_INVALID",
    message: string,
    details: string[] = []
  ) {
    super(message);
    this.name = "ModuleRegistryError";
    this.code = code;
    this.details = details;
  }
}
