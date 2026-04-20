import { useEffect, useMemo, useState } from "react";
import type { KeyBinding } from "../../../../shared/types/world-entities";
import { DEFAULT_KEYBINDINGS } from "../../../../shared/types/world-entities";

/**
 * AAF-WORLD-COMPONENT active:overlay-tool
 * Mount policy: only mounted inside the system hotkey overlay.
 */

type WorldHotkeyActionInfo = {
  action: string;
  label: string;
  category: string;
  description: string;
};

type HotkeySettingsPanelProps = {
  worldId: string;
  userId?: string;
  bindings: KeyBinding[];
  onChange: (bindings: KeyBinding[]) => void;
};

const WORLD_HOTKEY_ACTIONS: WorldHotkeyActionInfo[] = [
  { action: "toggleSystemPanel", label: "展开/收起系统板", category: "通用", description: "快速隐藏右侧系统板，给舞台腾出空间。" },
  { action: "toggleHUD", label: "展开/收起 HUD", category: "通用", description: "隐藏或显示底部角色行动面板。" },
  { action: "toggleChat", label: "打开聊天页", category: "通用", description: "切到聊天标签并展开系统板。" },
  { action: "openHotkeys", label: "打开快捷键设置", category: "通用", description: "随时回到本面板重新录制快捷键。" },
  { action: "escape", label: "关闭弹窗/取消", category: "通用", description: "关闭当前弹窗、右键菜单或临时创建表单。" },
  { action: "toggleFullscreen", label: "切换全屏", category: "通用", description: "进入或退出浏览器全屏模式。" },
  { action: "quickSave", label: "同步提示", category: "通用", description: "提示当前世界为实时同步，不需要手动保存。" },
  { action: "openBattleTab", label: "打开战斗页", category: "系统板", description: "切到先攻、回合和战斗控制面板。" },
  { action: "openSceneTab", label: "打开场景页", category: "系统板", description: "切到舞台、视觉、棋子和测量面板。" },
  { action: "openCharacterTab", label: "打开角色页", category: "系统板", description: "切到角色花名册。" },
  { action: "openPackTab", label: "打开资源包页", category: "系统板", description: "GM 可快速进入资源包导入导出。" },
  { action: "openSystemTab", label: "打开系统页", category: "系统板", description: "切到规则查询、快捷键、返回大厅和 GM 控制台。" },
  { action: "openAbilityOverlay", label: "打开能力结算台", category: "战斗", description: "打开隐藏式能力执行弹窗。" },
  { action: "openStoryOverlay", label: "打开剧情事件板", category: "剧情", description: "打开剧情事件、检定和物语点面板。" },
  { action: "toggleBattleBar", label: "展开/收起战斗序列", category: "战斗", description: "控制顶部先攻序列栏显示。" },
  { action: "endTurn", label: "结束/推进回合", category: "战斗", description: "拥有权限时推进到下一回合。" },
  { action: "rollInitiative", label: "投掷先攻", category: "战斗", description: "预留动作，后续接入先攻投掷。" },
  { action: "centerOnToken", label: "定位我的棋子", category: "场景", description: "把视线拉回绑定角色的棋子。" },
  { action: "advanceFateClock", label: "推进命刻", category: "命刻", description: "将当前命刻推进一格。" },
  { action: "retreatFateClock", label: "回退命刻", category: "命刻", description: "将当前命刻回退一格。" },
  { action: "slot1", label: "快捷栏 1", category: "快捷栏", description: "触发底部 HUD 第 1 格。" },
  { action: "slot2", label: "快捷栏 2", category: "快捷栏", description: "触发底部 HUD 第 2 格。" },
  { action: "slot3", label: "快捷栏 3", category: "快捷栏", description: "触发底部 HUD 第 3 格。" },
  { action: "slot4", label: "快捷栏 4", category: "快捷栏", description: "触发底部 HUD 第 4 格。" },
  { action: "slot5", label: "快捷栏 5", category: "快捷栏", description: "触发底部 HUD 第 5 格。" },
  { action: "slot6", label: "快捷栏 6", category: "快捷栏", description: "触发底部 HUD 第 6 格。" },
  { action: "slot7", label: "快捷栏 7", category: "快捷栏", description: "触发底部 HUD 第 7 格。" },
  { action: "slot8", label: "快捷栏 8", category: "快捷栏", description: "触发底部 HUD 第 8 格。" },
  { action: "slot9", label: "快捷栏 9", category: "快捷栏", description: "触发底部 HUD 第 9 格。" },
  { action: "slot0", label: "快捷栏 10", category: "快捷栏", description: "触发底部 HUD 第 10 格。" },
];

const ACTION_INFO_BY_ID = new Map(WORLD_HOTKEY_ACTIONS.map((item) => [item.action, item]));
const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function getDefaultWorldHotkeys(): KeyBinding[] {
  const defaultsByAction = new Map<string, KeyBinding>();
  for (const binding of DEFAULT_KEYBINDINGS) {
    defaultsByAction.set(binding.action, { ...binding, device: binding.device ?? "keyboard" });
  }

  return WORLD_HOTKEY_ACTIONS.map((action) => {
    const existing = defaultsByAction.get(action.action);
    return existing
      ? { ...existing, label: action.label, category: action.category }
      : { action: action.action, key: "", label: action.label, category: action.category, disabled: true };
  });
}

export function getWorldHotkeyStorageKey(worldId: string, userId?: string) {
  return `aaf-world-hotkeys:v1:${worldId}:${userId ?? "anonymous"}`;
}

export function mergeWorldHotkeyBindings(bindings: KeyBinding[] | null | undefined) {
  const merged = new Map(getDefaultWorldHotkeys().map((binding) => [binding.action, binding]));
  for (const binding of bindings ?? []) {
    if (!binding?.action || !ACTION_INFO_BY_ID.has(binding.action)) {
      continue;
    }
    const actionInfo = ACTION_INFO_BY_ID.get(binding.action);
    merged.set(binding.action, {
      ...merged.get(binding.action),
      ...binding,
      label: actionInfo?.label ?? binding.label,
      category: actionInfo?.category ?? binding.category,
      device: binding.device ?? (binding.key.startsWith("Mouse") ? "mouse" : "keyboard"),
    });
  }
  return WORLD_HOTKEY_ACTIONS.map((action) => merged.get(action.action)).filter((item): item is KeyBinding => Boolean(item));
}

export function loadWorldHotkeyBindings(worldId: string, userId?: string) {
  if (typeof window === "undefined") {
    return getDefaultWorldHotkeys();
  }

  const raw = window.localStorage.getItem(getWorldHotkeyStorageKey(worldId, userId));
  if (!raw) {
    return getDefaultWorldHotkeys();
  }

  try {
    const parsed = JSON.parse(raw);
    return mergeWorldHotkeyBindings(Array.isArray(parsed) ? parsed : null);
  } catch {
    return getDefaultWorldHotkeys();
  }
}

export function saveWorldHotkeyBindings(worldId: string, userId: string | undefined, bindings: KeyBinding[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getWorldHotkeyStorageKey(worldId, userId), JSON.stringify(mergeWorldHotkeyBindings(bindings)));
}

function formatKeyboardKey(key: string) {
  if (key === " ") return "Space";
  if (key === "Escape") return "Esc";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function formatMouseButton(button?: number) {
  switch (button) {
    case 0:
      return "鼠标左键";
    case 1:
      return "鼠标中键";
    case 2:
      return "鼠标右键";
    case 3:
      return "鼠标侧键1";
    case 4:
      return "鼠标侧键2";
    default:
      return "鼠标按键";
  }
}

export function formatKeyBinding(binding: KeyBinding | undefined) {
  if (!binding || binding.disabled || !binding.key) {
    return "未设置";
  }

  const parts = [
    binding.ctrl ? "Ctrl" : "",
    binding.alt ? "Alt" : "",
    binding.shift ? "Shift" : "",
    binding.meta ? "Meta" : "",
  ].filter(Boolean);

  parts.push(binding.device === "mouse" ? formatMouseButton(binding.button) : formatKeyboardKey(binding.key));
  return parts.join(" + ");
}

function bindingFromKeyboardEvent(action: WorldHotkeyActionInfo, event: KeyboardEvent): KeyBinding | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  return {
    action: action.action,
    key: event.key,
    device: "keyboard",
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    label: action.label,
    category: action.category,
  };
}

function bindingFromMouseEvent(action: WorldHotkeyActionInfo, event: MouseEvent): KeyBinding {
  return {
    action: action.action,
    key: `Mouse${event.button}`,
    device: "mouse",
    button: event.button,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    label: action.label,
    category: action.category,
  };
}

function groupActionsByCategory() {
  return WORLD_HOTKEY_ACTIONS.reduce<Record<string, WorldHotkeyActionInfo[]>>((groups, action) => {
    groups[action.category] = [...(groups[action.category] ?? []), action];
    return groups;
  }, {});
}

export function HotkeySettingsPanel({ worldId, userId, bindings, onChange }: HotkeySettingsPanelProps) {
  const [recordingActionId, setRecordingActionId] = useState<string | null>(null);
  const [recordingHint, setRecordingHint] = useState("选择一项操作后，按键盘、鼠标或组合键即可录制。");
  const mergedBindings = useMemo(() => mergeWorldHotkeyBindings(bindings), [bindings]);
  const bindingByAction = useMemo(() => new Map(mergedBindings.map((binding) => [binding.action, binding])), [mergedBindings]);
  const groupedActions = useMemo(() => groupActionsByCategory(), []);

  useEffect(() => {
    if (!recordingActionId) {
      return;
    }

    const action = ACTION_INFO_BY_ID.get(recordingActionId);
    if (!action) {
      setRecordingActionId(null);
      return;
    }

    const commitBinding = (binding: KeyBinding | null) => {
      if (!binding) {
        setRecordingHint("请在修饰键之外再按一个主键，例如 Ctrl + K。");
        return;
      }

      const next = mergeWorldHotkeyBindings([
        ...mergedBindings.filter((item) => item.action !== action.action),
        binding,
      ]);
      onChange(next);
      saveWorldHotkeyBindings(worldId, userId, next);
      setRecordingActionId(null);
      setRecordingHint(`已设置：${action.label} = ${formatKeyBinding(binding)}`);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      commitBinding(bindingFromKeyboardEvent(action, event));
    };

    const onMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      commitBinding(bindingFromMouseEvent(action, event));
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [mergedBindings, onChange, recordingActionId, userId, worldId]);

  const clearBinding = (action: WorldHotkeyActionInfo) => {
    const next = mergeWorldHotkeyBindings([
      ...mergedBindings.filter((item) => item.action !== action.action),
      { action: action.action, key: "", label: action.label, category: action.category, disabled: true },
    ]);
    onChange(next);
    saveWorldHotkeyBindings(worldId, userId, next);
    setRecordingHint(`已清除：${action.label}`);
  };

  const resetDefaults = () => {
    const next = getDefaultWorldHotkeys();
    onChange(next);
    saveWorldHotkeyBindings(worldId, userId, next);
    setRecordingHint("已恢复默认快捷键。");
  };

  return (
    <section className="world-hotkey-panel" data-world-component="hotkey-settings-panel">
      <div className="world-hotkey-panel__head">
        <div>
          <strong>快捷键设置</strong>
          <p>每个用户单独保存。支持键盘、鼠标、Ctrl / Alt / Shift / Meta 组合键。</p>
        </div>
        <button type="button" className="world-hotkey-panel__reset" onClick={resetDefaults}>
          恢复默认
        </button>
      </div>

      <p className={`world-hotkey-panel__hint ${recordingActionId ? "is-recording" : ""}`.trim()}>{recordingHint}</p>

      <div className="world-hotkey-panel__groups">
        {Object.entries(groupedActions).map(([category, actions]) => (
          <section className="world-hotkey-panel__group" key={category}>
            <h3>{category}</h3>
            <div className="world-hotkey-panel__rows">
              {actions.map((action) => {
                const binding = bindingByAction.get(action.action);
                const recording = recordingActionId === action.action;
                return (
                  <article className={`world-hotkey-row ${recording ? "is-recording" : ""}`.trim()} key={action.action}>
                    <div className="world-hotkey-row__main">
                      <strong>{action.label}</strong>
                      <span>{action.description}</span>
                    </div>
                    <kbd className={binding?.disabled ? "is-empty" : ""}>{recording ? "等待输入..." : formatKeyBinding(binding)}</kbd>
                    <div className="world-hotkey-row__actions">
                      <button
                        type="button"
                        className="world-hotkey-row__record"
                        onClick={() => {
                          setRecordingActionId(action.action);
                          setRecordingHint(`正在录制“${action.label}”：请按键盘、鼠标或组合键。`);
                        }}
                      >
                        录制
                      </button>
                      <button type="button" className="world-hotkey-row__clear" onClick={() => clearBinding(action)}>
                        清除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
