import { useState } from "react";
import { THEME_PACKS, SYSTEM_DEFAULT_THEME, type ThemePack, type ThemePackId } from "../../../lib/theme";

export type ThemePickerOverlayProps = {
  /** Currently effective pack id (resolved from precedence). */
  effective: ThemePackId;
  /** Player's personal preference. */
  userPreference: ThemePackId;
  /** World-level pack (GM-set), if any. */
  worldPack: ThemePackId | null;
  /** Whether the world pack is forced on every player by the GM. */
  worldPackForcedByGM: boolean;
  /** True when current viewer is the world GM. */
  isGm: boolean;
  /** Player picks a personal pack. */
  onPickUserPack: (id: ThemePackId) => void;
  /** GM saves a world-level pack + lock setting. Pass null to clear. */
  onSaveWorldPack?: (input: { themePack: ThemePackId | null; forced: boolean }) => Promise<void> | void;
};

/**
 * 设计风格选择器
 *
 * 优先级：GM 强制世界包 > GM 默认世界包 > 玩家个人偏好 > 系统默认。
 * - 玩家：点击任意包卡片切换 userPreference，立即生效（除非被 GM 强制）。
 * - GM：除上述外，可在底部为整个世界设定默认包 / 锁定开关。
 */
export function ThemePickerOverlay({
  effective,
  userPreference,
  worldPack,
  worldPackForcedByGM,
  isGm,
  onPickUserPack,
  onSaveWorldPack,
}: ThemePickerOverlayProps) {
  const [draftWorldPack, setDraftWorldPack] = useState<ThemePackId | null>(worldPack);
  const [draftForced, setDraftForced] = useState<boolean>(worldPackForcedByGM);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSaveWorld = async () => {
    if (!onSaveWorldPack) return;
    setSaving(true);
    try {
      await onSaveWorldPack({ themePack: draftWorldPack, forced: draftForced });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  const lockedByWorld = !!(worldPack && worldPackForcedByGM);

  return (
    <div className="theme-picker">
      <header className="theme-picker__head">
        <div>
          <h3>设计风格</h3>
          <p className="theme-picker__subtitle">
            {lockedByWorld
              ? "GM 已为本世界锁定风格，玩家个人选择当前不生效。"
              : worldPack && worldPack !== SYSTEM_DEFAULT_THEME
                ? "GM 为本世界设置了默认风格。你也可以在下面挑选个人偏好。"
                : "在下方挑选你喜欢的风格，立即生效，并自动记住偏好。"}
          </p>
        </div>
        <div className="theme-picker__current">
          <span className="theme-picker__current-label">当前生效</span>
          <strong>{THEME_PACKS.find((p) => p.id === effective)?.label ?? effective}</strong>
        </div>
      </header>

      <div className="theme-picker__grid">
        {THEME_PACKS.map((pack) => (
          <ThemeCard
            key={pack.id}
            pack={pack}
            isEffective={pack.id === effective}
            isUserPick={pack.id === userPreference}
            isWorldPick={pack.id === worldPack}
            disabled={lockedByWorld && pack.id !== effective}
            onPick={() => {
              if (lockedByWorld) return;
              onPickUserPack(pack.id);
            }}
          />
        ))}
      </div>

      {isGm && onSaveWorldPack ? (
        <section className="theme-picker__gm">
          <header className="theme-picker__gm-head">
            <strong>GM · 世界级风格</strong>
            <span>为本世界设置默认风格，可选锁定为强制项。</span>
          </header>

          <div className="theme-picker__gm-row">
            <label className="theme-picker__gm-field">
              <span>世界默认</span>
              <select
                value={draftWorldPack ?? ""}
                onChange={(e) => setDraftWorldPack(e.target.value === "" ? null : (e.target.value as ThemePackId))}
              >
                <option value="">（无 · 跟随玩家偏好）</option>
                {THEME_PACKS.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.label} — {pack.tone}
                  </option>
                ))}
              </select>
            </label>

            <label className="theme-picker__gm-toggle">
              <input
                type="checkbox"
                checked={draftForced}
                disabled={!draftWorldPack}
                onChange={(e) => setDraftForced(e.target.checked)}
              />
              <span>锁定为强制项（覆盖所有玩家个人选择）</span>
            </label>
          </div>

          <div className="theme-picker__gm-actions">
            <button
              type="button"
              className="theme-picker__gm-save"
              onClick={() => void handleSaveWorld()}
              disabled={saving}
            >
              {saving ? "保存中..." : savedFlash ? "已保存 ✓" : "保存世界设置"}
            </button>
            <button
              type="button"
              className="theme-picker__gm-clear"
              onClick={() => {
                setDraftWorldPack(null);
                setDraftForced(false);
              }}
              disabled={saving}
            >
              清空（恢复跟随玩家偏好）
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

type ThemeCardProps = {
  pack: ThemePack;
  isEffective: boolean;
  isUserPick: boolean;
  isWorldPick: boolean;
  disabled: boolean;
  onPick: () => void;
};

function ThemeCard({ pack, isEffective, isUserPick, isWorldPick, disabled, onPick }: ThemeCardProps) {
  const cls = [
    "theme-picker__card",
    isEffective && "is-effective",
    isUserPick && "is-user-pick",
    isWorldPick && "is-world-pick",
    disabled && "is-disabled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onPick}
      disabled={disabled}
      title={disabled ? "GM 已锁定本世界风格" : pack.description}
      data-theme={pack.id}
    >
      <span
        className="theme-picker__card-preview"
        style={{
          background: `linear-gradient(135deg, ${pack.swatches[0]} 0%, ${pack.swatches[1]} 55%, ${pack.swatches[2]} 100%)`,
        }}
      >
        {pack.swatches.map((hex) => (
          <i key={hex} style={{ background: hex }} />
        ))}
      </span>
      <span className="theme-picker__card-body">
        <strong>{pack.label}</strong>
        <em>{pack.tone}</em>
        <span>{pack.description}</span>
      </span>
      <span className="theme-picker__card-flags">
        {isEffective ? <b className="flag flag-effective">使用中</b> : null}
        {isUserPick && !isEffective ? <b className="flag flag-user">个人偏好</b> : null}
        {isWorldPick && !isEffective ? <b className="flag flag-world">世界默认</b> : null}
      </span>
    </button>
  );
}
