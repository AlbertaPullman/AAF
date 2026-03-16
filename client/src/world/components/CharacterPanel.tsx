import type { FormEvent } from "react";

type CharacterItem = {
  id: string;
  name: string;
  type: "PC" | "NPC";
  userId: string | null;
  stats?: unknown;
  snapshot?: unknown;
};

type CharacterPanelProps = {
  characters: CharacterItem[];
  selectedCharacterId: string;
  onSelectCharacter: (characterId: string) => void;
  creating: boolean;
  createName: string;
  createType: "PC" | "NPC";
  onCreateNameChange: (value: string) => void;
  onCreateTypeChange: (value: "PC" | "NPC") => void;
  onCreateCharacter: (event: FormEvent) => void;
  editName: string;
  editHp: string;
  editMp: string;
  editLevel: string;
  editClassName: string;
  saving: boolean;
  onEditNameChange: (value: string) => void;
  onEditHpChange: (value: string) => void;
  onEditMpChange: (value: string) => void;
  onEditLevelChange: (value: string) => void;
  onEditClassNameChange: (value: string) => void;
  onSaveCharacter: (event: FormEvent) => void;
};

export function CharacterPanel(props: CharacterPanelProps) {
  const {
    characters,
    selectedCharacterId,
    onSelectCharacter,
    creating,
    createName,
    createType,
    onCreateNameChange,
    onCreateTypeChange,
    onCreateCharacter,
    editName,
    editHp,
    editMp,
    editLevel,
    editClassName,
    saving,
    onEditNameChange,
    onEditHpChange,
    onEditMpChange,
    onEditLevelChange,
    onEditClassNameChange,
    onSaveCharacter
  } = props;

  return (
    <div className="world-card">
      <strong>CharacterPanel</strong>
      <p>角色数量：{characters.length}</p>

      <label className="block text-sm text-gray-700">当前绑定角色</label>
      <select
        className="mb-2 mt-1 w-full rounded border px-2 py-1.5"
        value={selectedCharacterId}
        onChange={(e) => onSelectCharacter(e.target.value)}
      >
        <option value="">未绑定</option>
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.name} ({character.type})
          </option>
        ))}
      </select>

      <form className="space-y-2" onSubmit={onCreateCharacter}>
        <label className="block text-sm text-gray-700">新建角色</label>
        <input
          className="w-full rounded border px-2 py-1.5"
          value={createName}
          onChange={(e) => onCreateNameChange(e.target.value)}
          placeholder="角色名"
          required
        />
        <select className="w-full rounded border px-2 py-1.5" value={createType} onChange={(e) => onCreateTypeChange(e.target.value as "PC" | "NPC")}>
          <option value="PC">PC</option>
          <option value="NPC">NPC</option>
        </select>
        <button className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-60" disabled={creating} type="submit">
          {creating ? "创建中..." : "创建角色"}
        </button>
      </form>

      <form className="mt-4 space-y-2" onSubmit={onSaveCharacter}>
        <label className="block text-sm text-gray-700">编辑角色</label>
        <input
          className="w-full rounded border px-2 py-1.5"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          placeholder="角色名"
          required
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="w-full rounded border px-2 py-1.5"
            type="number"
            min={0}
            value={editHp}
            onChange={(e) => onEditHpChange(e.target.value)}
            placeholder="HP"
          />
          <input
            className="w-full rounded border px-2 py-1.5"
            type="number"
            min={0}
            value={editMp}
            onChange={(e) => onEditMpChange(e.target.value)}
            placeholder="MP"
          />
          <input
            className="w-full rounded border px-2 py-1.5"
            type="number"
            min={1}
            value={editLevel}
            onChange={(e) => onEditLevelChange(e.target.value)}
            placeholder="等级"
          />
          <input
            className="w-full rounded border px-2 py-1.5"
            value={editClassName}
            onChange={(e) => onEditClassNameChange(e.target.value)}
            placeholder="职业"
          />
        </div>
        <button className="rounded bg-amber-700 px-3 py-1.5 text-sm text-white disabled:opacity-60" disabled={saving || !selectedCharacterId} type="submit">
          {saving ? "保存中..." : "保存角色详情"}
        </button>
      </form>
    </div>
  );
}
