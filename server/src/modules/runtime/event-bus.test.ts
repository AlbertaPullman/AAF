import assert from "node:assert/strict";
import test from "node:test";
import { EventBusError, RuntimeEventBus } from "./event-bus";
import { EventNamingError, parseRuntimeEventName } from "./event-naming";

type TestEventMap = {
  "world:runtime:updated": { worldId: string; status: string };
  "world:module:enabled": { worldId: string; moduleKey: string };
};

test("parseRuntimeEventName parses domain/entity/action", () => {
  const parsed = parseRuntimeEventName("world:runtime:updated");
  assert.equal(parsed.domain, "world");
  assert.equal(parsed.entity, "runtime");
  assert.equal(parsed.action, "updated");
});

test("parseRuntimeEventName rejects invalid name", () => {
  assert.throws(
    () => parseRuntimeEventName("world.runtime.updated"),
    (error: unknown) => {
      assert.ok(error instanceof EventNamingError);
      assert.equal(error.code, "EVENT_NAME_INVALID");
      assert.match(error.message, /事件名不合法/);
      return true;
    }
  );
});

test("RuntimeEventBus on/emit/off work as expected", async () => {
  const bus = new RuntimeEventBus<TestEventMap>();
  const received: string[] = [];

  const handler = (payload: { worldId: string; status: string }) => {
    received.push(`${payload.worldId}:${payload.status}`);
  };

  bus.on("world:runtime:updated", handler);
  assert.equal(bus.listenerCount("world:runtime:updated"), 1);

  await bus.emit("world:runtime:updated", {
    worldId: "w-1",
    status: "active"
  });
  assert.deepEqual(received, ["w-1:active"]);

  bus.off("world:runtime:updated", handler);
  assert.equal(bus.listenerCount("world:runtime:updated"), 0);

  await bus.emit("world:runtime:updated", {
    worldId: "w-1",
    status: "sleeping"
  });
  assert.deepEqual(received, ["w-1:active"]);
});

test("RuntimeEventBus once runs only one time", async () => {
  const bus = new RuntimeEventBus<TestEventMap>();
  let count = 0;

  bus.once("world:module:enabled", () => {
    count += 1;
  });

  await bus.emit("world:module:enabled", { worldId: "w-2", moduleKey: "chat" });
  await bus.emit("world:module:enabled", { worldId: "w-2", moduleKey: "chat" });

  assert.equal(count, 1);
  assert.equal(bus.listenerCount("world:module:enabled"), 0);
});

test("RuntimeEventBus rejects invalid event names in on and emit", async () => {
  const bus = new RuntimeEventBus<TestEventMap>();

  assert.throws(
    () => bus.on("bad.name" as keyof TestEventMap & string, () => undefined),
    (error: unknown) => {
      assert.ok(error instanceof EventNamingError);
      return true;
    }
  );

  await assert.rejects(
    () =>
      bus.emit("bad.name" as keyof TestEventMap & string, {
        worldId: "w-3",
        status: "active"
      }),
    (error: unknown) => {
      assert.ok(error instanceof EventNamingError);
      return true;
    }
  );
});

test("RuntimeEventBus rejects non-function handlers", () => {
  const bus = new RuntimeEventBus<TestEventMap>();

  assert.throws(
    () => bus.on("world:runtime:updated", null as unknown as (payload: { worldId: string; status: string }) => void),
    (error: unknown) => {
      assert.ok(error instanceof EventBusError);
      assert.equal(error.code, "EVENT_HANDLER_INVALID");
      return true;
    }
  );
});
