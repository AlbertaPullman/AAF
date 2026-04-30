# AAF 实装总规划 v1

更新时间：2026-04-27
状态：主线规划文档（唯一来源）。任何与本文件冲突的旧文档作废。

---

## 0. 本文件的定位

本文件取代被退役的 `docs/AAF总计划.md`、`docs/世界资源包-JSON导入指南.md`、`docs/聊天启动指南.md`、`世界需求与填写清单.md`、`docs/更新日志.md`。

它是接下来所有迭代的**主线**，回答四个问题：
1. **要做什么** — 把 AAF 从"徒有其表"做成可真实跑团的 VTT。
2. **按什么顺序做** — 见 §6 路线图。
3. **每期做完是什么样** — 见各期 acceptance。
4. **绝不做什么** — 见 §1 红线。

---

## 1. 设计原则与红线

1. **服务端裁判**：所有战斗与造物结算以服务端为最终裁判，前端只显示和触发。
2. **规则常量单源**：所有"规则书数值"（属性调整值、熟练加值、HP 公式、AC 公式等）只能写在 `shared/rules/` 下的纯函数与常量表里，禁止散落到 client/server 任意一处。
3. **DSL 而非硬编码**：能力效果通过 trigger/condition/effect DSL 表达，**永远不能**在代码里写"if ability.name === '猛击' then ..."。
4. **核心包不可关闭**：用户口述新约定 — 核心包 = 平台预置框架槽位，所有世界默认加载且无法关闭；扩展包 + 私设包 = GM 可开关、可导入导出。
5. **数据由用户手填**：本规划只搭框架（schema、加载机制、UI 编辑器、导入导出），不预置规则书的具体种族/职业/物品/能力数据。所有内容由用户后期手动录入。
6. **自动化对齐 FVTT DnD5e + MidiQOL**：交互模型与命名（Activity / ActiveEffect / Workflow Hook / Concentration / TPR Reaction）在精神上对齐 FVTT 生态，避免重新造概念，参考链接见 §13。
7. **天赋树是核心进步器**：冒险职业最高 10 级，目前只 1–3 级写了特性（4–10 级未来可能补），所有进阶能力来自天赋树。天赋树系统必须做成"电子游戏级"的可视化与交互。
8. **装备/造物三件套捆绑**：装备槽 + 魔法物品组件网格 + 生活职业/造物 必须**一起**做，规则未完整前不动手。本规划只在 schema 与类型上**预留扩展位**，不实装。

---

## 2. 现状评估（一页纸）

| 模块 | 状态 |
|---|---|
| Schema | ✅ Race/Profession/Background/Item/Ability/FateClock/Deck/RandomTable/Talent 表都有；❌ 缺装备槽枚举、Character.resources 结构化、SceneCombat 缺动作经济资源 |
| 规则常量 | ❌ 没有 `shared/rules/constants.ts`；属性调整值、熟练加值、HP/MP/战意/技力公式散落各处或缺失 |
| 资产加载 | ❌ 无核心包/扩展包/私设包三层加载机制；现有 `world-entity.service` 只是单世界 CRUD |
| 角色卡 | ⚠️ 2320 行单组件，stats/snapshot 是松散 JSON，无规则化创建向导，不联动种族/职业自动算 AC/HP |
| 天赋树 | ⚠️ 大厅有预览雏形 + 试用页 + 共享判定函数；UI 美观度与交互（拖拽、缩放、节点动画、详情联动）远未达到电子游戏级 |
| 场景画布 | ❌ WorldCanvas 188 行像素硬编码，无真实网格坐标系，不渲染光照/雾/背景图，token 与 Character 绑定弱 |
| 棋子 | ❌ Token 只有 tokenId+x+y，没有体型/AC/HP/状态徽标/视野圈 |
| 战斗 | ⚠️ 有 round/turnIndex 骨架；❌ 没有真实先攻投掷、动作经济追踪、反应窗口、回合开始结算钩子 |
| 能力执行 | ❌ AbilityExecutionPanel 是三个下拉框，没有"地图点目标"管线、范围测量板、批量结算窗口 |
| HUD | ⚠️ 200 行布局壳，无快捷栏、无资源条、无动作经济点 |
| 装备/造物 | ❌ ItemDefinition 有 enhanceSlots/gemSlots 两个数字字段，无装备槽枚举、无组件网格、无生活职业 → 槽位映射 |
| 命刻/物语点/事件 | ✅ schema + 服务可用；⚠️ UI 与战斗管线接通待补 |

---

## 3. 资产层级（核心包 / 扩展包 / 私设包）

### 3.1 三层模型

| 层级 | 谁维护 | 是否可关闭 | 是否可导出 | 用途 |
|---|---|---|---|---|
| **核心包**（core） | 平台/我手填 | ❌ 不可关闭 | ❌ 不导出 | AAF 规则书 SRD 内容（种族/职业/武器/护甲/基础能力/天赋树骨架） |
| **扩展包**（extension） | 平台或社区 | ✅ GM 可开关 | ✅ 可导入导出 | 主题副本、独立模组、变体规则 |
| **私设包**（homebrew） | GM 自己 | ✅ 该世界独有 | ✅ 可导出供他人用 | 该 GM 的私货 |

结算优先级：私设 > 启用的扩展 > 核心。后者只在前者未覆盖时生效。

### 3.2 实现要点（Phase B 落地）

- 新增 Prisma 表 `AssetPack`（id, kind=core|extension|homebrew, name, version, manifest JSON, enabled, worldId nullable）。
- 所有现有 `AbilityDefinition / RaceDefinition / ProfessionDefinition / ItemDefinition / FateClock / DeckDefinition / RandomTable` 加 `packId` 外键，标识来源。
- `pack.service.ts`：注册核心包、加载/卸载扩展包、私设包导入导出。
- 启动时自动确保每个 World 都关联了 core pack（不可解除）。

---

## 4. 自动化模型（对齐 FVTT 生态）

### 4.1 概念对齐表

| AAF 概念 | FVTT 等价 | 备注 |
|---|---|---|
| AbilityDefinition | Item + Activity | 一个能力一个文档 |
| AbilityActivity | Activity (Attack/Save/Damage/Utility/Heal) | 后续引入活动子类型；当前先以单活动能力执行 |
| AbilityWorkflowRun | Midi-QOL Workflow | 每次能力执行的阶段记录、自动化模式、伤害应用和撤销快照 |
| EffectInstance | ActiveEffect | 持续效果挂在角色/token上 |
| 触发器 trigger | MidiQOL Workflow Hook | preItemRoll → preAttackRoll → onAttackRollComplete → preDamageRoll → preApplyDamage → postActiveEffects |
| 反应触发 | MidiQOL TPR (Third-Party Reaction) | 例：受攻击前/被命中后 |
| Concentration | Concentration | 法术专注，新法术覆盖旧 |
| ATL 灯光跟随 | ATL/Active Token Lighting | 火炬术等附加在 token 上的光源 |
| ActiveEffect change key | "data.attributes.ac.bonus" | 我们用 `attrPath` 表达 |

### 4.2 Workflow 钩子（服务端）

战斗能力一次执行的标准流水（已作为 `AbilityWorkflowRun.phases` 落地）：

```
1. declare              — 玩家点能力 → 生成 workflow id
2. target-confirmation  — 选择/确认目标
3. cost-check           — 资源/动作经济校验与消耗
4. reaction-window      — 反应、打断、第三方反应窗口
5. attack-roll          — 命中检定
6. save-roll            — 豁免/对抗检定
7. damage-roll          — 伤害掷骰
8. damage-application   — 抗性/免疫/临时 HP/实际扣血
9. effect-application   — 状态、标签、治疗、持续效果挂载
10. post-apply          — 专注、持续伤害、击破检测、后置触发
11. settle              — 写日志、快照和后续 Socket
```

每一步可以被规则 trigger 监听并插入效果。没有用到的阶段标记 `skipped`，需要 GM/玩家确认的阶段标记 `waiting`，不能在前端另起一套隐藏流程。

### 4.3 自动化模式

- `manual`：手动预览，只产出 workflow 和结算卡，不真实扣资源/扣血/应用效果。
- `assisted`：半自动，内部测试默认。自动掷骰和应用当前可处理的结果，同时保留 workflow、撤销快照和人工修正空间。
- `full`：全自动，目标确认、掷骰、判定、应用伤害和效果都走自动阶段。

`reactionStrat` 仍用于单个反应/被动能力的“始终问 / 智能问 / 自动”，但它是 workflow 阶段内的策略，不再代表整个自动化系统的开关。

---

## 5. 天赋树系统升级（专题）

天赋树是角色 1 级以后所有能力的来源，现有大厅预览只是雏形。本期目标：做成 PoE / Diablo IV 风格的可视化、互动、流畅的学习界面。

### 5.1 视觉规格

- **节点**：圆形或六边形图标，三态 — 已学（金边发光）/ 可学（蓝边脉动）/ 锁定（灰）。研习节点用环形进度（5/5 等级）。排他节点带禁用斜杠图标。通晓节点带 ✦ 角标。
- **连线**：父子用 SVG path，已学路径金色流光，可学路径蓝色虚线，锁定路径灰色。
- **背景**：星图风格，每个职业有专属背景纹路（剑/盾/法杖星座）。
- **动画**：学习时节点爆发金光 + 微震，回退时收缩。

### 5.2 交互规格

- 鼠标滚轮缩放（0.5x – 2.0x）+ 拖拽平移。
- 左键节点：右侧滑出详情卡（描述、词缀、消耗、前置链）。
- 双击节点：消耗 1 点天赋点学习（研习节点可重复双击升级）。
- 右键节点：显示菜单（试算路径、回退、添加到对比）。
- "试算模式"：所有学习先入草稿，确认后批量提交，可随时取消。
- "路径预览"：悬停未学节点时高亮从已学到该节点的最短前置链。
- "重置树"：按钮 + 二次确认 + 服务端重置（消耗道具或免费由 GM 决定）。

### 5.3 多树切换

- 角色侧栏列出该角色所有 PROFESSION 树（每职业一棵）+ 1 棵 GENERAL 树。
- 标签页切换 + 当前树名 + 剩余 TP（职业TP / 通用TP 分别显示）。

### 5.4 复用契约

- 已有 `shared/rules/talent-tree.ts` 的判定函数（canUnlock, canLearn, prune）必须复用，不准复制第二套逻辑。
- Phase D 只做 UI/UX 升级 + 交互层，规则判定不动。

---

## 6. 装备槽 + 魔法物品组件网格（预留架构）

### 6.1 装备槽枚举（schema 现在就要预留，实装推迟到生活职业/造物规则成熟后一起做）

```ts
type EquipSlot =
  | "head"      // 头饰
  | "neck"      // 颈部 — 吊坠、项链
  | "accessory" // 饰品 — 耳环、发簪、胸针
  | "back"      // 背部
  | "robe"      // 衣袍
  | "enchant"   // 附魔
  | "armor"     // 盔甲
  | "bracer"    // 护腕
  | "ring"      // 戒指
  | "belt"      // 腰带
  | "feet"      // 双脚
  | "weapon"    // 武器
  | "treasure"; // 宝物栏
type ConsumableSlot = "consumable"; // 不占装备栏
```

**默认槽位数量**（可被能力突破，例如机兵士天赋 +2 宝物槽）：

| 槽位 | 默认数量 |
|---|---|
| ring | 2 |
| treasure | 4 |
| 其他所有 EquipSlot | 1 |

实现：Character.snapshot 缓存 `equipSlotLimits: Record<EquipSlot, number>`，由派生函数 `getEquipSlotLimits(character)` 从基础值 + ActiveEffect 计算得出。

### 6.2 生活职业 → 槽位映射

```ts
const LIFE_PROFESSION_SLOTS: Record<LifeProfession, EquipSlot[]> = {
  alchemy:    ["consumable"],
  smithing:   ["head", "feet", "weapon", "armor", "shield"],
  enchanting: ["staff", "wand", "scepter"], // 归入 weapon 子分类
  inscription:["scroll"],                    // 归入 consumable 子分类
  engineering:["gadget"],                    // 杂项 / 奇械
  jewelry:    ["accessory", "ring"],
  leatherwork:["back", "robe", "bracer", "belt"],
};
```

### 6.3 魔法物品组件网格

- `MagicItem` 字段：
  - `baseGridWidth` / `baseGridHeight` — 默认由稀有度推导（普通 1×1、非凡 2×2、依此类推）
  - `gridOverride` — 可空，**特殊魔法物品天生不一样的网格**直接覆盖稀有度默认值
  - `gridExpansions` — Record<expansionId, {dx, dy}>，玩家通过能力扩充网格的累加项；最终网格 = override ?? base + Σ expansions
  - `baseStats`、`baseAbilities`
- `MagicItemComponent` 字段：`shape`（[w,h] 矩形或将来 polyomino）、`offsetX`、`offsetY`、`rotation`（0/90/180/270）、`tags`（用于将来 position/direction/synergy 规则）。
- `Inventory` 表：character_id × item_id × component_layouts JSON。
- 服务端校验：组件不重叠、不越界。
- **预留扩展位**：`positionConstraint`（leftmost/rightmost/center/null）、`adjacencyBonus`（Record<direction, bonusRule>）、`setId`（同套装羁绊）。这些字段先存进 schema，规则代码留 TODO。

### 6.4 造物（Crafting）

按规则规格 §11 已定义：工期推进、自动造物、双槽位机制。Phase H 落地最小可用版本。

---

## 7. 角色资源系统（Phase A/C 联动）

每个角色（Character）需要结构化的资源池，替换现有 `stats: Json` 模糊存储：

```ts
type CharacterResources = {
  hp:      { current: number; max: number; temp: number };
  mp:      { current: number; max: number };
  fury:    { current: number; max: number };       // 战意
  skill:   { current: number; max: number };       // 技力
  story:   { current: number };                    // 物语点（无上限）
  inspiration: { count: number; dice: "d6"|"d8"|"d10"|"d12" }; // 激励骰
  hero:    { count: number };                      // 英雄骰，最多1
  actions: {
    standard: number; swift: number; move: number;
    free: number; reaction: number; compound: number; special: number;
  };
};
```

派生值（AC、初始 HP/MP/Fury 上限、熟练加值）由 `shared/rules/derive.ts` 纯函数从 race + profession + level + equipment + activeEffects 算出，存入 Character.snapshot 缓存。

---

## 8. 场景与战斗（Phase D/E）

### 8.1 场景真实化

- 重写 WorldCanvas 为**网格坐标系**：内部状态用 (gx, gy) 而非 px。渲染层把 (gx, gy) × cellSize 转 px。
- 真实渲染：背景图层 → 网格层 → 雾层（mask） → 光源层（多光源叠加 darkness） → token 层 → 测量板覆盖层 → HUD 浮层。
- 场景管理：GM 创建/重命名/排序/删除/克隆/切换 + 编辑网格（5尺方格/六角）+ 上传背景 + 摆光源 + 涂雾 + 切预设（战斗/休息/地下城/叙事）。
- Token 必须绑定 Character（或 Monster）；无绑定的 token 称为"标记"（marker），仅用于位置标识。

### 8.2 战斗管线

- "开战"按钮：收集场景内有 actor 的 token → 服务端 `rollInitiative(token)` → 写入 SceneCombatState.participants（含 initiative roll、actorId、resources 快照）。
- 回合开始钩子：恢复战意 → 触发回合开始效果（中毒、燃烧 DOT）→ 命刻推进 → 推送当前角色资源面板。
- 动作经济追踪：当前 token 本回合剩余资源（标/快/机/复/反），消耗后变灰。
- 反应窗口：服务端实现"后发先至"队列（规则书第 152 行）。
- 回合结束：写日志 → 触发回合结束效果 → turnIndex++ → 满轮则 round++ → 重新进入回合开始钩子。

### 8.3 HUD + 能力执行（Phase F/G）

- HUDPanel = 当前角色头像 + 资源条（HP/MP/战意/技力点）+ 动作经济 7 个点位 + 快捷栏（10 格）+ 战斗序列条收纳。
- 玩家从角色卡能力列表拖能力到快捷栏。
- 点能力按钮 → 进入"目标选择模式"（光标变准星，画布上 token 高亮可选；范围能力出测量板，鼠标移动定落点，滚轮转朝向）→ 左键确认 → 服务端调起 §4.2 工作流。
- 飘字、命中弹幕、HP 条变化通过 Socket 推送给所有人。
- 反应触发档位由 AbilityDefinition.reactionStrat 决定。

---

## 9. 路线图（分期 + Acceptance）

每期完成后必须通过对应 acceptance 才能进入下一期。

### Phase A — 规则地基（约 1 周）
**做**：在 `shared/rules/` 加：
- `constants.ts` — 属性调整值表、熟练加值表、等级XP表、护甲基础值表、武器属性枚举、动作经济枚举、伤害类型枚举、装备槽枚举、生活职业枚举、词缀枚举。
- `derive.ts` — 纯函数：`getAttrMod`、`getProficiency`、`getMaxHp`、`getMaxMp`、`getMaxFury`、`getMaxSp`、`getAC`、`rollInitiative`、`rollD20WithBonusDice`。
- `damage.ts` — 伤害类型表、抗性/易伤/免疫求解。
- 单元测试覆盖率 ≥ 80%。

**Acceptance**：所有公式与规则书第 1–500 行对得上；后续模块只通过这些函数读规则。

### Phase B — 资产包加载机制（约 1 周）
**做**：
- Prisma 加 `AssetPack` 表 + 现有实体表加 `packId` 外键。
- `pack.service.ts`：核心包注册（空数据，仅占位 manifest）+ 扩展包/私设包加载/卸载/导入/导出 + 启动时自动绑定每个 World 到 core pack。
- GM 系统板加"资产包"页：列出 enabled packs、上传扩展包 JSON、导出私设。
- **不录入任何规则数据**，等用户手填。

**Acceptance**：能创建一个空世界，自动挂上 core pack；GM 能上传/启用/禁用扩展包；私设导出后能在另一世界导入。

### Phase C — 角色资源 + 创建向导（约 1.5 周）
**做**：
- Character 表加 `resources Json`（结构见 §7），写迁移脚本。
- 重构 CharacterSheetWorkbench：拆 10 个步骤组件（按规则书 168 行那 10 步）。
- 每步实时调 Phase A 公式算 AC/HP/MP/熟练加值/战意/技力，并写 snapshot。
- 装备穿脱重算 AC（消费 Phase H 的装备槽 schema，但允许此期先简单实现）。
- 角色卡导入导出 schemaVersion 升级。

**Acceptance**：能从零创建一个角色，所有派生值自动算对；穿脱装备 AC 实时变化；JSON 导入导出可往返。

### Phase D — 天赋树视觉与交互升级（约 2 周）
**做**：见 §5。复用现有 `shared/rules/talent-tree.ts` 判定。
- 重做大厅预览器 + 角色试用页为统一组件。
- 引入 SVG/Canvas 渲染节点 + 连线 + 流光。
- 缩放/拖拽/详情卡/试算模式/路径预览/重置。
- 多树切换 + 双 TP 显示。

**Acceptance**：流畅的 60fps 缩放拖拽；学习/回退动画明显；研习/排他/通晓视觉化无歧义；与现有判定函数 100% 一致。

### Phase E — 场景真实化（约 1.5 周）
**做**：见 §8.1。重写 WorldCanvas 为网格坐标系；接通光照/雾/背景图渲染；token ↔ Character 绑定。

**Acceptance**：GM 能创建场景、设网格、传背景、摆光源、涂雾；玩家从角色卡能投放 token 到场景；token 显示头像 + HP 条 + 状态徽标 + 视野圈。

### Phase F — 战斗管线 + 能力工作流（约 2.5 周）
**做**：见 §4.2 + §8.2 + §8.3。这是最大一期。
- 服务端 ability:* 工作流。
- 客户端目标选择模式 + 范围测量板。
- 自动先攻 + 动作经济追踪 + 反应窗口。
- 飘字 / HP 变化 / 战斗日志卡片。

**Acceptance**：能从"开战"一路打到一个 token HP 归零；多段攻击 + 目标失效续攻可工作；范围法术覆盖正确（半格判定按规则规格 §8.3）；战斗日志可回放。

### Phase G — HUD + 快捷栏 + 飘字打磨（约 1 周）
**做**：HUDPanel 改造为 §8.3 描述的样子。Battle FX（飘字、命中震动、HP 条流光）打磨到 BG3 体验。

**Acceptance**：玩家不打开任何菜单也能完成一回合战斗（点快捷栏 → 点目标 → 看飘字）。

### Phase H — 装备 + 魔法物品 + 生活职业 + 造物（**推迟，规则未敲定**）
用户口头：这四块"要写好就是一起写好的"。本期**不实装**，仅做：
- §6.1 装备槽 enum、§6.2 生活职业映射、§6.3 物品网格字段、§7 角色资源里的装备槽数量缓存 — **写进 schema 与 shared/types**，让其他模块（角色卡、ActiveEffect 修改器）可以引用类型，但不参与计算。
- 在 `docs/装备造物预留设计.md` 收纳已决约定 + 待补规则清单，等用户补完规则后启动真正的 Phase H。

**Acceptance**：schema 与类型字段就位且通过 TS 编译；预留 `// TODO: 等生活职业规则` 注释；不影响其他模块运行。

### Phase I — 命刻 / 物语点 / 剧情事件接通（约 0.5 周）
**做**：现有 schema + 服务已基本就绪。仅做：
- 命刻在战斗回合钩子上自动推进（如规则书第 122–139 行）。
- 物语点重骰 / 触发命途接入战斗工作流（§4.2 步骤 5/6 之后可消耗物语点重骰）。
- 剧情事件 + 检定与战斗外检定共享 dice 引擎。

**Acceptance**：完成规则规格 §16 的最小闭环。

### 总计：约 12–14 周

---

## 10. 文档治理

### 退役（已删除 2026-04-27）
- `docs/AAF总计划.md`
- `docs/世界资源包-JSON导入指南.md`
- `docs/聊天启动指南.md`
- `docs/更新日志.md`
- `世界需求与填写清单.md`

### 保留（仍权威）
- `规则书.txt` / `AAF世界设定.txt` — 真理来源
- `docs/规则规格-战斗与造物系统-v1.md` — 规则与代码的桥梁（本文件多处引用其条款）
- `docs/接口契约.md` + `docs/Socket事件契约.md` + `docs/interface-registry.json` — 工程契约
- `docs/命名规范.md` — 工程规范
- `docs/世界模板实现蓝图.md` — 世界页 UX/权限/自动化变更必须同步
- `docs/modules/*.md` — 模块卡片，每期完成后更新对应卡

### 新建（本文件 + 待新建）
- ✅ `docs/AAF实装总规划.md`（本文件）
- ⏳ `docs/AAF核心规则常量映射.md`（Phase A 输出，规则书 → shared/rules 字段映射表）
- ⏳ `docs/天赋树设计文档.md`（Phase D 启动前细化 §5）
- ⏳ `docs/装备造物预留设计.md`（Phase H 启动前细化 §6）
- ⏳ `docs/能力工作流契约.md`（Phase F 启动前细化 §4.2 钩子签名）

### 角色卡设计文档
- 保留 `角色卡设计文档.md`，每次 schemaVersion 变化时更新。

---

## 11. 验收门槛（全局）

每期至少验证三类用例：
1. **正常路径**：标准用法成功。
2. **权限边界**：玩家不能做 GM 操作；只读身份不能写。
3. **异常路径**：资源不足、目标失效、并发冲突的回滚正确。

每期完成后：
- 更新对应模块卡 `docs/modules/0N-*.md` 的"当前约定"。
- 世界面变更同步 `docs/世界模板实现蓝图.md` §9。
- 接口或事件变更同步 `docs/接口契约.md` + `docs/Socket事件契约.md` + `docs/interface-registry.json`。
- 在本文件 §12 追加一段"已完成 + 影响 + 下一步"。

---

## 12. 已完成 / 进行中（迭代日志）

### 2026-04-27 — 规划立项
- 退役 5 篇旧文档。
- 写本规划文档。
- 与用户确认资产层级三层模型、装备槽枚举（13 类含颈部）、槽位数量（戒指×2 / 宝物×4 / 其他×1，可被能力突破）、生活职业映射、天赋树为核心进步器、冒险职业 10 级（1–3 有特性）、装备造物生活职业三件套捆绑推迟。
- 三张升级表（XP / MP / 升级表）补充进 §14 与 Phase A 的 LEVEL_PROGRESSION_TABLE 来源。
- **下一步**：等用户批准后启动 Phase A。

---

## 13. 自动化参考资料

FVTT DnD5e 生态对本项目的设计启发，对应概念见 §4.1。

- [MidiQOL — Foundry VTT package](https://foundryvtt.com/packages/midi-qol)
- [Active Effects — Foundry official article](https://foundryvtt.com/article/active-effects/)
- [dnd5e Active Effect Guide — GitHub Wiki](https://github.com/foundryvtt/dnd5e/wiki/Active-Effect-Guide)
- [dnd5e API Reference — DeepWiki](https://deepwiki.com/foundryvtt/dnd5e/6.1-api-reference)
- [Activity Type: Attack — dnd5e Wiki](https://github.com/foundryvtt/dnd5e/wiki/Activity-Type-Attack)
- [Dynamic Active Effects (DAE) — package](https://foundryvtt.com/packages/dae)
- [Active Token Effects (ATL) — package](https://foundryvtt.com/packages/ATL)
- [Automated Conditions 5e — package](https://foundryvtt.com/packages/automated-conditions-5e)
- [Ready Set Roll for D&D5e — package](https://foundryvtt.com/packages/ready-set-roll-5e)
- [Cauldron of Plentiful Resources (Chris's Premades) — package](https://foundryvtt.com/packages/chris-premades)

我们**不直接采用** FVTT 的代码或数据格式，只在概念层对齐 — 因为对接 SRD 法务、技术栈差异（Web + Prisma vs 本地 + JSON）、玩家群体定位都不同。

---

## 14. 用户已确认约定（2026-04-27 第二轮对话）

- 冒险职业**最高 10 级**，目前规则书只写了 1–3 级特性，4–10 级未来可能补；进阶能力主要走天赋树。
- 每升 1 级人物等级 = +1 冒险职业等级 + +1 生活职业等级。
- 角色升级表（熟练加值 / 属性值提升 / 职业TP / 通用TP / 魔力上限）— 与规则书图表完全一致，落进 `shared/rules/constants.ts` 的 `LEVEL_PROGRESSION_TABLE`。
- 经验表（1→0, 2→300, ..., 20→355,000）— 同上。
- 魔力值表（1→4, 2→7, ..., 20→150）— 同上。
- 装备槽 13 类：头饰 / 颈部 / 饰品 / 背部 / 衣袍 / 附魔 / 盔甲 / 护腕 / 戒指 / 腰带 / 双脚 / 武器 / 宝物栏（+ 消耗品独立栏）。
  - 颈部 = 吊坠/项链；饰品 = 耳环/发簪/胸针。
- 默认槽位数量：戒指 ×2、宝物栏 ×4、其他全 ×1；可被能力突破（例：机兵士 +2 宝物槽）。
- 生活职业 → 槽位映射见 §6.2。
- 魔法物品基础网格由稀有度决定（普通 1×1, 非凡 2×2…）；**特殊物品可天生覆盖**；玩家**可通过能力扩充**网格。
- 组件占网格空间，背包整理风。预留 position / direction / synergy 三种未来约束。
- **装备/造物/生活职业三件套必须一起做**，规则未完整前 Phase H 只做 schema 与类型预留。
