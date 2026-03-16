const EVENT_NAME_PATTERN = /^([a-z][a-z0-9-]*):([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/;

export type RuntimeEventNameParts = {
  domain: string;
  entity: string;
  action: string;
};

export class EventNamingError extends Error {
  code: "EVENT_NAME_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "EventNamingError";
    this.code = "EVENT_NAME_INVALID";
  }
}

export function parseRuntimeEventName(eventName: string): RuntimeEventNameParts {
  const normalized = eventName.trim();
  const match = EVENT_NAME_PATTERN.exec(normalized);
  if (!match) {
    throw new EventNamingError("事件名不合法，应为 domain:entity:action");
  }

  return {
    domain: match[1],
    entity: match[2],
    action: match[3]
  };
}

export function assertValidRuntimeEventName(eventName: string): string {
  const normalized = eventName.trim();
  parseRuntimeEventName(normalized);
  return normalized;
}
