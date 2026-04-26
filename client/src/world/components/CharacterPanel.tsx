import type { MouseEvent } from "react";
import type { CharacterItem } from "../../pages/world/types";

/**
 * AAF-WORLD-COMPONENT active:list-surface
 * Mount policy: right-side character tab only. Detailed sheets and edit forms
 * live in overlays so the system panel stays short and scan-friendly.
 */

type CharacterPanelProps = {
  characters: CharacterItem[];
  selectedCharacterId: string;
  canCreateCharacter: boolean;
  readOnlyHint?: string;
  onSelectCharacter: (characterId: string) => void;
  onOpenCharacter: (characterId: string) => void;
  onOpenCreate: () => void;
  onCharacterContextMenu: (event: MouseEvent, characterId: string) => void;
};

function getRecordNumber(record: unknown, key: string, fallback = 0) {
  if (!record || typeof record !== "object") {
    return fallback;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRecordString(record: unknown, key: string, fallback = "") {
  if (!record || typeof record !== "object") {
    return fallback;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function CharacterPanel({
  characters,
  selectedCharacterId,
  canCreateCharacter,
  readOnlyHint,
  onSelectCharacter,
  onOpenCharacter,
  onOpenCreate,
  onCharacterContextMenu,
}: CharacterPanelProps) {
  return (
    <section className="world-card world-character-roster" data-world-component="character-roster-panel" data-world-layer="panel">
      <div className="world-character-roster__head">
        <div>
          <strong>角色花名册</strong>
          <p>点击条目打开角色卡，右键条目进行快捷操作。</p>
        </div>
        {canCreateCharacter ? (
          <button type="button" className="world-stage-header-btn" onClick={onOpenCreate}>
            创建角色
          </button>
        ) : (
          <span className="world-stage-pill">只读</span>
        )}
      </div>

      {characters.length === 0 ? (
        <div className="world-stage-empty">{readOnlyHint || "当前世界还没有可见角色。"}</div>
      ) : (
        <div className="world-character-roster__list">
          {characters.map((character) => {
            const level = getRecordNumber(character.snapshot, "level", 1);
            const className = getRecordString(character.snapshot, "class", "未知职业");
            const hp = getRecordNumber(character.stats, "hp", 0);
            const mp = getRecordNumber(character.stats, "mp", 0);
            const ac = getRecordNumber(character.snapshot, "ac", 10);
            const isActive = character.id === selectedCharacterId;

            return (
              <button
                type="button"
                key={character.id}
                className={`world-character-roster__row ${isActive ? "is-active" : ""}`.trim()}
                onClick={() => {
                  onSelectCharacter(character.id);
                  onOpenCharacter(character.id);
                }}
                onContextMenu={(event) => onCharacterContextMenu(event, character.id)}
              >
                <span className="world-character-roster__avatar">{character.name.slice(0, 1).toUpperCase()}</span>
                <span className="world-character-roster__main">
                  <strong>{character.name}</strong>
                  <em>{character.type} · Lv.{level} · {className}</em>
                </span>
                <span className="world-character-roster__stats">
                  <i>HP {hp}</i>
                  <i>MP {mp}</i>
                  <i>AC {ac}</i>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="world-stage-readonly-note">提示：右键角色可设为当前角色、投放棋子或打开角色卡。</p>
    </section>
  );
}
