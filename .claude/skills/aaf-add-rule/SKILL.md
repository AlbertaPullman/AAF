---
name: aaf-add-rule
description: Add or modify a combat rule, ability, spell effect, or condition using the AAF trigger/condition/effect DSL. Trigger when user says "加技能"/"加法术"/"加被动"/"新规则"/"做个能力"/"DSL"/"加触发器"/"加 buff/debuff". NEVER hardcode ability names or effects — always express via DSL nodes. Run aaf-balance-check before persisting.
---

# AAF Add Rule Skill

Rules are data, not code. You are composing nodes from `shared/rules/node-types.ts`, NOT writing if-else branches that reference ability names.

## Step 0 — Read the DSL surface

Before designing, open these (only these):
- `shared/rules/node-types.ts` — full node catalog
- `shared/rules/node-metadata.ts` — node UI/display metadata
- `shared/rules/context.ts` — RuleContext shape (what data is available at evaluation time)
- `shared/rules/result.ts` — result/event shape that feeds settlement + FX

If a node you need doesn't exist, **adding a new node type** is a separate (larger) task — surface it to the user before extending DSL.

## Step 1 — Confirm design intent

Ask:
- 能力/法术名 + 一句话效果
- 触发方式（主动行动 / 反应触发 / 持续被动）
- 资源消耗（AP/MP/CD/充能/每日次数）
- 目标类型（自身/单体/AOE/方向）
- 数值（伤害公式、命中、保存、持续）
- 学派 / 标签（用于互动检索）

## Step 2 — Map to DSL nodes

Compose as nested structure:

```
ability {
  trigger: <when> (active action | reactive on event | passive)
  conditions: [<can fire?> ...]
  costs: [<AP>, <MP>, <other>]
  targeting: <shape + range>
  effects: [
    <damage | heal | apply_status | move | summon | ...>,
    ...
  ]
}
```

每个 effect / condition / trigger 必须是 `node-types.ts` 列表里的一个 type。Type 不在列表里 = 你需要先加 node type，停下问用户.

## Step 3 — 复用判定函数 (HARD RULE)

命中、暴击、保存、抗性、伤害类型转换 —— 全部走 `shared/rules/` 里现有函数。不要在新能力定义里再写一遍判定逻辑.

如果天赋树共享公式，**reuse** `talent-tree.service.ts` / `shared/rules/` 内已有 helper（per `feedback_reuse_talent_funcs`）。

## Step 4 — 核心规则合规

- **同名不叠加**：相同 status/buff name 不堆叠。如设计要叠加，必须不同 name 或显式 stackable flag.
- **向下取整**：所有除法/百分比走 `Math.floor`. 别用 round.
- **至少为一**：伤害/治疗 floored 后若 ≤0，最终值为 1（除非显式 nonlethal/0-allow 标记）.
- **特例优先**：能力上的特例覆盖通用规则；表达为 condition 而非散落 if.

## Step 5 — 行动经济 / 法术模型对齐

- Action type ∈ `标准 / 快速 / 机动 / 自由 / 反应 / 复合 / 特殊`. 禁用 `move` / `full-round`.
- 法术：用 `法术等级` + `MP cost` + `AP cost` + `学派`. 不写 spell slot 槽位.

## Step 6 — 持久化

能力定义走 `AbilityDefinition` Prisma model 的 `data` JSON 字段。无 schema 改动。通过 service / route / client store 写入。

如新能力是种子数据（默认世界包），加到 `server/prisma/seed.ts` 或对应 fixture.

## Step 7 — 平衡检查 (必做)

链 `aaf-balance-check` 跑数值 verdict。FAIL → 调整再写库。FLAG → 让用户确认是有意设计.

## Step 8 — 验证

```
npm run build -w server
# 跑能力相关 test（如 ability-engine.*.test.ts）
```

测试场景至少覆盖：
1. 资源不足时不可触发
2. 命中/未命中两条路径
3. 与现有同类能力共存（同名不叠加）
4. 反应触发不会无限链（如适用）

## Step 9 — 收尾

链 `aaf-sync-memory`。能力如改变战斗节奏或新增机制，更新 `docs/规则规格-战斗与造物系统-v1.md`、`docs/modules/04-rules-engine-settlement.md` 的"当前约定"，和 `docs/世界模板实现蓝图.md`.
