# 03 资源模板库

## 职责

资源模板库支撑零代码自定义：GM 可以可视化创建职业、种族、背景、能力、物品、命刻、牌组、随机表，并用多级分类维护素材库。

## 入口文件

- `client/src/world/components/system/EntityManager.tsx`
- `client/src/world/components/system/EntityVisualEditors.tsx`
- `client/src/world/components/system/CollectionPackPanel.tsx`
- `client/src/pages/system/AbilityLabPage.tsx`
- `client/src/world/stores/worldEntityStore.ts`
- `server/src/services/world-entity.service.ts`
- `server/src/routes/world.routes.ts`
- `shared/types/world-entities.ts`
- `server/prisma/schema.prisma`
- `docs/世界资源包-JSON导入指南.md`

## 当前约定

- 能力编辑器的自动化配置必须映射到 `AbilityAutomationConfig`，并以中文选项呈现 `manual` / `assisted` / `full`、目标确认、自动掷骰、自动应用伤害、自动应用效果等字段；不要在编辑器里另建一套与 workflow 无关的自动化字段。
- `AbilityDefinition.automation` 是能力模板的持久化字段：Prisma、service create/update、合集包导入导出和可视化编辑器都必须同步透传。
- 能力库中的公式、DC、状态分类和触发器仍从 shared registry/config 读取；执行时由 `AbilityWorkflowRun` 记录每次结算是否只是预览、等待确认或已经实际应用。
- 模板库页面只展示分类树和条目摘要。
- 模板库外层必须吃满弹窗宽度；桌面端分类树保持约 168-196px 窄列，条目区占满剩余空间。条目应使用完整行列表，不使用小卡片网格，避免单条数据漂在左上角。
- 分类栏底部工具区使用紧凑纵向排布，输入框和按钮必须完整占满栏宽，避免在窄列里被横向挤压变形。
- 双击条目才打开详细编辑器。
- 资源库窗口允许多开；详情编辑器也不使用遮罩或点击外部关闭，而是在当前资源库中以更窄的非模态工具窗浮出，避免阻断跨库拖拽。
- 资源条目应接入公共悬浮说明卡：鼠标悬停约 1 秒显示简介，持续悬停约 3 秒固定；说明卡文本中的能力、状态、资源词条可继续嵌套展开。
- 编辑器使用 `展示文本 / 规则结算 / 高级数据` 页签。
- `folderPath` 是当前多级分类字段，使用 `/` 分隔。
- 玩家可读描述和 GM 结算配置必须拆开。
- 检定方式要驱动字段显隐：攻击、豁免、对抗各自显示必要字段。
- 能力编辑器的触发条件、DC、状态和状态分类必须优先使用 shared registry 的中文选项；GM 不应被迫手写公式路径。当前初版入口在右侧系统板“能力库”页签，并复用能力/种族/职业模板库弹窗。
- 能力系统实验页 `/system/ability-lab/:worldId?` 复用 `EntityManager` 作为中央工作区，右侧系统板提供能力/物品/随机/资源包入口；分类创建仍由 `EntityManager` 的 `folderPath` 空分类机制维护，避免在测试页另造一套目录模型。
- 状态选择必须区分 `定身 / 干扰 / 其他状态 / 效果标记` 分类；解除或免疫分类时表示命中该分类下任一状态。
- 资源类型、标签、API 路径、编辑器 schema 应逐步收敛到集中 registry/config。新增类型时不要只在 `EntityManager.tsx` 加一个局部分支，必须同步 shared 类型、store、route/service、Prisma、导入导出和文档。
- **本地缓存（B2）**：`worldEntityStore.loadEntities` 走 stale-while-revalidate — 先从 IndexedDB 读到缓存即时渲染，再向 `/worlds/:id/{type}` 发请求，差异时更新 store 并写回缓存。`createEntity / updateEntity / deleteEntity / advanceFateClock` 同步写穿透；`importPack` 调用 `cacheInvalidateWorld(worldId)` 失效全部 8 类缓存。缓存失败（无 IndexedDB / 浏览器隐私模式）静默回退到纯网络模式，不影响主流程。缓存层文件：`client/src/world/lib/worldCache.ts`。

## 常见任务定位

- 改资源列表/分类/双击行为：只看 `EntityManager.tsx`。
- 改具体职业/能力/物品可视化字段：看 `EntityVisualEditors.tsx`。
- 改资源 API 或导入导出：看 `worldEntityStore.ts`、`world-entity.service.ts`、`world.routes.ts`。
- 改字段落库：看 `schema.prisma`、迁移、`shared/types/world-entities.ts`。

## 待拆分点

- `EntityManager.tsx` 同时承载标签、字段 schema、列表行为和编辑器分发；后续应拆出 `entityRegistry` / `entitySchemas`，让新增资源类型变成注册配置而不是修改巨型组件。
- `world-entity.service.ts` 仍按资源类型重复 CRUD 字段映射；后续可先提取通用权限、排序、folderPath、导入导出适配层，再逐类迁移，避免一次性大重构影响并发任务。

## 验证

- 前端：`npm run build -w client`。
- 后端字段/API：`npm run prisma:generate -w server`、`npm run build -w server`、必要时 `npm test -w server`。
- 导入字段变化必须同步更新 `docs/世界资源包-JSON导入指南.md`。
