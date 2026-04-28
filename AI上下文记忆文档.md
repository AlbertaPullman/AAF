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

1. Phase 1：舞台组件美化——FateClockWidget / HUDPanel / BattleSequenceBar / HoverInsightCards / ContextMenu，去除胶囊形状（共 29 处 `border-radius: 9999px`），改成 JRPG 菜单按钮形态。
2. Phase 2：工具面板美化——SystemPanel / EntityManager / AbilityExecutionPanel / CharacterSheetWorkbench，走"实用密度高"路线。
3. Phase 3：逐组件 polish pass（用 `aaf-component-polish` skill）。
4. Phase 4：用替代主题包（如黑暗）验证 token 覆盖完整性。
