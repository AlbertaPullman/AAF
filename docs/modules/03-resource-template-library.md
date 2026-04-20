# 03 资源模板库

## 职责

资源模板库支撑零代码自定义：GM 可以可视化创建职业、种族、背景、能力、物品、命刻、牌组、随机表，并用多级分类维护素材库。

## 入口文件

- `client/src/world/components/system/EntityManager.tsx`
- `client/src/world/components/system/EntityVisualEditors.tsx`
- `client/src/world/components/system/CollectionPackPanel.tsx`
- `client/src/world/stores/worldEntityStore.ts`
- `server/src/services/world-entity.service.ts`
- `server/src/routes/world.routes.ts`
- `shared/types/world-entities.ts`
- `server/prisma/schema.prisma`
- `docs/世界资源包-JSON导入指南.md`

## 当前约定

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

## 常见任务定位

- 改资源列表/分类/双击行为：只看 `EntityManager.tsx`。
- 改具体职业/能力/物品可视化字段：看 `EntityVisualEditors.tsx`。
- 改资源 API 或导入导出：看 `worldEntityStore.ts`、`world-entity.service.ts`、`world.routes.ts`。
- 改字段落库：看 `schema.prisma`、迁移、`shared/types/world-entities.ts`。

## 验证

- 前端：`npm run build -w client`。
- 后端字段/API：`npm run prisma:generate -w server`、`npm run build -w server`、必要时 `npm test -w server`。
- 导入字段变化必须同步更新 `docs/世界资源包-JSON导入指南.md`。
