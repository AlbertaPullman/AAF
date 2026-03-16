type TokenPanelProps = {
  tokenCount: number;
  selectedCharacterName: string;
  onAddMyToken: () => void;
  onCenterToken: () => void;
};

export function TokenPanel({ tokenCount, selectedCharacterName, onAddMyToken, onCenterToken }: TokenPanelProps) {
  return (
    <div className="world-card">
      <strong>TokenPanel</strong>
      <p>当前 token 数量：{tokenCount}</p>
      <p>当前绑定角色：{selectedCharacterName || "未绑定"}</p>
      <div className="flex gap-2">
        <button className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white" onClick={onAddMyToken} type="button">
          新增我的 token
        </button>
        <button className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white" onClick={onCenterToken} type="button">
          移动主 token 到中心
        </button>
      </div>
    </div>
  );
}