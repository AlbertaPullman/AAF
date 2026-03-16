import assert from "node:assert/strict";
import test from "node:test";
import {
  extractLinkedStoryEventIdFromMessageMetadata,
  includesKeyword,
  normalizeStoryEventSearchInput,
  toMessageChannelKey,
  toStoryEventSearchText,
  toStoryEventStatus,
  type StoryEventItem
} from "./story-event.search";

test("includesKeyword supports case-insensitive search", () => {
  assert.equal(includesKeyword("Guard Check", "guard"), true);
  assert.equal(includesKeyword("Guard Check", "merchant"), false);
});

test("extractLinkedStoryEventIdFromMessageMetadata extracts first valid eventId", () => {
  const id = extractLinkedStoryEventIdFromMessageMetadata({
    storyPointProposalTag: { eventId: "sev_123" },
    storyEventCard: { eventId: "sev_456" }
  });

  assert.equal(id, "sev_456");
});

test("extractLinkedStoryEventIdFromMessageMetadata returns undefined for invalid metadata", () => {
  assert.equal(extractLinkedStoryEventIdFromMessageMetadata(null), undefined);
  assert.equal(extractLinkedStoryEventIdFromMessageMetadata({ storyEventCard: { eventId: 123 } }), undefined);
});

test("normalizeStoryEventSearchInput clamps limit and hours", () => {
  const normalized = normalizeStoryEventSearchInput({
    sceneId: "  scene-1  ",
    limit: 999,
    eventStatus: "OPEN",
    channelKey: "IC",
    hours: 99999
  });

  assert.equal(normalized.sceneId, "scene-1");
  assert.equal(normalized.limit, 50);
  assert.equal(normalized.eventStatus, "OPEN");
  assert.equal(normalized.channelKey, "IC");
  assert.equal(normalized.hours, 24 * 30);
  assert.ok(normalized.sinceDate instanceof Date);
});

test("normalizeStoryEventSearchInput rejects invalid status/channel", () => {
  assert.throws(() => normalizeStoryEventSearchInput({ eventStatus: "INVALID" as any }), /search event status is invalid/);
  assert.throws(() => normalizeStoryEventSearchInput({ channelKey: "INVALID" as any }), /search channel key is invalid/);
});

test("toStoryEventSearchText includes title/option/request fields", () => {
  const event: StoryEventItem = {
    id: "sev_1",
    worldId: "w1",
    title: "卫兵巡检",
    description: "守门卫兵盘查身份",
    scope: "ALL",
    status: "OPEN",
    options: [
      {
        id: "opt_1",
        label: "欺瞒",
        check: {
          skillKey: "deception",
          dc: 15,
          checkMode: "SINGLE"
        },
        successOutcome: "顺利放行",
        failureOutcome: "引起怀疑",
        closed: false,
        attempts: []
      }
    ],
    narrativeRequests: [
      {
        id: "nr_1",
        eventId: "sev_1",
        userId: "u1",
        cost: 1,
        reason: "守卫认识我",
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    createdBy: "gm_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const text = toStoryEventSearchText(event);
  assert.match(text, /卫兵巡检/);
  assert.match(text, /deception/);
  assert.match(text, /守卫认识我/);
});

test("toStoryEventStatus and toMessageChannelKey map values correctly", () => {
  assert.equal(toStoryEventStatus("ALL"), undefined);
  assert.equal(toStoryEventStatus("RESOLVED"), "RESOLVED");
  assert.equal(toMessageChannelKey("ALL"), undefined);
  assert.equal(toMessageChannelKey("SYSTEM"), "SYSTEM");
});
