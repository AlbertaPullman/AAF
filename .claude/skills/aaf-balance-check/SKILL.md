---
name: aaf-balance-check
description: Run numerical sanity checks before adding/modifying an ability, spell, monster, or item in AAF. Trigger when user says "新能力"/"加技能"/"加法术"/"新怪"/"调数值"/"balance"/"平衡"/"DPR"/"伤害够不够"/"是否过强". Compares against same-tier existing entities and the AAF action economy + spell model. Stops obviously broken designs before they enter the world.
---

# AAF Balance Check Skill

You are vetting a new or changed entity for numerical sanity. Run this BEFORE writing the entity to Prisma / world entity store.

## Constants to apply (AAF core)

- 行动经济: 标准 / 快速 / 机动 / 自由 / 反应 / 复合 / 特殊. Never `move` / `full-round` (per `feedback_aaf_action_economy`).
- 法术模型: 法术等级序列 + MP + AP + 学派. NOT spell slots (per `feedback_aaf_spell_model`).
- 核心规则: 同名不叠加、向下取整、至少为一、特例优先 (per `feedback_aaf_core_principles`).

## Inputs you need from the user (ask if missing)

1. 实体类型 (能力/法术/怪物/物品)
2. 等级 / 学派 / 阵营 (如适用)
3. 资源消耗（AP/MP/CD/充能）
4. 主要数值（伤害公式、命中、范围、持续）
5. 设计意图（一句话："我想让它做什么"）

## Step 1 — Find peers

读取 `client/src/world/stores/worldEntityStore.ts` 和数据库（或导出包）里**同等级 + 同类型**的现有实体 3–5 个作为对照组. 不要凭印象比较.

## Step 2 — DPR/Resource ratio

计算 **每 AP 期望伤害** (DPR per AP):

```
DPR_per_AP = E[damage] × hit_rate / AP_cost
```

| Tier | DPR/AP 健康区间（参考，按当前游戏调整） |
|---|---|
| 1 级 | ?–? （从对照组求 median ± 30%）|
| ... | ... |

如果新实体 DPR/AP 偏离对照组 median 的 ±50%，**红旗** — 要么是设计独特，要么是数值漏洞。让用户确认。

## Step 3 — Burst vs sustain

- Burst （单次大伤）：检查与同等级单次伤害上限比较，是否超 1.5x
- Sustain （持续/DOT）：检查总伤害 / 持续回合，对比同等级 sustain 法术
- AOE：基础伤害 ×0.6–0.7 后再比较，AOE 自带溢价

## Step 4 — 资源曲线

- MP 消耗 / 法术等级 是否合理（同学派同等级对照）
- AP 消耗 / 行动类型 是否合理（标准 1AP / 快速 0AP / 复合 2AP 是当前默认，确认与规则书一致）
- 冷却 / 充能 / 每日次数 是否能被滥用（连续 5 回合白嫖）

## Step 5 — 控制效果系数

控制 (眩晕/定身/沉默) 应至少消耗：
- 1 AP + 投定（对方有抵抗）
- 持续 1 回合起步，长持续 (≥3 回合) 必须强投定
- 检查是否有 stacking — 同名不叠加是核心规则

## Step 6 — Anti-cheese checks

- 反应触发的能力是否会无限循环（A 触发 B，B 触发 A）
- 治疗是否能在战斗外瞬补满（应有 OOC cap 或长冷却）
- 召唤物是否能再召唤（指数膨胀）
- 资源回复是否能在同回合内反向触发自己

## Step 7 — DSL 合规

数值定下来后，能力必须用 trigger/condition/effect DSL 表达 (per `feedback_no_hardcoded_abilities`). 不写自定义 if-else. 见 `shared/rules/node-types.ts` 列表.

## Output format

给用户一份 verdict：

```
== Balance Verdict: [PASS / FLAG / FAIL] ==

对照组: [3–5 个实体名]
DPR/AP: 新 X.X vs 对照 median Y.Y (±Z%)
Burst:  ...
Sustain: ...
控制系数: ...
Anti-cheese: ...

红旗:
- ...

建议调整 (可选采纳):
- ...
```

不要替用户改数值——出 verdict，由用户决定接受还是改。
