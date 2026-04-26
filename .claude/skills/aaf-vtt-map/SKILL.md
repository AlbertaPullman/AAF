---
name: aaf-vtt-map
description: Work on AAF VTT tactical map — grid coords, token movement, AOE highlight, line of sight, range/measure tool. Trigger when user says "地图"/"棋盘"/"格子"/"棋子"/"token"/"AOE"/"视野"/"测距"/"移动范围"/"路径"/"网格"/"场景画布"/"WorldCanvas". Centralizes coord math, fog/LOS, and movement so each new feature reuses one source of truth.
---

# AAF VTT Map Skill

You are about to change tactical-map behavior. Read this before writing any code.

## Single source of truth

All grid math goes through one module (suggested: `client/src/world/scene/grid.ts`). If it doesn't exist yet, create it. **Do not** duplicate `pixelToCell` / `cellToPixel` / `cellsInRange` / `lineOfSight` in other components.

If you are tempted to write coord math inside `WorldCanvas.tsx`, `TokenPanel.tsx`, `MeasurePanel.tsx`, or `SceneVisualPanel.tsx` — STOP. Add the helper to `grid.ts` and import.

## Coord conventions (lock in if not yet)

- Logical cell coord: `{ x: number, y: number }` integers, origin top-left, +x right, +y down.
- Pixel coord: `{ px: number, py: number }` after pan/zoom. Always pass through current camera transform.
- Distance metric: 默认切比雪夫（chebyshev, 国际象棋王步）= `max(|dx|, |dy|)`. 棋盘单位 = 1.5m AAF default. Confirm against rule 规则书 before changing.
- Grid type: 方格 (square). 不引入六边形除非用户明确要求.

## Common ops — use the helpers

| Need | Helper |
|---|---|
| 鼠标坐标→格子 | `pixelToCell(px, py, camera)` |
| 格子→中心像素 | `cellToPixel(cell, camera)` |
| 范围内所有格子 | `cellsInRange(origin, range, shape)` shape: `circle`/`square`/`cone`/`line` |
| 直线视野 | `lineOfSight(from, to, blockers)` returns `{ visible, hitCell? }` |
| A→B 路径 | `findPath(from, to, blockers, costMap)` A* |
| AOE 命中 | `cellsInAOE(origin, aoeShape, params)` |

If the helper doesn't cover your case, **extend it**, do not branch.

## Token movement rules

- 移动通过 socket event，服务端校验合法性（per `feedback_server_is_truth`）.
- 客户端先乐观渲染移动动画 (200ms ease-out per cell), 服务端 reject 后回滚.
- 多格移动按路径 segment 播放，每段 ≤ 150ms，全程上限 1200ms (cap with skip-to-end).
- 困难地形 / 触发地形进入服务端结算流程，FX 走 `aaf-combat-fx` skill.

## AOE 高亮

- 选中能力 → 鼠标 hover 时实时显示 AOE 候选格子（半透明橙色 `--jrpg-warn` 30%）
- 点击确认 → 高亮变实色 + 脉冲，等待服务端结算回执
- LOS 阻挡的格子用斜线纹理覆盖，提示玩家不可达

## 视野 / Fog

- 视野为玩家可选 toggle，主持人始终全见.
- 仅渲染层裁剪——服务端发送数据时已按角色身份过滤，客户端不二次过滤敏感信息.

## 测距

- Shift+drag = 临时测距（不入历史）
- 普通点击两点 = 入历史测距，可清除
- 距离单位与规则书一致：`Math.max(|dx|,|dy|) × 1.5m`

## Visual style

走 aaf-jrpg-ui 的舞台美学：玻璃浮层、浅蓝网格线、橙色高亮。网格线默认 `rgba(93,130,206,0.18)`. 不要黑色网格线。

## Performance

- WorldCanvas 当前是 6865 行的单文件 (per `01-world-shell.md`) — 不要再往里加新逻辑，新功能放到子组件并 import.
- token 数 >50 时考虑虚拟化或分层 canvas.
- 高亮层 60fps，普通层 30fps 即可.

## After change

更新 `06-scenes-combat-socket.md` 的"当前约定"。任何坐标系/距离单位变化必须同步 `docs/世界模板实现蓝图.md`.
