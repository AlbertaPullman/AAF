---
name: aaf-add-entity
description: Add a new world entity type (e.g. 教派/学派/怪物图鉴/秘宝类别) end-to-end across Prisma → shared types → server service → routes → client store → UI panel → permissions → docs. Trigger when user says "加一种新实体"/"新建资源类型"/"新增图鉴分类"/"加 X 模板库". Not for adding individual instances of existing types — that's just data.
---

# AAF Add Entity Skill

You are adding a **new entity TYPE** (a new table/category of resource template), not a single instance. Run all 9 steps in order. Mark each ✓ when done.

## Step 0 — Confirm scope

Ask user:
1. 实体名（中文 + 英文 slug）
2. 关键字段（≥3 个核心字段示例）
3. 谁能 CRUD（GM only / GM+主持 / 玩家可读）
4. 是否需要分类树（`folderPath`）— 默认是
5. 是否进角色卡 / 战斗结算 / 商店 — 决定下游 hook

## Step 1 — Prisma schema

`server/prisma/schema.prisma` —— 添加新 model. 按现有 entity 模式：
- `id` String @id @default(cuid())
- `worldId` String + relation
- `folderPath` String? （分类树）
- `name` / `description` / `data` Json
- 时间戳 createdAt / updatedAt
- @@index 该加的索引

跑 migration：
```
npx prisma migrate dev --name add_<slug>
```

## Step 2 — Shared types

`shared/types/<slug>.ts` —— 定义 Definition / Payload / Filter 类型. 若涉及 DSL，复用 `shared/rules/node-types.ts` 的 effect/condition. 不另起 DSL.

如果 `shared/types/world-entities.ts` 有 union type 列表，把新 entity 加进去.

## Step 3 — Server service

`server/src/services/<slug>.service.ts` —— CRUD + 分类树操作 + 导入导出.
**复用模式**：参考最接近的现有 service（如 `world.service.ts` / `scene.service.ts`），不要重新设计 service 架构。

权限：在 service 入口检查 `hasPermission` from `shared/types/permissions.ts`. 服务端是真相。

## Step 4 — Routes

`server/src/routes/<slug>.ts` —— REST 端点 (GET list / GET id / POST / PATCH / DELETE / 导入 / 导出).
注册到主 router. 在 `docs/接口契约.md` 追加端点（详细 schema 进 `docs/interface-registry.json`）.

## Step 5 — Socket events (if realtime)

如果其他玩家需要实时收到变化（多数情况是），在 `shared/constants/events.ts` 加事件名常量，service 写完成后 emit。客户端订阅。

## Step 6 — Client store

`client/src/world/stores/<slug>Store.ts` 或并入 `worldEntityStore.ts`（如果属于资源模板库统一管理）—— Zustand. 提供 list/upsert/remove/byId selectors.

## Step 7 — Client UI

两面：
- 资源模板库面板 (`client/src/world/components/system/EntityManager.tsx`) — 增加新 tab + 分类树 + 列表 + 编辑器
- 编辑器组件：尽可能复用 `EntityVisualEditors.tsx` 的现有 visual editor 模式；fields 走 schema-driven 不要硬写表单

UI 走 **工具面板**美学（aaf-jrpg-ui），不要套舞台玻璃卡.

## Step 8 — Permissions

`shared/types/permissions.ts` —— 加 permission key（如 `entity:cult:read` / `:write` / `:delete`）, 加进 role-permission map. 客户端 tab 用 `isTabVisible` 控制.

## Step 9 — Docs + memory

- `AI上下文记忆文档.md` —— 追加一节（用 `aaf-sync-memory`）
- `docs/世界模板实现蓝图.md` —— 若世界面向，写入新实体的角色和约束
- `docs/接口契约.md` + `docs/interface-registry.json` —— 端点 + payload
- `docs/modules/03-resource-template-library.md` —— 更新"当前约定"
- `docs/世界资源包-JSON导入指南.md` —— 若新实体支持导入导出，补字段说明

## Step 10 — Verify

```
npx prisma generate
npm run build -w server
npm run build -w client
# 跑相关 test 而非全量
```

报告用户：完成项 + 影响文件清单 + 待手测项（CRUD/权限/Socket 同步）。不自己 commit.
