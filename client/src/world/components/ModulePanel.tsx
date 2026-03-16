import { worldRuntimeMessagesZh } from "../i18n/messages";

type RuntimeModuleState = {
  worldId: string;
  key: string;
  displayName: string;
  dependencies: string[];
  status: "enabled" | "disabled";
  updatedAt: string;
};

type ModulePanelProps = {
  modules: RuntimeModuleState[];
  myRole: "GM" | "PLAYER" | "OBSERVER" | "ASSISTANT" | null;
  loading: boolean;
  togglingModuleKey: string | null;
  onRefresh: () => void;
  onToggle: (module: RuntimeModuleState) => void;
};

function canManageModules(role: ModulePanelProps["myRole"]): boolean {
  return role === "GM" || role === "ASSISTANT";
}

export function ModulePanel({ modules, myRole, loading, togglingModuleKey, onRefresh, onToggle }: ModulePanelProps) {
  const canManage = canManageModules(myRole);

  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>{worldRuntimeMessagesZh.modulePanelTitle}</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? worldRuntimeMessagesZh.refreshing : worldRuntimeMessagesZh.refresh}
        </button>
      </div>

      <p className="mb-2 text-xs text-gray-500">这里管理世界规则模块、附加系统与开关状态。</p>
      <p className="mb-2 text-xs text-gray-500">权限：{canManage ? worldRuntimeMessagesZh.permissionCanManage : worldRuntimeMessagesZh.permissionReadonly}</p>

      {modules.length === 0 ? <p className="text-sm text-gray-500">{worldRuntimeMessagesZh.noModules}</p> : null}
      <div className="space-y-2">
        {modules.map((module) => {
          const nextStatus = module.status === "enabled" ? "disabled" : "enabled";
          const isToggling = togglingModuleKey === module.key;
          return (
            <div className="rounded border p-2" key={module.key}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{module.displayName}</p>
                  <p className="text-xs text-gray-500">{module.key}</p>
                </div>
                <button
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-60"
                  type="button"
                  onClick={() => onToggle(module)}
                  disabled={!canManage || isToggling}
                >
                  {isToggling
                    ? worldRuntimeMessagesZh.moduleToggling
                    : nextStatus === "enabled"
                    ? worldRuntimeMessagesZh.moduleToggleEnable
                    : worldRuntimeMessagesZh.moduleToggleDisable}
                </button>
              </div>

              <p className="mt-1 text-xs">
                {worldRuntimeMessagesZh.moduleStatusLabel}：
                {module.status === "enabled" ? worldRuntimeMessagesZh.moduleEnabled : worldRuntimeMessagesZh.moduleDisabled}
              </p>
              <p className="text-xs text-gray-500">
                {worldRuntimeMessagesZh.moduleDependencyLabel}：
                {module.dependencies.length > 0 ? module.dependencies.join(" / ") : worldRuntimeMessagesZh.moduleDependencyNone}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
