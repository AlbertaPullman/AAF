---
name: aaf-sync-memory
description: End-of-iteration routine for AAF — append a section to AI上下文记忆文档.md, update the relevant module card 当前约定/待拆分点, and sync docs/世界模板实现蓝图.md if world-facing. Trigger before closing any AAF coding session, or when user says "更新记忆"/"sync"/"收尾"/"更新上下文文档"/"记一下". User-mandated routine — do not skip.
---

# AAF Sync Memory Skill

Run at end of any AAF iteration that changed code or design. The user explicitly requires this — skipping it means future sessions lose recent context.

## Step 1 — Did anything code- or design-relevant happen?

If no code/design change (pure question, abandoned exploration), skip this skill and tell the user.

## Step 2 — Append to AI上下文记忆文档.md

Open `AI上下文记忆文档.md`. Find the section that holds iteration notes (look for the latest "## " section about current main line / phase). Append ONE block with this template:

```markdown
### <YYYY-MM-DD> · <一句话主题>

**当前主线变化**：<这次做了什么、改了什么边界>

**影响规则 / 接口**：
- <规则 / API / DSL 节点变化要点>
- <被影响的下游模块>

**下一步**：<最小的下一动作；如已完结写 "—"，不写空想>
```

注意：
- 用绝对日期，不写"今天/昨天"
- 主题 ≤ 12 字
- "影响规则"段是给未来 AI 看的——写下游能搜到的关键词，不写废话
- 文档已是"精简版"——若本次只是 bugfix 且无规则影响，1–2 行即可，不要写满模板

## Step 3 — Update module card

改动落在哪张模块卡 (`docs/modules/01-*.md` … `10-*.md`) 的管辖范围，就更新哪张：
- 找该卡的 **当前约定** 段，把新约定写入（一两行，可执行的事实）
- 如果暴露出新的复杂度，加到 **待拆分点** 段
- 跨 ≥2 模块时，只更新 **主**模块卡，依赖卡不动

## Step 4 — Sync 世界蓝图 (条件)

如果改动涉及以下任一面：
- 世界 UX
- 权限模型
- 规则自动化（DSL 节点、结算流程）
- 资源编辑器 / 模板库
- 制造 / 生活职业

→ 更新 `docs/世界模板实现蓝图.md` 对应章节.

## Step 5 — Verify

读一遍刚加的段，自检：
- 三个月后我（AI）能凭这段独立接手吗？
- 关键词是否能被 grep 搜到（用户日常提到的术语）？
- 没有"详见会话"这种死链表述？

## Step 6 — 报告用户

```
✓ AI上下文记忆文档.md  追加段：<日期 · 主题>
✓ 模块卡 <0X-name>     更新约定：<一句话>
✓/— 世界蓝图           <更新章节>          (或：—  非世界面向)
```

不要 commit。让用户自己 review 文案后决定。
