---
name: aaf-combat-fx
description: Design or modify BG3-style automated combat presentation in AAF — the visual/audio layer over the trigger/condition/effect DSL settlement. Trigger when user says "战斗演出"/"伤害飘字"/"命中动画"/"BG3 体验"/"结算反馈"/"技能特效"/"先攻动效"/"战斗镜头"/"状态图标"/"DOT 表现". Bridges shared/rules settlement events to client/src/world/components/Scene*/Battle* visual updates.
---

# AAF Combat FX Skill

You are wiring **结算结果 → 视觉演出**. Settlement runs server-side and emits structured events. The client must turn each event into a tightly choreographed sequence: 命中判定 → 伤害飘字 → 状态图标 → 镜头/震屏 → 资源条更新.

## Hard constraints

1. **Settlement is the source of truth** (per `feedback_server_is_truth`). FX never decides damage, hit/miss, or state changes — it only renders what the server says.
2. **Never hardcode ability names.** All FX dispatch goes through DSL effect type tags (e.g. `damage`, `apply_status`, `heal`, `move`). See `shared/rules/node-types.ts`.
3. **All animation must be skippable** — provide a "fast-forward" toggle and respect `prefers-reduced-motion`.
4. Never block input for >800ms per single attack. Multi-target chains can extend, but each beat caps at ~600ms.

## Event → FX mapping

Build/maintain a single dispatcher (suggested location: `client/src/world/combat/fxDispatcher.ts`). Map effect types to FX presets:

| Effect type | Visual beat | Audio | Camera |
|---|---|---|---|
| `damage` (physical) | 红色伤害飘字 + 目标抖动 + 暗红顿帧 | 物理打击 | 轻震屏 |
| `damage` (magical) | 学派色飘字 + 学派粒子环 | 学派 SFX | 缩放 1.02 |
| `heal` | 绿色 + 上飘字 + 柔光 | 治疗 SFX | 无 |
| `apply_status` | 状态图标飞入血条下方 + 名称气泡 | 状态 SFX | 无 |
| `remove_status` | 图标淡出 + 灰化一帧 | 微音 | 无 |
| `miss` / `dodge` | "Miss"/"闪避" 灰白飘字 + 目标后撤 | 落空 | 无 |
| `crit` | 飘字放大 1.5x + 金色描边 + 强震屏 | 暴击 | 顿帧 80ms |
| `move` | 棋子缓动 + 路径残影 | 脚步 | 跟随 |
| `death` | 棋子降饱和 → 倒地 → 灰色 token | 死亡 | 短焦聚光 |

## Beat sequence (single ability resolution)

```
0ms     施法者起手姿态 (200ms)
200ms   投射物/链接特效飞向目标
400ms   命中/闪避判定显示
500ms   伤害/治疗/状态飘字
600ms   血条/资源条增减动画 (200ms 缓动)
800ms   清场，等待下一个 effect 或回合
```

For AOE/multi-target: stagger 80ms per target.

## Beats hooked from server

Subscribe to settlement socket events (`shared/constants/events.ts`). The settlement service should emit a structured `AbilityResolution` containing an ordered list of `EffectResolution`. The dispatcher iterates and plays beats. **Never** synthesize beats client-side from raw HP deltas — wait for the structured event.

## Visual layer location

- 飘字、状态图标、命中文字 → overlay above `WorldCanvas`, NOT inside the canvas (use absolutely positioned React layer for crisp text)
- 棋子动画/粒子 → inside canvas (Konva/PixiJS layer, whichever is current)
- 血条/资源条 → 在 token 上方组件，订阅 character store 的过渡值

## Status icon catalog

Status icons (buff/debuff/condition) come from entity definitions. The icon, color, and tooltip live on the status definition itself — FX layer renders them, never embeds the catalog.

## Reusable judgement funcs

Per `feedback_reuse_talent_funcs`: hit/crit/save judgments live in `shared/rules/`. FX dispatcher imports and reuses, never reimplements probabilities or thresholds.

## Acceptance test before shipping FX changes

1. 一次普攻：起手→飞行→命中→飘字→血条扣减，全程 ≤800ms.
2. 一次 AOE 三目标：staggered，总时长 ≤ 1200ms.
3. 暴击 vs 普通有明显区分（飘字大小+震屏）.
4. 闪避显示"闪避"字样且没有血条变化.
5. 快进按钮按下后所有 FX 跳过到资源条更新.
6. `prefers-reduced-motion` 时无震屏、无粒子、仅飘字+血条.

## After change

Update `04-rules-engine-settlement.md` 的"当前约定"段，记录新 FX hook。如涉及世界级演出规范，同步 `docs/世界模板实现蓝图.md`.
