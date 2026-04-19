/**
 * 战斗序列栏 - BattleSequenceBar
 *
 * 默认隐藏，当战斗开始时(combat:start)从顶部滑入。
 * 参与者按先攻值从左到右排列，当前回合角色高亮且带光效。
 */

import React, { useMemo } from "react";

export interface InitiativeEntry {
  id: string;
  name: string;
  avatarUrl?: string;
  initiative: number;
  isCurrentTurn: boolean;
  isMine: boolean;
  type: "PC" | "NPC";
  hp?: number;
  maxHp?: number;
  statusTags?: string[];
}

interface BattleSequenceBarProps {
  visible: boolean;
  entries: InitiativeEntry[];
  roundNumber: number;
  onEndTurn?: () => void;
  onSelectEntry?: (id: string) => void;
  canAdvanceTurn: boolean;
}

export const BattleSequenceBar: React.FC<BattleSequenceBarProps> = ({
  visible,
  entries,
  roundNumber,
  onEndTurn,
  onSelectEntry,
  canAdvanceTurn,
}) => {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.initiative - a.initiative),
    [entries]
  );

  return (
    <section
      className={`battle-sequence-bar ${visible ? "battle-sequence-bar--visible" : ""}`}
      aria-label="战斗序列栏"
      aria-hidden={!visible}
    >
      <div className="battle-sequence-bar__round">
        <span className="battle-sequence-bar__round-label">第</span>
        <span className="battle-sequence-bar__round-number">{roundNumber}</span>
        <span className="battle-sequence-bar__round-label">轮</span>
      </div>

      <div className="battle-sequence-bar__track">
        {sorted.map((entry) => {
          const hpPercent = entry.maxHp ? Math.max(0, Math.min(100, ((entry.hp ?? 0) / entry.maxHp) * 100)) : 100;
          return (
            <button
              key={entry.id}
              type="button"
              className={[
                "battle-sequence-bar__entry",
                entry.isCurrentTurn && "battle-sequence-bar__entry--current",
                entry.isMine && "battle-sequence-bar__entry--mine",
                entry.type === "NPC" && "battle-sequence-bar__entry--npc",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelectEntry?.(entry.id)}
              title={`${entry.name} (先攻: ${entry.initiative})`}
            >
              <div className="battle-sequence-bar__avatar">
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt={entry.name} draggable={false} />
                ) : (
                  <span className="battle-sequence-bar__avatar-fallback">
                    {entry.name.charAt(0)}
                  </span>
                )}
                {entry.isCurrentTurn && <div className="battle-sequence-bar__glow" />}
              </div>

              <div className="battle-sequence-bar__info">
                <span className="battle-sequence-bar__name">{entry.name}</span>
                <span className="battle-sequence-bar__init">{entry.initiative}</span>
              </div>

              <div className="battle-sequence-bar__hp-bar">
                <div
                  className="battle-sequence-bar__hp-fill"
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              {entry.statusTags && entry.statusTags.length > 0 && (
                <div className="battle-sequence-bar__tags">
                  {entry.statusTags.map((tag) => (
                    <span key={tag} className="battle-sequence-bar__tag">{tag}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {canAdvanceTurn && (
        <button
          type="button"
          className="battle-sequence-bar__end-turn"
          onClick={onEndTurn}
        >
          结束回合
        </button>
      )}
    </section>
  );
};
