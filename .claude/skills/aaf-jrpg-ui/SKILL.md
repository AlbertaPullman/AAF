---
name: aaf-jrpg-ui
description: Enforce AAF JRPG bright (blue/white/orange) UI direction when creating or modifying any user-facing component. Trigger when the task touches client/src/**/*.tsx or client/src/styles/**, or when user says "美化"/"调样式"/"改 UI"/"做面板"/"加按钮"/"调色"/"加动画". Loads palette tokens, surface vs tool aesthetics, button/scrollbar/disabled rules, and the 舞台 vs 工具面板 distinction. Skip for backend, shared/, server/ tasks.
---

# AAF JRPG UI Skill

You are about to touch UI. Apply this checklist before writing any styles or markup.

## Step 1 — Identify the surface type

Ask yourself: is this 舞台 (stage) or 工具面板 (tool panel)?

| | 舞台 (WorldCanvas, HUD, BattleSequenceBar, FateClockWidget, hover cards) | 工具面板 (EntityManager, AbilityExecutionPanel, CharacterSheetWorkbench, system panels) |
|---|---|---|
| Background | 玻璃面板 + 浅蓝渐变 + 淡橘高光 + 舞台网格 | 浅色矩形、低装饰、强对齐 |
| Decoration | 卡片高光、光晕、动效允许 | 极简，先好用再好看 |
| Density | 中低密度，留白 | 高密度，紧凑栅格 |

**Rule:** 舞台可以好看，工具必须先好用。Never apply stage glass-card style to tool panels.

## Step 2 — Use existing CSS tokens, never raw hex

Tokens live in `client/src/styles/index.css`. Use these (do not invent new colors without checking):

```
--jrpg-text-main: #10264d   主文字
--jrpg-text-sub:  #3f5f8d   次级文字
--jrpg-card:      rgba(255,255,255,0.88)   卡面
--jrpg-card-border: rgba(93,130,206,0.32)  卡边
--jrpg-accent:    #1274ff   主蓝（链接/选中）
--jrpg-accent-soft: #2fc6ff 浅蓝高光
--jrpg-success:   #08a37b
--jrpg-warn:      #f59e0b   橙：强调/选中/高风险/关键反馈
--jrpg-danger:    #dc2626
--jrpg-shadow:    0 18px 40px rgba(12,30,68,0.15)
--jrpg-heading-font: KaiTi, STKaiti, Microsoft YaHei
```

Special-purpose token families (do NOT mix into world UI):
- `--auth-*` only inside `client/src/pages/auth/*`
- `--rulebook-*` only for 规则书阅读视图
- `--talent-*` only for 天赋树相关

## Step 3 — Hard rules (do not violate)

1. **Never use dark backgrounds for "readability savings".** This regression was overturned 2026-04-19. Bright冷蓝+白 base only.
2. **Never use 默认浏览器白色滚动条.** Style scrollbars to match the bright palette (浅蓝 thumb on transparent track).
3. **Never use pill/capsule tags for routine layout.** They deform on long Chinese labels. Use 短矩形标签 only for status markers.
4. **Orange (`--jrpg-warn`) is reserved** for: 强调、选中、高风险、关键反馈. Never as decorative chrome.
5. **Buttons** look like JRPG menu items: 标题 + 箭头/角标 + 状态 + 明显 hover. Not flat form buttons.
6. **Hierarchy:** 舞台最大 > HUD 次之 > 系统板固定右侧 > 辅助信息靠左.

## Step 4 — Required interaction states

Every interactive element must define all five:

- `hover` — 浅蓝光晕或位移 1–2px
- `active` — 略缩 + 加深
- `focus-visible` — 蓝色 outline，不要去掉默认 focus ring 不补
- `disabled` — 50–60% 透明 + cursor: not-allowed，颜色不变成灰
- `loading` — 内置 spinner 或 shimmer，禁止整面板替换

## Step 5 — Animation budget

- Transitions: 150–250ms, `cubic-bezier(0.22, 1, 0.36, 1)` (gentle ease-out)
- 弹性动画 (springy) only on 舞台胜负演出/技能命中/拾取，不用在工具面板
- 不要超过 400ms 的过渡——用户感觉卡顿
- 任何持续动画必须有 `prefers-reduced-motion` 降级

## Step 6 — Reference

If unsure, the reference feel is **碧蓝幻想式明亮幻想冒险**. Avoid:
- 任何赛博/暗黑/控制台美学
- 大面积 #000–#222 背景
- 霓虹紫/绿色作为主色
- Material Design 卡片阴影（用 `--jrpg-shadow`）

## Step 7 — After change

If the change altered world UX, mirror in `docs/世界模板实现蓝图.md` (per `feedback_update_world_blueprint`).
