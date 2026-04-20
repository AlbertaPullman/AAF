# 06 场景战斗与 Socket

## 职责

本模块管理场景、棋子、地图视觉、先攻序列、战斗状态、聊天隔离和实时同步。

## 入口文件

- `client/src/world/components/WorldCanvas.tsx`
- `client/src/world/components/ScenePanel.tsx`
- `client/src/world/components/SceneVisualPanel.tsx`
- `client/src/world/components/SceneCombatPanel.tsx`
- `client/src/world/components/TokenPanel.tsx`
- `client/src/world/components/BattleSequenceBar.tsx`
- `server/src/services/scene.service.ts`
- `server/src/routes/scene*.ts`
- `server/src/socket/*`
- `docs/Socket事件契约.md`

## 当前约定

- 战斗序列栏默认收起，战斗开始时展开。
- 战斗页常驻信息必须短，只保留先攻、回合和核心控制。
- 棋子操作需要权限判断：GM 全权，玩家主要操作自己的棋子，旁观者只读。
- 聊天和剧情事件要按世界/场景隔离。

## 常见任务定位

- 场景 CRUD 和排序：`scene.service.ts`、`scene.routes.test.ts`。
- 地图和棋子交互：`WorldCanvas.tsx`、`TokenPanel.tsx`。
- 战斗轮推进：`SceneCombatPanel.tsx`、`scene.runtime.routes.test.ts`。
- Socket 同步：`server/src/socket/*`、`docs/Socket事件契约.md`。

## 验证

- 场景/战斗/Socket 改动跑 `npm test -w server`。
- 前端地图交互改动跑 `npm run build -w client`，并在本地世界页手动抽查。
