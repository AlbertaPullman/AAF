import { useMemo } from "react";

type AbilityItem = {
  id: string;
  name: string;
  category?: unknown;
  actionType?: unknown;
  activation?: unknown;
  description?: unknown;
  sourceName?: unknown;
  tags?: unknown;
  resourceCosts?: unknown;
  effects?: unknown;
};

type CharacterItem = {
  id: string;
  name: string;
  type: "PC" | "NPC";
  stats?: unknown;
  snapshot?: unknown;
};

type AbilityExecutionResult = {
  ability: {
    id: string;
    name: string;
    activation: string;
    actionType: string;
  };
  actor: {
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  };
  targets: Array<{
    id: string;
    name: string;
    stats: Record<string, unknown>;
    snapshot: Record<string, unknown>;
  }>;
  settlement: {
    success?: boolean;
    check?: {
      success?: boolean;
      total?: number;
      targetValue?: number;
    };
    damage?: {
      total?: number;
      damageType?: string;
    };
  } | null;
  costs: Array<{
    type: string;
    amount: number;
    label: string;
  }>;
  effects: Array<{
    type: string;
    target: string;
    value: string | number | boolean | null;
    label?: string;
  }>;
};

type AbilityExecutionPanelProps = {
  abilities: AbilityItem[];
  actorCharacters: CharacterItem[];
  targetCharacters: CharacterItem[];
  selectedAbilityId: string;
  actorCharacterId: string;
  targetCharacterId: string;
  executing: boolean;
  latestResult: AbilityExecutionResult | null;
  canExecuteAction: boolean;
  readOnlyHint?: string;
  onAbilityChange: (value: string) => void;
  onActorChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onExecute: () => void;
};

function getRecordNumber(record: unknown, key: string, fallback = 0) {
  if (!record || typeof record !== "object") {
    return fallback;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function summarizeJsonArray(value: unknown, fallback: string) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }
  return `${value.length} 项`;
}

function describeExecutionResult(result: AbilityExecutionResult | null) {
  if (!result) {
    return null;
  }

  if (result.settlement?.success === false) {
    return "结算失败";
  }

  if (result.settlement?.damage?.total) {
    return `造成 ${result.settlement.damage.total} ${result.settlement.damage.damageType ?? ""}`.trim();
  }

  if (result.settlement?.check?.total != null) {
    return `检定 ${result.settlement.check.total} vs ${result.settlement.check.targetValue ?? "-"}`;
  }

  return "已完成结算";
}

export function AbilityExecutionPanel({
  abilities,
  actorCharacters,
  targetCharacters,
  selectedAbilityId,
  actorCharacterId,
  targetCharacterId,
  executing,
  latestResult,
  canExecuteAction,
  readOnlyHint,
  onAbilityChange,
  onActorChange,
  onTargetChange,
  onExecute,
}: AbilityExecutionPanelProps) {
  const selectedAbility = useMemo(
    () => abilities.find((item) => item.id === selectedAbilityId) ?? null,
    [abilities, selectedAbilityId]
  );

  const actorCharacter = useMemo(
    () => actorCharacters.find((item) => item.id === actorCharacterId) ?? null,
    [actorCharacterId, actorCharacters]
  );

  const targetOptions = useMemo(
    () => targetCharacters.filter((item) => item.id !== actorCharacterId),
    [actorCharacterId, targetCharacters]
  );

  const abilityTags = toTextList(selectedAbility?.tags);
  const canSubmitExecution = canExecuteAction && Boolean(selectedAbilityId && actorCharacterId) && !executing;
  const latestSummary = describeExecutionResult(latestResult);

  return (
    <section className="world-card world-ability-exec">
      <div className="world-ability-exec__head">
        <div>
          <strong>能力结算台</strong>
          <p>从快捷栏带入能力，快速预览资源消耗、效果与本轮最新结算结果。</p>
        </div>
        {canExecuteAction ? (
          <button type="button" className="world-stage-header-btn" onClick={onExecute} disabled={!canSubmitExecution}>
            {executing ? "执行中..." : "执行能力"}
          </button>
        ) : (
          <span className="world-stage-pill">只读观战</span>
        )}
      </div>

      {!canExecuteAction ? (
        <p className="world-stage-readonly-note">
          {readOnlyHint || "当前身份只能查看能力信息与结算结果，不能发起能力执行。"}
        </p>
      ) : null}

      <div className="world-ability-exec__grid">
        <label className="world-ability-exec__field">
          <span>能力</span>
          <select value={selectedAbilityId} onChange={(event) => onAbilityChange(event.target.value)}>
            <option value="">选择能力</option>
            {abilities.map((ability) => (
              <option value={ability.id} key={ability.id}>
                {ability.name}
              </option>
            ))}
          </select>
        </label>

        <label className="world-ability-exec__field">
          <span>施放者</span>
          <select
            value={actorCharacterId}
            onChange={(event) => onActorChange(event.target.value)}
            disabled={actorCharacters.length === 0 || !canExecuteAction}
          >
            <option value="">{actorCharacters.length > 0 ? "选择角色" : "当前身份无可操作角色"}</option>
            {actorCharacters.map((character) => (
              <option value={character.id} key={character.id}>
                {character.name} ({character.type})
              </option>
            ))}
          </select>
        </label>

        <label className="world-ability-exec__field">
          <span>目标</span>
          <select value={targetCharacterId} onChange={(event) => onTargetChange(event.target.value)} disabled={targetOptions.length === 0}>
            <option value="">无目标 / 自身</option>
            {targetOptions.map((character) => (
              <option value={character.id} key={character.id}>
                {character.name} ({character.type})
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedAbility ? (
        <div className="world-ability-exec__summary">
          <div className="world-ability-exec__meta">
            <span>{String(selectedAbility.category ?? "custom")}</span>
            <span>{String(selectedAbility.actionType ?? "standard")}</span>
            <span>{String(selectedAbility.activation ?? "active")}</span>
            {selectedAbility.sourceName ? <span>{String(selectedAbility.sourceName)}</span> : null}
          </div>
          <p className="world-ability-exec__description">{String(selectedAbility.description ?? "暂无描述")}</p>
          {abilityTags.length > 0 ? (
            <div className="world-ability-exec__tags">
              {abilityTags.map((tag) => (
                <span className="world-ability-exec__tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="world-ability-exec__facts">
            <span>资源消耗：{summarizeJsonArray(selectedAbility.resourceCosts, "无")}</span>
            <span>效果数量：{summarizeJsonArray(selectedAbility.effects, "0")}</span>
            {actorCharacter ? (
              <span>
                当前施放者：{actorCharacter.name} · HP {getRecordNumber(actorCharacter.stats, "hp", 0)} /{" "}
                {getRecordNumber(actorCharacter.snapshot, "maxHp", getRecordNumber(actorCharacter.stats, "hp", 0))}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="world-stage-empty">选择一个能力后，这里会显示它的动作类型、标签、资源消耗与结算入口。</div>
      )}

      {latestResult ? (
        <div className="world-ability-exec__result">
          <div className="world-ability-exec__result-head">
            <strong>最近一次结算</strong>
            <span>{latestSummary}</span>
          </div>
          <div className="world-ability-exec__result-grid">
            <div className="world-ability-exec__result-card">
              <span>施放者</span>
              <strong>{latestResult.actor.name}</strong>
              <p>
                HP {getRecordNumber(latestResult.actor.stats, "hp", 0)} /{" "}
                {getRecordNumber(latestResult.actor.snapshot, "maxHp", getRecordNumber(latestResult.actor.stats, "hp", 0))}
              </p>
            </div>
            <div className="world-ability-exec__result-card">
              <span>目标</span>
              <strong>{latestResult.targets.map((item) => item.name).join(" / ") || "无"}</strong>
              <p>
                {latestResult.settlement?.damage?.total
                  ? `${latestResult.settlement.damage.total} ${latestResult.settlement.damage.damageType ?? ""}`
                  : "没有直接伤害"}
              </p>
            </div>
            <div className="world-ability-exec__result-card">
              <span>检定</span>
              <strong>
                {latestResult.settlement?.check?.total != null
                  ? `${latestResult.settlement.check.total} vs ${latestResult.settlement.check.targetValue ?? "-"}`
                  : "无检定"}
              </strong>
              <p>{latestResult.settlement?.check?.success === false ? "检定未通过" : "检定通过或未使用"}</p>
            </div>
          </div>
          <div className="world-ability-exec__result-lines">
            <p>资源：{latestResult.costs.map((item) => `${item.label || item.type} -${item.amount}`).join("，") || "无"}</p>
            <p>效果：{latestResult.effects.map((item) => item.label || item.type).join("，") || "无"}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
