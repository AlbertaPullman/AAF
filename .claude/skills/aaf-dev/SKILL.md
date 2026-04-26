---
name: aaf-dev
description: Default entry skill for any AAF VTT task. Trigger at the start of any new conversation about AAF, or whenever the user asks to "开始/继续 AAF 开发"/"做个 AAF 任务"/"开始迭代". Loads project context, golden rules, task→file routing, and reminds to sync AI上下文记忆文档.md at the end. Skip only for skill creation/meta tasks.
---

# AAF Dev Entry Skill

Run this at the start of any AAF task. Output a short context block, then proceed with the user's actual request.

## Step 1 — Establish task class

Decide which class the task falls into. Pick ONE:

| Class | Specialized skill to chain | Touches |
|---|---|---|
| 加/改实体（职业/种族/能力/法术/物品/牌组/命刻/随机表） | `aaf-add-entity` | Prisma + shared + server + client store + UI |
| 角色卡字段改动 | `aaf-edit-sheet` | `CharacterSheetWorkbench.tsx` 三处 + schemaVersion + 角色卡设计文档 |
| 战斗规则/能力 DSL | `aaf-add-rule` | `shared/rules/*` + ability service |
| UI 美化/调样式 | `aaf-jrpg-ui` (+ `aaf-component-polish` if single component) | client/src/**/*.tsx |
| 战斗演出 | `aaf-combat-fx` | settlement → 视觉 |
| 战棋地图/AOE/视野/移动 | `aaf-vtt-map` | WorldCanvas / Scene*Panel |
| 数值平衡 | `aaf-balance-check` | 实体定义 |
| 其他（bug/重构/文档） | 无专属 skill；遵循下方通用规则 |

如果不确定，问用户一句"这是 X 还是 Y？"再决定。

## Step 2 — Load context, do NOT scan repo

**优先顺序：**
1. 读 `docs/modules/README.md`，挑一张主模块卡 + 至多一张依赖卡（卡片在 `docs/modules/01-*.md` … `10-*.md`）。
2. 始终读 `AI上下文记忆文档.md` 顶部前 2 节快照，知道当前阶段+边界。
3. 若任务世界面向，按需打开 `docs/世界模板实现蓝图.md`。

不要 grep 整仓库。不要 ls 多层目录。任务范围之外的文件不打开。

## Step 3 — Golden rules (must comply)

| 规则 | 一句话 |
|---|---|
| 不硬编码能力 | 一切战斗逻辑走 trigger/condition/effect DSL |
| 服务端是真相 | 客户端权限校验只用于显示，结算只信服务端 |
| 角色卡三处一致 | 任何字段改动同步 `CharacterSheetExportPayload` + `isCharacterSheetExportPayload` + import 映射，并 bump `schemaVersion` |
| 复用判定函数 | 命中/暴击/抗性走 shared/rules，不在新代码里复制公式 |
| 局部验证 | 客户端改 → `npm run build -w client`；服务端/规则改 → `npm run build -w server` + 相关测试 |
| JRPG 亮色 | 蓝/白/橙；禁止暗背景、胶囊标签、默认浏览器滚动条 |
| AAF 行动经济 | 标准/快速/机动/自由/反应/复合/特殊；禁用 move / full-round |
| AAF 法术模型 | 等级序列 + MP + AP + 学派；不是 spell slots |
| 核心规则 | 同名不叠加、向下取整、至少为一、特例优先 |
| 不提交敏感物 | 规则书.txt、tmp/、auth、生成的测试世界 |

## Step 4 — 输出对齐 (必做)

回复用户前给出 3 行：

```
任务类: <X>  →  将链 <skill-name>
影响文件: <主要 1–3 个>
红线: <最相关 1–2 条规则>
```

之后再做事。

## Step 5 — 收尾 (代码改动后)

如果本次改了代码：
1. 跑对应的 build/test（局部，不全量）
2. 链 `aaf-sync-memory` 更新 `AI上下文记忆文档.md`
3. 如涉及世界面向（UX/权限/自动化/资源编辑器/制造），同步 `docs/世界模板实现蓝图.md`

不要 commit，除非用户明确要求。
