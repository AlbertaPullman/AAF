import type {
  AbilityAutomationConfig,
  AbilityAutomationMode,
  AbilityWorkflowCharacterSnapshot,
  AbilityWorkflowPhaseKey,
  AbilityWorkflowPhaseLog,
  AbilityWorkflowPhaseStatus,
  AbilityWorkflowRun,
  AbilityWorkflowStepAutomation
} from "../types/world-entities";

export const ABILITY_WORKFLOW_PHASES: Array<{ key: AbilityWorkflowPhaseKey; label: string }> = [
  { key: "declare", label: "Declare ability" },
  { key: "target-confirmation", label: "Confirm targets" },
  { key: "cost-check", label: "Check and consume costs" },
  { key: "reaction-window", label: "Reaction window" },
  { key: "attack-roll", label: "Attack roll" },
  { key: "save-roll", label: "Saving throw" },
  { key: "damage-roll", label: "Damage roll" },
  { key: "damage-application", label: "Apply damage" },
  { key: "effect-application", label: "Apply effects" },
  { key: "post-apply", label: "Post-apply hooks" },
  { key: "settle", label: "Finalize workflow" }
];

export const ABILITY_AUTOMATION_PRESETS: Record<AbilityAutomationMode, AbilityAutomationConfig> = {
  manual: {
    mode: "manual",
    autoConfirmTargets: false,
    autoConsumeResources: false,
    autoRollAttack: false,
    autoCheckHits: false,
    autoRollSaves: false,
    autoRollDamage: false,
    autoApplyDamage: false,
    autoApplyEffects: false,
    autoConcentration: false,
    autoReactions: false,
    allowManualOverride: true,
    createUndoSnapshot: true
  },
  assisted: {
    mode: "assisted",
    autoConfirmTargets: false,
    autoConsumeResources: true,
    autoRollAttack: true,
    autoCheckHits: true,
    autoRollSaves: true,
    autoRollDamage: true,
    autoApplyDamage: true,
    autoApplyEffects: true,
    autoConcentration: false,
    autoReactions: false,
    allowManualOverride: true,
    createUndoSnapshot: true
  },
  full: {
    mode: "full",
    autoConfirmTargets: true,
    autoConsumeResources: true,
    autoRollAttack: true,
    autoCheckHits: true,
    autoRollSaves: true,
    autoRollDamage: true,
    autoApplyDamage: true,
    autoApplyEffects: true,
    autoConcentration: true,
    autoReactions: true,
    allowManualOverride: false,
    createUndoSnapshot: true
  }
};

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function createWorkflowId() {
  return `awf_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeAbilityAutomationMode(value: unknown, fallback: AbilityAutomationMode = "assisted"): AbilityAutomationMode {
  return value === "manual" || value === "assisted" || value === "full" ? value : fallback;
}

export function resolveAbilityAutomationConfig(
  requested?: AbilityAutomationMode | Partial<AbilityAutomationConfig>,
  abilityDefaults?: Partial<AbilityAutomationConfig>
): AbilityAutomationConfig {
  const requestedMode =
    typeof requested === "string"
      ? normalizeAbilityAutomationMode(requested)
      : normalizeAbilityAutomationMode(requested?.mode ?? abilityDefaults?.mode);
  return {
    ...ABILITY_AUTOMATION_PRESETS[requestedMode],
    ...(abilityDefaults ?? {}),
    ...(typeof requested === "object" && requested ? requested : {}),
    mode: requestedMode
  };
}

function getPhaseAutomation(phase: AbilityWorkflowPhaseKey, config: AbilityAutomationConfig): AbilityWorkflowStepAutomation {
  if (config.mode === "manual") {
    return "manual";
  }

  if (config.mode === "assisted") {
    if (phase === "target-confirmation" || phase === "reaction-window" || phase === "damage-application" || phase === "effect-application") {
      return "prompt";
    }
  }

  switch (phase) {
    case "target-confirmation":
      return config.autoConfirmTargets ? "auto" : "prompt";
    case "cost-check":
      return config.autoConsumeResources ? "auto" : "prompt";
    case "reaction-window":
      return config.autoReactions ? "auto" : "prompt";
    case "attack-roll":
      return config.autoRollAttack ? "auto" : "prompt";
    case "save-roll":
      return config.autoRollSaves ? "auto" : "prompt";
    case "damage-roll":
      return config.autoRollDamage ? "auto" : "prompt";
    case "damage-application":
      return config.autoApplyDamage ? "auto" : "prompt";
    case "effect-application":
      return config.autoApplyEffects ? "auto" : "prompt";
    default:
      return "auto";
  }
}

function getEditableFields(phase: AbilityWorkflowPhaseKey): string[] {
  switch (phase) {
    case "attack-roll":
    case "save-roll":
      return ["roll", "bonus", "dc", "advantage", "disadvantage"];
    case "damage-roll":
      return ["formula", "damageType", "bonus", "critical"];
    case "damage-application":
      return ["amount", "resistance", "vulnerability", "immunity", "temporaryHp"];
    case "cost-check":
      return ["resource", "amount"];
    case "effect-application":
      return ["effect", "duration", "target"];
    default:
      return [];
  }
}

function createPhaseLog(phase: { key: AbilityWorkflowPhaseKey; label: string }, config: AbilityAutomationConfig): AbilityWorkflowPhaseLog {
  const automation = getPhaseAutomation(phase.key, config);
  return {
    key: phase.key,
    label: phase.label,
    automation,
    status: "pending",
    requiresConfirmation: automation !== "auto",
    editableFields: getEditableFields(phase.key)
  };
}

export function createAbilityWorkflowCharacterSnapshot(input: {
  characterId: string;
  name: string;
  stats: Record<string, unknown>;
  snapshot: Record<string, unknown>;
}): AbilityWorkflowCharacterSnapshot {
  return {
    characterId: input.characterId,
    name: input.name,
    statsBefore: cloneRecord(input.stats),
    snapshotBefore: cloneRecord(input.snapshot)
  };
}

export function createAbilityWorkflowRun(input: {
  abilityId: string;
  abilityName: string;
  actor: AbilityWorkflowCharacterSnapshot;
  targets: AbilityWorkflowCharacterSnapshot[];
  config: AbilityAutomationConfig;
  manualOverrides?: Record<string, unknown>;
}): AbilityWorkflowRun {
  const now = new Date().toISOString();
  const actor = {
    ...input.actor,
    statsBefore: cloneRecord(input.actor.statsBefore),
    snapshotBefore: cloneRecord(input.actor.snapshotBefore)
  };
  const targets = input.targets.map((target) => ({
    ...target,
    statsBefore: cloneRecord(target.statsBefore),
    snapshotBefore: cloneRecord(target.snapshotBefore)
  }));

  return {
    id: createWorkflowId(),
    abilityId: input.abilityId,
    abilityName: input.abilityName,
    mode: input.config.mode,
    config: input.config,
    status: "running",
    currentPhase: "declare",
    phases: ABILITY_WORKFLOW_PHASES.map((phase) => createPhaseLog(phase, input.config)),
    actor,
    targets,
    damageApplications: [],
    manualOverrides: input.manualOverrides,
    undoSnapshot: input.config.createUndoSnapshot
      ? {
          actor: {
            ...actor,
            statsBefore: cloneRecord(actor.statsBefore),
            snapshotBefore: cloneRecord(actor.snapshotBefore)
          },
          targets: targets.map((target) => ({
            ...target,
            statsBefore: cloneRecord(target.statsBefore),
            snapshotBefore: cloneRecord(target.snapshotBefore)
          }))
        }
      : undefined,
    createdAt: now,
    updatedAt: now
  };
}

export function setAbilityWorkflowPhase(
  workflow: AbilityWorkflowRun,
  key: AbilityWorkflowPhaseKey,
  status: AbilityWorkflowPhaseStatus,
  message?: string
) {
  const now = new Date().toISOString();
  workflow.currentPhase = key;
  workflow.updatedAt = now;
  workflow.phases = workflow.phases.map((phase) =>
    phase.key === key
      ? {
          ...phase,
          status,
          message,
          resolvedAt: status === "resolved" || status === "skipped" || status === "failed" ? now : phase.resolvedAt
        }
      : phase
  );
}

export function finalizeAbilityWorkflow(workflow: AbilityWorkflowRun, status: AbilityWorkflowRun["status"] = "completed") {
  const now = new Date().toISOString();
  workflow.status = status;
  workflow.currentPhase = "settle";
  workflow.updatedAt = now;
  workflow.phases = workflow.phases.map((phase) =>
    phase.status === "pending"
      ? {
          ...phase,
          status: "skipped",
          resolvedAt: now
        }
      : phase
  );
}

export function attachAbilityWorkflowAfterSnapshots(
  workflow: AbilityWorkflowRun,
  input: {
    actor: { stats: Record<string, unknown>; snapshot: Record<string, unknown> };
    targets: Array<{ characterId: string; stats: Record<string, unknown>; snapshot: Record<string, unknown> }>;
  }
) {
  workflow.actor.statsAfter = cloneRecord(input.actor.stats);
  workflow.actor.snapshotAfter = cloneRecord(input.actor.snapshot);
  workflow.targets = workflow.targets.map((target) => {
    const matched = input.targets.find((item) => item.characterId === target.characterId);
    return matched
      ? {
          ...target,
          statsAfter: cloneRecord(matched.stats),
          snapshotAfter: cloneRecord(matched.snapshot)
        }
      : target;
  });
  workflow.updatedAt = new Date().toISOString();
}
