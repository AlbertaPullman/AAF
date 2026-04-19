import assert from "node:assert/strict";
import test from "node:test";
import { resolveSettlementAction } from "./settlement.service";

test("resolveSettlementAction handles advantage with bonus/penalty dice and hit-timing resource cost", () => {
  const result = resolveSettlementAction({
    actionId: "atk-1",
    actorTokenId: "token-hero",
    targetTokenId: "token-goblin",
    check: {
      targetType: "AC",
      targetValue: 15,
      attributeMod: 3,
      proficiency: 2,
      bonusDiceCount: 2,
      penaltyDiceCount: 1,
      advantageState: "advantage"
    },
    damage: {
      formula: "2d6+3",
      damageType: "slashing"
    },
    resourceCost: 2,
    resourceTiming: "hit",
    fixedRolls: {
      d20: [8, 14],
      bonusDice: [6, 2],
      penaltyDice: [4],
      damageDice: [4, 5]
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.check.selectedD20, 14);
  assert.equal(result.check.total, 25);
  assert.equal(result.check.success, true);
  assert.equal(result.damage.total, 12);
  assert.equal(result.resource.consumed, 2);
  assert.equal(result.resource.rolledBack, 0);
});

test("resolveSettlementAction doubles damage dice on critical hit", () => {
  const result = resolveSettlementAction({
    actionId: "crit-1",
    actorTokenId: "token-hero",
    targetTokenId: "token-ogre",
    check: {
      targetType: "AC",
      targetValue: 10,
      criticalRangeStart: 19
    },
    damage: {
      formula: "1d8+1"
    },
    fixedRolls: {
      d20: [20],
      damageDice: [5, 4]
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.check.critical, true);
  assert.equal(result.damage.resolvedFormula, "2d8+1");
  assert.equal(result.damage.total, 10);
});

test("resolveSettlementAction rolls back consumed resource when later stage fails", () => {
  const result = resolveSettlementAction({
    actionId: "bad-damage",
    actorTokenId: "token-hero",
    targetTokenId: "token-ogre",
    check: {
      targetType: "AC",
      targetValue: 5
    },
    damage: {
      formula: "invalid_formula"
    },
    resourceCost: 3,
    resourceTiming: "declare",
    fixedRolls: {
      d20: [16]
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.error, "invalid damage formula, expected format like 2d6+3");
  assert.equal(result.resource.cost, 3);
  assert.equal(result.resource.consumed, 0);
  assert.equal(result.resource.rolledBack, 3);
});
