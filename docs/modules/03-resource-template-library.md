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
- 双击条目才打开详细编辑器。
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
