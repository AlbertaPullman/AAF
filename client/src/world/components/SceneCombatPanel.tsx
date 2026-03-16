import { worldSceneRuntimeMessagesZh } from "../i18n/messages";

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
  onRefresh: () => void;
  onSave: (input: SceneCombatInput) => void;
  onNextTurn: () => void;
};

function statusLabel(status: SceneCombatState["status"]) {
  if (status === "active") {
    return worldSceneRuntimeMessagesZh.combatStatusActive;
  }
  if (status === "paused") {
    return worldSceneRuntimeMessagesZh.combatStatusPaused;
  }
  if (status === "ended") {
    return worldSceneRuntimeMessagesZh.combatStatusEnded;
  }
  return worldSceneRuntimeMessagesZh.combatStatusIdle;
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
    rank: index + 1
  }));
}

export function SceneCombatPanel({ combatState, loading, saving, advancing, canManage, onRefresh, onSave, onNextTurn }: SceneCombatPanelProps) {
  const onSetStatus = (status: SceneCombatState["status"]) => {
    if (!combatState || !canManage) {
      return;
    }

    onSave({
      status,
      round: clampRound(combatState.round),
      turnIndex: combatState.turnIndex,
      participants: normalizeParticipants(combatState.participants),
      pauseReason: combatState.pauseReason
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
        name: `参战者 ${combatState.participants.length + 1}`,
        initiative: 10,
        rank: combatState.participants.length + 1
      }
    ]);

    onSave({
      status: combatState.status,
      round: clampRound(combatState.round),
      turnIndex: Math.min(combatState.turnIndex, Math.max(0, next.length - 1)),
      participants: next,
      pauseReason: combatState.pauseReason
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
      pauseReason: combatState.pauseReason
    });
  };

  return (
    <div className="world-card">
      <div className="mb-2 flex items-center justify-between">
        <strong>{worldSceneRuntimeMessagesZh.combatPanelTitle}</strong>
        <button className="rounded border px-2 py-1 text-xs" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? worldSceneRuntimeMessagesZh.refreshing : worldSceneRuntimeMessagesZh.refresh}
        </button>
      </div>

      <p>这里管理回合、先攻顺序与战斗流程。</p>

      {!combatState ? <p className="text-sm text-gray-500">{worldSceneRuntimeMessagesZh.notLoadedCombat}</p> : null}

      {combatState ? (
        <>
          <p className="text-sm">{worldSceneRuntimeMessagesZh.combatStatusLabel}：{statusLabel(combatState.status)}</p>
          <p className="text-sm">{worldSceneRuntimeMessagesZh.combatRoundLabel}：{combatState.round}</p>
          <p className="text-sm">{worldSceneRuntimeMessagesZh.combatTurnIndexLabel}：{combatState.turnIndex}</p>
          <p className="text-sm">{worldSceneRuntimeMessagesZh.combatParticipantsLabel}：{combatState.participants.length}</p>
          <p className="text-xs text-gray-500">{worldSceneRuntimeMessagesZh.updatedAtLabel}：{new Date(combatState.updatedAt).toLocaleString()}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded border px-2 py-1 text-xs disabled:opacity-60"
              type="button"
              onClick={() => onSetStatus("active")}
              disabled={!canManage || saving}
            >
              {worldSceneRuntimeMessagesZh.combatSetActive}
            </button>
            <button
              className="rounded border px-2 py-1 text-xs disabled:opacity-60"
              type="button"
              onClick={() => onSetStatus("paused")}
              disabled={!canManage || saving}
            >
              {worldSceneRuntimeMessagesZh.combatSetPaused}
            </button>
            <button
              className="rounded border px-2 py-1 text-xs disabled:opacity-60"
              type="button"
              onClick={() => onSetStatus("ended")}
              disabled={!canManage || saving}
            >
              {worldSceneRuntimeMessagesZh.combatSetEnded}
            </button>
            <button
              className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-60"
              type="button"
              onClick={onNextTurn}
              disabled={!canManage || advancing || combatState.participants.length === 0}
            >
              {advancing ? worldSceneRuntimeMessagesZh.advanceInProgress : worldSceneRuntimeMessagesZh.combatNextTurn}
            </button>
          </div>

          <div className="mt-2 rounded border p-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold">先攻序列</p>
              <button
                className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={onAddParticipant}
                disabled={!canManage || saving}
              >
                {worldSceneRuntimeMessagesZh.initiativeAdd}
              </button>
            </div>

            {combatState.participants.length === 0 ? <p className="text-xs text-gray-500">{worldSceneRuntimeMessagesZh.initiativeEmpty}</p> : null}
            <div className="space-y-1">
              {combatState.participants.map((item, index) => (
                <div className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-xs" key={item.tokenId}>
                  <span>
                    #{index + 1} {item.name}({item.initiative})
                  </span>
                  <button
                    className="rounded border px-2 py-0.5 disabled:opacity-60"
                    type="button"
                    onClick={() => onRemoveParticipant(item.tokenId)}
                    disabled={!canManage || saving}
                  >
                    {worldSceneRuntimeMessagesZh.initiativeRemove}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">权限：{canManage ? worldSceneRuntimeMessagesZh.permissionCanManage : worldSceneRuntimeMessagesZh.permissionReadonly}</p>
          {saving ? <p className="text-xs text-indigo-700">{worldSceneRuntimeMessagesZh.saveInProgress}</p> : null}
        </>
      ) : null}
    </div>
  );
}
