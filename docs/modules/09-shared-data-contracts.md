# 09 共享契约与数据层

## 职责

本模块维护前后端共享类型、接口契约、Prisma 模型、资源包格式和错误常量。它决定各模块能不能稳定协作。

## 入口文件

- `shared/types/world-entities.ts`
- `shared/rules/ability-workflow.ts`
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

- 能力自动化共享契约以 `shared/types/world-entities.ts` 中的 `AbilityAutomationConfig`、`AbilityWorkflowRun`、`AbilityWorkflowPhaseLog`、`AbilityWorkflowDamageApplication` 为准；预设和创建/收尾逻辑集中在 `shared/rules/ability-workflow.ts`。
- `AbilityDefinition.automation` 持久化为 Prisma JSON 字段，并允许资源包导入导出；执行层只读取共享契约，不在 client/server 分别维护字段副本。
- `AbilityWorkflowDamageApplication` 已承载 `effectiveDamage`、`tempHpDamage`、`hpDamage`、`resistanceApplied`、`vulnerabilityApplied`、`immunityApplied`、`flatReduction` 和 `damageTypeModifiers`，字段保持可选以兼容旧日志。
- 新增或调整 workflow 阶段、自动化模式、伤害应用记录字段时，必须同步更新后端执行服务、前端能力执行面板、`能力系统接口文档.md`、`docs/接口契约.md` 和 `docs/interface-registry.json`。
- 共享类型先于 UI 和服务端实现更新。
- Prisma schema 改动必须配套 migration。
- 资源包导入字段变化必须更新 JSON 导入指南。
- 不把临时 UI 状态写进共享契约，除非它要跨前后端或持久化。
- 跨模块字段、枚举、事件名、权限名必须有单一来源；不要在 client、server、shared 三处各自复制字符串。
- 能力系统选项源从 `shared/rules/ability-registry.ts` 读取；新增状态、状态分类、触发时机、公式值、DC 预设或效果类型时先改这里，再同步 UI、服务端执行和导入导出说明。
- 新增资源类型、规则节点或权限入口时，先定义 shared 契约，再用 registry/config 映射到 UI、API path、Prisma 表和验证逻辑。
- 如果某个契约还无法完全集中，必须在本文件或对应模块卡片列出“新增时要同步改哪些文件”。

## 常见任务定位

- 新增资源字段：先改 `shared/types/world-entities.ts`，再改 `schema.prisma`、service、UI。
- 新增规则节点：先改 `shared/rules/*`。
- 新增权限常量：先改 `shared/constants/roles.ts` 或 `shared/types/permissions.ts`。
- 新增世界内资源类型：先确认 `EntityType`、API path、后端 service/route、Prisma 模型、导入导出、编辑器 schema 是否有集中映射可扩展。

## 验证

- Prisma 字段变化：`npm run prisma:generate -w server`。
- 后端：`npm run build -w server`。
- 前端受影响：`npm run build -w client`。
