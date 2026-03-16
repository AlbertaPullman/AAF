import assert from "node:assert/strict";
import test from "node:test";
import { generateTavernAssistantDraft } from "./tavern.service";

test("generateTavernAssistantDraft prioritizes story event cards", () => {
  const draft = generateTavernAssistantDraft(
    {
      worldId: "w1",
      sceneId: "s1",
      generatedAt: "2026-03-16T12:30:00.000Z",
      policy: {
        eventCardsFirst: true,
        sourceOrder: ["storyEventCards", "recentMessages"]
      },
      storyEventCards: [
        {
          messageId: "m1",
          createdAt: "2026-03-16T12:00:00.000Z",
          sceneId: "s1",
          eventId: "e1",
          title: "卫兵巡检",
          summary: "卫兵进行了盘查",
          finalOutcome: "队伍顺利入城",
          fromUser: { id: "u1", username: "gm", displayName: "GM" }
        }
      ],
      recentMessages: [
        {
          messageId: "m2",
          createdAt: "2026-03-16T12:10:00.000Z",
          sceneId: "s1",
          channelKey: "IC",
          content: "我们是商队护卫。",
          linkedEventId: "e1",
          fromUser: { id: "u2", username: "alice", displayName: "Alice" }
        }
      ],
      hints: []
    },
    "请总结本段剧情"
  );

  assert.equal(draft.mode, "local-fallback");
  assert.match(draft.content, /请总结本段剧情/);
  assert.match(draft.content, /优先事件卡片/);
  assert.match(draft.content, /卫兵巡检/);
  assert.equal(draft.sourceCounts.storyEventCards, 1);
  assert.equal(draft.sourceCounts.recentMessages, 1);
});

test("generateTavernAssistantDraft degrades when no story cards exist", () => {
  const draft = generateTavernAssistantDraft({
    worldId: "w1",
    generatedAt: "2026-03-16T12:30:00.000Z",
    policy: {
      eventCardsFirst: true,
      sourceOrder: ["storyEventCards", "recentMessages"]
    },
    storyEventCards: [],
    recentMessages: [],
    hints: ["未找到剧情事件卡片"]
  });

  assert.match(draft.content, /暂无/);
  assert.equal(draft.sourceCounts.storyEventCards, 0);
  assert.equal(draft.sourceCounts.recentMessages, 0);
});
