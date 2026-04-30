import { useMemo } from "react";
import { ACTION_ECONOMY_LABELS, normalizeActionEconomy } from "../../../../shared/types/world-entities";
import type { CharacterItem } from "../../pages/world/types";

/**
 * AAF-WORLD-COMPONENT active:overlay-tool
 * Mount policy: only mounted inside the ability overlay or via HUD shortcut.
 * Keep this out of the always-visible battle tab to preserve scan speed.
 */

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
  automation?: unknown;
};

type AbilityAutomationMode = "manual" | "assisted" | "full";
type WorkflowPhaseStatus = "pending" | "waiting" | "skipped" | "resolved" | "failed";

const AUTOMATION_MODE_LABELS: Record<AbilityAutomationMode, string> = {
  manual: "手动预览",
  assisted: "半自动",
  full: "全自动"
};

const WORKFLOW_STATUS_LABELS: Record<"running" | "waiting" | "completed" | "failed", string> = {
  running: "进行中",
  waiting: "等待确认",
  completed: "已完成",
  failed: "失败"
};

const WORKFLOW_PHASE_LABELS: Record<string, string> = {
  declare: "声明能力",
  "target-confirmation": "确认目标",
  "cost-check": "资源检查",
  "reaction-window": "反应窗口",
  "attack-roll": "攻击检定",
  "save-roll": "豁免/对抗",
  "damage-roll": "伤害掷骰",
  "damage-application": "应用伤害",
  "effect-application": "应用效果",
  "post-apply": "后处理",
  settle: "完成结算"
};

const WORKFLOW_PHASE_STATUS_LABELS: Record<WorkflowPhaseStatus, string> = {
  pending: "未开始",
  waiting: "等待",
  skipped: "跳过",
  resolved: "完成",
  failed: "失败"
};

const WORKFLOW_STEP_AUTOMATION_LABELS: Record<string, string> = {
  manual: "手动",
  prompt: "询问",
  auto: "自动"
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
  workflow?: {
    mode: AbilityAutomationMode;
    status: "running" | "waiting" | "completed" | "failed";
    phases?: Array<{
      key: string;
      label?: string;
      automation?: "manual" | "prompt" | "auto" | string;
      status: WorkflowPhaseStatus;
      message?: string;
      requiresConfirmation?: boolean;
      editableFields?: string[];
    }>;
    damageApplications?: Array<{
      targetName: string;
      damageType?: string;
      rawDamage: number;
      effectiveDamage?: number;
      appliedDamage: number;
      tempHpDamage?: number;
      hpDamage?: number;
      oldHp?: number;
      newHp?: number;
      oldTempHp?: number;
      newTempHp?: number;
      resistanceApplied?: boolean;
      vulnerabilityApplied?: boolean;
      immunityApplied?: boolean;
      flatReduction?: number;
      applied: boolean;
      notes?: string[];
    }>;
  };
};

type AbilityExecutionPanelProps = {
  abilities: AbilityItem[];
  actorCharacters: CharacterItem[];
  targetCharacters: CharacterItem[];
  selectedAbilityId: string;
  actorCharacterId: string;
  targetCharacterId: string;
  automationMode: AbilityAutomationMode;
  executing: boolean;
  latestResult: AbilityExecutionResult | null;
  canExecuteAction: boolean;
  readOnlyHint?: string;
  onAbilityChange: (value: string) => void;
  onActorChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onAutomationModeChange: (value: AbilityAutomationMode) => void;
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

function readAutomationMode(value: unknown): AbilityAutomationMode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const mode = (value as Record<string, unknown>).mode;
  return mode === "manual" || mode === "assisted" || mode === "full" ? mode : null;
}

function formatDamageApplication(item: NonNullable<NonNullable<AbilityExecutionResult["workflow"]>["damageApplications"]>[number]) {
  const effectiveDamage = item.effectiveDamage ?? item.rawDamage;
  const modifiers = [
    item.immunityApplied ? "免疫" : null,
    item.resistanceApplied ? "抗性" : null,
    item.vulnerabilityApplied ? "易伤" : null,
    item.flatReduction ? `减伤 ${item.flatReduction}` : null,
  ].filter(Boolean);
  const hpLine = `临时HP ${item.oldTempHp ?? "-"}→${item.newTempHp ?? "-"}，HP ${item.oldHp ?? "-"}→${item.newHp ?? "-"}`;
  return `${item.targetName}：${item.applied ? "已应用" : "待应用"} ${effectiveDamage}/${item.rawDamage}${
    item.damageType ? ` ${item.damageType}` : ""
  }${modifiers.length ? `（${modifiers.join("、")}）` : ""}；${hpLine}`;
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

function formatActionType(value: unknown) {
  const normalized = normalizeActionEconomy(value);
  return ACTION_ECONOMY_LABELS[normalized] ?? String(value ?? "特殊");
}

export function AbilityExecutionPanel({
  abilities,
  actorCharacters,
  targetCharacters,
  selectedAbilityId,
  actorCharacterId,
  targetCharacterId,
  automationMode,
  executing,
  latestResult,
  canExecuteAction,
  readOnlyHint,
  onAbilityChange,
  onActorChange,
  onTargetChange,
  onAutomationModeChange,
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
  const selectedAbilityMeta = selectedAbility
    ? [
        { label: "分类", value: String(selectedAbility.category ?? "custom") },
        { label: "动作", value: formatActionType(selectedAbility.actionType ?? "standard") },
        { label: "激活", value: String(selectedAbility.activation ?? "active") },
        { label: "来源", value: selectedAbility.sourceName ? String(selectedAbility.sourceName) : "未指定" },
      ]
    : [];
  const selectedAbilityFacts = selectedAbility
    ? [
        { label: "资源消耗", value: summarizeJsonArray(selectedAbility.resourceCosts, "无") },
        { label: "效果数量", value: summarizeJsonArray(selectedAbility.effects, "0") },
        {
          label: "默认自动化",
          value: AUTOMATION_MODE_LABELS[readAutomationMode(selectedAbility.automation) ?? "assisted"],
        },
        {
          label: "当前施放者",
          value: actorCharacter
            ? `${actorCharacter.name} · HP ${getRecordNumber(actorCharacter.stats, "hp", 0)} / ${getRecordNumber(
                actorCharacter.snapshot,
                "maxHp",
                getRecordNumber(actorCharacter.stats, "hp", 0)
              )}`
            : "尚未选择",
        },
      ]
    : [];

  return (
    <section className="world-ability-exec world-tool-panel">
      <div className="world-ability-exec__head">
        <div>
          <strong>能力结算台</strong>
          <p>从快捷栏带入能力，快速预览资源消耗、效果与本轮最新结算结果。</p>
        </div>
        {canExecuteAction ? (
          <button type="button" className="world-stage-header-btn" onClick={onExecute} disabled={!canSubmitExecution}>
            {executing ? "执行中..." : automationMode === "manual" ? "生成预览" : "执行能力"}
          </button>
        ) : (
          <span className="world-tool-status">只读观战</span>
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
          <select
            value={selectedAbilityId}
            onChange={(event) => {
              const nextAbilityId = event.target.value;
              onAbilityChange(nextAbilityId);
              const nextAbility = abilities.find((item) => item.id === nextAbilityId);
              const nextMode = readAutomationMode(nextAbility?.automation);
              if (nextMode) {
                onAutomationModeChange(nextMode);
              }
            }}
          >
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

        <label className="world-ability-exec__field">
          <span>自动化</span>
          <select
            value={automationMode}
            onChange={(event) => onAutomationModeChange(event.target.value as AbilityAutomationMode)}
            disabled={!canExecuteAction}
          >
            {Object.entries(AUTOMATION_MODE_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedAbility ? (
        <div className="world-ability-exec__summary">
          <dl className="world-ability-exec__kv" aria-label="能力基础信息">
            {selectedAbilityMeta.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="world-ability-exec__description">{String(selectedAbility.description ?? "暂无描述")}</p>
          {abilityTags.length > 0 ? (
            <div className="world-ability-exec__tag-list" aria-label="能力标签">
              {abilityTags.map((tag) => (
                <span className="world-ability-exec__tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <dl className="world-ability-exec__facts" aria-label="结算事实摘要">
            {selectedAbilityFacts.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
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
            <p>
              流程：
              {latestResult.workflow
                ? `${AUTOMATION_MODE_LABELS[latestResult.workflow.mode]} · ${WORKFLOW_STATUS_LABELS[latestResult.workflow.status]}`
                : "旧式结算"}
            </p>
            {latestResult.workflow?.damageApplications?.length ? (
              <p>
                伤害应用：
                {latestResult.workflow.damageApplications.map((item) => formatDamageApplication(item)).join("；")}
              </p>
            ) : null}
          </div>
          {latestResult.workflow ? (
            <div className="world-ability-exec__workflow" aria-label="Workflow 阶段列表">
              <div className="world-ability-exec__workflow-head">
                <strong>Workflow 阶段</strong>
                {latestResult.workflow.mode === "manual" ? <span>手动模式：等待 GM 应用伤害/效果</span> : null}
              </div>
              <div className="world-ability-exec__phase-list">
                {(latestResult.workflow.phases ?? []).map((phase) => (
                  <article className={`world-ability-exec__phase is-${phase.status}`} key={phase.key}>
                    <div>
                      <strong>{WORKFLOW_PHASE_LABELS[phase.key] ?? phase.label ?? phase.key}</strong>
                      <span>
                        {WORKFLOW_PHASE_STATUS_LABELS[phase.status]} · {WORKFLOW_STEP_AUTOMATION_LABELS[phase.automation ?? ""] ?? phase.automation ?? "未知"}
                      </span>
                    </div>
                    {phase.message ? <p>{phase.message}</p> : null}
                    {phase.status === "waiting" && phase.key === "damage-application" ? (
                      <em>等待手动应用伤害</em>
                    ) : null}
                    {phase.status === "waiting" && phase.key === "effect-application" ? (
                      <em>等待手动应用效果</em>
                    ) : null}
                  </article>
                ))}
              </div>
              <div className="world-ability-exec__workflow-actions" aria-label="Workflow 操作入口">
                <button type="button" disabled>
                  应用本次伤害
                </button>
                <button type="button" disabled>
                  应用本次效果
                </button>
                <button type="button" disabled>
                  撤销本次执行
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
