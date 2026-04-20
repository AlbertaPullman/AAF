# 09 共享契约与数据层

## 职责

本模块维护前后端共享类型、接口契约、Prisma 模型、资源包格式和错误常量。它决定各模块能不能稳定协作。

## 入口文件

- `shared/types/world-entities.ts`
- `shared/types/permissions.ts`
- `shared/types/life-crafting.ts`
- `shared/constants/*`
- `shared/rules/*`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/*`
- `docs/接口契约.md`
- `docs/interface-registry.json`
- `docs/世界资源包-JSON导入指南.md`

## 当前约定

- 共享类型先于 UI 和服务端实现更新。
- Prisma schema 改动必须配套 migration。
- 资源包导入字段变化必须更新 JSON 导入指南。
- 不把临时 UI 状态写进共享契约，除非它要跨前后端或持久化。

## 常见任务定位

- 新增资源字段：先改 `shared/types/world-entities.ts`，再改 `schema.prisma`、service、UI。
- 新增规则节点：先改 `shared/rules/*`。
- 新增权限常量：先改 `shared/constants/roles.ts` 或 `shared/types/permissions.ts`。

## 验证

- Prisma 字段变化：`npm run prisma:generate -w server`。
- 后端：`npm run build -w server`。
- 前端受影响：`npm run build -w client`。
