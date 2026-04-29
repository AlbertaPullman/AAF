# AAF 世界页 · 五种 JRPG 风格 UI 方案

为 AAF 自动化跑团 VTT 重构 `WorldPage` 顶层 UI 而生。  
所有方案 **保持后端契约不变**（CP-12 已锁定），仅改前端结构、配色、动效、交互编排。  
仅作于 `.superdesign/design_iterations/`，未触碰 `client/src/` 真实代码。

> 参考目标：碧蓝幻想（Granblue Fantasy）的王道 JRPG 体感 + TRPG 战棋骨架

---

## 概览对比表

| # | 方案 | 关键词 | 主色 | 字体 | 适合气氛 | 文件 |
|---|---|---|---|---|---|---|
| 1 | **碧空圣典** Sky Codex | 白·蓝·金·蕾丝雕花 | `#2a78ff` 主蓝 / `#f5a623` 金 | Cinzel + Noto Serif SC | **王道光辉的主流派**，最贴合碧蓝幻想 | [world_1_sky_codex.html](world_1_sky_codex.html) · [theme](world_theme_1_sky_codex.css) |
| 2 | **苍辉骑士团** Azure Knights | 深海军蓝·银·琥珀·勋章六边形 | `#0b1426` 深底 / `#f5a623` 琥珀 / `#d6dcec` 银 | Cinzel + Inter | **BG3 / FF Tactics 严肃骑士团**，重战术 | [world_2_azure_knights.html](world_2_azure_knights.html) · [theme](world_theme_2_azure_knights.css) |
| 3 | **幻想绘卷** Fantasy Scroll | 羊皮纸·蓝墨·金印·手绘 | `#f5ecd6` 羊皮 / `#2c3e72` 蓝墨 / `#c79a3a` 浅金 | Noto Serif SC + Lora | **故事向强叙事局**，文字轻战斗 | [world_3_fantasy_scroll.html](world_3_fantasy_scroll.html) · [theme](world_theme_3_fantasy_scroll.css) |
| 4 | **水晶斗技场** Crystal Arena | 玻璃·水晶蓝·紫·半身像卡 | `#2c7be5` 主 / `#8c5fff` 紫 / `#36c2e5` 青 | Sora + Inter | **GBF 战斗界面 1:1**，重操作手感 | [world_4_crystal_arena.html](world_4_crystal_arena.html) · [theme](world_theme_4_crystal_arena.css) |
| 5 | **极光圣战** Aurora Crusade | 玻璃拟态·极光霓虹·平行四边形 | 极光渐变 cyan-violet-magenta | Orbitron + Rajdhani | **FF13 / 异度神剑** 未来感 | [world_5_aurora_crusade.html](world_5_aurora_crusade.html) · [theme](world_theme_5_aurora_crusade.css) |

---

## 五种方案细化

### 方案 1 · 碧空圣典 Sky Codex
- **核心比喻**：天上王国的圣典图鉴
- **舞台**：白蓝渐变天幕 + 金色 48px 网格
- **特色组件**：金色蕾丝四角包边、HUD 顶部金色横条、技能槽悬浮放大 + 金光晕
- **系统面板**：6 个圆形勋章式纵向 Tab，激活时变金色硬币
- **动效**：缓缓上下浮动的圣典感、伤害飘字带"CRIT"金光
- **推荐场景**：日常跑团默认皮肤、走光辉系正派调

### 方案 2 · 苍辉骑士团 Azure Knights
- **核心比喻**：海军骑士团夜营
- **舞台**：深蓝渐变 + 银色 48px 网格
- **特色组件**：六角形 hexagon clip 勋章 Tab、军用 dogtag 队伍卡（左侧琥珀竖条）、英文 + 中文混排
- **系统面板**：纵向六边形勋章，激活金辉
- **动效**：琥珀边光呼吸、INITIATIVE 横条下滑
- **推荐场景**：重战斗黑暗系剧本、军事 / 高难本

### 方案 3 · 幻想绘卷 Fantasy Scroll
- **核心比喻**：在羊皮书页上展开的冒险
- **舞台**：羊皮纸纹理 + 蓝墨网格
- **特色组件**：上下双卷轴边、金色蜡封头像、手写体"壹貳叁"汉字、金色印章按钮（"落印 / 封卷"）
- **系统面板**：羊皮纸方块 Tab，激活金黄
- **动效**：开卷展开式 unfold 入场、伤害浮字直接是大写"壹貳捌"汉字
- **推荐场景**：剧情向轻战斗、童话 / 古风设定

### 方案 4 · 水晶斗技场 Crystal Arena ⚡
- **结构差异最大**：取消左侧队伍栏，**底部并入 4 张半身像角色卡（GBF 风）**，每张内嵌：
  - 圆环 HP% 显示
  - HP / MP 双条
  - **A / B / C 三个能力槽**（带 CD 数字徽章）
- 系统面板收窄到 240px，舞台得到最大可用区域
- BattleSequenceBar 改为悬浮于舞台顶端的 pill bar
- **核心比喻**：碧蓝幻想战斗界面 1:1
- **推荐场景**：纯战斗本、PVP、Boss 战、追求操作感的局

### 方案 5 · 极光圣战 Aurora Crusade
- **核心比喻**：未来圣战平台
- **舞台**：深紫黑底 + 极光霓虹流光顶/底边
- **特色组件**：平行四边形 clip-path 按钮和 Tab、玻璃拟态 backdrop-filter、伤害飘字用 cyan-violet-magenta 极光渐变文本
- **系统面板**：水平极光 Tab 横排
- **动效**：背景极光 14s 缓动呼吸、按钮悬浮 cyan glow、活动 Tab aurora-stream 流动
- **推荐场景**：科幻 / 异度神剑设定、未来奇幻、追求"哇感"的演示

---

## 五方案共同覆盖元素清单

每个 HTML 都演示了世界页的所有关键容器：

- ✅ 顶部 FateClockWidget + BattleSequenceBar（先攻条）
- ✅ 左侧 CharacterPanel（队伍卡 + 在线列表）—— 方案 4 例外，已合并到底部
- ✅ 中央 WorldCanvas（48px 网格、4 个 Token、AOE 圆、伤害浮字、暴击文字）
- ✅ 右侧 6-Tab 系统面板（聊 / 战 / 景 / 角 / 包 / 系），含徽标 badge
- ✅ 景 Tab 内容：当前章节、视觉切换、Token 操作、测距工具、场景列表
- ✅ 底部 HUDPanel（10 个数字键能力槽 + HP/MP/TP 条 + 4 个 Tab + 结束/防御/逃跑）
- ✅ 浮窗工具：能力库、能力结算台、状态 Tooltip（无遮罩、可拖拽、可多开）
- ✅ 主题色入场动效

---

## 如何预览

直接用浏览器打开任一 HTML 文件即可（已使用 Tailwind CDN + Google Fonts CDN + Lucide CDN，无需构建）。

```pwsh
# 例：浏览器打开方案 1
start .superdesign\design_iterations\world_1_sky_codex.html
```

## 推荐选择路径

- **想要默认主线皮肤** → 方案 1 碧空圣典  
- **跑暗黑高难本** → 方案 2 苍辉骑士团  
- **跑剧情向童话本** → 方案 3 幻想绘卷  
- **追求 GBF 操作手感（推荐）** → 方案 4 水晶斗技场  
- **演示 / Demo / 科幻设定** → 方案 5 极光圣战

也可考虑：方案 1 作主基调 + 方案 4 作战斗模式切换，两种皮肤共存。

---

## 文件清单

```
.superdesign/design_iterations/
├── README_world_designs.md                  ← 本文件
├── world_theme_1_sky_codex.css
├── world_1_sky_codex.html
├── world_theme_2_azure_knights.css
├── world_2_azure_knights.html
├── world_theme_3_fantasy_scroll.css
├── world_3_fantasy_scroll.html
├── world_theme_4_crystal_arena.css
├── world_4_crystal_arena.html
├── world_theme_5_aurora_crusade.css
└── world_5_aurora_crusade.html
```

> 决定方案后，下一步可把选中的 CSS tokens 接入 `client/src/styles/themes/`，组件改造在 `client/src/world/components/` 下逐文件切换。
