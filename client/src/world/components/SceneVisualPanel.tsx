import { worldSceneRuntimeMessagesZh } from "../i18n/messages";

type SceneLightSourceState = {
  id: string;
  targetType: "actor" | "object" | "point";
  targetId?: string | null;
  x?: number;
  y?: number;
  brightRadiusFeet: number;
  dimRadiusFeet: number;
  colorHex: string;
  followTarget: boolean;
  durationMode: "rounds" | "battle-end" | "concentration" | "manual";
  durationRounds?: number;
};

type SceneFogRevealedArea = {
  id: string;
  shape: "circle" | "rect" | "polygon";
  points?: Array<{ x: number; y: number }>;
  radius?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type SceneFogState = {
  enabled: boolean;
  mode: "full" | "hidden";
  revealedAreas: SceneFogRevealedArea[];
};

type SceneVisualState = {
  sceneId: string;
  grid: {
    enabled: boolean;
    unitFeet: number;
  };
  lights: SceneLightSourceState[];
  fog: SceneFogState;
  updatedAt: string;
};

type SceneVisualPatchInput = {
  grid?: {
    enabled?: boolean;
    unitFeet?: number;
  };
  lights?: SceneLightSourceState[];
  fog?: SceneFogState;
};

type SceneVisualPanelProps = {
  visualState: SceneVisualState | null;
  loading: boolean;
  saving: boolean;
  canManage: boolean;
  onRefresh: () => void;
  onPatch: (input: SceneVisualPatchInput) => void;
};

function clampUnitFeet(value: number): number {
  const safe = Number.isFinite(value) ? Math.round(value) : 5;
  return Math.max(1, Math.min(50, safe));
}

export function SceneVisualPanel({ visualState, loading, saving, canManage, onRefresh, onPatch }: SceneVisualPanelProps) {
  const onToggleGrid = () => {
    if (!visualState || !canManage) {
      return;
    }

    onPatch({
      grid: {
        enabled: !visualState.grid.enabled,
        unitFeet: visualState.grid.unitFeet
      }
    });
  };

  const onBumpGridSize = (delta: number) => {
    if (!visualState || !canManage) {
      return;
    }

    onPatch({
      grid: {
        enabled: visualState.grid.enabled,
        unitFeet: clampUnitFeet(visualState.grid.unitFeet + delta)
      }
    });
  };

  const onToggleFogEnabled = () => {
    if (!visualState || !canManage) {
      return;
    }

    onPatch({
      fog: {
        ...visualState.fog,
        enabled: !visualState.fog.enabled
      }
    });
  };

  const onSwitchFogMode = () => {
    if (!visualState || !canManage) {
      return;
    }

    onPatch({
      fog: {
        ...visualState.fog,
        mode: visualState.fog.mode === "hidden" ? "full" : "hidden"
      }
    });
  };

  const onAddPointLight = () => {
    if (!visualState || !canManage) {
      return;
    }

    const now = Date.now();
    const nextLights: SceneLightSourceState[] = [
      ...visualState.lights,
      {
        id: `light-${now}`,
        targetType: "point",
        x: 120,
        y: 120,
        brightRadiusFeet: 20,
        dimRadiusFeet: 20,
        colorHex: "#ffffff",
        followTarget: false,
        durationMode: "manual"
      }
    ];

    onPatch({ lights: nextLights });
  };

  const onClearLights = () => {
    if (!visualState || !canManage) {
      return;
    }

    onPatch({ lights: [] });
  };

  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>{worldSceneRuntimeMessagesZh.visualPanelTitle}</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? worldSceneRuntimeMessagesZh.refreshing : worldSceneRuntimeMessagesZh.refresh}
        </button>
      </div>

      {!visualState ? <p className="text-sm text-gray-500">{worldSceneRuntimeMessagesZh.notLoadedVisual}</p> : null}

      {visualState ? (
        <>
          <p className="text-xs text-gray-500">{worldSceneRuntimeMessagesZh.updatedAtLabel}：{new Date(visualState.updatedAt).toLocaleString()}</p>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">{worldSceneRuntimeMessagesZh.gridTitle}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.gridStateLabel}：{visualState.grid.enabled ? worldSceneRuntimeMessagesZh.gridEnabled : worldSceneRuntimeMessagesZh.gridDisabled}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.gridUnitLabel}：{visualState.grid.unitFeet} 英尺</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onToggleGrid}
                disabled={!canManage || saving}
              >
                {visualState.grid.enabled ? worldSceneRuntimeMessagesZh.gridDisable : worldSceneRuntimeMessagesZh.gridEnable}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={() => onBumpGridSize(-1)}
                disabled={!canManage || saving}
              >
                {worldSceneRuntimeMessagesZh.gridDown}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={() => onBumpGridSize(1)}
                disabled={!canManage || saving}
              >
                {worldSceneRuntimeMessagesZh.gridUp}
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">{worldSceneRuntimeMessagesZh.fogTitle}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.fogStateLabel}：{visualState.fog.enabled ? worldSceneRuntimeMessagesZh.gridEnabled : worldSceneRuntimeMessagesZh.gridDisabled}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.fogModeLabel}：{visualState.fog.mode === "full" ? worldSceneRuntimeMessagesZh.fogModeFull : worldSceneRuntimeMessagesZh.fogModeHidden}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.fogRevealCountLabel}：{visualState.fog.revealedAreas.length}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onToggleFogEnabled}
                disabled={!canManage || saving}
              >
                {visualState.fog.enabled ? worldSceneRuntimeMessagesZh.fogDisable : worldSceneRuntimeMessagesZh.fogEnable}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onSwitchFogMode}
                disabled={!canManage || saving}
              >
                {worldSceneRuntimeMessagesZh.fogSwitchMode}
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">{worldSceneRuntimeMessagesZh.lightsTitle}</p>
            <p className="text-xs text-gray-600">{worldSceneRuntimeMessagesZh.lightsCountLabel}：{visualState.lights.length}</p>
            {visualState.lights.length > 0 ? (
              <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                {visualState.lights.map((light) => (
                  <div className="rounded bg-gray-50 px-2 py-1 text-xs" key={light.id}>
                    {light.id} · {light.targetType} · 亮 {light.brightRadiusFeet} / 暗 {light.dimRadiusFeet}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onAddPointLight}
                disabled={!canManage || saving}
              >
                {worldSceneRuntimeMessagesZh.lightsAddPoint}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onClearLights}
                disabled={!canManage || saving || visualState.lights.length === 0}
              >
                {worldSceneRuntimeMessagesZh.lightsClear}
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">权限：{canManage ? worldSceneRuntimeMessagesZh.permissionCanManage : worldSceneRuntimeMessagesZh.permissionReadonly}</p>
          {saving ? <p className="text-xs text-indigo-700">{worldSceneRuntimeMessagesZh.saveInProgress}</p> : null}
        </>
      ) : null}
    </div>
  );
}
