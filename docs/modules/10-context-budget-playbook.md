# 10 上下文预算流程

## 目标

把每次任务的读取范围压到最小，让开发能持续推进，不因为上下文窗口塞满而反复丢记忆。

## 标准流程

1. 读 `docs/modules/README.md`。
2. 根据任务选择 1 个主模块文档。
3. 如果任务跨模块，只补 1 个依赖模块文档。
4. 只打开模块文档列出的入口文件。
5. 搜索时优先限定目录或文件名，不从仓库根部泛搜。
6. 修改后更新对应模块文档和必要的总蓝图。
7. 提交前跑模块对应的最小验证。

## 并发 AI 工作流

1. 开始前运行 `git status --short --branch`，确认当前 worktree 是否干净。
2. 选择一个主模块并只写该模块入口文件；必须跨模块时，先说明依赖模块和共享契约变更点。
3. 跨前后端或持久化字段先改 `09` 共享契约，再改 UI / service / route，避免不同 AI 各自发明字段。
4. 世界页面只负责装配。新增功能应先落在模块组件、hook、store 或 service，再由 `WorldPage.tsx` 接一层薄入口。
5. 完成后更新模块卡片的约定、待拆分点或验证项，让下一位 AI 不需要重新猜边界。

## 反硬编码检查

- Tab、覆盖层、资源类型、规则节点、动作类型、权限入口优先集中到 registry/config，再由组件渲染。
- 同一字符串字面量如果同时出现在 client、server、shared，优先提升到 shared 类型、常量或明确的映射表。
- 资源模板新增类型时，至少检查 `EntityType`、API path、route/service、Prisma schema、导入导出、模块文档。
- 规则结算新增能力效果时优先扩展数据表达式，不把职业名、能力名或特殊效果写死在 service。
- CSS 颜色、圆角、阴影、动效走主题 token；组件级样式就近放置，避免继续堆进全局大文件。

## 分支清理纪律

- 可以自动删除：已合并到 `main`、没有关联 worktree、没有未提交文件的本地旧分支。
- 不自动删除：当前分支、`main`、远端共享分支、脏 worktree、含未跟踪文件的 worktree、未合并提交。
- 删除前先看 `git branch --merged main`、`git worktree list --porcelain` 和目标 worktree 的 `git status --short`。
- 远端 prune 或远端分支删除失败时，不要改用强删；报告失败原因即可。

## 任务到模块的快速映射

- “UI 丑、布局、HUD、舞台”：`01`。
- “系统板太长、弹窗、右键菜单、藏 UI”：`02`。
- “职业/能力/物品编辑器、资源包、分类”：`03`。
- “规则不对、检定、动作、伤害、效果”：`04`。
- “GM/玩家差异、角色权限、角色卡”：`05`。
- “地图、棋子、战斗序列、Socket”：`06`。
- “生活职业、制造、组件网格”：`07`。
- “大厅、登录、社交”：`08`。
- “字段、Prisma、类型、接口”：`09`。

## 搜索纪律

- 优先使用模块入口文件。
- 如果必须搜索，用限定路径，例如 `client/src/world/components/system`。
- 不要用根目录全文搜索规则书、dist、node_modules、tmp。
- 不要把 `规则书.txt` 全文读入上下文；需要规则时优先读规则规格文档。

## 验证纪律

- 纯文档改动：可用 `git diff --check`。
- 前端模块：`npm run build -w client`。
- 后端模块：`npm run build -w server`。
- 权限、结算、Socket、API：`npm test -w server`。
- Prisma 改动：`npm run prisma:generate -w server`，必要时 `npm run prisma:deploy -w server`。
