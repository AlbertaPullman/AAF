import assert from "node:assert/strict";
import test from "node:test";
import { canSendWorldChannel } from "./chat.service";

test("GM can send SYSTEM channel", () => {
  assert.equal(canSendWorldChannel("GM", "SYSTEM"), true);
});

test("PLAYER cannot send SYSTEM channel", () => {
  assert.equal(canSendWorldChannel("PLAYER", "SYSTEM"), false);
});

test("PLAYER can send OOC and IC channels", () => {
  assert.equal(canSendWorldChannel("PLAYER", "OOC"), true);
  assert.equal(canSendWorldChannel("PLAYER", "IC"), true);
});
