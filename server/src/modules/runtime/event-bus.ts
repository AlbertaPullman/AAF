import { assertValidRuntimeEventName } from "./event-naming";

export type RuntimeEventMap = Record<string, unknown>;

export type RuntimeEventHandler<TPayload> = (payload: TPayload) => void | Promise<void>;

export class EventBusError extends Error {
  code: "EVENT_HANDLER_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "EventBusError";
    this.code = "EVENT_HANDLER_INVALID";
  }
}

export class RuntimeEventBus<TEvents extends RuntimeEventMap> {
  private readonly handlers = new Map<string, Set<RuntimeEventHandler<unknown>>>();

  on<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: RuntimeEventHandler<TEvents[TEventName]>
  ): () => void {
    const normalizedEventName = assertValidRuntimeEventName(String(eventName));
    if (typeof handler !== "function") {
      throw new EventBusError("事件处理器必须是函数");
    }

    const bucket = this.handlers.get(normalizedEventName) ?? new Set<RuntimeEventHandler<unknown>>();
    bucket.add(handler as RuntimeEventHandler<unknown>);
    this.handlers.set(normalizedEventName, bucket);

    return () => this.off(eventName, handler);
  }

  once<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: RuntimeEventHandler<TEvents[TEventName]>
  ): () => void {
    if (typeof handler !== "function") {
      throw new EventBusError("事件处理器必须是函数");
    }

    const wrapped: RuntimeEventHandler<TEvents[TEventName]> = async (payload) => {
      this.off(eventName, wrapped);
      await handler(payload);
    };

    return this.on(eventName, wrapped);
  }

  off<TEventName extends keyof TEvents & string>(
    eventName: TEventName,
    handler: RuntimeEventHandler<TEvents[TEventName]>
  ) {
    const normalizedEventName = assertValidRuntimeEventName(String(eventName));
    const bucket = this.handlers.get(normalizedEventName);
    if (!bucket) {
      return;
    }

    bucket.delete(handler as RuntimeEventHandler<unknown>);
    if (bucket.size === 0) {
      this.handlers.delete(normalizedEventName);
    }
  }

  async emit<TEventName extends keyof TEvents & string>(eventName: TEventName, payload: TEvents[TEventName]) {
    const normalizedEventName = assertValidRuntimeEventName(String(eventName));
    const bucket = this.handlers.get(normalizedEventName);
    if (!bucket || bucket.size === 0) {
      return;
    }

    for (const handler of Array.from(bucket.values())) {
      await handler(payload);
    }
  }

  listenerCount(eventName: keyof TEvents & string): number {
    const normalizedEventName = assertValidRuntimeEventName(String(eventName));
    const bucket = this.handlers.get(normalizedEventName);
    return bucket?.size ?? 0;
  }
}
