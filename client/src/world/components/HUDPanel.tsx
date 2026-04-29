import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import type { HUDConfig, HUDSlot } from "../../../../shared/types/world-entities";

interface HUDPanelProps {
  visible: boolean;
  config: HUDConfig;
  resources: {
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    stamina: number;
    maxStamina: number;
    fury: number;
    maxFury: number;
  };
  characterName?: string;
  characterLevel?: number;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  onSlotClick?: (slot: HUDSlot) => void;
  onSlotDrop?: (slotIndex: number, data: { type: "ability" | "item"; id: string }) => void;
  onToggleMode?: () => void;
  resolveLabel?: (type: "ability" | "item", id: string) => string;
  resolveIcon?: (type: "ability" | "item", id: string) => string | undefined;
  renderGeneralTab?: (activeTabId: string) => ReactNode;
}

export const HUDPanel: React.FC<HUDPanelProps> = ({
  visible,
  config,
  resources,
  characterName,
  characterLevel,
  emptyStateTitle,
  emptyStateDescription,
  onSlotClick,
  onSlotDrop,
  onToggleMode,
  resolveLabel,
  resolveIcon,
  renderGeneralTab,
}) => {
  const [activeTab, setActiveTab] = useState("character");

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (slotIndex: number, event: React.DragEvent) => {
      event.preventDefault();
      try {
        const raw = event.dataTransfer.getData("application/json");
        const data = JSON.parse(raw) as { type: "ability" | "item"; id: string };
        onSlotDrop?.(slotIndex, data);
      } catch {
        // ignore malformed drop payload
      }
    },
    [onSlotDrop]
  );

  const visibleTabs = useMemo(() => config.generalTabs.filter((tab) => tab.visible), [config.generalTabs]);

  const hpPct = resources.maxHp ? (resources.hp / resources.maxHp) * 100 : 0;
  const mpPct = resources.maxMp ? (resources.mp / resources.maxMp) * 100 : 0;
  const staminaPct = resources.maxStamina ? (resources.stamina / resources.maxStamina) * 100 : 0;
  const furyPct = resources.maxFury ? (resources.fury / resources.maxFury) * 100 : 0;
  const hasCharacter = Boolean(characterName);

  if (!visible) {
    return null;
  }

  return (
    <div className="hud-wrap" aria-label="HUD 面板">
      {/* 大头像：80×80 圆形，嵌入 HUD 左侧凹槽 */}
      <div className="hud-avatar" title="点击查看角色卡">
        <div className="hud-avatar__name">
          {hasCharacter ? characterName?.split("").join(" ") : "· · ·"}
        </div>
        {characterLevel != null && hasCharacter ? (
          <div className="hud-avatar__lv">LV. {characterLevel}</div>
        ) : null}
      </div>

      {/* HUD 主体：SVG 金边描线 + 4×10 格子 + 特殊功能区 */}
      <div className="hud">
        {/* SVG 金边描线：只描上/右/下三边，左侧凹槽不描 */}
        <svg className="hud-frame" viewBox="0 0 800 152" preserveAspectRatio="none" aria-hidden="true">
          <path
            className="hud-frame__outer"
            d="M 0 0 L 788 0 Q 800 0 800 12 L 800 140 Q 800 152 788 152 L 0 152"
          />
          <path
            className="hud-frame__inner"
            d="M 6 6 L 786 6 Q 794 6 794 14 L 794 138 Q 794 146 786 146 L 6 146"
          />
        </svg>

        {/* 拖拽热区：仅边缘 8px 可拖动 */}
        <div className="hud-drag-rim">
          <i />
          <i />
          <i />
          <i />
        </div>

        {/* 4 排 × 10 槽 */}
        <div className="hud-slots">
          {/* 第一排：主要技能，带快捷键 1-0 */}
          <div className="hud-row primary">
            {config.combatSlots.slice(0, 10).map((slot, idx) => {
              const label =
                slot.type !== "empty" && slot.linkedId
                  ? resolveLabel?.(slot.type, slot.linkedId) ?? slot.customLabel ?? ""
                  : slot.customLabel ?? "";
              const iconUrl = slot.type !== "empty" && slot.linkedId ? resolveIcon?.(slot.type, slot.linkedId) : slot.customIconUrl;
              const isFilled = slot.type !== "empty";

              return (
                <div
                  key={slot.index}
                  className={`slot ${isFilled ? "filled" : ""}`.trim()}
                  title={label || `快捷栏位 ${idx + 1}`}
                  onClick={() => {
                    if (isFilled) {
                      onSlotClick?.(slot);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(slot.index, event)}
                  role="button"
                  tabIndex={0}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={label} className="icon" draggable={false} />
                  ) : isFilled ? (
                    <span className="emoji">{label || "?"}</span>
                  ) : (
                    <span className="plus">＋</span>
                  )}
                  <span className="key">{idx < 9 ? idx + 1 : 0}</span>
                </div>
              );
            })}
          </div>

          {/* 第二排 */}
          <div className="hud-row">
            {config.combatSlots.slice(10, 20).map((slot) => {
              const label =
                slot.type !== "empty" && slot.linkedId
                  ? resolveLabel?.(slot.type, slot.linkedId) ?? slot.customLabel ?? ""
                  : slot.customLabel ?? "";
              const iconUrl = slot.type !== "empty" && slot.linkedId ? resolveIcon?.(slot.type, slot.linkedId) : slot.customIconUrl;
              const isFilled = slot.type !== "empty";

              return (
                <div
                  key={slot.index}
                  className={`slot ${isFilled ? "filled" : ""}`.trim()}
                  title={label || `快捷栏位 ${slot.index + 1}`}
                  onClick={() => {
                    if (isFilled) {
                      onSlotClick?.(slot);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(slot.index, event)}
                  role="button"
                  tabIndex={0}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={label} className="icon" draggable={false} />
                  ) : isFilled ? (
                    <span className="emoji">{label || "?"}</span>
                  ) : (
                    <span className="plus">＋</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 第三排 */}
          <div className="hud-row">
            {config.combatSlots.slice(20, 30).map((slot) => {
              const label =
                slot.type !== "empty" && slot.linkedId
                  ? resolveLabel?.(slot.type, slot.linkedId) ?? slot.customLabel ?? ""
                  : slot.customLabel ?? "";
              const iconUrl = slot.type !== "empty" && slot.linkedId ? resolveIcon?.(slot.type, slot.linkedId) : slot.customIconUrl;
              const isFilled = slot.type !== "empty";

              return (
                <div
                  key={slot.index}
                  className={`slot ${isFilled ? "filled" : ""}`.trim()}
                  title={label || `快捷栏位 ${slot.index + 1}`}
                  onClick={() => {
                    if (isFilled) {
                      onSlotClick?.(slot);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(slot.index, event)}
                  role="button"
                  tabIndex={0}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={label} className="icon" draggable={false} />
                  ) : isFilled ? (
                    <span className="emoji">{label || "?"}</span>
                  ) : (
                    <span className="plus">＋</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 第四排 */}
          <div className="hud-row">
            {config.combatSlots.slice(30, 40).map((slot) => {
              const label =
                slot.type !== "empty" && slot.linkedId
                  ? resolveLabel?.(slot.type, slot.linkedId) ?? slot.customLabel ?? ""
                  : slot.customLabel ?? "";
              const iconUrl = slot.type !== "empty" && slot.linkedId ? resolveIcon?.(slot.type, slot.linkedId) : slot.customIconUrl;
              const isFilled = slot.type !== "empty";

              return (
                <div
                  key={slot.index}
                  className={`slot ${isFilled ? "filled" : ""}`.trim()}
                  title={label || `快捷栏位 ${slot.index + 1}`}
                  onClick={() => {
                    if (isFilled) {
                      onSlotClick?.(slot);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDrop(slot.index, event)}
                  role="button"
                  tabIndex={0}
                >
                  {iconUrl ? (
                    <img src={iconUrl} alt={label} className="icon" draggable={false} />
                  ) : isFilled ? (
                    <span className="emoji">{label || "?"}</span>
                  ) : (
                    <span className="plus">＋</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 特殊功能区：2×2 切换态图标 */}
        <div className="hud-special" title="切换类能力">
          <div className="tog on" title="圣盾姿态（开）">
            🛡
          </div>
          <div className="tog" title="潜行">
            👤
          </div>
          <div className="tog" title="专注">
            🎯
          </div>
          <div className="tog" title="疾驰">
            ⚡
          </div>
        </div>
      </div>
    </div>
  );
};
