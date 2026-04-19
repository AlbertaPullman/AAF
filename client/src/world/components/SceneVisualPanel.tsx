import { useEffect, useMemo, useState } from "react";

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
  colorHex: string;
  revealedAreas: SceneFogRevealedArea[];
};

type SceneVisualState = {
  sceneId: string;
  preset: "custom" | "battle" | "rest" | "dungeon" | "narrative";
  backgroundImageUrl: string | null;
  grid: {
    enabled: boolean;
    unitFeet: number;
    type: "square" | "hex";
    sizePx: number;
    colorHex: string;
    opacity: number;
    snap: boolean;
  };
  lights: SceneLightSourceState[];
  fog: SceneFogState;
  lighting: {
    globalLight: boolean;
    darkness: number;
    gmSeeInvisible: boolean;
  };
  elevation: {
    enabled: boolean;
    baseLevel: number;
  };
  updatedAt: string;
};

type SceneVisualPatchInput = {
  preset?: SceneVisualState["preset"];
  backgroundImageUrl?: string | null;
  grid?: Partial<SceneVisualState["grid"]>;
  lights?: SceneLightSourceState[];
  fog?: Partial<SceneFogState>;
  lighting?: Partial<SceneVisualState["lighting"]>;
  elevation?: Partial<SceneVisualState["elevation"]>;
};

type SceneVisualPanelProps = {
  visualState: SceneVisualState | null;
  loading: boolean;
  saving: boolean;
  canManage: boolean;
  onRefresh: () => void;
  onPatch: (input: SceneVisualPatchInput) => void;
};

const PRESETS: Array<{ key: SceneVisualState["preset"]; label: string }> = [
  { key: "custom", label: "自定义" },
  { key: "battle", label: "战斗" },
  { key: "rest", label: "休整" },
  { key: "dungeon", label: "地下城" },
  { key: "narrative", label: "叙事" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SceneVisualPanel({ visualState, loading, saving, canManage, onRefresh, onPatch }: SceneVisualPanelProps) {
  const [bgDraft, setBgDraft] = useState("");

  useEffect(() => {
    setBgDraft(visualState?.backgroundImageUrl ?? "");
  }, [visualState?.backgroundImageUrl]);

  const canEdit = canManage && !saving;

  const summaryText = useMemo(() => {
    if (!visualState) {
      return "未加载场景视觉配置";
    }
    return `预设 ${visualState.preset} · 网格 ${visualState.grid.enabled ? "开启" : "关闭"} · 雾效 ${visualState.fog.enabled ? "开启" : "关闭"}`;
  }, [visualState]);

  const addPointLight = () => {
    if (!visualState || !canEdit) {
      return;
    }
    const now = Date.now();
    onPatch({
      lights: [
        ...visualState.lights,
        {
          id: `light-${now}`,
          targetType: "point",
          x: 120,
          y: 120,
          brightRadiusFeet: 20,
          dimRadiusFeet: 30,
          colorHex: "#ffffff",
          followTarget: false,
          durationMode: "manual"
        }
      ]
    });
  };

  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>场景视觉配置</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      <p className="text-xs text-gray-600">{summaryText}</p>
      {visualState ? <p className="text-xs text-gray-500">更新时间：{new Date(visualState.updatedAt).toLocaleString()}</p> : null}

      {!visualState ? null : !canManage ? (
        <>
          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">舞台状态</p>
            <p className="text-xs text-gray-600">预设：{PRESETS.find((item) => item.key === visualState.preset)?.label ?? visualState.preset}</p>
            <p className="text-xs text-gray-600">背景：{visualState.backgroundImageUrl ? "已配置" : "未配置"}</p>
            <p className="text-xs text-gray-600">
              网格：{visualState.grid.enabled ? "开启" : "关闭"} · {visualState.grid.type} · {visualState.grid.unitFeet} 英尺/格
            </p>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">光照与雾效</p>
            <p className="text-xs text-gray-600">
              雾效 {visualState.fog.enabled ? "开启" : "关闭"} · 模式 {visualState.fog.mode} · 黑暗度 {(visualState.lighting.darkness * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-600">光源数量：{visualState.lights.length}</p>
            <p className="text-xs text-gray-600">高度层：{visualState.elevation.enabled ? `开启（基准 ${visualState.elevation.baseLevel}）` : "关闭"}</p>
          </div>

          <p className="mt-2 text-xs text-gray-500">当前身份只能查看场景视觉摘要，不能直接改动舞台配置。</p>
        </>
      ) : (
        <>
          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">场景预设</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                  disabled={!canEdit || visualState.preset === preset.key}
                  onClick={() => {
                    onPatch({ preset: preset.key });
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="rounded border px-2 py-1 text-xs"
                value={bgDraft}
                placeholder="背景图片 URL"
                onChange={(event) => setBgDraft(event.target.value)}
              />
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                disabled={!canEdit}
                onClick={() => {
                  onPatch({ backgroundImageUrl: bgDraft.trim() || null });
                }}
              >
                应用背景
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">网格</p>
            <p className="text-xs text-gray-600">
              {visualState.grid.type} · {visualState.grid.unitFeet} 英尺/格 · {visualState.grid.sizePx}px · 吸附 {visualState.grid.snap ? "开" : "关"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { enabled: !visualState.grid.enabled } })}
              >
                {visualState.grid.enabled ? "关闭网格" : "开启网格"}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { type: visualState.grid.type === "square" ? "hex" : "square" } })}
              >
                切换网格类型
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { snap: !visualState.grid.snap } })}
              >
                {visualState.grid.snap ? "关闭吸附" : "开启吸附"}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { unitFeet: clamp(visualState.grid.unitFeet - 1, 1, 100) } })}
              >
                英尺 -1
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { unitFeet: clamp(visualState.grid.unitFeet + 1, 1, 100) } })}
              >
                英尺 +1
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { sizePx: clamp(visualState.grid.sizePx - 4, 24, 120) } })}
              >
                像素 -4
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ grid: { sizePx: clamp(visualState.grid.sizePx + 4, 24, 120) } })}
              >
                像素 +4
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">雾效与光照</p>
            <p className="text-xs text-gray-600">
              雾效 {visualState.fog.enabled ? "开启" : "关闭"} · 模式 {visualState.fog.mode} · 黑暗度 {(visualState.lighting.darkness * 100).toFixed(0)}%
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ fog: { enabled: !visualState.fog.enabled } })}
              >
                {visualState.fog.enabled ? "关闭雾效" : "开启雾效"}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ fog: { mode: visualState.fog.mode === "hidden" ? "full" : "hidden" } })}
              >
                切换雾效模式
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ lighting: { globalLight: !visualState.lighting.globalLight } })}
              >
                {visualState.lighting.globalLight ? "关闭全局光" : "开启全局光"}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ lighting: { darkness: clamp(visualState.lighting.darkness - 0.1, 0, 1) } })}
              >
                黑暗 -10%
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ lighting: { darkness: clamp(visualState.lighting.darkness + 0.1, 0, 1) } })}
              >
                黑暗 +10%
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">高度层</p>
            <p className="text-xs text-gray-600">{visualState.elevation.enabled ? "启用" : "禁用"} · 基准 {visualState.elevation.baseLevel}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ elevation: { enabled: !visualState.elevation.enabled } })}
              >
                {visualState.elevation.enabled ? "关闭高度层" : "启用高度层"}
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ elevation: { baseLevel: visualState.elevation.baseLevel - 1 } })}
              >
                高度 -1
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ elevation: { baseLevel: visualState.elevation.baseLevel + 1 } })}
              >
                高度 +1
              </button>
            </div>
          </div>

          <div className="mt-2 rounded border p-2">
            <p className="text-sm font-semibold">光源</p>
            <p className="text-xs text-gray-600">当前光源数量：{visualState.lights.length}</p>
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
                onClick={addPointLight}
                disabled={!canEdit}
              >
                新增点光源
              </button>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={() => onPatch({ lights: [] })}
                disabled={!canEdit || visualState.lights.length === 0}
              >
                清空光源
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">权限：{canManage ? "可编辑" : "只读"}</p>
          {saving ? <p className="text-xs text-indigo-700">保存中...</p> : null}
        </>
      )}
    </div>
  );
}
