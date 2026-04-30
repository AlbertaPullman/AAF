import { useState, type MouseEvent } from "react";
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

type FolderNode = {
  path: string;
  name: string;
  icon: string;
  characters: CharacterItem[];
  collapsed: boolean;
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
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // 按类型分组角色
  const pcCharacters = characters.filter(c => c.type === "PC");
  const npcCharacters = characters.filter(c => c.type === "NPC");
  const monsterCharacters = characters.filter(c => c.type !== "PC" && c.type !== "NPC");

  const folders: FolderNode[] = [];

  if (pcCharacters.length > 0) {
    folders.push({
      path: "玩家队伍",
      name: "玩 家 队 伍",
      icon: "👥",
      characters: pcCharacters,
      collapsed: collapsedFolders.has("玩家队伍")
    });
  }

  if (npcCharacters.length > 0) {
    folders.push({
      path: "NPC·友方",
      name: "NPC · 友方",
      icon: "👥",
      characters: npcCharacters,
      collapsed: collapsedFolders.has("NPC·友方")
    });
  }

  if (monsterCharacters.length > 0) {
    folders.push({
      path: "怪物·本局",
      name: "怪 物 · 本 局",
      icon: "👿",
      characters: monsterCharacters,
      collapsed: collapsedFolders.has("怪物·本局")
    });
  }

  const toggleFolder = (path: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getCharacterIcon = (character: CharacterItem) => {
    if (character.type === "PC") return "🛡️";
    if (character.type === "NPC") return "👨‍🌾";
    return "🗡️";
  };

  const getCharacterTag = (character: CharacterItem) => {
    if (character.type === "PC") return { text: "绑定", className: "tag-ok" };
    if (character.type === "NPC") return { text: "NPC", className: "tag-npc" };
    const level = getRecordNumber(character.snapshot, "level", 1);
    return { text: `CR ${level}`, className: "tag-foe" };
  };

  return (
    <>
      <div className="res-toolbar">
        <button
          type="button"
          className="sc-btn sc-btn--gold"
          onClick={onOpenCreate}
          disabled={!canCreateCharacter}
        >
          新 建 角 色
        </button>
        <button type="button" className="sc-btn" disabled>新 建 目 录</button>
        <button type="button" className="sc-btn" disabled>导 入</button>
        <button type="button" className="sc-btn" disabled>导 出</button>
      </div>
      <div className="res-tree">
        {characters.length === 0 ? (
          <div style={{ padding: '12px', color: 'var(--sc-ink-mute)', fontSize: '12px', textAlign: 'center' }}>
            {readOnlyHint || "当前世界还没有可见角色。"}
          </div>
        ) : (
          <ul>
            {folders.map((folder) => (
              <li key={folder.path}>
                <li className={`dir ${folder.collapsed ? 'collapsed' : ''}`.trim()} onClick={() => toggleFolder(folder.path)}>
                  <span className="caret">▾</span>
                  <span className="ic">{folder.icon}</span>
                  <span>{folder.name}</span>
                  <span className="meta">{folder.characters.length}</span>
                </li>
                <ul>
                  {folder.characters.map((character) => {
                    const level = getRecordNumber(character.snapshot, "level", 1);
                    const className = getRecordString(character.snapshot, "class", "");
                    const isActive = character.id === selectedCharacterId;
                    const tag = getCharacterTag(character);

                    return (
                      <li
                        key={character.id}
                        className={`leaf ${isActive ? 'active' : ''}`.trim()}
                        onClick={() => {
                          onSelectCharacter(character.id);
                          onOpenCharacter(character.id);
                        }}
                        onContextMenu={(event) => onCharacterContextMenu(event, character.id)}
                      >
                        <span className="ic">{getCharacterIcon(character)}</span>
                        <span>{character.name}{className ? ` · ${className}` : ''} {level > 1 ? level : ''}</span>
                        <span className={`meta ${tag.className}`.trim()}>{tag.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-xs" style={{ color: 'var(--sc-ink-mute)', marginTop: '8px', padding: '0 4px' }}>
        左键点击打开角色卡；右键角色 → 设为当前 / 投放棋子 / 快捷操作
      </div>
    </>
  );
}
