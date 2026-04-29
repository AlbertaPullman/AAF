import { useState, type FormEvent } from "react";
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

type FolderNode = {
  path: string;
  name: string;
  scenes: SceneItem[];
  collapsed: boolean;
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

  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // 按 sortOrder 分组场景到虚拟文件夹
  const folders: FolderNode[] = [];
  const chapterSize = 5; // 每 5 个场景一个章节

  for (let i = 0; i < scenes.length; i += chapterSize) {
    const chapterScenes = scenes.slice(i, Math.min(i + chapterSize, scenes.length));
    const chapterNum = Math.floor(i / chapterSize) + 1;
    const folderPath = `第 ${chapterNum} 章`;
    folders.push({
      path: folderPath,
      name: folderPath,
      scenes: chapterScenes,
      collapsed: collapsedFolders.has(folderPath)
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

  return (
    <>
      <div className="res-toolbar">
        <button type="button" className="sc-btn sc-btn--gold" onClick={(e) => {
          e.preventDefault();
          const fakeEvent = { preventDefault: () => {}, target: { value: createName } } as unknown as FormEvent;
          onCreateScene(fakeEvent);
        }} disabled={creating || !createName.trim()}>
          新 建 场 景
        </button>
        <button type="button" className="sc-btn" disabled>新 建 目 录</button>
        <button type="button" className="sc-btn" disabled>导 入</button>
        <button type="button" className="sc-btn" disabled>导 出</button>
      </div>
      <div className="res-tree">
        <ul>
          {folders.map((folder) => (
            <li key={folder.path}>
              <li className={`dir ${folder.collapsed ? 'collapsed' : ''}`.trim()} onClick={() => toggleFolder(folder.path)}>
                <span className="caret">▾</span>
                <span className="ic">📁</span>
                <span>{folder.name}</span>
                <span className="meta">{folder.scenes.length}</span>
              </li>
              <ul>
                {folder.scenes.map((scene) => (
                  <li
                    key={scene.id}
                    className={`leaf ${scene.id === selectedSceneId ? 'active' : ''}`.trim()}
                    onClick={() => onSelectScene(scene.id)}
                  >
                    <span className="ic">🏞️</span>
                    <span>{scene.name}</span>
                    {scene.id === selectedSceneId ? <span className="meta tag-ok">激活</span> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-xs" style={{ color: 'var(--sc-ink-mute)', marginTop: '8px', padding: '0 4px' }}>
        左键点击场景切换；右键场景 → <b style={{ color: 'var(--sc-accent-deep)' }}>场景配置弹窗</b>（网格 / 光照 / 迷雾 / 背景）
      </div>

      {/* 隐藏的创建表单，用于保持现有功能 */}
      <div style={{ display: 'none' }}>
        <input
          value={createName}
          onChange={(e) => onCreateNameChange(e.target.value)}
          placeholder="场景名称"
        />
      </div>
    </>
  );
}
