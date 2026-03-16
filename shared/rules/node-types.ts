export type RuleNodeKind = "condition" | "action";

export type RuleNodeConditionOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "contains";

export type RuleConditionNodeData = {
  leftPath: string;
  operator: RuleNodeConditionOperator;
  rightValue: string | number | boolean;
};

export type LightSourceActionParams = {
  targetType: "actor" | "object" | "point";
  targetId?: string;
  brightRadiusFeet: number;
  dimRadiusFeet: number;
  colorHex: string;
  followTarget: boolean;
  durationMode: "rounds" | "battle-end" | "concentration" | "manual";
  durationRounds?: number;
  stackMode: "override" | "max" | "stack";
};

export type MeasureBoardActionParams = {
  shape: "circle" | "cone" | "rect" | "line";
  sizeFeet: number;
  colorHex: string;
  opacity: number;
  label: string;
  persistent: boolean;
  ownerActorId?: string;
  clearMode: "round-end" | "battle-end" | "manual";
};

export type RuleActionNodeData = {
  actionKey: string;
  params: Record<string, unknown> | LightSourceActionParams | MeasureBoardActionParams;
};

export type RuleNode = {
  id: string;
  kind: RuleNodeKind;
  nextNodeIds: string[];
  data: RuleConditionNodeData | RuleActionNodeData;
};
