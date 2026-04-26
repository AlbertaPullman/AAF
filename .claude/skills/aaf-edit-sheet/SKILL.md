---
name: aaf-edit-sheet
description: Make any field-level change to the AAF character sheet. Trigger when user says "改角色卡"/"加字段"/"调整角色卡"/"角色卡多一项"/"sheet 改"/"角色属性增加". Enforces the 3-place rule (export payload type + type guard + import handler) and schemaVersion bump and 角色卡设计文档 append. Single source: client/src/components/character/CharacterSheetWorkbench.tsx.
---

# AAF Edit Sheet Skill

Character sheet uses ONE component for both lobby pre-create and in-world play: `client/src/components/character/CharacterSheetWorkbench.tsx`. Any field change must touch exactly these places.

## Step 1 — Confirm the change

Ask user (if not clear):
- 字段名（中文 + 英文 key）
- 类型（数字/文本/枚举/嵌套对象/数组）
- 默认值
- 是否参与战斗结算（影响是否要跑到 server 端）
- 是否在 lobby 预创角时填写

## Step 2 — The 3 places (HARD RULE)

Inside `CharacterSheetWorkbench.tsx`:

1. **`CharacterSheetExportPayload` 类型** —— 加字段类型定义
2. **`isCharacterSheetExportPayload` type guard** —— 加运行时校验，确保导入的旧/外部 JSON 不会让字段未定义
3. **import handler** —— 把外部 payload 映射到 state，处理 missing/legacy 情况

漏一处都会导致旧角色卡导入失败或运行时崩。

## Step 3 — schemaVersion bump

在同一文件找 `schemaVersion` 常量，递增数字。同时在 import handler 里加 migration 分支：

```ts
if (payload.schemaVersion < <new>) {
  // 老版本 → 新版本的字段补齐 / 重命名 / 默认值
}
```

不要假设旧角色卡都已删除——用户的朋友可能存了导出。

## Step 4 — UI 渲染

在 `CharacterSheetWorkbench.tsx` 找到合适的 section 加表单控件。走 **工具面板**美学（aaf-jrpg-ui）：紧凑、对齐、低装饰。

如果新字段很复杂（嵌套表/动态行），考虑抽出子组件——但仍住在同一文件夹下，不要散到 world/components.

## Step 5 — 服务端持久化

如果角色卡走 Prisma 持久化（多数情况是 `Character.data` JSON 字段，无需 schema 改动）：
- 不动 schema
- `server/src/services/character.service.ts` 通常透传 data，无需改

如果新字段是 first-class 列（罕见），走完整 Prisma migration。

## Step 6 — 战斗结算 hook

如果新字段参与结算（如新属性、新抗性、新资源条）：
- `shared/rules/context.ts` 把字段塞进 RuleContext
- `shared/rules/node-types.ts` 如果需要新的 condition/effect 引用，加进 DSL
- 复用 talent-tree/已有判定函数；不写自定义公式

## Step 7 — 文档同步

**必做**：在 `角色卡设计文档.md` 追加一段：
- 字段名 + 含义
- 取值范围 + 默认
- schemaVersion 变化
- 是否参与结算 + 走哪条 rule path

**条件**：若变更涉及世界规则展示，同步 `docs/世界模板实现蓝图.md`.

## Step 8 — Verify

```
npm run build -w client
# 测：新建角色 → 填字段 → 导出 JSON → 重新导入 → 字段保留
# 测：用旧 schemaVersion 的导出 JSON 导入 → migration 分支生效 → 不崩
```

链 `aaf-sync-memory` 收尾。
