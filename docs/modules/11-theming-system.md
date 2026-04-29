# 模块 11 · 主题系统与设计方案切换

> 维护说明：当 **`jrpg-bright`（碧空圣典）默认方案**仍在调整时，每次新增 / 删除 / 重命名一个 CSS token、或加入新视觉模块（如 `--mod-foo-*`），都要同步本文档；**先不要去改 5 套替代主题**，等用户确认默认方案完工后再统一同步。

## 1. 总览

- 主题加载入口：`client/src/lib/theme.ts`
  - `THEME_PACKS: Record<ThemePackId, ThemePack>`：所有方案的元数据（label / tone / swatches / userSelectable）。
  - `applyThemePack(id)`：在 `<html>` 上写 `data-theme="<id>"`。
  - `resolveThemePack({ worldPack, worldPackForcedByGM, userPreference })`：优先级 GM 强制 > 世界默认 > 玩家偏好 > 系统默认。
  - `bootstrapTheme()`：在 React mount 前先注入 `data-theme`，避免闪烁，被 `client/src/main.tsx` 调用。
- 状态：`client/src/store/themeStore.ts`（zustand + persist key `theme-storage`，仅持久化 `userPreference`）。
- UI：`client/src/world/components/system/ThemePickerOverlay.tsx`（弹窗）+ `client/src/styles/theme-picker.css`（弹窗样式，跟随当前主题 token）。
- 接入：`client/src/pages/world/WorldPage.tsx`
  - `OverlayState` / `OverlayDraft` 包含 `kind: "theme"` 分支。
  - 系统页（`renderSystemTab`）的「快捷键设置」下面有「设计风格」按钮 → `openThemeOverlay`。
  - 加载 `worldDetail` 时调用 `useThemeStore.getState().enterWorld({ worldPack, forcedByGM })`；socket cleanup 中 `leaveWorld()`。
- 后端：`PATCH /api/worlds/:worldId/theme`（`server/src/controllers/world.controller.ts:patchWorldTheme` → `world.service.updateWorldThemePack`），写入 `World.themePack` / `World.themePackForcedByGM`。仅 owner / GM 可调用。
- DB：`server/prisma/schema.prisma` 的 `World` 模型已加两个字段；**首次启用前必须执行**：

  ```powershell
  cd server
  npx prisma migrate dev --name add-world-theme-pack
  ```

## 2. Token 契约（`client/src/styles/themes/_contract.css`）

> 这是所有方案**必须**覆盖（或继承）的语义层。新增/删除 token 必须同步更新本节，否则会出现「切到 X 主题部分组件没颜色」。

### 2.1 全局 token

| 类别 | Token |
| --- | --- |
| 字体 | `--font-display` `--font-base` `--font-mono` |
| 圆角 | `--radius-sm` `--radius-md` `--radius-lg` `--radius-xl` |
| 阴影 | `--shadow-sm` `--shadow-md` `--shadow-lg` |
| 动效 | `--motion-fast` `--motion-base` `--motion-slow` `--ease-standard` `--ease-emphasized` |
| 表面 | `--surface-app` `--surface-card` `--surface-card-strong` `--surface-overlay` `--surface-divider` |
| 文字 | `--text-primary` `--text-secondary` `--text-muted` `--text-inverse` |
| 强调色 | `--accent-action` `--accent-emphasis` `--accent-info` `--accent-warning` `--accent-success` `--accent-danger` |

### 2.2 模块 token（命名规则 `--mod-<module>-*`）

- 命运（FateClock）：`--mod-fate-bg` `--mod-fate-clock-stroke` `--mod-fate-clock-fill` `--mod-fate-text` `--mod-fate-glow`
- HUD：`--mod-hud-bg` `--mod-hud-border` `--mod-hud-text` `--mod-hud-accent`
- 工具面板：`--mod-panel-bg` `--mod-panel-bg-strong` `--mod-panel-border` `--mod-panel-text` `--mod-panel-muted`
- 角色卡：`--mod-sheet-bg` `--mod-sheet-border` `--mod-sheet-text` `--mod-sheet-accent`
- 登录：`--mod-auth-bg` `--mod-auth-panel` `--mod-auth-border` `--mod-auth-text` `--mod-auth-accent`
- 规则书：`--mod-rulebook-bg` `--mod-rulebook-border` `--mod-rulebook-text` `--mod-rulebook-accent`

### 2.3 兼容别名

`--jrpg-*` 与 `--auth-*` 老变量保留为别名，新组件**禁止**直接使用，改用上面的语义 token。

## 3. 默认方案 `jrpg-bright`（碧空圣典） — 当前主调整目标

文件：`client/src/styles/themes/jrpg-bright.css`，选择器 `[data-theme="jrpg-bright"]`。

> **当前阶段**：仅修改 `_contract.css`（默认值）和 `jrpg-bright.css`。其他 5 套先保持现状，待用户拍板后统一对齐。

## 4. 替代方案 5 套（**待统一同步**）

| id | 文件 | 风格 |
| --- | --- | --- |
| `dark-arcane` | `themes/dark-arcane.css` | 深紫秘术（旧） |
| `crimson-dynasty` | `themes/crimson-dynasty.css` | 朱砂王朝（朱红/鎏金/墨黑） |
| `verdant-forest` | `themes/verdant-forest.css` | 翠野秘林（苔绿/米黄/赤土） |
| `noir-cyber` | `themes/noir-cyber.css` | 霓虹回路（黑/电青/品红） |
| `parchment-quill` | `themes/parchment-quill.css` | 羊皮卷宗（米黄/棕墨/暗金） |
| `frost-dawn` | `themes/frost-dawn.css` | 霜晓极光（冰蓝/银白/极光紫） |

> 用户明确要求：**默认方案完工前不要主动改这 5 个文件**。但每次 `_contract.css` 增删 token 时，请在本文档「2. Token 契约」里登记，方便后续一次性补齐。

## 5. 新增 / 删除 / 重命名 Token 时的 checklist

1. 改 `_contract.css` 的 `:root` 默认值。
2. 在「2. Token 契约」表格里增/删一行。
3. 更新所有 _直接使用_ 该 token 的组件 CSS（用 `grep_search var\(--token-name\)` 一遍）。
4. 如果是新增**模块前缀** `--mod-<x>-*`：在第 2.2 节加一行；如已被 `theme-picker.css` 引用，确认 fallback 链有意义。
5. 如果删除：在「替代方案待同步清单」里登记 `<token>: removed YYYY-MM-DD`，5 套替代主题统一同步那天一并清掉。

### 替代方案待同步清单（pending sync）

> 格式：`- <date> · <action> · <token | file path>`
>
> 默认方案稳定后，按此清单逐项扫过 5 套 CSS 即可。

- _（暂无；新增/删除请按上面格式登记）_

### A 系列重构进度（默认方案打磨期）

> 每个 A 阶段完成一个组件级重写：把 `index.css` 里的旧定义删掉，新 CSS 落到组件就近的 `world-components.css` 段，全 token 驱动。完成后这一组件即可被任何主题切换覆盖。

| 阶段 | 组件 | 状态 | 落点文件 | 备注 |
| --- | --- | --- | --- | --- |
| A1 | 命刻枢纽 `.world-fixed-gauge` (FateGauge Hub) | ✅ 完成 | `client/src/world/styles/world-components.css` 末尾 | 删除了 `index.css` 三处旧定义（原 line 10085 / 11569 / 12339）。新版用 `var(--mod-fate-accent)` + `color-mix()` 驱动鎏金外缘。 |
| A2 | 顶部回合条 / 先攻列表 | ✅ 完成 | `BattleSequenceBar` | 删除 `index.css` 行 7487-7783 重复定义；`world-components.css` BattleSequenceBar 全段重写：grid frame、entry::before glow、HP/tags 绝对定位，全 token (`--mod-fate-accent` / `--accent-action` / `--accent-success` + `color-mix`)。响应式 media query 保留在 `index.css`。|
| A3 | 底部 ActionBar / HUDPanel（资源条 + 快捷栏 + 标签页 + 模式切换） | ✅ 完成 | `HUDPanel` (`world-components.css` 868-1217) | `world-components.css` HUD 段所有硬编码 hex/rgba 全部替换为 `var(--mod-hud-accent)` / `var(--mod-fate-accent)` / `var(--accent-action)` / `var(--accent-danger)` / `var(--accent-warn)` / `var(--surface-card)` + `color-mix(... transparent)`。删除 `index.css` 两段 `.world-stage-shell .hud-panel*` 主题硬编码覆盖（原深色宇宙 11638-11685 + 亮色 12173-12208），HUD 现完全跟随主题包。 |
| A4 | 队伍简卡 + 在线玩家卡 | 🔶 部分完成 | `index.css` 9821-10210 基础块 | 基础块 `.world-fixed-bottom-left-rect` / `.world-online-list*` (含 4 档延迟徽章) / `.world-stage-empty` / `.world-stage-party-*` 全部 token 化（`var(--accent-action)` / `var(--accent-success)` / `var(--accent-warn)` / `var(--accent-danger)` / `var(--mod-fate-accent)` / `var(--surface-card)` + `color-mix`）。⚠️ `.world-stage-shell` 联合覆盖块（party-card 与 battle-slot/role-card/scene-stage 共享的多类选择器，行 11078/11236/11794/11947 等）暂留，待 A6 后做统一清理（涉及 scene-stage 与共用徽章颜色）。 |
| A5 | 浮层（飘字 / 状态卡 / 能力结算台） | 🔶 部分完成 | `index.css` 8060-8230 + 10215-10395 | `.hover-insight-card` 全段（双径向高光 / is-pinned 描边 / __head span/em 徽章 / __meta span / .hover-insight-term 下划线色）+ `.world-ability-exec__field select / __summary / __meta span / __facts span / __tag / __result / __result-card[:hover]` 全部 token 化（`var(--accent-action)` / `var(--accent-emphasis)` / `var(--accent-action-soft)` / `var(--surface-card)` + `color-mix`）。⚠️ 飘字层（伤害浮字 / 状态浮字）目前前端尚未落地组件，本期只覆盖洞察卡 + 结算台两类浮层；后续落地飘字时 token 已就绪。 |
| A6 | 顶部"碧空圣典"烫金标题 + 工具图标 | 🔶 部分完成 | `index.css` 7553-7670 + 9920-10024 + 10692-10745 | `.world-fixed-system-tab*` 11 列工具图标（默认/hover/is-active）+ `.world-fixed-system-tab-page` 容器/head + 4 类 view radial 主题色（chat→action / battle→danger / scene→success / system→action+emphasis）+ `.world-stage-header-copy/-btn[:hover]` 标题与按钮 + `.world-stage-alert` 红条 + `.world-gm-view-banner` 橙条（含内嵌按钮）+ `.world-fixed-hud__panel span` + `.world-refactor-top-back/-scene-banner` 全部 token 化（`var(--accent-action)` / `var(--accent-action-soft)` / `var(--accent-emphasis)` / `var(--accent-success)` / `var(--accent-danger)` / `var(--surface-card)` + `color-mix`）。⚠️ `.world-stage-shell` 联合覆盖块中 header-btn / header-copy / header-status 段保留，等 A-final 清理。 |
| A-final-1 | `.world-stage-shell` 联合覆盖块「桥接层」 | 🔶 部分完成 | `index.css` 10905-10974 + 11640-11703 | 两处 `.world-stage-shell` `--world-*` 自定义属性（默认 + `--gm/--assistant/--player/--observer` 四角色变体）从硬编码 `#79b8ff/#f0c57a/#2f7fd8/#f59e32/rgba(...)` → 全部桥接到 `var(--accent-action)` / `var(--accent-action-soft)` / `var(--accent-emphasis)` / `var(--accent-success)` / `var(--text-secondary)` / `var(--accent-warn)` / `var(--surface-card)` / `var(--surface-card-border)` / `var(--text-primary)` / `var(--text-secondary)` / `var(--surface-stage-bg)` + `color-mix`。底层 `.world-stage-shell .X { background: var(--world-panel) }` 等选择器从此自动跟随主题包切换。⚠️ 单行 selector 内残留的 `rgba(...)` 渐变（如 `linear-gradient(180deg, rgba(255,255,255,.92), ...)` ~700 行）作为视觉细节遗留，需要逐个手工 token 化或确认可删除（B 阶段 / 5 套主题同步前再清）。 |

## 6. 新增一个主题方案的步骤

> 仅在用户明确同意后再做。

1. 复制 `themes/jrpg-bright.css` 为 `themes/<id>.css`，把选择器改成 `[data-theme="<id>"]`，按 token 表覆盖颜色。
2. 在 `client/src/styles/index.css` 的 `@import` 段插入新行（位置在 `theme-picker.css` 之前）。
3. 在 `client/src/lib/theme.ts` 的 `ThemePackId` 联合类型与 `THEME_PACKS` 注册表加一项（含 `tone` 和 3 色 `swatches`）。
4. （可选）在 `THEME_PACKS` 顺序中决定是否 `userSelectable: false`（仅 GM 可设）。
5. 重启 vite，进入「设计风格」弹窗验证。

## 7. 删除一个主题方案的步骤

1. 删除 `themes/<id>.css`。
2. `index.css` 移除对应 `@import`。
3. `lib/theme.ts` 从 `ThemePackId` 联合 + `THEME_PACKS` 注册表移除。
4. **数据迁移注意**：检查 `World.themePack` 数据库里是否还有引用该 id 的世界，必要时写 SQL 置 NULL，避免世界卡在不存在的方案上（前端有 `isKnownPack` 兜底为 `null`，会自动回落到玩家偏好/默认，不会崩溃，但 GM 看到「（已废弃）」会困惑）。

## 8. 已知约束 / 后续待办

- 跨玩家实时同步：GM 改动后目前只在本端立即生效，其他玩家需要刷新世界。后续要加 `world:theme:update` socket 事件 → `useThemeStore.getState().enterWorld(...)`。
- 账号级跨设备偏好：当前玩家偏好仅在 localStorage（`theme-storage`）。如要跨设备，扩展 `User.preferences` JSON 字段。
- Prisma 迁移：必须执行 `add-world-theme-pack` 迁移，否则 GM 保存会 4xx，前端会静默 fallback 到本地预览（控制台 warn，不报红）。

## 9. 排错历史

- **2026-04-29 PostCSS Unclosed string**（index.css:9018）：旧版本里 `.entity-mgr__item--draggable::after { content: "可拖�?; }` 因为编码事故末尾少了 `"`，PostCSS 把后续所有内容当字符串吞掉直到 line 13665。修复：`content: "可拖动";`。如果以后再出现「Unclosed string at index.css:很大行号:某列」，先用脚本扫一次每行双引号是否成对：

  ```powershell
  $lines = Get-Content -LiteralPath 'client/src/styles/index.css'
  for ($i=0; $i -lt $lines.Count; $i++) {
    $cnt = ([regex]::Matches($lines[$i],'"')).Count
    if ($cnt % 2) { Write-Host "L$($i+1): $($lines[$i])" }
  }
  ```
