import type { MouseEvent } from "react";

/**
 * AAF-WORLD-COMPONENT active:combat-focus-panel
 * Mount policy: right-side battle tab only. Non-core battle tools are opened
 * from command buttons or context menus, not stacked inside this panel.
 */

type CombatParticipantState = {
  tokenId: string;
  name: string;
  initiative: number;
  rank: number;
};

type SceneCombatState = {
  sceneId: string;
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason: string | null;
  updatedAt: string;
};

type SceneCombatInput = {
  status: "idle" | "active" | "paused" | "ended";
  round: number;
  turnIndex: number;
  participants: CombatParticipantState[];
  pauseReason?: string | null;
};

type SceneCombatPanelProps = {
  combatState: SceneCombatState | null;
  loading: boolean;
  saving: boolean;
  advancing: boolean;
  canManage: boolean;
  onParticipantContextMenu?: (event: MouseEvent, tokenId: string) => void;
  onRefresh: () => void;
  onSave: (input: SceneCombatInput) => void;
  onNextTurn: () => void;
};

function statusLabel(status: SceneCombatState["status"]) {
  if (status === "active") {
    return "进行中";
  }
  if (status === "paused") {
    return "已暂停";
  }
  if (status === "ended") {
    return "已结束";
  }
  return "待机";
}

function clampRound(value: number) {
  const safe = Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, safe);
}

function normalizeParticipants(participants: CombatParticipantState[]): CombatParticipantState[] {
  const sorted = [...participants].sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return a.rank - b.rank;
  });

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

function formatCombatTime(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString();
}

export function SceneCombatPanel({
  combatState,
  loading,
  saving,
  advancing,
  canManage,
  onParticipantContextMenu,
  onRefresh,
  onSave,
  onNextTurn,
}: SceneCombatPanelProps) {
  const onSetStatus = (status: SceneCombatState["status"]) => {
    if (!combatState || !canManage) {
      return;
    }

    onSave({
      status,
      round: clampRound(combatState.round),
      turnIndex: combatState.turnIndex,
      participants: normalizeParticipants(combatState.participants),
      pauseReason: combatState.pauseReason,
    });
  };

  const onAddParticipant = () => {
    if (!combatState || !canManage) {
      return;
    }

    const next = normalizeParticipants([
      ...combatState.participants,
      {
        tokenId: `token-${Date.now()}`,
        name: `参战单位 ${combatState.participants.length + 1}`,
        initiative: 10,
        rank: combatState.participants.length + 1,
      },
    ]);

    onSave({
      status: combatState.status,
      round: clampRound(combatState.round),
      turnIndex: Math.min(combatState.turnIndex, Math.max(0, next.length - 1)),
      participants: next,
      pauseReason: combatState.pauseReason,
    });
  };

  const onRemoveParticipant = (tokenId: string) => {
    if (!combatState || !canManage) {
      return;
    }

    const next = normalizeParticipants(combatState.participants.filter((item) => item.tokenId !== tokenId));
    onSave({
      status: combatState.status,
      round: clampRound(combatState.round),
      turnIndex: Math.min(combatState.turnIndex, Math.max(0, next.length - 1)),
      participants: next,
      pauseReason: combatState.pauseReason,
    });
  };

  const currentTurnParticipant =
    combatState && combatState.participants.length > 0
      ? combatState.participants[Math.min(Math.max(combatState.turnIndex, 0), combatState.participants.length - 1)] ?? null
      : null;

  return (
    <section className="world-card world-combat-panel" data-world-component="combat-focus-panel" data-world-layer="panel">
      <div className="world-combat-panel__head">
        <div>
          <strong>战斗序列</strong>
          <p>{canManage ? "管理回合、先攻和战斗节奏。" : "查看先攻顺序与当前回合，保持对战场节奏的感知。"}</p>
        </div>
        <button className="world-stage-header-btn" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {!combatState ? (
        <div className="world-stage-empty">当前场景还没有载入战斗状态。</div>
      ) : (
        <>
          <div className="world-stage-stat-grid">
            <div className="world-stage-stat-card">
              <span>战斗状态</span>
              <strong>{statusLabel(combatState.status)}</strong>
            </div>
            <div className="world-stage-stat-card">
              <span>当前轮次</span>
              <strong>第 {combatState.round} 轮</strong>
            </div>
            <div className="world-stage-stat-card">
              <span>当前行动者</span>
              <strong>{currentTurnParticipant?.name ?? "未开始"}</strong>
            </div>
            <div className="world-stage-stat-card">
              <span>参战单位</span>
              <strong>{combatState.participants.length}</strong>
            </div>
          </div>

          {combatState.pauseReason ? (
            <p className="world-stage-readonly-note">暂停原因：{combatState.pauseReason}</p>
          ) : null}

          {canManage ? (
            <div className="world-combat-panel__actions">
              <button type="button" onClick={() => onSetStatus("active")} disabled={saving || combatState.status === "active"}>
                进入战斗
              </button>
              <button type="button" onClick={() => onSetStatus("paused")} disabled={saving || combatState.status === "paused"}>
                暂停
              </button>
              <button type="button" onClick={() => onSetStatus("ended")} disabled={saving || combatState.status === "ended"}>
                结束
              </button>
              <button
                type="button"
                onClick={onNextTurn}
                disabled={advancing || combatState.participants.length === 0}
              >
                {advancing ? "推进中..." : "下一回合"}
              </button>
            </div>
          ) : (
            <p className="world-stage-readonly-note">
              你当前处于战斗观察视角，可查看顺序与回合，但不能改动战斗流程。
            </p>
          )}

          <div className="world-combat-order">
            <div className="world-combat-order__head">
              <div>
                <strong>先攻顺序</strong>
                <p>高亮单位代表当前行动回合。</p>
              </div>
              {canManage ? (
                <button type="button" onClick={onAddParticipant} disabled={saving}>
                  添加参战单位
                </button>
              ) : (
                <span className="world-stage-pill">只读</span>
              )}
            </div>

            {combatState.participants.length === 0 ? (
              <div className="world-stage-empty">还没有参战单位，战斗序列会在开战后显示在这里。</div>
            ) : (
              <div className="world-combat-order__list">
                {combatState.participants.map((item, index) => {
                  const isCurrentTurn = index === combatState.turnIndex;
                  return (
                    <div
                      className={`world-combat-order__item${isCurrentTurn ? " is-current" : ""}`}
                      key={item.tokenId}
                      onContextMenu={(event) => onParticipantContextMenu?.(event, item.tokenId)}
                    >
                      <div className="world-combat-order__identity">
                        <span className="world-combat-order__rank">#{index + 1}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <p>先攻 {item.initiative}</p>
                        </div>
                      </div>
                      {canManage ? (
                        <button type="button" onClick={() => onRemoveParticipant(item.tokenId)} disabled={saving}>
                          移出
                        </button>
                      ) : isCurrentTurn ? (
                        <span className="world-stage-pill world-stage-pill--accent">当前</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="world-stage-meta-line">最近同步：{formatCombatTime(combatState.updatedAt)}</p>
          {saving ? <p className="world-stage-meta-line">战斗状态正在保存...</p> : null}
        </>
      )}
    </section>
  );
}
