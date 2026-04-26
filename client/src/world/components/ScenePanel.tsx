import type { FormEvent } from "react";
import type { SceneItem } from "../../pages/world/types";

type ScenePanelProps = {
  scenes: SceneItem[];
  selectedSceneId: string;
  createName: string;
  renameName: string;
  creating: boolean;
  renaming: boolean;
  deleting: boolean;
  sorting: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelectScene: (sceneId: string) => void;
  onCreateNameChange: (value: string) => void;
  onRenameNameChange: (value: string) => void;
  onCreateScene: (event: FormEvent) => void;
  onRenameScene: (event: FormEvent) => void;
  onDeleteScene: () => void;
  onMoveSceneUp: () => void;
  onMoveSceneDown: () => void;
};

export function ScenePanel(props: ScenePanelProps) {
  const {
    scenes,
    selectedSceneId,
    createName,
    renameName,
    creating,
    renaming,
    deleting,
    sorting,
    canMoveUp,
    canMoveDown,
    onSelectScene,
    onCreateNameChange,
    onRenameNameChange,
    onCreateScene,
    onRenameScene,
    onDeleteScene,
    onMoveSceneUp,
    onMoveSceneDown
  } = props;

  return (
    <div className="world-card">
      <strong>场景航图</strong>
      <p>当前已收录场景：{scenes.length}</p>

      <label className="block text-sm text-gray-700">当前舞台</label>
      <select className="mb-2 mt-1 w-full rounded border px-2 py-1.5" value={selectedSceneId} onChange={(e) => onSelectScene(e.target.value)}>
        {scenes.map((scene) => (
          <option key={scene.id} value={scene.id}>
            #{scene.sortOrder} {scene.name}
          </option>
        ))}
      </select>

      <form className="space-y-2" onSubmit={onCreateScene}>
        <label className="block text-sm text-gray-700">开辟新舞台（GM）</label>
        <input
          className="w-full rounded border px-2 py-1.5"
          value={createName}
          onChange={(e) => onCreateNameChange(e.target.value)}
          placeholder="场景名称"
        />
        <button className="rounded bg-cyan-700 px-3 py-1.5 text-sm text-white disabled:opacity-60" disabled={creating} type="submit">
          {creating ? "开辟中..." : "创建场景"}
        </button>
      </form>

      <form className="mt-3 space-y-2" onSubmit={onRenameScene}>
        <label className="block text-sm text-gray-700">修改当前舞台名称（GM）</label>
        <input
          className="w-full rounded border px-2 py-1.5"
          value={renameName}
          onChange={(e) => onRenameNameChange(e.target.value)}
          placeholder="新场景名称"
        />
        <button className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-60" disabled={renaming || !selectedSceneId} type="submit">
          {renaming ? "铭刻中..." : "保存名称"}
        </button>
      </form>

      <button
        className="mt-3 rounded bg-rose-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        disabled={deleting || !selectedSceneId || scenes.length <= 1}
        onClick={onDeleteScene}
        type="button"
      >
        {deleting ? "抹除中..." : "删除当前场景"}
      </button>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          disabled={sorting || !canMoveUp}
          onClick={onMoveSceneUp}
          type="button"
        >
          上移
        </button>
        <button
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          disabled={sorting || !canMoveDown}
          onClick={onMoveSceneDown}
          type="button"
        >
          下移
        </button>
      </div>
    </div>
  );
}
