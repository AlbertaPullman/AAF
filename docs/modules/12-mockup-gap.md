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
- **现状**：底部 footer 横条；HP/MP/Stamina/Fury 4 条；hotbar 按钮排；✅ 新增 64px 圆形 `__avatar`（HUD 蓝→金渐变 + 双层环 + Lv 徽章），与 `__resources/__bars/__hotbar` 同行布局，呈现"火炬奖杯"凹槽感
- **差距**：⏳ 拖拽位置/可移动 HUD 未做；常规模式 4×10 网格槽位未实现（当前仅 hotbar 单行）
- **结论**：⭐ 视觉雏形已对齐核心，剩余拖拽与网格槽位为功能层面

### 2.4 PartyPanel · 队伍状态卡
- **Mockup**：`.pc-card` 立体卡片（白→淡蓝渐变，左侧 3px primary border-left；自己卡用金色变体）；32px 字母头像；hp/mp 条带 label/val 阴影描边白字；附 `.pc-deploy` 部署生物子卡（虚线边框，左缘弯钩连接线）
- **现状**：✅ 已对齐核心视觉——`.world-stage-party-card` 加 3px primary `border-left` + hover 上浮 + `is-active` 金色变体；新增 32px `__avatar` 字母圆形（primary→fate 渐变 + active 时切金）；卡片改为 grid 布局 32px 内容列
- **差距**：⏳ `.pc-deploy` 部署生物子卡（虚线 + 弯钩连接）尚未做（需要场景数据接入）
- **结论**：✅ 主卡视觉已达 mockup 等价水平

### 2.5 OnlinePanel · 在线玩家
- **Mockup**：每行 `<b>主/玩/观</b>+名+角色`，右侧信号条 `.ping`（4 段竖条，good/mid/bad 颜色）；离线 `.offline` 灰度
- **现状**：✅ 已对齐 ping 信号条——`.world-online-list__ping` 4 段竖条 + `__ping-text` 数值，颜色随延迟变（good/warn/bad/unknown）；离线时 unknown 灰阶
- **差距**：⏳ 行首 `<b>主/玩/观</b>` 角色徽章未做（需要 role 数据），目前只显示玩家名
- **结论**：✅ ping 信号条达 mockup 等价水平

### 2.6 系统右板 sys-panel
- **Mockup**：10 个 1:1 方形 tab（聊/战/景/角/能/物/随/乐/集/系），active 金色，badge 红点；每 tab 内容区固定结构（res-toolbar + res-tree 多级目录 + sys-section 卡片）
- **现状**：✅ tab 已加 `aspect-ratio: 1` 强制 1:1 方形 + 加 `__badge` / `[data-badge]` 红点徽标支持（金色边框 active 已具备）
- **差距**：⏳ res-tree 多级目录 caret 折叠 + tag-foe/-npc/-ok 着色未做（需要资源面板 JSX 重构）
- **结论**：⭐ tab 视觉对齐完成；目录树视觉单独立项

### 2.7 浮动元素群
- **Mockup**：`.float-win`（能力库/结算台/Tooltip 等小窗）、`.tool-fab` + `.tool-panel` + `.tool-sub`（左侧悬浮工具栏，可拖、智能展开方向）、`.aoe`（场景 AOE 圆）、`.dmg-float`（伤害飘字）
- **现状**：✅ CSS 骨架已就位——`.world-aoe`（金色虚线圆 + data-label 角标）、`.world-dmg-float` + `__num/__tag` + `worldDmgFloat` 1.1s 飘字关键帧（含 `--heal/--miss` 变体）、`.world-float-win` + `__header/__body/__close`、`.world-tool-fab`（金 ↔ 蓝 open 切换 + dragging 态）
- **差距**：⏳ JSX 触发逻辑未接入——需要 `aaf-combat-fx` skill 把 settlement 事件桥接成 `.world-dmg-float` 节点；`.tool-fab` 拖拽与展开方向逻辑
- **结论**：⭐ CSS 骨架完成可直接渲染，行为层留给后续

## 3 · 本次执行范围

✅ 已做（前序步骤）：
- token 化所有硬编码颜色（A-final-2 三段 board/overlay）
- 6 个候选主题包覆盖 34 个核心 token
- IndexedDB stale-while-revalidate 缓存

🔄 本次本 commit 内：
- 重写 FateClockWidget DOM + CSS → mockup `.fate-dial` 风格
- 重写 BattleSequenceBar CSS + 加金色 round-info / pulse / init-end 视觉

⏳ 后续迭代（不在本次）：
- ~~HUDPanel 嵌入式重塑~~ → ✅ avatar 视觉已对齐，剩余拖拽 + 4×10 网格槽位
- ~~PartyPanel + OnlinePanel 新建~~ → ✅ 已完成原 DOM 增强
- ~~sys-panel tab 视觉对齐~~ → ✅ 1:1 方形 + 红点 badge 完成；res-tree 目录树留待
- ~~float-win / tool-fab / dmg-float 演出层~~ → ✅ CSS 骨架就位；触发/JSX 集成留待 aaf-combat-fx skill
- ~~标题栏 Cinzel 字距~~ → ✅ .title-left strong letter-spacing: .28em
- ~~舞台底色 sky 渐变 + 网格~~ → ✅ .stage-canvas 径向渐变 + 48px 金色网格线
- ~~右栏 tab 图标~~ → ✅ lucide-react 6 图标替换单字 label
- ~~Dead CSS 清理~~ → ✅ world-fixed-* 系列（L7488-10036）已删除
- PartyPanel `.pc-deploy` 部署生物子卡 + role badge
- HUD 拖拽浮动 + 常规模式 4×10 网格槽位
- res-tree 多级目录 caret 折叠 + tag-foe/-npc/-ok 着色
- 演出层 JSX 触发器：settlement → dmg-float / aoe 注入

## 4 · 决策原则

- **token 层永不复制硬编码颜色**：所有新组件 CSS 一律 `var(--accent-*)/--surface-*/--text-*`，不用 `rgba(245,166,35,…)`
- **保持 React props 接口稳定**：组件 DOM/CSS 重写不破坏现有调用点（`WorldPage`/`Scene*`）
- **演出层与结算层分离**：BG3 风格特效走 `aaf-combat-fx` skill 路径，不混入基础 UI 重写
