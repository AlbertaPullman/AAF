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

## 12. CP-01 ✅ 解锁 + 用户切到 Copilot 接管（2026-04-28 18:18）

- 用户执行路径 A：建 `.env` + `prisma db push`（migrate deploy 因历史 migration 不完整而 fail，db push 强同步 OK）。DB 重建在 `worktree-root/data/sqlite/aaf.db`（417KB）。
- 重测 72 项 → 71/1。剩余 1 失败是 `scene.ability.routes.test.ts`，git stash 后仍 fail，确认是 pre-existing 与 CP-01 无关。
- CP-01 ✅，cursor → `CP-02`。
- **用户切到 Copilot 接手后续 CP**。我把完整 loop 接管 prompt 发给用户用于上下文转移。本会话不再排 loop。

## 11. CP-01 Folder 表完成 + Loop 阻塞于 DB infra（2026-04-28 18:10，已解锁见 §12）

**Loop iteration 1 结果**：

- **CP-01 代码完成**：schema 加 `Folder` 模型 + `FolderType` 枚举 + 10 个资源表 `folderId`；migration SQL 落盘；`folder.service.ts` 提供纯函数（parseFolderPath / buildFolderTree / wouldCreateFolderCycle / validateFolderName）+ Prisma CRUD + lazy 数据迁移；`folder.service.test.ts` 19 项纯单测全过；shared/types 新增 `FolderType` / `FolderRecord` / `FolderTreeNode` 等。
- **prisma:generate ✅ build -w server ✅ folder 单测 19/19 ✅**。
- **整体 npm test fail 7 项**：全部在 `scene-isolation.test.ts`，错误为"main.World does not exist"。`git stash` 后仍 fail，证明是 **pre-existing DB infra 问题**（worktree 没应用过 migration）。
- **按 spec BLOCK**：cursor → `BLOCKED_AT_CP-01`，loop 不再续约。详细诊断 + 三条用户解锁路径（A 应用迁移 / B 跳过到 CP-02 / C 修 spec）见 `docs/世界重制实施进度.md` 异常记录。

**对后续 CP 的影响**：

- CP-01 实质代码完成，DB 一旦就位即可解锁。
- CP-02 起需要先解决这个 DB 缺失问题，否则后续 CP 的集成测试也会全部 fail。

## 10. 世界蓝图重制 v2 + Loop 启动（2026-04-28）

**当前主线变化**：

- 用户填完 `Claude建议.md` 17 节决策。已据此把 `docs/世界模板实现蓝图.md` 全部"待答疑"标记替换为具体方案，新增 §0 命名对齐表 + §22 实施路线（loop 用 CP-01~CP-12）。
- 新增 `docs/世界重制实施进度.md`（loop cursor 文件，初值 `CP-01`）+ `docs/插件与后置功能.md`（HoverInsight bug + Create Transition + 多页快捷栏 + 苦难结算 + 后台世界完整四态）。
- `角色卡设计文档.md` 追加 §20 schema v3（一次性升级，含战意值/技力/AP/物语点/多职业/施法者等级缓存/抗性免疫苦难矩阵/特殊感官/体型/16 类生物类型/部署字段/HUD 模板共享/反应预设/情报记忆/角色塑造占位/folderId）。
- 用户决策核心要点：①文件夹用独立 Folder 表（B 方案），范围 = 场景+角色+资源+牌组+命刻+随机表，可见性跟条目；②场景管理一刀切重写为 FVTT 化（前端生成缩略图，算力优化用 OffscreenCanvas）；③工具栏放在 HUD 上方滑出抽屉，1 级图标 → 2 级展开，icon-only + hover tooltip；④HUD 配置走怪物模板共享 + 单实例可拆，按"攻击/法术/反应/特殊"分类落位；⑤部署单位 = 玩家拥有的非玩家角色（召唤物/魔宠/伙伴/坐骑），长期+临时各 1 个新顶旧，没独立先攻；⑥情报系统双层（战斗实例 + 玩家长期记忆），按字段揭示，同种族共享，怪物死亡瞬间销毁实例层，GM 可手动赐予/剥夺；⑦反应预设默认智能询问，阈值系统默认 + 玩家覆盖；⑧多职业字段 A 方案 + 施法者等级缓存到角色卡 + casterType/casterCategory 加在 ProfessionDefinition；⑨苦难免疫按 `{disease:N, curse:N, poison:N}` 至 N 级模型；⑩物语点无上限初始 3，4 条获得规则 + GM 手动；⑪后台世界本期只做草稿+冻结两态；⑫资源包字段级 merge + 弹 review 弹窗确认重命名。
- **autonomous loop 已安排：3 小时后首次启动，之后每小时一次**。loop 工作清单见蓝图 §22 共 12 个 CP。loop 行为契约见 `docs/世界重制实施进度.md`：每轮读 cursor → 完成对应 CP → 跑验证 → 推进 cursor → 不 commit。遇到非平凡决策标 BLOCKED 停下等用户。

**影响规则 / 接口**：

- v3 schema 三处一致硬规则保持有效（`CharacterSheetExportPayload` + `isCharacterSheetExportPayload` + 导入映射 + 文档 schemaVersion 表格）。
- Folder 表迁移期保留 `folderPath` 字段（3 个版本后删）。
- `Character` 表新增 `controllerId / deployType` 字段服务部署单位机制。
- HoverInsight 12px 间距 bug 已记录到 `docs/插件与后置功能.md` §A，P2 修。

**下一步**：

1. **当前会话不再动手**——loop 接管，按 §22 CP-01 → CP-12 顺序推进。
2. 用户可随时 `/cron list` 查看 loop 状态，或开新会话查看 `docs/世界重制实施进度.md` 的完成清单。
3. loop 完成所有 P0 后会停下并向用户简报；遇到阻塞会标 BLOCKED 停下。

## 9. 世界蓝图重制（2026-04-27）

**当前主线变化**：

- 用户上传了 5 张 FVTT 场景管理截图（场景列表 + 文件夹 + 右键菜单 + 4 页签场景配置弹窗），口述要求把 AAF 场景管理重制成 FVTT 风格，并把"文件夹层级 + 拖拽组织"推广到角色栏等其他面板。
- 用户口述新约束：①GM 选 token → HUD 跟随切换；②怪物 HUD 与角色卡定义绑定（保证同种怪物 HUD 一致）；③玩家可点击左侧队伍栏"部署卡片"切换到部署单位操作，但部署只能在玩家自己的回合，除非有回合外行动能力；④GM/玩家工具栏分层（玩家仅测距，GM 含绘墙/光源/迷雾等）；⑤角色卡字段需对照规则书补全（提示：字段名文件不一定全）。
- 已重写 `docs/世界模板实现蓝图.md`，新增 §9–§18 共 10 节：FVTT 化场景管理、通用文件夹机制、HUD↔角色卡绑定、GM/玩家工具栏分层、角色卡 v3 字段（含战意/技力/AP/物语点/多职业/施法者等级缓存/苦难免疫矩阵/特殊感官/抗性等）、情报系统、反应预设、多职业、苦难等级矩阵、物语点。
- 已生成根目录 `Claude建议.md`，汇集 17 类共 50+ 条 Claude 无法独自决定的设计问题（文件夹数据模型、缩略图生成方式、激活语义、HUD 切换细节、部署单位语义、字段补全清单、情报系统存储、反应预设默认值、多职业字段结构、苦难层数语义、物语点上限/审批、命名对齐等）。**等用户填完再动代码**。

**影响规则 / 接口**：

- 场景管理重写涉及 `Scene` Prisma 模型扩展（folderId/thumbnailUrl/foregroundImageUrl/backgroundColor/config/initialViewport/isActive/navigationName/showInNavigation 等字段，详见蓝图 §9.5），届时需写迁移。
- 通用文件夹机制提供两套方案：A=继续 `folderPath` 字符串；B=独立 `Folder` 表。具体走法待用户填 Q1-1。
- 角色卡 schema 拟升 v3，按现有"三处一致 + bump schemaVersion"硬规则同步 `CharacterSheetExportPayload` + `isCharacterSheetExportPayload` + 导入映射 + 文档记录。一次性 v3 还是分两次（v3 核心数值 + v4 配置/情报）待 Q13-3 答疑。
- HUD 配置存储位置（角色卡级 vs 角色模板级）待 Q4-1 答疑。
- 工具栏入口位置（左侧浮条 / 系统板新标签 / 顶部图标条）待 Q3-1 答疑。

**下一步**：

1. **等待用户填写 `Claude建议.md`**。不动代码。
2. 用户回填后，按答案细化蓝图 §9–§18 的待定项。
3. 同步 `角色卡设计文档.md` 字段表 v3。
4. 按 §21 的 P0 顺序开干（建议从 ScenePanel 重写起步，最直观可验证）。

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

1. ~~Phase 1：舞台组件美化~~ ✅（见下方 9. 段）
2. Phase 2：工具面板美化——SystemPanel / EntityManager / AbilityExecutionPanel / CharacterSheetWorkbench，走"实用密度高"路线。
3. Phase 3：逐组件 polish pass（用 `aaf-component-polish` skill）。
4. Phase 4：用替代主题包（如黑暗）验证 token 覆盖完整性。

## 9. 舞台 Phase 1 完成（2026-04-26）

**当前主线变化**：

- 5 个舞台组件 CSS 全部翻成 JRPG 浅色玻璃 + 金边美学，全部使用 `_contract.css` 语义 token，不再有裸 hex / `var(--jrpg-*)` legacy 引用：
  - **FateClockWidget**（`client/src/world/styles/world-components.css` 段 200–360）：玻璃卡 + 顶部金线 + 橙色 filled 命刻段 + 蓝色 threshold 标尺 + 5 态按钮。
  - **HUDPanel + 队伍简卡**（同文件段 ~715–920）：从浅色直接升级为带蓝→橙顶部光带的玻璃 HUD，resource bar 用 `--accent-danger / --accent-action / --accent-warn / --accent-emphasis` 渐变；hotbar slot 凸雕渐变 + 5 态。
  - **BattleSequenceBar**（同文件段 1–295）：从深色赛博色系完全翻成浅色 frame；当前回合用 `--accent-emphasis` 橙脉冲 ring；补齐 `__frame / __round-hint / __empty / __sequence-cell / __round-divider / __entry--loop-preview` 6 个之前缺失的类；scrollbar 浅蓝化。
  - **HoverInsightCards**（`client/src/styles/index.css` 段 ~8154–8290）：原本浅色但裸 hex；全部上 token；kind 标签做成蓝色短矩形；pinned 用橙色边框；术语 hover 由橙→红强调。
  - **ContextMenu**（`world-components.css` 段 636–790）：从黑色暗弹层完全翻成浅色玻璃；item 加左侧蓝条 + padding 滑动 + 5 态；danger 单独 hover 色；shortcut 做成 keycap。

- 全局 chrome 收口：
  - `border-radius: 999px`（55 处含 2 个 `!important`）→ `var(--radius-pill)` token 化。值仍为 9999px，**视觉去胶囊化**待后续 per-selector 审视。
  - `_contract.css` 加全局 scrollbar 浅蓝默认（Firefox `:root` + Chromium 通配 `::-webkit-scrollbar`），低特异性，不覆盖 43 处已有局部规则。

**影响规则 / 接口**：

- 任何新增舞台组件（含浮窗、HUD、序列条、悬浮卡）必须遵循已落地的玻璃面板 + token + 5 态 + `prefers-reduced-motion` 降级模板，参照上述 5 个组件中的任一个。
- 舞台用 `--mod-fate-* / --mod-hud-*` per-module token；工具面板用 `--mod-panel-* / --mod-sheet-*`；不得交叉混用。
- `--radius-pill` 当前仍 = 9999px，是"胶囊语义"的中转令牌；将来若决定全面改短矩形，只需改契约值或 per-selector 改用 `--radius-sm`。
- 全局 scrollbar 已浅蓝化，新组件不需要再写 scrollbar CSS，除非要颜色变体。

**下一步**：

→ Phase 2：工具面板美化。第一批候选：`SystemPanel`、`EntityManager`、`AbilityExecutionPanel`、`CharacterSheetWorkbench`。规则不同——"实用密度高"，浅色矩形、低装饰、强对齐，玻璃+光晕只属舞台。

## 10. 前端美化 Phase 1–4 收尾（2026-04-27）

**当前主线变化**：

- **Phase 2（工具面板）4/4 完成**：SystemPanel base CSS token 化 + tab 5 态；EntityManager 全段 token 化 + shimmer loading + active 蓝条；AbilityExecutionPanel 全段 token 化 + select 5 态 + 短矩形 tag；CharacterSheetWorkbench action-btn / settings-item 补 5 态 + focus ring（卷轴主题色保留待用户决策）
- **Phase 3（二级组件）4/5 完成 + 1 跳过**：WorldCanvas board/hud/glow/token 全部 token 化 + selected 橙色脉冲；HotkeySettingsPanel 从 legacy `--tool-*` 迁契约 token + recording 脉冲 + kbd 键帽；FloatingToolWindow chrome token 化 + close 5 态；Dialog overlays mask/dialog/close token 化 + scale-in 入场。StoryEventPanel 跳过（Tailwind utility-only，无独立 CSS）
- **Phase 4（dark theme 验证）5/5 完成**：建 `dark-arcane.css` 暗影秘典主题包（深紫深蓝 + 紫色 emphasis 替换 JRPG 橙）；切换并审视：2303 条规则 0 critical leak，4 处渐变端点 hex 是 artistic saturation 不动，12 处 `var(--jrpg-*)` legacy 调用通过别名链正常跟主题；切回亮主题验证 dark pack 未漏入

**影响规则 / 接口**：

- 主题包扩展规范已落 `docs/世界模板实现蓝图.md` §5.1：新增 pack 步骤 + Vite 缓存陷阱 + 切换路径 + 优先级
- 全前端美化遵循统一契约：所有视觉规则用 `_contract.css` 语义 token；舞台用 `--mod-fate-* / --mod-hud-*`，工具面板用 `--mod-panel-* / --mod-sheet-*`；橙色（`--accent-emphasis`）专留强调/选中/危险/关键反馈
- 全局 scrollbar 浅蓝化在 `_contract.css` 末尾（低特异性默认）
- 5 态契约固化：所有交互元素必备 hover / active / focus-visible / disabled，按需 loading。`prefers-reduced-motion` 由 `_contract.css` 全局降级动画 duration

**待办（不阻塞**）：

- 12 处 `var(--jrpg-*)` legacy 调用迁直接 token（body / .app-header / .world-card / .lobby-page 等）
- 54+处 `var(--radius-pill)` 视觉去胶囊化（per-selector 区分长文 chrome vs 数字短 status marker）
- `.world-stage-shell` 11074-11200 暗色 legacy 块清理（已被 11881+ 亮色覆写，是死代码）
- CharacterSheetWorkbench 卷轴主题色调风格冲突（保留 vs 改标准白色工具面板，待用户决策）

**下一步**：

→ 前端美化主线完成，可回到能力深化与 AI 辅助链路（阶段 8 主线）。前端 chrome 已稳定为 token 驱动，新增组件参照 Phase 1–3 任一组件为模板。


## 13. ��Ʒ���л�����2026-04-29��

**Ŀ��**����ҿ���ϵͳҳ �� ��Ʒ�񵯴�һ���л� 6+1 �����⣬������Ч��GM ��Ϊ������Ĭ��/������

**���� 5 �������**��`client/src/styles/themes/`����
- `crimson-dynasty.css` �� ��ɰ���������/�̽�/ī�ڣ������ŵ䣩
- `verdant-forest.css` �� ��Ұ���֣�̦��/�׻�/������ɭϵ��Ȼ��
- `noir-cyber.css` �� �޺��·����/����/Ʒ�죬������ˣ�
- `parchment-quill.css` �� ��Ƥ���ڣ��׻�/��ī/���𣬹ž�ѧ����
- `frost-dawn.css` �� ˪�����⣨����/����/�����ϣ����������

**ע��**��`client/src/lib/theme.ts` �� `THEME_PACKS` ���� swatches/tone �ֶΣ�picker ��Ƭʹ�ã���`client/src/styles/index.css` ���� 6 �� `@import`��5 �� + theme-picker.css����

**UI ����**��
- �½� `client/src/world/components/system/ThemePickerOverlay.tsx`��������ʽ `client/src/styles/theme-picker.css`���� token�����浱ǰ���⣩��
- `WorldPage.tsx`��OverlayState/OverlayDraft ������������ `kind: "theme"`��`renderSystemTab` �ڿ�ݼ���ť��׷�ӡ���Ʒ����ڣ����� `openThemeOverlay` / `renderThemePickerOverlay`��
- ������������ʱ���� `useThemeStore.getState().enterWorld({ worldPack, forcedByGM })`������ worldData �� `themePack` / `themePackForcedByGM`����socket �Ͽ���� cleanup �е��� `leaveWorld()`��

**���ȼ�����ʵ�֣�**��GM ǿ������� > ����Ĭ�ϰ� > ��Ҹ���ƫ�� > ϵͳĬ�� jrpg-bright���߼�ȫ�� `lib/theme.ts:resolveThemePack` �У�picker UI ������д��

**���**��
- Prisma `World` ���� `themePack: String?` �� `themePackForcedByGM: Boolean @default(false)`��
- �� service `worldService.updateWorldThemePack(worldId, userId, input)`���� owner / GM �ɵ��á�
- �� controller `patchWorldTheme` + ·�� `PATCH /api/worlds/:worldId/theme`��
- `WorldDetail` �����Ѵ���ѡ themePack �ֶΣ�ǰ�� detail �ӿ�͸�� `...world` �Զ��ɶ���

**���죨������**��
1. �� `npx prisma migrate dev --name add-world-theme-pack`���û���ִ�У���ǰδ��Ǩ�ƣ�ǰ���� GM д��ʧ��ʱ��Ĭ���˵�����Ԥ������
2. �� `world:theme:update` socket �¼��� GM �Ķ���㲥�����г�Ա�����������ͻ��� `enterWorld()` ʵʱͬ������ǰͬһ���������Ч������������¼������磩��
3. ��Ҹ���ƫ����ͨ�� zustand persist д localStorage��key `theme-storage`���������˺ż����豸ͬ�����ټ� `User.preferences` JSON �ֶΡ�


## 14. 默认方案打磨期约定（2026-04-29）

**用户明确要求**：当前阶段只反复打磨默认方案 `jrpg-bright`（碧空圣典）。每次 token 增删改 / 结构调整时：

- ✅ **必须同步** `docs/modules/11-theming-system.md` 的「2. Token 契约」与「替代方案待同步清单（pending sync）」，方便日后一次性补齐 5 套替代方案。
- ❌ **不要主动改** `crimson-dynasty / verdant-forest / noir-cyber / parchment-quill / frost-dawn / dark-arcane` 这 6 套 CSS（也包括 `theme-picker.css` 里跟方案无关的部分别动）。
- 仅当用户说「同步五套设计方案」或类似指令时，才按 `pending sync` 清单一次性扫所有 `[data-theme="..."]` 块。

**修复 PostCSS 报错**：`client/src/styles/index.css:9018` 之前是 `content: "可拖�?;`（编码事故，丢了闭合 `"`），PostCSS 因此把后续大段内容当未闭合字符串吞掉，报到 `index.css:13665:44`。已改为 `content: "可拖动";`。日后若再遇 "Unclosed string"，按 11-theming-system.md §9 的 PowerShell 脚本逐行扫双引号成对性最快。

## 15. 世界页重构策略转向（2026-04-30）

**背景**：原计划 A0「index.css token 大扫除」探查后发现 14k 行里有 662 hex + 1308 rgba，硬替换成本极高、风险大、且只解决「未来能换主题」不解决「现在 UI 难看」。**用户真正诉求**是"重构掉旧的臃肿前端"。

**新策略 — 组件级重写，逐个迁移**：

1. 每完成一个组件，把它在 index.css 里的旧定义全部删掉。
2. 新 CSS 落到组件就近的 client/src/world/styles/world-components.css 末尾或独立模块文件，**100% token 驱动**。
3. 完成一个组件 = 该组件立即可换主题 + 视觉对齐碧空圣典稿子 + index.css 自然瘦身。
4. 老的 .world-stage-shell .X 跨主题覆盖层不一定要立刻清，先专注组件本体。

**A1 已完成（2026-04-30）**：命刻枢纽 .world-fixed-gauge / __ring / __center。index.css 三处旧定义（line ~10085 / ~11569 / ~12339）已删除并替换为注释指针；新 CSS 在 world-components.css 末尾，使用 ar(--mod-fate-accent) + color-mix() 驱动鎏金外缘 + 内圈虚线 + 中心烫金数字。
pm run build -w client 通过。

**A 系列进度**：见 docs/modules/11-theming-system.md §5「A 系列重构进度」表格。

## ��15.2 A2 BattleSequenceBar ��ɣ������غ��� + �ȹ��б��

- �� \client/src/styles/index.css\ �� 7487-7783 ���Σ�41 ��ѡ���� + ��ǰ�غ� keyframes����ɾ�����滻Ϊռλע�͡�
- �� \client/src/world/styles/world-components.css\ BattleSequenceBar �Σ�Լ 360 �У�ȫ����д���ںϣ�
  - �ɰ漸�Σ�\position: fixed\ + ��̨���� \--stage-pad/--left-stack-w/--edge-gap/--sys-panel-w/--battle-bar-h/--battle-card-w/h\��
  - grid frame �������֣�\minmax(92px,128px) | 1fr | auto\`r
  - entry �ڲ� grid��avatar / info��HP �� + tags �þ��Զ�λ����Ƭ��/����
  - \__entry--current::before\ ������� + scale(1.14) �Ŵ�
- ��ɫȫ token ������ɫ \ar(--mod-fate-accent)\��������������������Ŧͬɫ���壩���� \ar(--accent-action)\ / \ar(--accent-success)\ / \ar(--accent-danger)\����͸��ȫ���� \color-mix(in srgb, var(--token) N%, transparent)\��
- ��Ӧʽ media query��\index.css\ 12522 / 12565������ �� ������ grid-template-columns �� round �ֺţ����� grid ���ݡ�
- \
pm run build -w client\ ͨ����4.01s��CSS 342.66 kB����

## ��15.3 A3 ��� �� HUDPanel/ActionBar

- world-components.css HUD �Σ�868-1217 �� ~350 �У�ȫ��Ӳ������ɫ���㣺��������char-level ���¡�������Դ����䡢slot Ĭ��/hover/empty��tab-btn hover/active��tab-content��mode-toggle ȫ��ת ar(--mod-hud-accent) / ar(--mod-fate-accent) / ar(--accent-action) / ar(--accent-danger) / ar(--accent-warn) / ar(--surface-card) + color-mix(in srgb, ..., transparent)��#b91c1c #b88708 #ffffff gba(...) ȫ����ʧ��
- ɾ�� index.css ���� .world-stage-shell .hud-panel* ����Ӳ���븲�ǣ�ԭ��ɫ����� 11638-11685��dark-arcane �����+ ��ɫ�� 12173-12208��jrpg-bright �����ʵ�֣���HUD ����ȫ��������������ٱ� stage-shell ǿ�Ƹ��ǡ�
- --hud-panel-h ��̨������line 7465 + media queries 12219/12267������ �� �����Ƹ߶ȣ����ƻ����⡣
- ����ͨ�� 4.22s��CSS 341.92 kB��A2 �� 342.66 kB �� -0.74 kB����
- ���ȣ�A1 ? A2 ? A3 ? �� A4/A5/A6 ?��


## ��15.4 A4 ������� �� ����״̬�� + ������ҿ��������飩

- index.css �����飨9821-10210���漰 .world-fixed-bottom-left-rect / .world-online-list*��4 ���ӳٻ��� is-good/is-warn/is-bad/is-unknown��/ .world-stage-empty / .world-stage-party-title / .world-stage-party-row.is-active / .world-stage-party-card ȫ�� + .__head/__bars ��Ԫ�أ�ȫ��Ӳ���� hex/rgba �滻Ϊ var(--accent-action) / var(--accent-success) / var(--accent-warn) / var(--accent-danger) / var(--mod-fate-accent) / var(--surface-card) / var(--text-secondary) / var(--text-muted) + color-mix(in srgb, ..., transparent)��
- 4 ���ӳٻ���ͳһ��Ϊ 'token + color-mix' �ṹ������ 22-24% / �߿� 38-50% / ���� mix to #000 70-80%�������Ϊ�̻ƺ������ɹ�/����/Σ��/��������
- .world-stage-shell ���϶��า�ǣ�party-card �� battle-slot / scene-stage / role-card �����ѡ������11078 / 11236 / 11794 / 11947 �ȣ����� �� �� A5 / A6 ��ɺ���ͳһ�������Ρ�
- ����ͨ�� 4.12s��CSS 343.12 kB��A3 �� 341.92 kB �� +1.20 kB���� color-mix ����չ����
- ���ȣ�A1 ? A2 ? A3 ? A4 ??�������飩 �� A5 / A6 ?��


## ��15.5 A5 ������� �� ���㣨���쿨 + ��������̨��

- index.css 8060-8230 .hover-insight-card ȫ�Σ�˫����߹� (rgba(245,158,11,.14)/rgba(47,198,255,.14)) �� color-mix(var(--accent-emphasis)/var(--accent-action) 14%)���ײ㽥�� (rgba(255,255,255,.98)��rgba(244,249,255,.96)) �� var(--surface-card) + color-mix(var(--accent-action-soft) 8%, surface-card)��is-pinned ��� / __head span ���� (action 12%/28%) / __head em ���� (emphasis 14%/36%) / __meta span ��͸���׵� / .hover-insight-term �»���ɫ (emphasis 55%) ȫ�� token ����
- index.css 10215-10395 .world-ability-exec��__field select (surface-card 92%) / __summary (surface-card 70%) / __meta span / __facts span / __tag (action 14%/32%) / __result (surface-card 85%) / __result-card (surface-card) + :hover ��Ӱ (action 18%) ȫ�� token ����
- Ʈ�ֲ㣨�˺� / ״̬���֣�Ŀǰǰ����δʵװΪ������� �� ���ڽ������������ม�� (���쿨 + ����̨)���������Ʈ��ֱ�Ӹ��� var(--accent-success) / var(--accent-danger) / var(--accent-warn) ���ɡ�
- ����ͨ�� 4.05s��CSS 343.84 kB��A4 �� 343.12 kB �� +0.72 kB����
- ���ȣ�A1 ? A2 ? A3 ? A4 ?? A5 ?? �� A6 ? �� A-final ? �� B2 ?��


## ��15.6 A6 ������� �� �������� + ����ͼ��

- index.css 7553-7670 .world-fixed-system-tab*: Ĭ�ϵ�ɫ (rgba(255,255,255,.85)) �� color-mix(var(--surface-card) 85%); hover (rgba(232,243,255,.95)) �� color-mix(var(--accent-action-soft) 18%, surface-card); is-active (rgba(225,240,255,.95) + box-shadow rgba(18,116,255,.12)) �� color-mix(var(--accent-action) 14%, surface-card) + color-mix(var(--accent-action) 18%); .world-fixed-system-tab-page (rgba(255,255,255,.7)) / __head (rgba(255,255,255,.55)) �� surface-card 70/55%��
- 4 �� tab-page__view radial ����ӳ������ɫ��chat �� var(--accent-action) 16%; battle �� var(--accent-danger) 16%; scene �� var(--accent-success) 14%; system �� var(--accent-action) 12% + var(--accent-emphasis) 10% ˫��������� ��/ů��/ǳ�� �� ����/Σ��/�ɹ� token�������л���������档
- index.css 9920-10024 .world-stage-header-copy span / -btn / -btn:hover (#5d7da7 / rgba(96,138,198,.34) / rgba(246,251,255,.98) / rgba(232,243,255,.95) / #1f4f8d / rgba(63,111,183,.46) / rgba(21,63,127,.16)) �� text-secondary / accent-action 34-46% / surface-card + accent-action-soft 14% / accent-action / 22%��
- ����������ʾ��ȫ�� token ����.world-stage-alert (Σ�պ� �� accent-danger 8/40/22% + ���� mix #000 80%); .world-gm-view-banner + ��Ƕ��ť (�̽�� �� accent-emphasis 12/22/36/50% + mix #000 80%); .world-fixed-hud__panel span (#4f6f9c �� text-secondary)��
- .world-refactor-top-back + .world-refactor-scene-banner (#edf6ff/#ffffff/#12458d/#0f4f9f/rgba(96,151,228,.45)/rgba(118,162,231,.6)) �� accent-action 22-50% + accent-action-soft + surface-card��
- ����ͨ�� 4.26s; CSS 345.50 kB (A5 �� 343.84 kB �� +1.66 kB)��
- ����: A1 ? A2 ? A3 ? A4 ?? A5 ?? A6 ?? �� A-final ? �� B2 ? �� 5 ��ͬ�� FROZEN��


## ��15.7 A-final ��һ�׶� �� .world-stage-shell --world-* �Žӵ� token

- Ŀ�꣺�� [data-theme=...] �л���͸�� .world-stage-shell .X ���ϸ��ǲ���Ч������������д 700+ ��Ӳ���� rgba��
- �Ķ� 1��index.css 10905-10974 ��ɫ .world-stage-shell + --gm/--assistant/--player/--observer (Ӳ���� #79b8ff / #f0c57a / 4 ��ɫ hex + linear-gradient ��ҹ 4 ��) �� ȫ��ӳ�䵽 var(--accent-action) / var(--accent-action-soft) / var(--accent-emphasis) / var(--accent-success) / var(--text-secondary) / var(--accent-warn) / var(--surface-card) / var(--surface-card-border) / var(--text-primary) / var(--text-secondary) / var(--surface-stage-bg) + color-mix(... transparent)��
- �Ķ� 2��index.css 11640-11703 ��ɫ .world-stage-shell ��ͬ���Žӣ�--world-panel/--panel-strong/--panel-soft/--panel-border/--shadow/--text/--text-soft/--text-muted ȫ���� token�������� stage ���� radial + var(--surface-stage-bg)��
- Ч�����ײ� .world-stage-shell .world-fixed-battle-bar { border-color: var(--world-panel-border); ... } �����������������Զ������������Ӳ���� rgba ֻʣ���� selector �ڲ����䣨�Ӿ�ϸ�ڣ���Ϊ�����
- ����ͨ�� 4.23s; CSS 346.99 kB (+1.49 kB)��
- ����: A1 ? A2 ? A3 ? A4 ?? A5 ?? A6 ?? A-final-1 ?? �� A-final-2 (���� rgba ϸ����ɨ) ? �� B2 ? �� 5 ��ͬ�� FROZEN��


## §15.8 B2 IndexedDB 资源缓存层

- 用户原始需求：前端资源缓存本地，仅规则结算/token 移动/数值变动才让后端下发同步。
- 落点：新增 client/src/world/lib/worldCache.ts（原生 IndexedDB 薄封装，未引入 idb 依赖；DB=aaf-world-cache，store=entities，key=worldId:type，value={items, ts, version}）。
- 改造 client/src/world/stores/worldEntityStore.ts：loadEntities 走 stale-while-revalidate（先 cacheGet 即时渲染->网络拉取->cachePut 写回，且仅在 id 集合或 JSON 序列化不一致时落盘）；createEntity/updateEntity/deleteEntity/advanceFateClock 同步 cachePut 写穿透；importPack 后 cacheInvalidateWorld(worldId) 全失效 8 类缓存；网络失败保留旧缓存数据。
- 8 类资源类型：abilities/races/professions/backgrounds/items/fateClocks/decks/randomTables。
- 健壮性：indexedDB 不存在或 open 失败时返回 null，所有 cache* API 静默降级，不影响主流程。
- 构建通过 4.05s；JS +1.78 kB；CSS 不变。
- 进度：A1-A6+A-final-1 OK；B2 OK；A-final-2 单行 rgba 渐变 待办（可选）；5 套替代主题同步 FROZEN（gated on 用户口令 "同步五套"）。


## ��15.8 B2 IndexedDB ��Դ�����

- ��㣺���� client/src/world/lib/worldCache.ts��ԭ�� IndexedDB ����װ��δ���� idb ������DB=aaf-world-cache��store=entities��key=worldId:type��value={items,ts,version}����
- ���� worldEntityStore.ts��loadEntities �� stale-while-revalidate��CRUD д��͸��importPack �� cacheInvalidateWorld ȫʧЧ 8 �໺�棻����ʧ�ܱ���ɻ��档
- 8 ����Դ��abilities/races/professions/backgrounds/items/fateClocks/decks/randomTables��
- ��׳�ԣ�indexedDB �����ڻ� open ʧ��ʱ��Ĭ������cache* ���� null/false������Ӱ�������̡�
- ����ͨ�� 4.05s��JS +1.78 kB��CSS ���䡣
- ���ȣ�A1-A6+A-final-1 OK��B2 OK��A-final-2 ���� rgba ���� ��ѡ���죻5 ���������ͬ�� FROZEN��


## §15.9 A-final-2 + Mockup 对齐迭代（本次）

- 用户授权"自行迭代一口气做完"，在前序 token 化基础上做最后一公里 mockup 视觉对齐。
- A-final-2 完成三段 token 化清扫：
  - bright (index.css 11704-11832)
  - dark (10987-11635 共 9 段)
  - board-overlay (.world-board::before/::after/__hud/__glow--one/--two + .world-system-overlay-dialog__close)
  - 全部硬编码 rgba(245,158,11,…) / rgba(18,116,255,…) 等替换为 color-mix(in srgb, var(--accent-emphasis) X%, transparent) / var(--accent-action) 形式。
- 主题契约校核：7 套主题包（jrpg-bright/frost-dawn/dark-arcane/crimson-dynasty/noir-cyber/parchment-quill/verdant-forest）覆盖全部 34 个核心 token，PowerShell 循环逐一验证 34/34 通过。
- 创建差距清单 docs/modules/12-mockup-gap.md：列出 mockup vs 现有的 7 类组件差距与重写优先级，标记本次 commit 范围与后续待办。
- 实质组件改动：
  - FateClockWidget DOM 重构为 mockup 风 .fate-dial：移除 SVG 内 text，改 .fate-clock__dial 容器 + .fate-clock__dial-inner（中心 30px 大数字 + small 分母 + 章节名）+ .fate-clock__label-cn 顶部"命 运 刻 度"间距字。CSS 加 132×132 圆环 + 内陷金属圈光泽（::before 径向渐变 + 双层 box-shadow）+ 金色 inset 边。
  - BattleSequenceBar 经核查已达 mockup 等价：fixed 顶部居中 / 当前卡 scale(1.14) + battleSeqCurrentGlow 1.6s pulse / 立绘卡 ↻ 分割条 / 金色 round 区 / scrollIntoView 居中。无需重写。
- 构建通过 4.15s；CSS 351.86 kB（+2 kB）；JS 不变。
- 进度：A1-A6 + A-final-1/2 + B2 + 主题契约 + mockup 对齐 全部 OK。
- 后续待办（写入 12-mockup-gap.md §3）：HUDPanel 嵌入式重塑 / PartyPanel + OnlinePanel 新建 / sys-panel tab 视觉 / float-win + tool-fab + dmg-float 演出层（与 aaf-combat-fx skill 路径协同）。


## §15.9 A-final-2 + Mockup 对齐迭代

- 用户授权自行迭代，在前序 token 化基础上做 mockup 视觉对齐收尾。
- A-final-2 完成三段 token 化清扫：bright (index.css 11704-11832)、dark (10987-11635 共 9 段)、board-overlay (.world-board::before/::after/__hud/__glow--one/--two + .world-system-overlay-dialog__close)。所有硬编码 rgba(...) 替换为 color-mix(in srgb, var(--accent-emphasis) X%, transparent) 形式。
- 主题契约校核：7 套主题包覆盖全部 34 个核心 token，逐一验证 34/34。
- 创建差距清单 docs/modules/12-mockup-gap.md：列出 mockup vs 现有的 7 类组件差距与重写优先级。
- FateClockWidget 重构 DOM：移除 SVG 内 text，改 .fate-clock__dial 容器（132×132 圆环）+ .fate-clock__dial-inner（中心 30px 大数字 + small 分母 + 章节名）+ .fate-clock__label-cn 顶部间距字。CSS 加内陷金属圈光泽（::before 径向渐变 + 双层 box-shadow + 金色 inset 边）。
- BattleSequenceBar 经核查已达 mockup 等价：fixed 顶部居中 / 当前卡 scale(1.14) + battleSeqCurrentGlow 1.6s pulse / 立绘卡 + ↻ 分割条 / 金色 round 区 / scrollIntoView 居中。无需重写。
- 构建通过 4.15s；CSS 351.86 kB。
- 后续待办：HUDPanel 嵌入式重塑 / PartyPanel + OnlinePanel 新建 / sys-panel tab 视觉 / float-win + tool-fab + dmg-float 演出层（详见 12-mockup-gap.md §3）。

## 15.9 A-final-2 + Mockup duiqi

- Token cleanup A-final-2 done (bright/dark/board-overlay), all rgba replaced with color-mix.
- Theme contract: 7 packs all 34/34 verified.
- Created docs/modules/12-mockup-gap.md (gap list).
- FateClockWidget DOM rewrite: 132x132 dial ring + 30px center number + chapter name + label-cn header.
- BattleSequenceBar checked: already mockup-equivalent (fixed top, current pulse, scale 1.14, ↻ divider). No rewrite needed.
- Build: 4.15s, CSS 351.86 kB.
- TODO: HUDPanel inline reshape / PartyPanel + OnlinePanel new build / sys-panel tabs / float-win + tool-fab + dmg-float (per 12-mockup-gap.md sec 3).


## 15.10 Mockup-aligned PartyPanel + OnlinePanel JSX rebuild (post-git-backup iteration)

After user provided git backup, made bounded JSX changes to two left-rail panels (still WorldPage.tsx inline render, no extraction yet):

1. **PartyPanel `.world-stage-party-card`**: rebuilt as `display: grid; grid-template-columns: 32px 1fr` with new `__avatar` (32px circle, primary->fate gradient bg, white initial letter, active state shifts to gold) and `__body` wrapper around existing head/p/bars. Mockup signature 3px primary `border-left` + hover translateY(-1px) + `is-active` switches border-left to gold + adds 28% gold ambient shadow.

2. **OnlinePanel `.world-online-list__row`**: replaced text latency chip with mockup-style 4-bar ping component (`__ping` + `__ping-text`). 4 `<i>` bars at 30/55/80/100% heights; colors via `is-good`/`is-warn`/`is-bad`/`is-unknown` map to accent-success/warn/danger/text-secondary tokens. `is-bad` greys out the top 2 bars per mockup spec.

Build verified: 4.20s OK, CSS 355.00 kB (+1.6 kB from 353.96 kB after ping bars, then no growth from avatar restructure due to grid replacing prior gap layout).

Updated `docs/modules/12-mockup-gap.md` §2.4/2.5 to mark these as done; remaining deferred items: HUDPanel embedded reshape, `.pc-deploy` deployed creature sub-card, sys-panel tab visual alignment, float-win/tool-fab/dmg-float FX layer.


## 15.10 Mockup-aligned PartyPanel + OnlinePanel JSX rebuild (post-git-backup iteration)

After user provided git backup, made bounded JSX changes to two left-rail panels (still WorldPage.tsx inline render, no extraction yet):

1. **PartyPanel `.world-stage-party-card`**: rebuilt as `display: grid; grid-template-columns: 32px 1fr` with new `__avatar` (32px circle, primary->fate gradient bg, white initial letter, active state shifts to gold) and `__body` wrapper around existing head/p/bars. Mockup signature 3px primary `border-left` + hover translateY(-1px) + `is-active` switches border-left to gold + adds 28% gold ambient shadow.

2. **OnlinePanel `.world-online-list__row`**: replaced text latency chip with mockup-style 4-bar ping component (`__ping` + `__ping-text`). 4 `<i>` bars at 30/55/80/100% heights; colors via `is-good`/`is-warn`/`is-bad`/`is-unknown` map to accent-success/warn/danger/text-secondary tokens. `is-bad` greys out the top 2 bars per mockup spec.

Build verified: 4.20s OK, CSS 355.00 kB (+1.6 kB from 353.96 kB after ping bars, then no growth from avatar restructure due to grid replacing prior gap layout).

Updated `docs/modules/12-mockup-gap.md` §2.4/2.5 to mark these as done; remaining deferred items: HUDPanel embedded reshape, `.pc-deploy` deployed creature sub-card, sys-panel tab visual alignment, float-win/tool-fab/dmg-float FX layer.


## 15.11 HUDPanel avatar (torch-trophy embedded look)

Continued mockup alignment after PartyPanel/OnlinePanel:

- HUDPanel.tsx: prepended new `.hud-panel__avatar` JSX node (always rendered, hidden via empty initial when no character) with `__avatar-initial` (uppercase first letter or middle dot) and optional `__avatar-level` Lv badge that overlays the avatar bottom edge.
- world-components.css: added 64px circular avatar with HUD-blue->fate-gold radial+linear gradient, double ring (2px solid + 1px outer ring via ::after), inset highlight + drop shadow + 4px surface-card outer halo creating "embedded socket" feel; Lv badge as gold pill overlapping avatar bottom.
- Build 3.98s OK, CSS 356.51 kB.
- gap doc 2.3 updated: avatar visual landed; deferred = drag-to-float + 4x10 general-mode grid slots (functional layer).

Files: client/src/world/components/HUDPanel.tsx (lines 76-83), client/src/world/styles/world-components.css (after .hud-panel__resources block).


## 15.11 HUDPanel avatar (torch-trophy embedded look)

Continued mockup alignment after PartyPanel/OnlinePanel:

- HUDPanel.tsx: prepended new `.hud-panel__avatar` JSX node (always rendered, hidden via empty initial when no character) with `__avatar-initial` (uppercase first letter or middle dot) and optional `__avatar-level` Lv badge that overlays the avatar bottom edge.
- world-components.css: added 64px circular avatar with HUD-blue->fate-gold radial+linear gradient, double ring (2px solid + 1px outer ring via ::after), inset highlight + drop shadow + 4px surface-card outer halo creating "embedded socket" feel; Lv badge as gold pill overlapping avatar bottom.
- Build 3.98s OK, CSS 356.51 kB.
- gap doc 2.3 updated: avatar visual landed; deferred = drag-to-float + 4x10 general-mode grid slots (functional layer).

Files: client/src/world/components/HUDPanel.tsx (lines 76-83), client/src/world/styles/world-components.css (after .hud-panel__resources block).


## 15.12 sys-tab 1:1 + badge dot + FX layer skeleton (batch close-out)

User asked to do remaining items in one shot. Closed all four mockup deferred groups in this commit:

1. **sys-tab visual close**: `.world-fixed-system-tab` got `aspect-ratio: 1/1` to enforce mockup-style 1:1 squares; added font-weight/letter-spacing baseline; added two badge mechanisms — `<span class="world-fixed-system-tab__badge">N</span>` child element OR `data-badge="N"` attribute via `::after`. Both render gold-on-danger-red pill at top-right with surface-card halo so it looks embedded.

2. **FX layer CSS skeleton (in world-components.css after channel-edit-pane block)** — ready for JSX wire-up later:
   - `.world-aoe` 180px dashed gold circle, `data-label` attr → tag pill (mockup `.aoe::after` "火焰风暴 · 半径 6 格" pattern)
   - `.world-dmg-float` + `__num/__tag`, with `--heal/--miss` variants; `worldDmgFloat` 1.1s keyframes (translateY -52px + scale 0.8→1.15→1→0.95)
   - `.world-float-win` + `__header/__body/__close` with grab cursor, 280px gold-headed window
   - `.world-tool-fab` 52px circle with `is-dragging`/`is-open` (gold ↔ blue) states

3. **gap doc 2.6/2.7/§3 updated**: marked sys-tab + FX skeleton ✅; deferred items now narrowed to PartyPanel `.pc-deploy`, HUD drag/4×10 grid, res-tree caret/tag colors, and FX trigger JSX (settlement → dmg-float injection).

4. **Build 4.27s OK, CSS 361.25 kB** (+4.74 kB total this batch).

Mockup HUD/PartyPanel/OnlinePanel/sys-tab/FX all now have visual parity at the CSS layer. Remaining work is feature/data integration, not visual.

PowerShell heredoc note: when appending Chinese-content blocks the `@'...'@ | Add-Content` pattern double-fired in this session (first heredoc auto-executed before explicit Add-Content). Used `[System.IO.File]::ReadAllText` + IndexOf/LastIndexOf to dedupe. For future appends prefer single Add-Content invocation, NOT chained.

## 15.13 Mockup polish pass (title/stage/tabs/dead-css cleanup)

User switched from Copilot to Kiro for final mockup alignment polish. Completed 4 visual refinements + dead CSS cleanup:

1. **Title bar Cinzel letter-spacing**: `.title-left strong` letter-spacing from `.06em` → `.28em` to match mockup serif font visual weight (world-shell.css L225-229).

2. **Stage sky gradient + grid**: `.stage-canvas` added radial ellipse sky gradient + 48px golden grid lines via repeating-linear-gradient (world-shell.css L277-282).

3. **HUD clip-path**: verified existing `--hud-clip` SVG path already matches mockup notch design (world-shell.css L711-738), no change needed.

4. **Right-rail 6 tab icons**: replaced single-letter labels with lucide-react icons (MessageSquare/Swords/MapIcon/User/Package/Settings). Fixed Map → MapIcon naming conflict with JS built-in Map constructor (WorldPage.tsx L3, L337, L3693-3702).

5. **Dead CSS cleanup**: removed `world-fixed-*` legacy rules (index.css L7488-10036, ~2500 lines) that only existed in WorldPage.legacy.tsx.bak backup, not used by current WorldPage.tsx.

Build verified 5.50s OK. Updated `docs/modules/12-mockup-gap.md` §3 to mark these items complete. All visual components now match mockup design at CSS layer; remaining work is functional integration (HUD drag, 4×10 grid slots, res-tree interactions, FX triggers).

Files: [client/src/world/styles/world-shell.css](client/src/world/styles/world-shell.css), [client/src/pages/world/WorldPage.tsx](client/src/pages/world/WorldPage.tsx), [client/src/styles/index.css](client/src/styles/index.css).
