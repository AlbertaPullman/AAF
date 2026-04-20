import { useEffect, useMemo, useRef, type MouseEvent, type WheelEvent } from "react";

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
  onEntryContextMenu?: (event: MouseEvent, id: string) => void;
  canAdvanceTurn: boolean;
  advancing?: boolean;
}

type SequenceEntry = {
  source: InitiativeEntry;
  key: string;
  loopPreview: boolean;
  showRoundDivider: boolean;
};

export function BattleSequenceBar({
  visible,
  entries,
  roundNumber,
  onEndTurn,
  onSelectEntry,
  onEntryContextMenu,
  canAdvanceTurn,
  advancing = false,
}: BattleSequenceBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activeEntryRef = useRef<HTMLButtonElement | null>(null);

  const currentEntry = useMemo(
    () => entries.find((entry) => entry.isCurrentTurn) ?? entries[0] ?? null,
    [entries]
  );

  const sequenceEntries = useMemo<SequenceEntry[]>(() => {
    const base = entries.map((entry) => ({
      source: entry,
      key: entry.id,
      loopPreview: false,
      showRoundDivider: false,
    }));

    if (entries.length > 1) {
      base.push({
        source: entries[0],
        key: `${entries[0].id}:next-round-preview`,
        loopPreview: true,
        showRoundDivider: true,
      });
    }

    return base;
  }, [entries]);

  useEffect(() => {
    if (!visible || !activeEntryRef.current) {
      return;
    }

    activeEntryRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentEntry?.id, entries.length, roundNumber, visible]);

  const onTrackWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.shiftKey || !trackRef.current) {
      return;
    }

    event.preventDefault();
    const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    trackRef.current.scrollLeft += primaryDelta;
  };

  return (
    <section
      className={`battle-sequence-bar ${visible ? "battle-sequence-bar--visible" : ""}`}
      aria-label="战斗序列栏"
      aria-hidden={!visible}
    >
      <div className="battle-sequence-bar__frame">
        <div className="battle-sequence-bar__round">
          <span className="battle-sequence-bar__round-label">第 {roundNumber} 轮</span>
          <strong>{currentEntry?.name ?? "未指定"}</strong>
          <span className="battle-sequence-bar__round-hint">当前先攻</span>
        </div>

        <div
          className="battle-sequence-bar__track"
          ref={trackRef}
          onWheel={onTrackWheel}
          aria-label="先攻顺序，按住 Shift 滚轮可本地横向查看"
        >
          {sequenceEntries.length === 0 ? (
            <div className="battle-sequence-bar__empty">当前场景暂无先攻序列。</div>
          ) : null}

          {sequenceEntries.map(({ source: entry, key, loopPreview, showRoundDivider }) => {
            const hpPercent = entry.maxHp
              ? Math.max(0, Math.min(100, ((entry.hp ?? 0) / entry.maxHp) * 100))
              : 100;
            const isCurrent = entry.isCurrentTurn && !loopPreview;

            return (
              <div className="battle-sequence-bar__sequence-cell" key={key}>
                {showRoundDivider ? (
                  <span
                    className="battle-sequence-bar__round-divider"
                    title="完整先攻序列结束"
                    aria-hidden="true"
                  />
                ) : null}

                <button
                  ref={isCurrent ? activeEntryRef : undefined}
                  type="button"
                  className={[
                    "battle-sequence-bar__entry",
                    isCurrent && "battle-sequence-bar__entry--current",
                    entry.isMine && !loopPreview && "battle-sequence-bar__entry--mine",
                    entry.type === "NPC" && "battle-sequence-bar__entry--npc",
                    loopPreview && "battle-sequence-bar__entry--loop-preview",
                  ].filter(Boolean).join(" ")}
                  onClick={() => onSelectEntry?.(entry.id)}
                  onContextMenu={(event) => onEntryContextMenu?.(event, entry.id)}
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
                  </div>

                  <div className="battle-sequence-bar__info">
                    <span className="battle-sequence-bar__name">{entry.name}</span>
                    <span className="battle-sequence-bar__init">先攻 {entry.initiative}</span>
                  </div>

                  {entry.maxHp ? (
                    <div className="battle-sequence-bar__hp-bar" aria-hidden="true">
                      <div
                        className="battle-sequence-bar__hp-fill"
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                  ) : null}

                  {entry.statusTags && entry.statusTags.length > 0 ? (
                    <div className="battle-sequence-bar__tags">
                      {entry.statusTags.slice(0, 2).map((tag) => (
                        <span key={tag} className="battle-sequence-bar__tag">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        {canAdvanceTurn ? (
          <button
            type="button"
            className="battle-sequence-bar__end-turn"
            onClick={onEndTurn}
            disabled={advancing}
          >
            {advancing ? "推进中" : "下一回合"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
