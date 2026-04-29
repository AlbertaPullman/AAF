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
    <footer className={`hud-panel hud-panel--${config.mode}`.trim()} aria-label="HUD 面板">
      <div className="hud-panel__avatar" aria-hidden="true">
        <span className="hud-panel__avatar-initial">
          {hasCharacter ? (characterName?.trim()?.[0] ?? "?").toUpperCase() : "·"}
        </span>
        {characterLevel != null && hasCharacter ? (
          <span className="hud-panel__avatar-level">Lv.{characterLevel}</span>
        ) : null}
      </div>
      <div className="hud-panel__resources">
        <div className="hud-panel__char-info">
          {hasCharacter ? (
            <>
              <span className="hud-panel__char-name">{characterName}</span>
              {characterLevel != null ? <span className="hud-panel__char-level">Lv.{characterLevel}</span> : null}
            </>
          ) : emptyStateTitle ? (
            <div className="hud-panel__empty-state">
              <span className="hud-panel__char-name">{emptyStateTitle}</span>
              {emptyStateDescription ? <span className="hud-panel__char-level">{emptyStateDescription}</span> : null}
            </div>
          ) : null}
        </div>

        {hasCharacter ? (
          <div className="hud-panel__bars">
            <div className="hud-panel__bar hud-panel__bar--hp" title={`生命值 ${resources.hp}/${resources.maxHp}`}>
              <div className="hud-panel__bar-fill" style={{ width: `${hpPct}%` }} />
              <span className="hud-panel__bar-text">
                {resources.hp}/{resources.maxHp}
              </span>
            </div>
            <div className="hud-panel__bar hud-panel__bar--mp" title={`魔力值 ${resources.mp}/${resources.maxMp}`}>
              <div className="hud-panel__bar-fill" style={{ width: `${mpPct}%` }} />
              <span className="hud-panel__bar-text">
                {resources.mp}/{resources.maxMp}
              </span>
            </div>
            {resources.maxStamina > 0 ? (
              <div
                className="hud-panel__bar hud-panel__bar--stamina"
                title={`体力 ${resources.stamina}/${resources.maxStamina}`}
              >
                <div className="hud-panel__bar-fill" style={{ width: `${staminaPct}%` }} />
                <span className="hud-panel__bar-text">
                  {resources.stamina}/{resources.maxStamina}
                </span>
              </div>
            ) : null}
            {resources.maxFury > 0 ? (
              <div className="hud-panel__bar hud-panel__bar--fury" title={`怒气 ${resources.fury}/${resources.maxFury}`}>
                <div className="hud-panel__bar-fill" style={{ width: `${furyPct}%` }} />
                <span className="hud-panel__bar-text">
                  {resources.fury}/{resources.maxFury}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {config.mode === "combat" ? (
        <div className="hud-panel__hotbar">
          {config.combatSlots.map((slot) => {
            const label =
              slot.type !== "empty" && slot.linkedId
                ? resolveLabel?.(slot.type, slot.linkedId) ?? slot.customLabel ?? ""
                : slot.customLabel ?? "";

            const iconUrl = slot.type !== "empty" && slot.linkedId ? resolveIcon?.(slot.type, slot.linkedId) : slot.customIconUrl;

            return (
              <div
                key={slot.index}
                className={`hud-panel__slot ${slot.type === "empty" ? "hud-panel__slot--empty" : ""}`.trim()}
                title={label || `快捷栏位 ${slot.index + 1}`}
                onClick={() => {
                  if (slot.type !== "empty") {
                    onSlotClick?.(slot);
                  }
                }}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(slot.index, event)}
                role="button"
                tabIndex={0}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt={label} className="hud-panel__slot-icon" draggable={false} />
                ) : (
                  <span className="hud-panel__slot-key">{slot.index < 9 ? slot.index + 1 : 0}</span>
                )}
                {label ? <span className="hud-panel__slot-label">{label}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {config.mode === "general" ? (
        <div className="hud-panel__tabs">
          <nav className="hud-panel__tab-nav">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`hud-panel__tab-btn ${activeTab === tab.id ? "hud-panel__tab-btn--active" : ""}`.trim()}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="hud-panel__tab-content">
            {renderGeneralTab ? renderGeneralTab(activeTab) : <div className="hud-panel__tab-placeholder">{activeTab} 内容区</div>}
          </div>
        </div>
      ) : null}

      {onToggleMode ? (
        <button
          type="button"
          className="hud-panel__mode-toggle"
          onClick={onToggleMode}
          title={config.mode === "combat" ? "切换到常规模式" : "切换到战斗模式"}
        >
          {config.mode === "combat" ? "⌘" : "◈"}
        </button>
      ) : null}
    </footer>
  );
};
