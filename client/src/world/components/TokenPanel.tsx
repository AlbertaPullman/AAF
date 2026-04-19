type TokenPanelProps = {
  tokenCount: number;
  selectedCharacterName: string;
  canDeployToken: boolean;
  readOnlyHint?: string;
  onAddMyToken: () => void;
  onCenterToken: () => void;
};

export function TokenPanel({ tokenCount, selectedCharacterName, canDeployToken, readOnlyHint, onAddMyToken, onCenterToken }: TokenPanelProps) {
  return (
    <div className="world-card">
      <strong>出战棋子</strong>
      <p>当前场景中的棋子数量：{tokenCount}</p>
      <p>当前绑定角色：{selectedCharacterName || "未绑定角色卡"}</p>
      <div className="flex gap-2">
        <button
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          onClick={onAddMyToken}
          type="button"
          disabled={!canDeployToken}
        >
          投放我的棋子
        </button>
        <button
          className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          onClick={onCenterToken}
          type="button"
          disabled={!canDeployToken}
        >
          将主棋子移到舞台中央
        </button>
      </div>
      {!canDeployToken ? <p className="mt-2 text-xs text-gray-500">{readOnlyHint || "当前身份不能投放棋子。"}</p> : null}
    </div>
  );
}
