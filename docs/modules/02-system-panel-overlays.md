# 02 系统板与弹窗

## 职责

系统板负责世界内的右侧游戏菜单。它应该像 FVTT/BG3 的入口面板：常驻内容少，复杂内容通过按钮、右键菜单或覆盖层打开。

## 入口文件

- `client/src/pages/world/WorldPage.tsx`
- `client/src/world/components/ContextMenu.tsx`
- `client/src/world/components/AbilityExecutionPanel.tsx`
- `client/src/world/components/StoryEventPanel.tsx`
- `client/src/world/components/HotkeySettingsPanel.tsx`
- `client/src/world/components/system/*`
- `client/src/styles/index.css`

## 当前约定

- 战斗页只常驻先攻、回合控制和战斗入口。
- 角色页只常驻角色条目，角色卡详情进入弹窗。
- 资源编辑器是工具弹窗，不套用高装饰舞台风格。
- 世界内工具窗不是传统 modal：不渲染灰色遮罩，不允许点击外部自动关闭，必须支持多个工具窗并列打开和拖动调整位置，方便 GM 在职业、种族、能力、物品之间拖拽赋予资源。
- 所有身份都能看到系统页中的规则查询、快捷键设置和返回大厅入口。
- GM 控制台只对 GM 展示；玩家助手、玩家、旁观者不看到底层模板管理按钮。

## 常见任务定位

- 新增系统板标签：先改 `WorldPage.tsx` 的 tab key、renderActiveSystemTab 和样式。
- 新增弹窗工具：在 `WorldPage.tsx` 做 overlay state，组件放 `client/src/world/components` 或 `system` 子目录。
- 右键菜单操作：打开 `ContextMenu.tsx` 和调用处。
- 快捷键：打开 `HotkeySettingsPanel.tsx`。

## 设计提醒

- 工具面板优先清晰、直观、低视觉压力。
- 工具窗宽度保持紧凑，优先缩短左右长度而不是压缩高度；顶层资源库窗口可并列显示，条目详情编辑窗比资源库更窄。
- 不要使用大量胶囊标签作为主要排版结构。
- 长表单必须拆页签、分组或弹窗，不允许挤进系统板滚动长条。
