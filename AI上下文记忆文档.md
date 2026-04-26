# AI 上下文记忆文档（精简版）

本文档只保留“下一次开发直接会用到”的上下文，避免历史日志占用 token。

## 1. 当前项目快照

- 项目：AAF（TRPG Web 平台，前后端分离）。
- 前端：React + TypeScript + Vite。
- 后端：Node.js + Express + Socket.IO。
- 数据层：Prisma + SQLite。
- 当前阶段：阶段 8（迭代 B 持续中）。

## 2. 当前主线与边界

- 当前主线：阶段 8 的世界内能力深化与 AI 辅助链路完善。
- 已完成基础：登录鉴权、世界管理、世界聊天、多场景、角色卡基础、规则书、天赋树编辑与预览、角色天赋试用。
- 本阶段不做：无关主线的历史阶段返工。

## 3. 天赋系统（后续角色卡必须复用）

### 3.1 词缀统一结构

词缀只使用三元结构：

- `mastery: boolean`（通晓）
- `exclusive: boolean`（排他）
- `studyMax: number`（研习最大层级）

展示文本规则：

- `mastery=true` => `通晓`
- `studyMax>0` => `研习X`
- `exclusive=true` => `排他`
- 多词缀以中文逗号拼接。

### 3.2 节点解锁判定

统一公式：

- `masteryPass OR (requirementPass AND parentPass)`

其中：

- `requirementPass`：职业等级前置满足。
- `parentPass`：父节点学习状态满足。
- `masteryPass`：同名通晓替代解锁条件满足。

### 3.3 学习/回退约束

- 普通节点最大学习次数为 1。
- 研习节点最大学习次数为 `studyMax`。
- 排他节点互斥：同树已学习任一排他后，不能再学其他排他。
- 取消学习时，节点 rank 不能低于 `committedRanks`。

### 3.4 关键一致性规则（已修复）

- 当母节点被回退（叉掉）后，必须级联校验并回退所有失去前置条件的子孙节点。
- 级联回退过程需迭代直到状态收敛（无新增回退）。

### 3.5 角色卡接入契约

角色卡落地时必须复用同一套规则函数，不允许复制出第二套判定逻辑。

建议共用纯函数：

1. `parseAffixMeta(value, rawMeta)`
2. `canUnlockNode(node, ranks, professionLevels, allNodes)`
3. `canLearnNode(node, ranks, committedRanks, points, allNodes)`
4. `pruneInvalidLearnedNodes(ranks, committedRanks, professionLevels, allNodes)`
5. `getNodeLearningStatusText(node, unlocked, rank)`

## 4. 当前稳定页面

- 大厅天赋树预览：支持缩略图/详情图、节点连线、右侧详情。
- 角色天赋试用页：支持学习模式、保存/取消、重置、母子级联回退。
- 规则书：大厅只读预览 + 管理员编辑器。

## 5. 下一次开发建议顺序

1. ~~抽离天赋判定为共享纯函数模块（供试用页与角色卡共用）。~~ ✅ `shared/rules/talent-tree.ts`
2. ~~落地角色卡天赋分配接口（读取、试算、提交、重置）。~~ ✅ `talent-allocation.service.ts` + controller + routes
3. 角色卡 UI 直接复用天赋树节点渲染与判定契约。
4. 补角色卡联调用例：
   - 母子级联回退
   - 排他冲突
   - 研习上限
   - 通晓同名不叠加

## 6. 文档维护规则

- 本文档只保留“未来会直接用到”的事实与规则。
- 历史流水日志不再堆积到本文件。
- 每次迭代只新增一段“当前主线变化 + 影响规则 + 下一步”。

## 7. 角色卡新约定（2026-04-08）

- 角色卡 JSON 导入导出已启用，命名规则固定为：`角色名_人物等级_玩家名_年月日_时分秒.json`。
- 角色卡导入导出 payload 采用 `CharacterSheetExportPayload` 统一结构，并带 `schemaVersion`。
- 硬约束：角色卡字段新增或删减时，必须同步更新：
   1. `CharacterSheetExportPayload` 类型
   2. `isCharacterSheetExportPayload` 校验
   3. 导入映射逻辑
   4. 文档中的 schemaVersion 记录
- 右上角已改为“设置”入口，编辑模式是第一优先开关；字段改动操作默认仅编辑模式可执行。
- 技能栏进入可配置阶段：支持关联属性、熟练/专精、常驻与临时调整值，且悬停可查看来源说明。
- 前瞻记录：后续会做 Ability System 的“公式索引插件”（可选公式下拉 + 中文说明），本阶段仅记录，不实现。

## 8. 主题系统与分支整合（2026-04-26）

**当前主线变化**：

- 把 `codex/world-template-ux-docs`（12 commits, +36k lines, 含世界 UI 组件）和 `claude/reverent-germain-b299cb`（Phase 0 主题系统 + 登录框美化）合并入 main，并清理了误入仓库的 `tmp/`、`规则书.txt/docx`、`*.tsbuildinfo`，扩展 `.gitignore` 防止再次入库。
- 引入语义 token 系统：所有视觉相关 CSS 变量改走 `--surface-*` / `--text-*` / `--accent-*` / `--mod-<module>-*` 三层语义层，旧的 `--jrpg-*` / `--auth-*` 通过别名保持向后兼容（位于 `client/src/styles/themes/_contract.css`）。
- 主题包加载机制：`client/src/lib/theme.ts` + `client/src/store/themeStore.ts`，优先级 GM 强制 > 世界默认 > 玩家偏好 > 系统默认。`bootstrapTheme()` 在 React 渲染前注入 `<html data-theme>`，避免闪烁。
- 登录页（`AuthCinematicPage.tsx`）的 cinematic 动画完整保留；只重塑了 `.auth-panel` 内部样式：金边外框 + 深夜底盘 + 四角金饰 + 卷轴风 tabs + 羊皮纸输入框 + 凸雕金质提交按钮。markup/类名/事件全部不动。

**影响规则 / 接口**：

- 所有新增视觉组件 CSS 必须使用语义 token（`var(--surface-card)`、`var(--accent-action)` 等），禁止再写裸 hex 或直接 `var(--jrpg-*)`。
- 新增世界级主题包：在 `client/src/styles/themes/<id>.css` 写 `[data-theme="<id>"] { ... }`，在 `client/src/lib/theme.ts` 的 `THEME_PACKS` 注册即可。
- 角色卡、能力等任何新建 UI 应区分**舞台**（FateClock/HUD/WorldCanvas chrome）和**工具面板**（SystemPanel/EntityManager/Sheet）两类美学——可读 `.claude/skills/aaf-jrpg-ui/SKILL.md`。
- `.claude/skills/` 下新增 10 个项目本地 skill；`.claude/launch.json` 提供 Claude Preview 启动配置（port 5174）。

**下一步**：

1. Phase 1：舞台组件美化——FateClockWidget / HUDPanel / BattleSequenceBar / HoverInsightCards / ContextMenu，去除胶囊形状（共 29 处 `border-radius: 9999px`），改成 JRPG 菜单按钮形态。
2. Phase 2：工具面板美化——SystemPanel / EntityManager / AbilityExecutionPanel / CharacterSheetWorkbench，走"实用密度高"路线。
3. Phase 3：逐组件 polish pass（用 `aaf-component-polish` skill）。
4. Phase 4：用替代主题包（如黑暗）验证 token 覆盖完整性。
