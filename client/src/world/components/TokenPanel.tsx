type TokenPanelProps = {
  tokenCount: number;
  selectedCharacterName: string;
  onAddMyToken: () => void;
  onCenterToken: () => void;
};

export function TokenPanel({ tokenCount, selectedCharacterName, onAddMyToken, onCenterToken }: TokenPanelProps) {
  return (
    <div className="world-card">
      <strong>出战棋子</strong>
      <p>当前场景中的棋子数量：{tokenCount}</p>
      <p>当前绑定角色：{selectedCharacterName || "未绑定角色卡"}</p>
      <div className="flex gap-2">
        <button className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white" onClick={onAddMyToken} type="button">
          投放我的棋子
        </button>
        <button className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white" onClick={onCenterToken} type="button">
          将主棋子移到舞台中央
        </button>
      </div>
    </div>
  );
}