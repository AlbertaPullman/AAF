export type RuleExecutionResult = {
  success: boolean;
  consumed: boolean;
  messages: string[];
  effects: Array<{
    key: string;
    payload?: Record<string, unknown>;
  }>;
  errorCode?: string;
};

export function createRuleExecutionResult(input?: Partial<RuleExecutionResult>): RuleExecutionResult {
  return {
    success: Boolean(input?.success),
    consumed: Boolean(input?.consumed),
    messages: Array.isArray(input?.messages) ? input?.messages : [],
    effects: Array.isArray(input?.effects) ? input?.effects : [],
    errorCode: typeof input?.errorCode === "string" ? input.errorCode : undefined
  };
}
