import { worldRuntimeMessagesZh } from "../i18n/messages";
import type { WorldRuntimeState } from "../../pages/world/types";

type RuntimePanelProps = {
  runtimeState: WorldRuntimeState | null;
  moduleCount: number;
  loading: boolean;
  errorSummary: string | null;
  onRefresh: () => void;
};

function statusLabel(status: WorldRuntimeState["status"]): string {
  if (status === "active") {
    return worldRuntimeMessagesZh.statusActive;
  }
  if (status === "loading") {
    return worldRuntimeMessagesZh.statusLoading;
  }
  if (status === "error") {
    return worldRuntimeMessagesZh.statusError;
  }
  return worldRuntimeMessagesZh.statusSleeping;
}

export function RuntimePanel({ runtimeState, moduleCount, loading, errorSummary, onRefresh }: RuntimePanelProps) {
  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>{worldRuntimeMessagesZh.panelTitle}</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? worldRuntimeMessagesZh.refreshing : worldRuntimeMessagesZh.refresh}
        </button>
      </div>

      <p>世界引擎的当前状态与异常摘要会显示在这里。</p>

      {runtimeState ? (
        <>
          <p className="text-sm">{worldRuntimeMessagesZh.statusLabel}：{statusLabel(runtimeState.status)}</p>
          <p className="text-sm">{worldRuntimeMessagesZh.moduleCountLabel}：{moduleCount}</p>
          <p className="text-xs text-gray-500">{worldRuntimeMessagesZh.updatedAtLabel}：{new Date(runtimeState.updatedAt).toLocaleString()}</p>
          <p className="text-sm">{worldRuntimeMessagesZh.summaryLabel}：{runtimeState.message || worldRuntimeMessagesZh.summaryNone}</p>
        </>
      ) : (
        <p className="text-sm text-gray-500">{worldRuntimeMessagesZh.notLoaded}</p>
      )}

      {errorSummary ? <p className="mt-2 text-sm text-red-600">{worldRuntimeMessagesZh.errorSummary}：{errorSummary}</p> : null}
    </div>
  );
}
