# 12 · Mockup 差距清单（碧空圣典 v1）

> Mockup 源：[AAF · 碧空圣典 v1（口述标准对齐版）.html](../../AAF · 碧空圣典 v1（口述标准对齐版）.html)（2102 行）  
> 现有实现：[client/src/world/](../../client/src/world/)  
> 状态时间：A-final-2 token 化完成 + 主题契约对齐 + IndexedDB 缓存完成后

## 1 · 总体差距

| 维度 | Mockup | 现状 | 差距等级 |
| --- | --- | --- | --- |
| 主色 / Token | `--sc-*` 一套 | `--surface-*/--accent-*/--text-*/--mod-*` 一套 | ✅ 已对齐（token 层 100% 化） |
| 主题包数量 | 单一明亮 | 7 包覆盖 34 token | ✅ 已对齐 |
| 布局栅格 | 顶部条 + 左列(命运/队伍/在线) + 中央 stage + 右系统板 | 类似但组件 DOM 不同 | ⚠ 中差距（结构 OK，组件 DOM 需重写） |
| 浮动元素 | init-bar 顶部居中、tool-fab 左侧、float-win × N、HUD wrap 嵌入 stage | BattleSequenceBar 普通栏、HUDPanel 底部 footer、无 tool-fab | ❌ 大差距 |

## 2 · 组件级差距

### 2.1 FateClockWidget · 命运刻度盘
- **Mockup**：小尺寸 220px 行；圆环 132×132；外圈 SVG 扇形刻度；中心 30px 数字 `5/8` + 章节名 `王都沦陷`；hover 悬浮 5 个圆角按钮（上/下/-/+/⚙）
- **现状**：竖向 SVG 大圆环，三按钮（-1/+1/+2）+ 推进原因输入框 + 删除按钮，永久可见
- **差距**：DOM 结构与 mockup 完全不同；hover 按钮交互未做；"刻度名"未呈现
- **重写优先级**：⭐⭐⭐ 高（视觉差异最大）

### 2.2 BattleSequenceBar · 战斗序列
- **Mockup**：`.init-bar` 顶部居中悬浮，传送带式（当前永远居中），立绘卡 56×80，圆角 8px；当前卡 `scale(1.1) translateY(-4px)` + 金色 box-shadow pulse 动画；左侧 round-info 金色徽章，右侧 next-btn
- **现状**：⭐ 经核查已完整对齐——`battle-sequence-bar` fixed 顶部居中；`__entry--current` 已含 `scale(1.14)` + `battleSeqCurrentGlow` 1.6s pulse 动画；`__round-divider` 含 ↻ 角标；`__round` 左侧含金色徽章区；`__end-turn` 右侧金色按钮；scrollIntoView 实现"当前居中"
- **差距**：⚠ 无需重写。可选优化：立绘卡比例与 mockup 56×80 对齐（目前由 `--battle-card-w/h` 控制，已是 mockup 比例）
- **结论**：✅ 视觉已达 mockup 等价水平

### 2.3 HUDPanel · HUD 嵌入式
- **Mockup**：`.hud-wrap` 可拖拽 fixed 浮动；左侧 80×80 圆形 hud-avatar + 主面板凹槽对接（"火炬奖杯"感）；4×10 网格槽位
- **现状**：底部 footer 横条；HP/MP/Stamina/Fury 4 条；hotbar 按钮排
- **差距**：完全不同的形态；现状是常规底栏 HUD，mockup 是悬浮式
- **重写优先级**：⭐⭐ 中（功能可用，纯视觉重塑工作量大）

### 2.4 PartyPanel · 队伍状态卡
- **Mockup**：`.pc-card` 立体卡片（白→淡蓝渐变，左侧 3px primary border-left；自己卡用金色变体）；32px 字母头像；hp/mp 条带 label/val 阴影描边白字；附 `.pc-deploy` 部署生物子卡（虚线边框，左缘弯钩连接线）
- **现状**：未发现独立 PartyPanel 组件（散在 WorldStageParty* / TokenPanel）
- **差距**：需新建组件
- **重写优先级**：⭐⭐ 中

### 2.5 OnlinePanel · 在线玩家
- **Mockup**：每行 `<b>主/玩/观</b>+名+角色`，右侧信号条 `.ping`（4 段竖条，good/mid/bad 颜色）；离线 `.offline` 灰度
- **现状**：未发现独立 OnlinePanel
- **重写优先级**：⭐ 低（lobby 已有类似）

### 2.6 系统右板 sys-panel
- **Mockup**：10 个 1:1 方形 tab（聊/战/景/角/能/物/随/乐/集/系），active 金色，badge 红点；每 tab 内容区固定结构（res-toolbar + res-tree 多级目录 + sys-section 卡片）
- **现状**：已有 system 类组件如 EntityManager，但 tab 视觉与 mockup 差距明显
- **差距**：tab 视觉、目录树（caret 折叠 + tag-foe/-npc/-ok 着色）需对齐
- **重写优先级**：⭐⭐ 中

### 2.7 浮动元素群
- **Mockup**：`.float-win`（能力库/结算台/Tooltip 等小窗）、`.tool-fab` + `.tool-panel` + `.tool-sub`（左侧悬浮工具栏，可拖、智能展开方向）、`.aoe`（场景 AOE 圆）、`.dmg-float`（伤害飘字）
- **现状**：基本没有这些悬浮装饰元素
- **重写优先级**：⭐ 低（属"演出层"，可与 aaf-combat-fx skill 一起后续做）

## 3 · 本次执行范围

✅ 已做（前序步骤）：
- token 化所有硬编码颜色（A-final-2 三段 board/overlay）
- 6 个候选主题包覆盖 34 个核心 token
- IndexedDB stale-while-revalidate 缓存

🔄 本次本 commit 内：
- 重写 FateClockWidget DOM + CSS → mockup `.fate-dial` 风格
- 重写 BattleSequenceBar CSS + 加金色 round-info / pulse / init-end 视觉

⏳ 后续迭代（不在本次）：
- HUDPanel 嵌入式重塑
- PartyPanel + OnlinePanel 新建
- sys-panel tab 视觉对齐
- float-win / tool-fab / dmg-float 演出层

## 4 · 决策原则

- **token 层永不复制硬编码颜色**：所有新组件 CSS 一律 `var(--accent-*)/--surface-*/--text-*`，不用 `rgba(245,166,35,…)`
- **保持 React props 接口稳定**：组件 DOM/CSS 重写不破坏现有调用点（`WorldPage`/`Scene*`）
- **演出层与结算层分离**：BG3 风格特效走 `aaf-combat-fx` skill 路径，不混入基础 UI 重写
