# AI 上下文记忆文档

本文档用于在跨会话开发时，为新的 AI 对话快速恢复项目背景、当前阶段、已完成事项、关键决策和下一步动作。这个文档不是产品介绍，而是开发记忆载体。后续每次完成重要步骤后，都应该立刻更新本文件。

## 1. 项目身份

### 1.1 项目名称

暂定名称：FVTT 风格 TRPG 平台

### 1.2 项目目标

这是一个为自定义 TRPG 规则开发的网页版虚拟桌面平台，目标是同时提供：

1. 多人实时在线跑团能力。
2. 基础社交能力，例如登录、世界、大厅、聊天。
3. VTT 画布能力，例如场景、Token、同步。
4. AI 增强能力，例如智能 NPC 与 GM 助手。

### 1.3 当前技术方向

1. 前端：React SPA。
2. 后端：Node.js + Express。
3. 实时通信：Socket.IO。
4. 数据库：SQLite。
5. ORM：优先 Prisma。

### 1.4 当前开发策略

项目采用渐进式开发，不追求一次写完全部功能。优先顺序为：

1. 工程骨架。
2. 鉴权。
3. 世界管理。
4. WebSocket 基础。
5. 最小 VTT。
6. 场景与角色卡。
7. AI 功能。

---

## 2. 关键业务定义

### 2.1 用户角色

1. GM：创建世界、管理场景、配置 NPC、主持流程。
2. Player：加入世界、参与聊天、操作角色、与 AI NPC 互动。

### 2.2 核心业务对象

1. User：平台用户。
2. World：跑团房间。
3. WorldMember：世界成员关系。
4. Scene：世界中的地图或场景。
5. Character：角色卡，包含 PC 和 NPC。
6. Message：聊天消息。
7. AiSession：AI NPC 对话记录。

### 2.3 MVP 主链路

MVP 首先必须跑通以下流程：

用户注册/登录 -> 进入大厅 -> 创建世界 -> 加入世界 -> 进入最小 VTT 页面 -> 拖动 Token 实时同步 -> 在聊天室发送消息。

如果这条链路没有稳定，不应提前进入复杂扩展开发。

---

## 3. 当前阶段状态

### 3.1 总体阶段清单

- 阶段 0：需求冻结与文档准备
- 阶段 1：项目骨架初始化
- 阶段 2：数据库与后端基础设施
- 阶段 3：认证系统
- 阶段 4：世界管理
- 阶段 5：全局聊天与 WebSocket 基础
- 阶段 6：最小 VTT Token 同步
- 阶段 7：场景系统、角色卡、世界内聊天
- 阶段 8：AI 酒馆与 GM 助手
- 阶段 9：部署、安全、性能整理

### 3.2 当前所处阶段

当前处于：阶段 8 迭代 B（实施中）。

### 3.3 当前最近目标

下一步目标：在剧情事件MVP已持久化的基础上，继续推进剧情扮演增强（物语点剧情风暴审核流、事件与聊天双向检索）并准备AI助手读取策略接入。

---

## 4. 已确认的关键决策

### 4.1 架构决策

1. 采用前后端分离架构。
2. 采用 HTTP + WebSocket 双通道。
3. 前端是 SPA，后端独立提供 API 和 Socket 服务。

### 4.2 数据层决策

1. 初期数据库使用 SQLite，降低部署门槛。
2. ORM 优先 Prisma，因为类型边界更清晰。
3. 即使某些表在 MVP 不全面使用，也可以先定义 schema，为后续扩展留接口。

### 4.3 实时同步决策

1. VTT 同步优先发增量事件，不频繁整图同步。
2. 每个世界应映射为独立 Socket room。
3. 第一版先同步 Token 位置，不先同步全量复杂 Fabric 对象。

### 4.4 功能优先级决策

1. 先做登录、世界、聊天室、最小 VTT。
2. 好友系统可以后置。
3. AI 酒馆和 GM 助手必须后置到基础业务稳定之后。
4. FRIENDS 和 PRIVATE 世界权限可以先保留字段，延后完整实现。

### 4.5 v0.1 冻结需求覆盖

以下条目以需求清单的填写结果为准，优先级高于本文件早期“建议项”。

1. 平台角色不是简单 GM/Player，而是平台级 MASTER/Admin/Player + 世界级 GM。
2. 平台管理员后台为 P0，必须在前中期纳入开发路线。
3. 世界可见性四种模式 PUBLIC/PASSWORD/FRIENDS/PRIVATE 全部是 P0，不再后置。
4. 第一版目标包含完整大厅系统与社交体系（好友、私聊、公告、公开聊天）。
5. VTT 的网格、测量、绘图不再延后，均为 P0。
6. Token 必须绑定角色卡，角色卡快照与玩家自编辑为 P0。
7. AI 酒馆不进入 MVP，GM 助手 P2 后置；AI 超预算时仅 GM 可用。
8. 部署目标先按 Windows 桌面 + 2核4G 规划。
9. 参数已补齐：头像 50MB、场景上限 500、SLA 99.9%、邀请链接 365 天、JWT 365 天。
10. 架构强约束：前后端与数据库分目录；酒馆独立目录；世界内功能组件模块化。

### 4.6 参数确认状态

所有阶段 0 关键参数已确认并闭合，无阻塞项。

---

## 5. 文档可信度说明

当前工作区里已有两份原始文档：

1. 技术栈文档。
2. 项目文档。

需要注意：项目文档后半段混入了历史 AI 对话与项目概述草稿内容。后续新 AI 读取时，应该优先提炼其中的有效业务信息，不应把“请生成项目概述”这类提示性文字误当成产品需求本身。

---

## 6. 代码实施前的推荐目录结构

建议未来代码结构如下：

```text
AAF/
  client/
  server/
  shared/
  docs/
  技术栈.md
  项目文档.md
  渐进式开发文档.md
  AI上下文记忆文档.md
```

如果后续未建立 shared 或 docs，也至少要保持 client 与 server 清晰分离。

---

## 7. 每次重要改动必须追加的记录格式

从下一次开始，每完成一个重要步骤，都按下面格式追加一条记录。

### 记录模板

```md
## [YYYY-MM-DD HH:mm] 变更标题

阶段：

本次完成：
1.
2.
3.

涉及文件：
1.

新增接口：
1.
2.

新增数据模型或字段：
1.
2.

新增 Socket 事件：
1.
2.

未解决问题：
1.
2.

下一步：
1.
2.
```

---

## 8. 当前待办总表

### 8.1 最高优先级

1. 完成阶段 7 收尾文档同步，统一当前阶段状态。
2. 在进入阶段 8 前，与用户确认酒馆与 AI 助手需求。
3. 明确阶段 8 的输入输出边界、模型调用策略与历史记录范围。
4. 决定是否先做阶段 7 的体验增强项，再进入 AI 开发。

### 8.2 第二优先级

1. 扩展角色卡更多结构化字段与表单校验。
2. 细化世界内频道权限策略（如 IC 权限分级）。
3. 增加多 Scene 聚合视图或更强的场景管理交互。
4. 评估是否需要补更多端到端体验测试。

### 8.3 第三优先级

1. 阶段 9 的部署、安全、性能整理前置规划。
2. AI 相关环境变量与服务层骨架预留。
3. 后续部署文档、备份策略和生产环境核查。

---

## 9. 未来 AI 接手时的工作规则

新的 AI 对话接手这个项目时，必须遵守以下规则：

1. 先读技术栈文档。
2. 先读项目概述相关内容。
3. 先读渐进式开发文档，确定当前应该做哪个阶段。
4. 先读本记忆文档，确认已经完成到哪里。
5. 不要跳阶段开发。
6. 每次只做一个清晰的阶段目标或一个清晰的子任务。
7. 完成后必须更新本记忆文档。
8. 若新增接口或事件，必须同步更新 docs/interface-registry.json。
9. 若新增命名规则，必须同步更新 docs/naming-convention.md。

---

## 10. 当前对下一次开发最重要的提示

如果下一次要直接开始写代码，应该从以下目标开始：

目标：进入阶段 5，打通全局聊天与基础 WebSocket 实时链路。

最小任务顺序：

1. 定义并实现 socket 身份校验中间件。
2. 实现 global 消息发送与广播事件。
3. 实现世界房间 join 事件与在线成员映射。
4. 同步写入 Message 表，保留最小历史查询接口。
5. 前端接入实时消息监听与发送。
6. 同步更新接口注册表、变更日志和记忆文档。

不要一开始就做：

1. 好友系统全量功能。
2. 复杂场景编辑器。
3. AI 酒馆业务逻辑。
4. GM 助手流程。
5. 高级部署优化。

---

## 11. 变更记录

## [2026-03-16 11:35] 阶段 8 体验对齐：迁移 OLD AAF 登录主题与入场动效

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 将旧项目登录视觉资源迁移到新前端（`loginbg.jpg`、`logoae.gif`、`login.png`）。
2. 新增统一认证页组件，登录页与注册页复用同一“点击按钮后再选择登录/注册”的交互模式。
3. 复刻旧版登录入场节奏：背景层 + 粒子下落 + Logo 入场 + 按钮延迟坠落。
4. 新增鉴权页全屏模式，在 `/login` 与 `/register` 隐藏全局 Header，确保沉浸式开场。
5. 补齐前端静态资源类型声明，修复图片资源导入的 TypeScript 报错。

涉及文件：
1. client/src/pages/auth/AuthCinematicPage.tsx
2. client/src/pages/auth/LoginPage.tsx
3. client/src/pages/auth/RegisterPage.tsx
4. client/src/styles/index.css
5. client/src/App.tsx
6. client/src/vite-env.d.ts
7. client/src/types/assets.d.ts
8. client/src/assets/auth/loginbg.jpg
9. client/src/assets/auth/logoae.gif
10. client/src/assets/auth/login.png
11. docs/change-log.md
12. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

验证结果：
1. 前端构建通过：`npm run build -w client`。

未解决问题：
1. 目前仍为“最小复刻版”开场，尚未加入旧站 CloudGate 云层转场特效。

下一步：
1. 继续把旧站其他核心页面（大厅/世界）主题色系统化迁移到新站变量体系。
2. 视需要再补“可跳过开场动画”显式按钮与动画时长配置项。

## [2026-03-16 13:05] 工程修复：server 启动脚本移除 dotenv-cli 依赖

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 修复 `aaf-server` 的 `dev/start/prisma` 脚本，移除对 `dotenv-cli` 命令的硬依赖。
2. 统一改为依赖 `server/src/config/env.ts` 自动加载根目录 `.env`。
3. 避免 Windows 环境下出现 `'dotenv' 不是内部或外部命令` 的启动失败。

涉及文件：
1. server/package.json
2. docs/change-log.md
3. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

未解决问题：
1. 当前环境仍需补齐依赖安装，缺少 `@prisma/client` 时 server 无法继续启动。

下一步：
1. 完成依赖安装后重新验证 `npm run dev -w server`。

## [2026-03-16 12:50] 阶段 8 核心推进：AI 助手受控生成与聊天回写闭环

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 新增受控生成接口：`POST /api/worlds/:worldId/assistant/respond`。
2. 接口会先读取 `assistant/context`，再生成一条 AI 助手草案消息写回世界 SYSTEM 频道。
3. tavern 模块新增本地 fallback 草案生成逻辑，用于真实模型接入前的最小闭环验证。
4. 世界页新增最小触发入口，可直接生成 AI 助手草案并回显到聊天区。

涉及文件：
1. server/src/modules/tavern/tavern.service.ts
2. server/src/modules/tavern/tavern.service.test.ts
3. server/src/services/assistant-response.service.ts
4. server/src/controllers/assistant-response.controller.ts
5. server/src/routes/world.routes.ts
6. client/src/pages/world/WorldPage.tsx
7. docs/api-contract.md
8. docs/interface-registry.json
9. docs/change-log.md
10. AI上下文记忆文档.md

新增接口：
1. POST /api/worlds/:worldId/assistant/respond

新增数据模型或字段：
1. 无新增表；复用 Message.metadata.aiAssistantContextTag 存储草案生成来源信息。

新增 Socket 事件：
1. 无。

未解决问题：
1. 当前为本地 fallback 草案模式，尚未调用真实 tavern adapter / 模型 API。
2. 生成结果目前通过 HTTP 回写聊天，尚未补充独立的 assistant 事件流。

下一步：
1. 将 fallback 生成边界替换为真实 tavern adapter 调用。
2. 视需要增加 AI 助手草案审核/应用流，与后续世界书写回衔接。

## [2026-03-16 12:25] 阶段 8 核心推进：AI 助手上下文读取接口（事件卡优先）

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 新增世界级 AI 助手上下文接口：`GET /api/worlds/:worldId/assistant/context`。
2. 上下文聚合策略明确为“先事件结算卡片，再最近聊天消息”。
3. 支持 sceneId 过滤与 hours/cardLimit/messageLimit 参数，便于控制读取范围。
4. 返回结构包含 policy、storyEventCards、recentMessages、hints，供后续 AI 接入直接消费。

涉及文件：
1. server/src/services/assistant-context.service.ts
2. server/src/controllers/assistant-context.controller.ts
3. server/src/routes/world.routes.ts
4. docs/api-contract.md
5. docs/interface-registry.json
6. docs/change-log.md
7. AI上下文记忆文档.md

新增接口：
1. GET /api/worlds/:worldId/assistant/context

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

未解决问题：
1. 当前仅完成“读取上下文”接口，尚未接入 tavern adapter 实际模型调用链。

下一步：
1. 以该接口为输入，接入最小 AI 生成链路（受控触发 + 回写世界聊天）。

## [2026-03-16 12:00] 项目治理：新增优化池文档并冻结核心优先策略

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 新增《项目优化文档》，集中登记核心功能之外的优化项。
2. 明确“核心功能优先”执行规则：核心未闭环前不插入优化开发。
3. 建立优化项准入机制（里程碑验收后再排期，按 P1/P2/P3 管理）。
4. 将当前若干体验增强项（如聊天上下文分页、高级动效）统一归档为延期项。

涉及文件：
1. 项目优化文档.md
2. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

未解决问题：
1. 优化项具体排期需在当前核心里程碑验收后再统一评估。

下一步：
1. 严格按阶段 8 核心功能推进（剧情事件主链路、造物系统、AI助手读取链路）。

## [2026-03-16 11:40] 阶段 8 剧情扮演增强：精确消息定位与事件自动滚动

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 新增世界聊天精确读取接口：`GET /api/chat/worlds/:worldId/messages/:messageId`。
2. 世界页“定位到聊天区”改为先按 messageId 精确读取目标消息，再拉取 recent 并合并展示。
3. 聊天定位支持超出 recent 100 窗口的历史消息，不再仅依赖最近窗口。
4. 若目标消息所在场景与当前场景不一致，前端会自动切换到目标场景后再定位。
5. 事件定位增强：目标事件卡片自动滚动到视口可见区域并高亮提示。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/controllers/chat.controller.ts
3. server/src/routes/chat.routes.ts
4. client/src/pages/world/WorldPage.tsx
5. client/src/world/components/StoryEventPanel.tsx
6. docs/api-contract.md
7. docs/interface-registry.json
8. docs/change-log.md

新增接口：
1. GET /api/chat/worlds/:worldId/messages/:messageId

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

未解决问题：
1. 聊天定位目前为“精确消息 + recent窗口合并”，尚未提供按目标消息前后文分页浏览能力。

下一步：
1. 如需更完整回看体验，可新增“按锚点加载前后文”接口与前端上下翻页能力。

## [2026-03-16 11:10] 阶段 8 剧情扮演增强：检索筛选与消息定位

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 双向检索新增结构化筛选参数：eventStatus、channelKey、hours。
2. 前端检索表单新增状态/频道/时间筛选输入，并透传到检索接口。
3. 检索结果中的聊天命中项支持“一键定位到聊天区”。
4. 聊天区新增目标消息高亮，便于快速回看上下文。
5. 检索结果中的事件命中项支持“一键定位到事件区”并高亮卡片。
6. 新增后端检索纯函数自动化测试，覆盖参数校验与关联提取规则。

涉及文件：
1. server/src/services/story-event.service.ts
2. server/src/controllers/story-event.controller.ts
3. client/src/world/components/StoryEventPanel.tsx
4. client/src/pages/world/WorldPage.tsx
5. docs/api-contract.md
6. docs/change-log.md

新增接口：
1. 无新增路径；扩展 GET /api/worlds/:worldId/story-events/search 查询参数。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

未解决问题：
1. 当前定位依赖“最近100条聊天”窗口，超出窗口需进一步增强分页定位。
2. 事件定位目前为高亮模式，尚未自动滚动到视口中心。

下一步：
1. 增强聊天定位能力（超窗口分页定位/按 messageId 精确查询）。
2. 增加事件定位自动滚动与更明显的高亮动效。

验证结果：
1. 新增 `server/src/services/story-event.search.test.ts` 纯函数测试文件。
2. 定向测试通过：`npx.cmd tsx --test --test-reporter=spec server/src/services/story-event.search.test.ts`（7 passed）。
3. 前端构建通过（npm.cmd run build -w client）。

## [2026-03-16 10:30] 阶段 8 剧情扮演增强：事件与聊天双向检索

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 新增剧情事件与世界聊天双向检索接口，支持关键词与场景过滤。
2. 检索结果支持双向关联：事件命中可反查关联聊天，聊天命中可反补关联事件。
3. 世界页剧情事件面板新增检索输入、结果摘要与命中明细展示。
4. 同步更新 API 契约、接口注册表与变更日志。

涉及文件：
1. server/src/services/story-event.service.ts
2. server/src/controllers/story-event.controller.ts
3. server/src/routes/world.routes.ts
4. client/src/world/components/StoryEventPanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. docs/api-contract.md
7. docs/interface-registry.json
8. docs/change-log.md

新增接口：
1. GET /api/worlds/:worldId/story-events/search

新增数据模型或字段：
1. 无新增数据库字段；复用 Message.metadata 中剧情事件标签实现关联检索。

新增 Socket 事件：
1. 无。

未解决问题：
1. 检索目前以关键词为主，尚未支持结构化过滤（状态、提案状态、时间范围）。
2. 前端结果区为最小展示，尚未提供跳转定位到聊天消息能力。

下一步：
1. 为双向检索补充后端自动化测试覆盖。
2. 增加前端筛选器（事件状态、频道、时间范围）与快速定位能力。

## [2026-03-15 07:55] 阶段 8 剧情扮演增强：物语点提案审核流

阶段：阶段 8（迭代 B 实施中）

本次完成：
1. 剧情事件新增物语点提案能力，玩家可提交“消耗点数 + 改写理由”。
2. 剧情事件新增 GM 审核能力，支持通过/驳回并附带备注。
3. 提案与裁决均写入世界聊天 metadata 标签，便于 AI 助手后续读取剧情上下文。
4. 前端剧情事件面板新增提案提交区与 GM 裁决区，聊天区新增提案/裁决标签展示。
5. 新增并应用 Prisma 迁移 `20260315074617_stage8_story_narrative_requests`。

涉及文件：
1. server/prisma/schema.prisma
2. server/prisma/migrations/20260315074617_stage8_story_narrative_requests/migration.sql
3. server/src/services/story-event.service.ts
4. server/src/controllers/story-event.controller.ts
5. server/src/routes/world.routes.ts
6. client/src/world/components/StoryEventPanel.tsx
7. client/src/pages/world/WorldPage.tsx
8. docs/api-contract.md
9. docs/interface-registry.json
10. docs/change-log.md

验证结果：
1. npm --workspace server run build 通过。
2. npm --workspace client run build 通过。
3. npm --workspace server run test -- --runInBand 通过（38 tests passed）。

下一步：
1. 继续补“事件与聊天双向检索”接口与前端入口。
2. 为物语点提案增加权限可视化（提案人昵称映射、过滤器）。

## 12. 文档索引（阶段 8 重点）

以下索引用于后续会话快速定位“规则/实现/契约”文档，避免重复检索。

### 12.1 主线与阶段文档

1. 世界细化开发文档.md：阶段 8 世界功能主线与迭代拆分。
2. 阶段8执行任务清单.md：阶段 8 总体蓝图与子任务顺序。
3. 阶段8-迭代A开发任务单.md：迭代 A 已完成项与 DoD 基线。

### 12.2 规则规格文档

1. docs/规则规格-战斗与造物系统-v1.md：战斗与造物规则讨论稿（持续更新）。
2. 世界需求与填写清单.md：需求冻结来源与优先级依据。
3. docs/规则规格-战斗与造物系统-v1.md#16：剧情事件、技能检定绑定与物语点机制（扮演玩法主入口）。
4. docs/规则规格-战斗与造物系统-v1.md#16.10：事件留档与结算卡片（AI助手读取剧情经过优先入口）。
5. docs/api-contract.md（Story Event 段落）：剧情事件MVP接口契约入口。
6. client/src/world/components/StoryEventPanel.tsx：剧情事件前端调试面板入口（GM创建/选项/结算，玩家检定）。
7. server/src/services/story-event.service.ts：剧情事件MVP服务（内存态事件 + 结算卡片写入聊天）。
8. server/src/controllers/story-event.controller.ts：剧情事件HTTP控制器。
9. server/prisma/migrations/20260315072102_stage8_story_event_persistence/migration.sql：剧情事件持久化迁移。

### 12.3 接口与事件契约文档

1. docs/api-contract.md：HTTP 接口契约。
2. docs/socket-contract.md：Socket 事件契约。
3. docs/interface-registry.json：接口与事件注册清单（新增能力必须同步）。

### 12.4 规范与变更文档

1. docs/naming-convention.md：命名规范。
2. docs/change-log.md：阶段性变更日志。
3. AI上下文记忆文档.md：跨会话记忆与当前状态。
4. docs/最终验收清单-完整版路线图.md：项目最终验收主清单（按阶段持续打勾）。

## [2026-03-13 20:40] 阶段 8 迭代 B 开工：场景战斗/视觉状态接口

阶段：阶段 8（迭代 B 进行中）

本次完成：
1. 新增场景视觉状态接口（GET/PATCH visual），支持网格、光源、迷雾状态读写。
2. 新增场景战斗状态接口（GET/PUT combat + POST next-turn），支持先攻列表、轮次与回合推进。
3. scene canvasState 存储改为增量合并，避免 token 写入覆盖视觉/战斗状态。
4. 新增接口级测试，覆盖 GM 权限边界与 next-turn 回合推进规则。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/controllers/scene.controller.ts
3. server/src/routes/world.routes.ts
4. server/src/routes/scene.runtime.routes.test.ts
5. docs/interface-registry.json
6. docs/api-contract.md
7. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run test -w server 通过（38 tests passed）。

下一步：
1. 迭代 B 前端接入 visual/combat 面板。
2. 补充最小战斗流程 UI（先攻展示、下一回合推进、状态提示）。

## [2026-03-13 20:25] 迭代 A 完成 A-RE-01/A-RE-02：规则类型基线

阶段：阶段 8（实施中）

本次完成：
1. 新增 RuleContext 与 RuleExecutionResult 类型基线。
2. 新增规则节点协议（条件节点/动作节点）基础定义。
3. 新增光源与测量板动作参数类型，覆盖 P0 模板关键字段。
4. 新增节点中文元数据类型与校验函数，强制中文名称与描述字段。
5. 完成 shared/rules 目录基础结构，为迭代 C/D 的规则引擎与编辑器提供类型地基。

涉及文件：
1. shared/rules/context.ts
2. shared/rules/result.ts
3. shared/rules/node-types.ts
4. shared/rules/node-metadata.ts
5. 阶段8-迭代A开发任务单.md
6. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run build -w client 通过。

下一步：
1. 阶段 8 从迭代 A 切换到迭代 B（战斗场景核心闭环）。
2. 先落地图层基础：网格、光源、迷雾状态模型与最小接口。

## [2026-03-13 20:10] 迭代 A 完成 A-FE-03：世界文案与错误映射基线

阶段：阶段 8（实施中）

本次完成：
1. 新增世界模块中文文案中心（zh-CN）。
2. 新增 runtime 错误消息映射函数（英文后端错误转中文提示）。
3. RuntimePanel 与 ModulePanel 改为统一读取中文文案入口。
4. 世界页 runtime 相关请求错误接入中文映射。

涉及文件：
1. client/src/world/i18n/zh-CN.ts
2. client/src/world/i18n/messages.ts
3. client/src/world/components/RuntimePanel.tsx
4. client/src/world/components/ModulePanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. 阶段8-迭代A开发任务单.md
7. docs/change-log.md

验证结果：
1. npm run build -w client 通过。

下一步：
1. 进入 A-RE-01：shared/rules/context.ts 与 shared/rules/result.ts。
2. 继续 A-RE-02：shared/rules/node-types.ts 与 shared/rules/node-metadata.ts。

## [2026-03-13 19:55] 迭代 A 完成 A-FE-01/A-FE-02：运行状态与模块面板

阶段：阶段 8（实施中）

本次完成：
1. 世界页新增运行状态面板 RuntimePanel。
2. 世界页新增模块管理面板 ModulePanel。
3. 接入 runtime 与 runtime modules 接口加载，支持手动刷新。
4. 模块启停按钮接入 PATCH runtime/modules 接口并本地即时更新。
5. 角色权限控制：GM/ASSISTANT 可启停模块，其他角色只读。

涉及文件：
1. client/src/world/components/RuntimePanel.tsx
2. client/src/world/components/ModulePanel.tsx
3. client/src/pages/world/WorldPage.tsx
4. 阶段8-迭代A开发任务单.md
5. docs/change-log.md

验证结果：
1. npm run build -w client 通过。

下一步：
1. 进入 A-FE-03：世界模块中文文案集中管理与错误映射。

## [2026-03-13 19:40] 迭代 A 完成 A-BE-04：运行时管理接口扩展

阶段：阶段 8（实施中）

本次完成：
1. world runtime 新增模块列表接口（GET /api/worlds/:worldId/runtime/modules）。
2. world runtime 新增模块启停接口（PATCH /api/worlds/:worldId/runtime/modules/:moduleKey）。
3. 模块列表读取时自动初始化默认模块定义。
4. 模块启停接入权限校验、依赖校验与统一错误返回。
5. 新增默认模块初始化单元测试并通过全量回归测试。

涉及文件：
1. server/src/modules/runtime/module-registry.ts
2. server/src/modules/runtime/module-registry.test.ts
3. server/src/controllers/world-runtime.controller.ts
4. server/src/routes/world.routes.ts
5. docs/interface-registry.json
6. docs/api-contract.md
7. 阶段8-迭代A开发任务单.md
8. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run test -w server 通过（37 tests passed）。

下一步：
1. 进入 A-FE-01：世界运行状态面板。
2. 并行准备 A-FE-02：模块管理面板（GM可启停，非GM只读）。

## [2026-03-13 19:20] 迭代 A 完成 A-BE-03：事件总线基础

阶段：阶段 8（实施中）

本次完成：
1. 新增事件命名校验模块，约束事件名为 domain:entity:action。
2. 新增 Typed Event Bus，支持 on/off/once/emit/listenerCount。
3. 非法事件名使用中文提示，处理器非法类型使用统一错误结构。
4. 新增事件总线单测，覆盖命名解析、非法命名、订阅退订、once 与异常分支。

涉及文件：
1. server/src/modules/runtime/event-naming.ts
2. server/src/modules/runtime/event-bus.ts
3. server/src/modules/runtime/event-bus.test.ts
4. 阶段8-迭代A开发任务单.md
5. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run test -w server 通过（36 tests passed）。

下一步：
1. 进入 A-BE-04：扩展 world runtime 管理接口（模块列表、模块启停、权限闭环）。

## [2026-03-13 19:05] 迭代 A 完成 A-BE-02：模块注册中心

阶段：阶段 8（实施中）

本次完成：
1. 新增 runtime 模块类型定义与错误模型。
2. 新增模块注册中心能力：register/enable/disable/get/list。
3. 新增依赖校验规则：依赖缺失或未启用时拒绝启用模块。
4. 新增懒加载入口 invokeRuntimeModuleLazyLoader，支持单次加载缓存。
5. 新增 module-registry 单元测试，覆盖排序、依赖校验、启停与懒加载缓存。

涉及文件：
1. server/src/modules/runtime/module.types.ts
2. server/src/modules/runtime/module-registry.ts
3. server/src/modules/runtime/module-registry.test.ts
4. 阶段8-迭代A开发任务单.md
5. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run test -w server 通过（30 tests passed）。

下一步：
1. 进入 A-BE-03：实现 Typed Event Bus 与事件命名校验。

## [2026-03-13 18:40] 迭代 A 开工：World Runtime 最小闭环

阶段：阶段 8（实施中）

本次完成：
1. 新增 world runtime 类型与服务，实现世界运行时状态读取/更新。
2. 新增 world runtime 接口：
  1. GET /api/worlds/:worldId/runtime
  2. PATCH /api/worlds/:worldId/runtime
3. 新增 world runtime 单元测试，覆盖默认状态、更新、非法状态、列表排序。
4. world 路由完成 runtime 接口挂载。
5. 补齐接口文档与接口注册表。

涉及文件：
1. server/src/modules/world-runtime/world-runtime.types.ts
2. server/src/modules/world-runtime/world-runtime.service.ts
3. server/src/modules/world-runtime/world-runtime.service.test.ts
4. server/src/controllers/world-runtime.controller.ts
5. server/src/routes/world.routes.ts
6. docs/interface-registry.json
7. docs/api-contract.md
8. docs/change-log.md

验证结果：
1. npm run build -w server 通过。
2. npm run test -w server 通过（26 tests passed）。

下一步：
1. 进入 A-BE-02：模块注册中心（register/enable/disable/dependency check）。

## [2026-03-13 18:20] 迭代 A 开工任务单已拆分

阶段：阶段 8（实施准备）

本次完成：
1. 新增迭代 A 开工任务单，按后端/前端/规则引擎三泳道拆分可执行任务。
2. 为每个任务给出建议文件、验收条件和推荐执行顺序。
3. 补充迭代 A 的 DoD 与验证命令，确保可按清单直接开工。

涉及文件：
1. 阶段8-迭代A开发任务单.md
2. 世界细化开发文档.md
3. AI上下文记忆文档.md
4. docs/change-log.md

当前可运行结果：
1. 阶段 8 已从“需求冻结”进入“可执行任务拆分”状态。

下一步：
1. 以任务单为准开始实现 A-BE-01。

## [2026-03-13 18:00] 世界细化开发文档建立（阶段 8 执行主线）

阶段：阶段 8（需求冻结完成，准备实施）

本次完成：
1. 在世界需求清单中补齐可执行缺口：持久化其他项、测量板模板、首发 P0 子集。
2. 修复需求文档结构错位，恢复章节顺序与可读性。
3. 新增世界细化开发文档，作为阶段 8 世界开发主线。
4. 明确需求文档与开发文档关系：需求清单负责冻结，细化文档负责实施。

涉及文件：
1. 世界需求与填写清单.md
2. 世界细化开发文档.md
3. 阶段8执行任务清单.md
4. AI上下文记忆文档.md
5. docs/change-log.md

当前可运行结果：
1. 世界功能开发已具备“需求冻结 + 实施主线”双文档结构。
2. 后续可以直接按世界细化开发文档的迭代 A-E 推进。

未解决问题：
1. 需要把“首发 P0 子集”进一步拆到可执行任务粒度（按文件与接口级别）。

下一步：
1. 以世界细化开发文档为核心，拆解迭代 A 的开发任务并开始实现。

## [2026-03-13 17:30] 世界级需求清单文档已建立（待用户填写）

阶段：阶段 8（需求深化中）

本次完成：
1. 新增世界级需求清单文档，围绕“一个世界=完整团务包”设计需求冻结模板。
2. 清单覆盖战斗、营地、城镇、触发器、智能角色卡、战斗卡片、任务日历、播片音频、天赋树、自定义编辑器、扩展包、AI 总结审核流。
3. 把优先级、验收标准、未决问题都转成可填写结构，便于后续逐项确认。

涉及文件：
1. 世界需求与填写清单.md
2. AI上下文记忆文档.md
3. docs/change-log.md

当前可运行结果：
1. 已形成可直接填写的需求冻结文档，可用于后续阶段 8 与阶段 9 实施拆解。

未解决问题：
1. 具体字段值和优先级尚待用户逐项填写。
2. 天赋树与可视化规则编辑器的最小可用边界尚待确认。

下一步：
1. 与用户逐段审阅并填写世界需求清单。
2. 从已填写 P0 项抽取首批实现里程碑。

## [2026-03-13 17:05] 阶段 8 开发设计稿已建立

阶段：阶段 8（设计中，未开工）

本次完成：
1. 根据已确认共识，新增阶段 8 开发文档，明确 AAF 与 SillyTavern 的职责边界。
2. 确认第一版由 SillyTavern 调用模型 API，AAF 通过适配层桥接，不直接嵌入酒馆复杂界面。
3. 确认主持人总结器采用“手动触发 -> 生成草案 -> 审核后写回”的流程。
4. 将阶段 8 实施顺序拆为：适配层、聊天桥接、NPC 同步、世界书、总结器、审核流。

涉及文件：
1. 阶段8执行任务清单.md
2. 渐进式开发文档.md
3. AI上下文记忆文档.md
4. docs/change-log.md

当前可运行结果：
1. 阶段 8 已具备明确的开发蓝图，可作为后续实现参考。
2. 阶段 8 仍未开始编码，当前只是设计冻结。

未解决问题：
1. 世界内 AI 交互细节和世界书编辑体验还需要继续细化。
2. 具体的数据表字段与接口返回结构要在正式编码前再收敛一次。

下一步：
1. 与用户继续讨论世界内交互设计。
2. 若确认无误，再按阶段 8 文档拆分第一个实现子任务。

## [2026-03-13 16:35] 阶段 7 收尾整理完成

阶段：阶段 7（已完成）

本次完成：
1. 统一修正文档中的阶段状态，确认阶段 7 核心链路已完成。
2. 明确阶段 8 暂不开工，进入酒馆与 AI 助手前必须先做需求确认。
3. 更新阶段 7 清单、README 与路线文档，使项目状态保持一致。

涉及文件：
1. README.md
2. 渐进式开发文档.md
3. 阶段7执行任务清单.md
4. AI上下文记忆文档.md
5. docs/change-log.md

当前可运行结果：
1. 项目当前可视为完成“可初步使用的跑团版”阶段收尾。
2. 第七阶段的主链路开发和关键自动化测试均已到位。

未解决问题：
1. 阶段 8 的酒馆与 AI 助手需求尚未最终确认。
2. 阶段 7 仍有若干体验增强项，但不影响主链路闭环。

下一步：
1. 与用户确认阶段 8 的需求边界。
2. 若暂不进入阶段 8，则回到阶段 7 的非阻塞增强项继续迭代。

## [2026-03-13 11:00] 阶段 7 子任务：世界内聊天链路落地

阶段：阶段 7（进行中）

本次完成：
1. 新增世界聊天历史接口 GET /api/chat/worlds/:worldId/recent。
2. 新增 world:message:send / world:message:new 事件，写入 WORLD 消息并按 world room 广播。
3. 世界页接入世界聊天面板，支持历史拉取与实时收发。
4. 世界聊天发送增加约束：需先加入 world room 且成员状态为 ACTIVE。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/controllers/chat.controller.ts
3. server/src/routes/chat.routes.ts
4. server/src/socket/events.ts
5. server/src/socket/index.ts
6. client/src/lib/socket.ts
7. client/src/pages/world/WorldPage.tsx
8. shared/constants/events.ts
9. docs/interface-registry.json
10. docs/api-contract.md
11. docs/change-log.md
12. 阶段7执行任务清单.md
13. AI上下文记忆文档.md

新增接口：
1. GET /api/chat/worlds/:worldId/recent

新增数据模型或字段：
1. 无新增模型，复用 Message(type=WORLD, worldId)。

新增 Socket 事件：
1. world:message:send
2. world:message:new

当前可运行结果：
1. 世界页可读取最近世界聊天消息并显示。
2. 在线成员可实时收到世界内新消息。
3. 未加入房间或非成员发送会返回错误 ack。

未解决问题：
1. 世界内多频道（OOC/IC）尚未实现。
2. 角色卡绑定与 token 联动尚未接入。

下一步：
1. 进入阶段 7 下一个子任务：角色卡最小链路。
2. 补充世界聊天与权限行为测试。

## [2026-03-13 11:35] 阶段 7 子任务：角色卡最小链路与 token 绑定

阶段：阶段 7（进行中）

本次完成：
1. 新增角色卡接口 GET/POST /api/worlds/:worldId/characters。
2. 落地角色权限：GM 可创建 NPC/PC，非 GM 仅可创建绑定自身的 PC。
3. token 同步事件新增 characterId 绑定，并返回 characterName。
4. 世界页新增 CharacterPanel，支持角色列表、角色创建、当前绑定角色选择。
5. 新增/移动 token 时可携带角色绑定，非 GM 不可绑定或移动他人角色 token。

涉及文件：
1. server/src/services/character.service.ts
2. server/src/controllers/character.controller.ts
3. server/src/routes/world.routes.ts
4. server/src/services/scene.service.ts
5. server/src/socket/index.ts
6. client/src/world/components/CharacterPanel.tsx
7. client/src/world/components/TokenPanel.tsx
8. client/src/world/components/WorldCanvas.tsx
9. client/src/pages/world/WorldPage.tsx
10. docs/interface-registry.json
11. docs/api-contract.md
12. docs/change-log.md
13. 阶段7执行任务清单.md
14. AI上下文记忆文档.md

新增接口：
1. GET /api/worlds/:worldId/characters
2. POST /api/worlds/:worldId/characters

新增数据模型或字段：
1. 无新增数据库模型；token 内存/持久化状态新增 characterId、characterName 字段。

新增 Socket 事件：
1. 无新增事件；扩展 scene:token:move/moved payload。

当前可运行结果：
1. 世界页可查看并创建角色卡。
2. token 可绑定角色并在广播中返回角色名。
3. 权限校验生效：非 GM 不能操作他人角色 token。

未解决问题：
1. 角色卡详情编辑（stats/snapshot）尚未接入。
2. 世界聊天多频道与频道权限尚未实现。

下一步：
1. 继续阶段 7：角色卡详情最小编辑（stats/snapshot）。
2. 补齐角色绑定与世界聊天链路的集成测试。

## [2026-03-13 12:00] 阶段 7 子任务：角色卡详情最小编辑

阶段：阶段 7（进行中）

本次完成：
1. 新增角色详情更新接口 PUT /api/worlds/:worldId/characters/:characterId。
2. 角色列表/创建返回中补充 stats 与 snapshot 字段。
3. 世界页 CharacterPanel 新增角色详情编辑表单（name/stats/snapshot JSON）。
4. 前端保存时增加 JSON 校验，后端执行角色编辑权限校验。

涉及文件：
1. server/src/services/character.service.ts
2. server/src/controllers/character.controller.ts
3. server/src/routes/world.routes.ts
4. client/src/world/components/CharacterPanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. docs/interface-registry.json
7. docs/api-contract.md
8. docs/change-log.md
9. 阶段7执行任务清单.md
10. AI上下文记忆文档.md

新增接口：
1. PUT /api/worlds/:worldId/characters/:characterId

新增数据模型或字段：
1. 无新增模型；复用 Character.stats 与 Character.snapshot 字段。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 世界页可创建角色并编辑角色详情字段。
2. 更新后的角色信息可用于 token 绑定展示。

未解决问题：
1. 角色详情编辑仍为 JSON 文本输入，易输错格式。
2. 世界聊天多频道（OOC/IC）尚未实现。

下一步：
1. 扩展世界聊天多频道能力。
2. 把角色详情编辑升级为结构化字段表单。

## [2026-03-13 12:20] 阶段 7 子任务：世界聊天多频道（OOC/IC/SYSTEM）

阶段：阶段 7（进行中）

本次完成：
1. 世界聊天历史接口支持 channelKey 查询（默认 OOC）。
2. world:message:send / world:message:new payload 增加 channelKey。
3. 世界聊天服务支持按频道写入/读取（OOC/IC/SYSTEM）。
4. 世界页聊天面板新增频道选择并按频道拉取历史。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/controllers/chat.controller.ts
3. server/src/socket/index.ts
4. client/src/pages/world/WorldPage.tsx
5. docs/api-contract.md
6. docs/change-log.md
7. 阶段7执行任务清单.md
8. AI上下文记忆文档.md

新增接口：
1. 无新增路径；扩展 GET /api/chat/worlds/:worldId/recent 的 channelKey 参数。

新增数据模型或字段：
1. 无新增模型；复用 Message.channelKey。

新增 Socket 事件：
1. 无新增事件；扩展 world:message:send/new payload。

当前可运行结果：
1. 世界页可切换 OOC/IC/SYSTEM 频道并读取对应历史。
2. 发送消息会携带频道并在同频道实时展示。

未解决问题：
1. SYSTEM 频道尚未做 GM-only 权限限制。
2. 频道未提供未读计数与消息提醒。

下一步：
1. 增加世界聊天频道权限控制（SYSTEM 仅 GM）。
2. 补齐集成测试覆盖频道与权限行为。

## [2026-03-13 12:35] 阶段 7 子任务：SYSTEM 频道 GM 权限控制

阶段：阶段 7（进行中）

本次完成：
1. 新增 SYSTEM 频道发送权限限制：仅 GM 可发。
2. 前端世界页在 SYSTEM 频道下对非 GM 禁用发送控件。
3. 服务端新增兜底校验，违规发送返回 channel permission denied。
4. 新增频道权限单元测试（chat.channel.test.ts）。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/controllers/chat.controller.ts
3. client/src/pages/world/WorldPage.tsx
4. server/src/services/chat.channel.test.ts
5. docs/api-contract.md
6. docs/change-log.md
7. 阶段7执行任务清单.md
8. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. GM 可在 SYSTEM 频道发消息；非 GM 无法发送。
2. OOC/IC 频道发送行为不受影响。

未解决问题：
1. 频道未读计数与消息提醒尚未实现。
2. IC 频道细粒度权限尚未设计。

下一步：
1. 增加频道未读计数与提醒。
2. 补齐频道权限与角色权限集成测试。

## [2026-03-13 12:50] 阶段 7 子任务：频道未读计数（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 世界页新增 OOC/IC/SYSTEM 三频道未读计数状态。
2. 收到非当前频道消息时，对应频道未读数自动累加。
3. 切换到目标频道并加载历史后，当前频道未读清零。
4. 保持现有 SYSTEM 频道 GM-only 发送规则。

涉及文件：
1. client/src/pages/world/WorldPage.tsx
2. docs/change-log.md
3. 阶段7执行任务清单.md
4. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无（前端本地状态实现）。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 世界页可看到频道未读数并随消息变化。
2. 切换频道后未读数按预期清零。

未解决问题：
1. 未读计数尚未持久化，刷新页面会丢失。
2. 暂无红点提醒与消息审计日志。

下一步：
1. 增加未读持久化和服务端审计。
2. 继续阶段 7 的集成测试覆盖。

## [2026-03-13 13:05] 阶段 7 子任务：角色详情结构化编辑

阶段：阶段 7（进行中）

本次完成：
1. 世界页角色详情编辑由 JSON 文本改为结构化字段（HP、MP、等级、职业）。
2. 前端保存时自动组装 stats/snapshot，降低输入错误率。
3. 保留既有角色编辑权限控制，不改变后端访问边界。

涉及文件：
1. client/src/world/components/CharacterPanel.tsx
2. client/src/pages/world/WorldPage.tsx
3. docs/change-log.md
4. 阶段7执行任务清单.md
5. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 角色详情编辑体验从自由 JSON 输入升级为结构化字段输入。
2. 保存后仍写入 Character.stats 与 Character.snapshot。

未解决问题：
1. 装备、技能等更多角色字段尚未结构化。
2. 未读计数尚未持久化。

下一步：
1. 增加未读持久化与频道消息审计。
2. 扩展角色详情字段并补充联调测试。

## [2026-03-13 13:20] 阶段 7 子任务：未读持久化与频道消息审计

阶段：阶段 7（进行中）

本次完成：
1. 世界聊天未读计数写入 localStorage，按 worldId + userId 恢复。
2. 服务端新增世界频道消息发送审计日志。
3. 保持现有频道权限与未读计数逻辑不变。

涉及文件：
1. client/src/pages/world/WorldPage.tsx
2. server/src/socket/index.ts
3. docs/change-log.md
4. 阶段7执行任务清单.md
5. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无（本次为前端 localStorage 与服务端日志增强）。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 刷新页面后可恢复频道未读计数。
2. 服务端可记录世界频道消息审计日志。

未解决问题：
1. 未读计数尚未服务端持久化与跨端同步。
2. 集成测试覆盖不足。

下一步：
1. 补充世界聊天与 token/角色权限集成测试。
2. 规划多 Scene 隔离与场景切换链路。

## [2026-03-13 13:35] 阶段 7 子任务：角色权限测试覆盖（单元）

阶段：阶段 7（进行中）

本次完成：
1. 抽离角色创建权限判定函数 canCreateCharacterByRole。
2. 抽离角色编辑权限判定函数 canEditCharacterByRole。
3. 新增角色权限单元测试，覆盖 GM/非GM 的创建与编辑边界。

涉及文件：
1. server/src/services/character.service.ts
2. server/src/services/character.permission.test.ts
3. docs/change-log.md
4. 阶段7执行任务清单.md
5. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 角色权限规则具备可测试、可复用的纯函数实现。
2. 后端权限单元测试覆盖面进一步提升。

未解决问题：
1. 仍缺少 world chat / token / character 组合链路的集成测试。
2. 场景切换与多 Scene 隔离尚未开始。

下一步：
1. 增加关键链路集成测试。
2. 规划并实现多 Scene 切换最小链路。

## [2026-03-13 14:00] 阶段 7 子任务：多 Scene 切换最小链路

阶段：阶段 7（进行中）

本次完成：
1. 新增场景接口 GET/POST /api/worlds/:worldId/scenes。
2. 新增 scene:select 事件用于切换当前场景上下文。
3. token 同步从 world 级升级为 scene 级，payload 增加 sceneId。
4. 世界页新增 ScenePanel，支持场景列表、切换与创建（最小版）。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/controllers/scene.controller.ts
3. server/src/routes/world.routes.ts
4. server/src/socket/events.ts
5. server/src/socket/index.ts
6. client/src/lib/socket.ts
7. client/src/pages/world/WorldPage.tsx
8. client/src/world/components/ScenePanel.tsx
9. shared/constants/events.ts
10. docs/interface-registry.json
11. docs/api-contract.md
12. docs/change-log.md
13. 阶段7执行任务清单.md
14. AI上下文记忆文档.md

新增接口：
1. GET /api/worlds/:worldId/scenes
2. POST /api/worlds/:worldId/scenes

新增数据模型或字段：
1. 无新增模型；Scene.canvasState 继续复用并按 sceneId 维度读写。

新增 Socket 事件：
1. scene:select

当前可运行结果：
1. 世界页可查看并切换场景，切换后 token 状态按场景隔离。
2. 新建场景后可立即切换并进行独立 token 同步。

未解决问题：
1. 多 Scene 聊天上下文尚未隔离。
2. 场景排序/重命名/删除等管理能力尚未实现。

下一步：
1. 完善多 Scene 下聊天与消息历史策略。
2. 补充 scene select 与 token move 的集成测试。

## [2026-03-13 14:20] 阶段 7 子任务：多 Scene 聊天上下文隔离（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 世界聊天历史接口新增 sceneId 参数并按 scene 返回消息。
2. world:message:send/new payload 增加 sceneId。
3. 服务端用 Message.metadata.sceneId 存储场景上下文（不改表结构）。
4. 世界页聊天和未读计数改为按 world+scene 维度隔离。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/controllers/chat.controller.ts
3. server/src/socket/index.ts
4. client/src/pages/world/WorldPage.tsx
5. docs/api-contract.md
6. docs/socket-contract.md
7. docs/change-log.md
8. 阶段7执行任务清单.md
9. AI上下文记忆文档.md

新增接口：
1. 无新增路径；扩展 GET /api/chat/worlds/:worldId/recent 的 sceneId 查询参数。

新增数据模型或字段：
1. 无新增字段；复用 Message.metadata 存储 sceneId。

新增 Socket 事件：
1. 无新增事件；扩展 world:message:send/new payload。

当前可运行结果：
1. 切换 scene 后仅显示当前 scene 的聊天历史。
2. 发送世界消息会绑定当前 scene 上下文并隔离广播展示。

未解决问题：
1. 目前按 scene 查询采用应用层过滤，后续可优化索引化查询。
2. 尚未补 scene 聊天链路的自动化集成测试。

下一步：
1. 补充 scene chat + scene token 的集成测试。
2. 增强场景管理能力（重命名、排序、删除）。

## [2026-03-13 14:35] 阶段 7 子任务：场景重命名（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 新增场景重命名接口 PUT /api/worlds/:worldId/scenes/:sceneId。
2. 服务端新增 GM-only 场景重命名权限校验。
3. 世界页 ScenePanel 新增重命名当前场景交互。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/controllers/scene.controller.ts
3. server/src/routes/world.routes.ts
4. client/src/world/components/ScenePanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. docs/interface-registry.json
7. docs/api-contract.md
8. docs/change-log.md
9. 阶段7执行任务清单.md
10. AI上下文记忆文档.md

新增接口：
1. PUT /api/worlds/:worldId/scenes/:sceneId

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. GM 可在世界页直接重命名当前场景。
2. 非 GM 重命名会被服务端拒绝。

未解决问题：
1. 场景排序与删除尚未实现。
2. 场景管理链路集成测试尚未补齐。

下一步：
1. 增加场景排序与删除能力。
2. 补充 scene 管理 + scene 聊天 + scene token 组合测试。

## [2026-03-13 14:50] 阶段 7 子任务：场景删除（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 新增场景删除接口 DELETE /api/worlds/:worldId/scenes/:sceneId。
2. 服务端新增 GM-only 删除权限与“至少保留一个场景”约束。
3. 世界页 ScenePanel 新增删除当前场景按钮。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/controllers/scene.controller.ts
3. server/src/routes/world.routes.ts
4. client/src/world/components/ScenePanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. docs/interface-registry.json
7. docs/api-contract.md
8. docs/change-log.md
9. 阶段7执行任务清单.md
10. AI上下文记忆文档.md

新增接口：
1. DELETE /api/worlds/:worldId/scenes/:sceneId

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. GM 可删除非最后一个场景。
2. 删除成功后前端会刷新场景列表并切换到可用场景。

未解决问题：
1. 场景排序尚未实现。
2. scene 管理链路缺少集成测试。

下一步：
1. 增加场景排序能力。
2. 补充 scene 管理 + scene 聊天 + scene token 组合测试。

## [2026-03-13 15:05] 阶段 7 子任务：场景排序（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 新增场景排序接口 PATCH /api/worlds/:worldId/scenes/:sceneId/sort。
2. 服务端新增 UP/DOWN 排序能力（事务交换 sortOrder，GM-only）。
3. 世界页 ScenePanel 新增上移/下移按钮并接入排序。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/controllers/scene.controller.ts
3. server/src/routes/world.routes.ts
4. client/src/world/components/ScenePanel.tsx
5. client/src/pages/world/WorldPage.tsx
6. docs/interface-registry.json
7. docs/api-contract.md
8. docs/change-log.md
9. 阶段7执行任务清单.md
10. AI上下文记忆文档.md

新增接口：
1. PATCH /api/worlds/:worldId/scenes/:sceneId/sort

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. GM 可在世界页对当前场景执行上移/下移。
2. 排序后场景列表顺序会立即刷新。

未解决问题：
1. 拖拽排序与批量排序尚未实现。
2. scene 管理链路仍缺少自动化测试。

下一步：
1. 补充 scene 管理链路测试。
2. 继续阶段 7 的集成测试覆盖。

## [2026-03-13 15:20] 阶段 7 子任务：场景管理规则单元测试（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 抽离场景管理权限判定函数 canManageSceneByRole。
2. 抽离场景排序目标解析函数 resolveSceneMoveTargetId。
3. 新增 scene.permission.test.ts 覆盖权限与排序边界行为。

涉及文件：
1. server/src/services/scene.service.ts
2. server/src/services/scene.permission.test.ts
3. docs/change-log.md
4. 阶段7执行任务清单.md
5. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 场景管理核心规则具备纯函数测试覆盖。
2. 场景排序边界行为可稳定回归。

未解决问题：
1. 场景管理 HTTP 接口层集成测试尚未补齐。
2. scene chat + token 组合链路集成测试仍待补。

下一步：
1. 增加 scene 管理接口级测试。
2. 补充 scene chat + scene token 的关键链路测试。

## [2026-03-13 15:35] 阶段 7 子任务：Scene Chat 规则单元测试（最小版）

阶段：阶段 7（进行中）

本次完成：
1. chat.service 抽出 extractSceneIdFromMetadata。
2. chat.service 抽出 filterMessagesByScene。
3. chat.service.test 新增 scene metadata 与 scene 过滤测试。

涉及文件：
1. server/src/services/chat.service.ts
2. server/src/services/chat.service.test.ts
3. docs/change-log.md
4. 阶段7执行任务清单.md
5. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. scene chat 过滤核心规则可自动回归。

未解决问题：
1. scene 管理接口层测试仍待补。
2. scene chat + token 组合链路集成测试仍待补。

下一步：
1. 增加 scene 管理接口级测试。
2. 补充 scene chat + scene token 的关键链路测试。

## [2026-03-13 15:50] 阶段 7 子任务：Scene 管理接口级测试（HTTP）

阶段：阶段 7（进行中）

本次完成：
1. 新增 scene.routes.test.ts，启动临时服务进行真实 HTTP 测试。
2. 覆盖场景重命名权限（GM 成功/非 GM 拒绝）。
3. 覆盖场景排序接口与顺序变更。
4. 覆盖场景删除与“不可删除最后一个场景”边界。

涉及文件：
1. server/src/routes/scene.routes.test.ts
2. docs/change-log.md
3. 阶段7执行任务清单.md
4. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. scene 管理接口具备可回归的 HTTP 自动化测试。

未解决问题：
1. scene chat + scene token 组合链路集成测试仍待补。
2. socket 事件级联行为尚未覆盖自动化测试。

下一步：
1. 增加 scene chat + scene token 组合链路测试。
2. 补充 socket 层关键事件联动测试。

## [2026-03-13 16:05] 阶段 7 子任务：Scene Chat + Token 组合链路测试（Socket）

阶段：阶段 7（进行中）

本次完成：
1. 新增 scene-isolation.test.ts，启动临时 HTTP + Socket 服务。
2. 覆盖 scene:select 切换后 token 快照隔离。
3. 覆盖 scene:token:move 与 world:message:send/new 在不同 scene 下的隔离行为。
4. 覆盖 HTTP 历史接口按 sceneId 过滤结果与 socket 行为一致。

涉及文件：
1. server/src/socket/scene-isolation.test.ts
2. docs/change-log.md
3. 阶段7执行任务清单.md
4. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. scene chat 与 scene token 的场景隔离具备真实 socket 自动化测试保障。

未解决问题：
1. 第七阶段剩余工作主要转向体验增强和阶段收尾。
2. 仍可补更多异常路径测试（如 scene mismatch、未 join 即发送）。

下一步：
1. 评估第七阶段是否还需补体验增强项。
2. 若阶段 7 目标已足够，可准备收尾并在进入阶段 8 前按约束与你确认需求。

## [2026-03-13 16:20] 阶段 7 子任务：Scene Socket 异常路径测试（最小版）

阶段：阶段 7（进行中）

本次完成：
1. 在 scene-isolation.test.ts 新增未 join 房间的 world chat / token move 异常测试。
2. 新增 scene mismatch 异常测试。
3. 验证服务端 ack 错误与预期一致，且不会误广播。

涉及文件：
1. server/src/socket/scene-isolation.test.ts
2. docs/change-log.md
3. 阶段7执行任务清单.md
4. AI上下文记忆文档.md

新增接口：
1. 无。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. scene socket 正常链路与关键异常链路均有自动化测试覆盖。

未解决问题：
1. 第七阶段主要剩余体验增强项而非主链路缺口。

下一步：
1. 评估是否需要继续做阶段 7 体验增强。
2. 若阶段 7 收尾，则在进入阶段 8 前与你确认酒馆/AI 助手需求。

## 阶段 8 开始前的需求确认约束

用户已明确要求：在进入阶段 8（酒馆与 AI 助手）前，必须先进行一次需求确认沟通；该部分尚未在需求文档中最终确认，不可直接开工。

## [2026-03-13 10:05] 阶段 6 最小 Token 实时同步落地

阶段：阶段 6（进行中）

本次完成：
1. 新增 scene:token:move / scene:token:moved 事件，完成世界内 token 位置实时同步。
2. 服务端新增 world 维度 token 内存态缓存，并接入 Scene.canvasState 持久化，成员 join 后可收到当前 token 状态。
3. 世界页接入 world:join/world:leave 生命周期，离开页面自动退出房间。
4. 世界页接入在线成员更新展示（world:members:update）。
5. WorldCanvas 与 TokenPanel 由占位升级为最小可交互组件。
6. token move 事件写回默认场景，服务重启后可恢复最小 token 布局。
7. 新增 token owner 权限策略：GM 可移动任意 token，非 GM 仅可移动自己的 token。

涉及文件：
1. server/src/socket/events.ts
2. server/src/socket/index.ts
3. client/src/lib/socket.ts
4. client/src/pages/world/WorldPage.tsx
5. client/src/world/components/WorldCanvas.tsx
6. client/src/world/components/TokenPanel.tsx
7. client/src/styles/index.css
8. shared/constants/events.ts
9. docs/interface-registry.json
10. docs/api-contract.md
11. docs/change-log.md
12. 阶段6执行任务清单.md
13. AI上下文记忆文档.md

新增接口：
1. 无新增 HTTP 接口。

新增数据模型或字段：
1. 无（本次为内存态同步）。

新增 Socket 事件：
1. scene:token:moved

当前可运行结果：
1. 登录用户进入世界页后会自动加入对应世界房间。
2. 点击/移动 token 后可实时广播到同房间客户端。
3. 新加入成员可收到当前 token 状态快照。
4. 服务端重启后 token 状态可从 Scene.canvasState 恢复。
5. 非 GM 用户无法移动他人 token；GM 可作为主持人调整任意 token。

未解决问题：
1. 暂未接入角色卡绑定与多 token 权限控制。
2. 暂未实现高频拖拽写库节流与多 Scene 切换隔离。

下一步：
1. 将 token 状态与 Scene 绑定并落库。
2. 进入阶段 7：场景系统、角色卡、世界内聊天。

## [2026-03-13 09:20] 阶段 5 收尾完成（限流、清洗、在线状态、重连提示）

阶段：阶段 5（已完成）

本次完成：
1. 全局聊天新增用户维度限流（窗口/次数可通过环境变量配置）。
2. 聊天消息新增内容清洗策略（控制字符过滤、HTML 转义、敏感词屏蔽）。
3. 新增 world:leave 事件与 world:members:update 广播，支持世界在线成员变更同步。
4. 大厅页新增 socket 连接状态提示（连接中/重连中/已断开）与手动重连按钮。
5. 新增后端基础聊天单元测试（chat.service 清洗逻辑）。

涉及文件：
1. server/src/config/env.ts
2. server/src/socket/index.ts
3. server/src/socket/events.ts
4. server/src/services/chat.service.ts
5. server/src/services/chat.service.test.ts
6. server/package.json
7. client/src/lib/socket.ts
8. client/src/pages/lobby/LobbyPage.tsx
9. docs/api-contract.md
10. docs/interface-registry.json
11. docs/change-log.md
12. 阶段5执行任务清单.md
13. AI上下文记忆文档.md

新增接口：
1. 无新增 HTTP 接口。

新增数据模型或字段：
1. 无。

新增 Socket 事件：
1. world:leave
2. world:members:update

当前可运行结果：
1. 全局聊天发送超过限流阈值会返回 ack 失败并提示重试时间。
2. 聊天消息入库前会做清洗与转义，降低注入风险。
3. 世界成员加入/离开/断线会触发在线成员广播。
4. 大厅页面可感知断线重连状态并支持手动重连。

未解决问题：
1. 敏感词目前为可配置轻量实现，尚未接入完整词库与上下文策略。
2. 尚未补充端到端集成测试（当前为基础单测）。

下一步：
1. 进入阶段 6，落地 scene:token:move 最小同步链路。
2. 在世界页接入 world room 的 join/leave 生命周期与在线状态展示。

## [2026-03-12 07:20] 阶段 5 最小实时聊天链路落地

阶段：阶段 5（进行中）

本次完成：
1. Socket 连接接入 JWT 鉴权，登录态用户才可建立实时连接。
2. 新增 global:message:send 与 global:message:new 事件，实现全局聊天实时广播。
3. 新增 world:join 事件基础实现（成员校验后加入世界房间）。
4. 新增聊天历史接口 GET /api/chat/global/recent。
5. 大厅页面接入实时聊天 UI、消息历史加载、socket 收发。
6. 通过联调验证：socket 发送 ack 成功，历史接口可回读。

涉及文件：
1. server/src/socket/index.ts
2. server/src/socket/events.ts
3. server/src/services/chat.service.ts
4. server/src/controllers/chat.controller.ts
5. server/src/routes/chat.routes.ts
6. server/src/routes/index.ts
7. client/src/lib/socket.ts
8. client/src/pages/lobby/LobbyPage.tsx
9. docs/api-contract.md
10. docs/interface-registry.json
11. docs/change-log.md
12. 阶段5执行任务清单.md

新增接口：
1. GET /api/chat/global/recent

新增 Socket 事件：
1. global:message:send
2. global:message:new
3. world:join

当前可运行结果：
1. 登录用户可建立 socket 连接并收到 connection ack。
2. 大厅页面可发送与接收全局实时消息。
3. 新消息持久化到 Message 表，并可通过 recent 接口读取。

未解决问题：
1. 聊天限流尚未实现。
2. 世界在线成员广播尚未实现。

下一步：
1. 完成阶段 5 收尾（限流、在线状态、稳定性）。
2. 准备阶段 6 的最小 token 同步事件骨架。

## [2026-03-12 06:40] 阶段 4 大厅与世界管理核心链路完成

阶段：阶段 4

本次完成：
1. 后端实现世界创建、世界列表、加入世界、世界详情接口。
2. 世界创建时自动创建 GM 成员和默认场景。
3. 支持 PUBLIC/PASSWORD 创建与加入，PASSWORD 使用 bcrypt 哈希和校验。
4. 前端大厅页完成真实业务接入：创建世界、查看我的世界、查看公开世界、加入并进入世界。
5. 前端新增受保护路由守卫，未登录用户自动跳转登录页。
6. 前端请求层新增 token 自动附带与 401 清理登录态。
7. 完成端到端联调：创建世界 -> 查询我的世界 -> 其他账号加入世界。

涉及文件：
1. server/src/services/world.service.ts
2. server/src/controllers/world.controller.ts
3. server/src/routes/world.routes.ts
4. server/src/routes/index.ts
5. client/src/pages/lobby/LobbyPage.tsx
6. client/src/router/RequireAuth.tsx
7. client/src/router/index.tsx
8. client/src/lib/http.ts
9. docs/api-contract.md
10. docs/interface-registry.json
11. docs/change-log.md
12. 阶段4执行任务清单.md

新增接口：
1. GET /api/worlds
2. POST /api/worlds
3. GET /api/worlds/:worldId
4. POST /api/worlds/:worldId/join

新增数据模型或字段：
1. 无新增数据模型；复用 World、WorldMember、Scene。

新增 Socket 事件：
1. 无（阶段 5 开始实现）。

当前可运行结果：
1. 用户登录后可在大厅创建世界。
2. 创建世界后可立即在“我的世界”看到该世界，且角色为 GM。
3. 其他用户可在“公开世界”中看到并加入该世界。
4. 构建通过：server/client 均可成功执行 npm run build。

未解决问题：
1. FRIENDS/PRIVATE 的准入策略仍是占位逻辑。
2. 世界页仍未接入世界详情 API 展示。

下一步：
1. 进入阶段 5，构建全局聊天与 WebSocket 基础链路。
2. 增加 socket token 鉴权与消息广播事件。

## [2026-03-12 00:00] 阶段 2 基础设施完成

阶段：阶段 2

本次完成：
1. 接入 Prisma 与 SQLite，并建立首版业务数据模型。
2. 生成并应用首个迁移，补充种子数据与 data 目录占位结构。
3. 升级健康检查为应用与数据库双探针，并完成构建与运行验证。

涉及文件：
1. package.json
2. server/package.json
3. server/prisma/schema.prisma
4. server/prisma/seed.ts
5. server/src/lib/prisma.ts
6. server/src/services/health.service.ts
7. server/src/controllers/health.controller.ts
8. README.md
9. docs/api-contract.md
10. docs/change-log.md
11. AI上下文记忆文档.md

新增接口：
1. 无新增接口，沿用 GET /api/health 并扩展数据库状态返回。

新增数据模型或字段：
1. User。
2. World。
3. WorldMember。
4. Scene。
5. Character。
6. Message。
7. Friend。
8. AiSession。

新增 Socket 事件：
1. 无。

当前可运行结果：
1. 已成功执行 Prisma 迁移并生成 SQLite 数据库文件。
2. 已成功执行种子脚本并写入最小验证数据。
3. 前后端构建通过。
4. GET /api/health 返回 api=ok、database=ok。

未解决问题：
1. 认证模块尚未开始施工。
2. User 模型目前仅用于基础设施准备，尚未接入注册登录流程。

下一步：
1. 进入阶段 3，实现注册、登录与当前用户接口。
2. 前端登录页和注册页接入真实认证链路。

## [2026-03-11 00:00] 初始规划文档建立

阶段：阶段 0

本次完成：
1. 读取并整理了现有技术栈文档与项目文档。
2. 生成了渐进式开发文档，明确了阶段划分、每阶段目标与验收标准。
3. 生成了本 AI 上下文记忆文档，用于跨会话追踪开发上下文。

涉及文件：
1. 技术栈.md
2. 项目文档.md
3. 渐进式开发文档.md
4. AI上下文记忆文档.md

新增接口：
1. 暂无

新增数据模型或字段：
1. 暂无

新增 Socket 事件：
1. 暂无

当前可运行结果：
1. 项目开发方向、阶段顺序、关键优先级已经明确。
2. 新的 AI 对话可以通过本文件快速知道下一步应从工程骨架开始。

未解决问题：
1. 代码工程尚未创建。
2. 项目文档存在部分历史提示语与生成内容混杂，需要在后续开发时只提炼有效需求。

下一步：
1. 初始化前后端工程骨架。
2. 建立 Prisma 与 SQLite 基础配置。

## [2026-03-11 00:20] 阶段 0 需求清单同步（v0.1）

阶段：阶段 0

本次完成：
1. 读取用户填写后的需求清单并完成冻结提炼。
2. 将冻结结果同步到渐进式开发文档与本记忆文档。
3. 标记了空值、单位冲突和 MVP 边界冲突，作为阶段 1 前置确认项。

涉及文件：
1. 需求确认与填写清单.md
2. 渐进式开发文档.md
3. AI上下文记忆文档.md

新增接口：
1. 暂无

新增数据模型或字段：
1. 暂无

新增 Socket 事件：
1. 暂无

当前可运行结果：
1. 阶段 0 已从“建议态”升级为“用户确认驱动的冻结态”。
2. 下一步可直接按阶段 1 文件级任务清单开始工程初始化。

未解决问题：
1. 需求清单有少量未填参数。
2. 部分字段存在单位冲突和 MVP 边界冲突，需用户最终拍板。

下一步：
1. 生成并执行阶段 1 文件级任务清单。
2. 在开工前完成待确认项的最终定稿。

## [2026-03-11 00:35] 阶段 0 参数终稿确认

阶段：阶段 0

本次完成：
1. 用户通过聊天补齐全部关键参数与边界决策。
2. 需求清单冲突项全部消除，形成 v0.1 最终冻结。
3. 新增架构约束：目录分层、酒馆隔离、组件模块化。

涉及文件：
1. 需求确认与填写清单.md
2. 渐进式开发文档.md
3. AI上下文记忆文档.md
4. 阶段1执行任务清单.md

新增接口：
1. 暂无

新增数据模型或字段：
1. 暂无

新增 Socket 事件：
1. 暂无

当前可运行结果：
1. 阶段 0 已完整闭合，可无歧义进入阶段 1 实作。
2. 阶段 1 的目录与模块边界已固定，可直接按文件级任务开工。

未解决问题：
1. 暂无阻塞项。

下一步：
1. 执行阶段 1 工程骨架初始化。
2. 创建 client/server/data/shared/docs 目录与基础文件。

## [2026-03-11 01:05] 阶段 1 工程骨架完成

阶段：阶段 1

本次完成：
1. 建立了 monorepo 基础工程（client/server/data/shared/docs）。
2. 建立了前端 React + Vite 与后端 Express + Socket.IO 可运行骨架。
3. 固化了目录边界：前后端与数据目录分离，酒馆模块独立，世界能力组件化占位。
4. 完成依赖安装并通过全量构建验证。

涉及文件：
1. package.json
2. client/**
3. server/**
4. data/**
5. shared/**
6. docs/**

新增接口：
1. GET /api/health
2. GET /api/tavern/status

新增数据模型或字段：
1. 暂无（阶段 2 开始接 Prisma）

新增 Socket 事件：
1. system:connection-ack

当前可运行结果：
1. 工作区可执行 npm run dev 启动前后端。
2. 工作区可执行 npm run build 完成前后端构建。

未解决问题：
1. 暂未接入数据库与鉴权。
2. 暂未实现业务接口，仅保留健康检查和酒馆占位状态接口。

下一步：
1. 进入阶段 2，初始化 Prisma 与 SQLite。
2. 设计并落地 User/World/WorldMember/Scene/Message 基础模型。