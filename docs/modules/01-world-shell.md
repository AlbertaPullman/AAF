# 01 世界外壳与布局

## 职责

世界外壳负责玩家进入世界后的主体验：命刻、战斗序列、中央舞台、右侧系统板、底部 HUD、左侧队伍简卡、在线列表。它是游戏界面，不是后台表单。

## 入口文件

- `client/src/pages/world/WorldPage.tsx`
- `client/src/world/components/WorldCanvas.tsx`
- `client/src/world/components/FateClockWidget.tsx`
- `client/src/world/components/BattleSequenceBar.tsx`
- `client/src/world/components/HUDPanel.tsx`
- `client/src/world/components/CharacterPanel.tsx`
- `client/src/pages/system/AbilityLabPage.tsx`
- `client/src/styles/index.css`

## 当前约定

- 主视觉使用蓝、白、橘的明亮 JRPG 风格。
- 左侧中央容器只能放队伍角色简卡，不放系统切换按钮。
- 顶部战斗序列栏默认完全不可见；只有当前场景战斗状态为 `active` 且存在参战单位时才向下滑出。
- 中央舞台优先服务地图、剧情视觉和棋子，不承载低频设置。
- 底部 HUD 承担玩家行动入口和快捷栏，不替代角色详细编辑器。
- 右侧系统板只放高频入口，详情进入弹窗。
- 世界页容器间距应优先保证可用空间：系统页、弹窗、资源编辑器和战斗列表使用紧凑矩形工具面板，不为装饰留过大的空隙。
- 能力系统实验页走 `/system/ability-lab/:worldId?`，在 `App.tsx` 中按世界页一样隐藏全局 header 并使用 `app-main--world` 全屏布局；它可以复用世界壳视觉和系统板，但不应反向把实验逻辑堆进 `WorldPage.tsx`。
- **舞台组件 Phase 1 已落地（2026-04-26）**：`FateClockWidget` / `HUDPanel` / `BattleSequenceBar` / `HoverInsightCards` / `ContextMenu` 五件已迁到 `_contract.css` 语义 token + 5 态交互 + 玻璃面板/金边美学。新增舞台组件参照其中任一为模板，禁止裸 hex 与 `var(--jrpg-*)` legacy。
- 全局 scrollbar 浅蓝化在 `_contract.css` 末尾，新组件不必再单独写 scrollbar CSS。
- `border-radius: 999px` 已统一到 `var(--radius-pill)` token；视觉去胶囊化（短矩形替代）属于待办，需 per-selector 审视。

## 待拆分点

- **视觉去胶囊化**：54+处 `var(--radius-pill)` 当前等于 `9999px`，需要逐 selector 区分"长文 chrome"（应改 `--radius-sm`）vs "数字/单字 status marker"（保留 pill）。是 Phase 1 遗留。

## 常见任务定位

- 修改整体布局：先看 `WorldPage.tsx` 渲染结构，再看 `index.css` 中 `.world-stage-shell` 和相关区域样式。
- 修改地图体验：打开 `WorldCanvas.tsx`。
- 修改 HUD 快捷栏：打开 `HUDPanel.tsx` 和 `WorldPage.tsx` 中 HUD handler。
- 修改队伍简卡：打开 `CharacterPanel.tsx`，必要时看角色权限模块。

## 验证

- UI 改动至少运行 `npm run build -w client`。
- 若涉及本地世界体验，打开 `http://localhost:5174/world/cmnxy9w6k00013tqo4454c5vw` 做玩家视角和 GM 视角抽查。
