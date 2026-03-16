import assert from "node:assert/strict";
import test from "node:test";
import { extractSceneIdFromMetadata, filterMessagesByScene, sanitizeChatContent, type GlobalMessagePayload } from "./chat.service";

test("sanitizeChatContent escapes html and trims control chars", () => {
  const raw = "  <script>alert(1)</script>\u0007  ";
  const sanitized = sanitizeChatContent(raw);

  assert.equal(sanitized, "&lt;script&gt;alert(1)&lt;/script&gt;");
});

test("sanitizeChatContent keeps normal message content", () => {
  const raw = "hello world";
  const sanitized = sanitizeChatContent(raw);

  assert.equal(sanitized, "hello world");
});

test("extractSceneIdFromMetadata returns sceneId when metadata is valid", () => {
  const sceneId = extractSceneIdFromMetadata({ sceneId: "scene-1" });
  assert.equal(sceneId, "scene-1");
});

test("extractSceneIdFromMetadata returns undefined for invalid metadata", () => {
  assert.equal(extractSceneIdFromMetadata(null), undefined);
  assert.equal(extractSceneIdFromMetadata({ sceneId: 1 }), undefined);
  assert.equal(extractSceneIdFromMetadata({}), undefined);
});

test("filterMessagesByScene keeps current scene messages and respects limit", () => {
  const base: GlobalMessagePayload = {
    id: "0",
    worldId: "w1",
    channelKey: "OOC",
    content: "msg",
    createdAt: "2026-03-13T00:00:00.000Z",
    fromUser: { id: "u1", username: "alice", displayName: "Alice" }
  };

  const messages: GlobalMessagePayload[] = [
    { ...base, id: "1", sceneId: "s1" },
    { ...base, id: "2", sceneId: "s2" },
    { ...base, id: "3", sceneId: "s1" }
  ];

  const result = filterMessagesByScene(messages, "s1", 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "3");
});

test("filterMessagesByScene returns tail when sceneId is missing", () => {
  const base: GlobalMessagePayload = {
    id: "0",
    worldId: "w1",
    channelKey: "OOC",
    content: "msg",
    createdAt: "2026-03-13T00:00:00.000Z",
    fromUser: { id: "u1", username: "alice", displayName: "Alice" }
  };

  const messages: GlobalMessagePayload[] = [{ ...base, id: "1" }, { ...base, id: "2" }, { ...base, id: "3" }];
  const result = filterMessagesByScene(messages, undefined, 2);
  assert.deepEqual(
    result.map((item) => item.id),
    ["2", "3"]
  );
});
