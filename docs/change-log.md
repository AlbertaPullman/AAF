# Change Log

## 2026-03-16 (Stage 8 - Auth Theme Migration From OLD AAF)

- 迁移旧项目登录视觉资产到新前端：`loginbg.jpg`、`logoae.gif`、`login.png`。
- 新增电影化认证页组件，复刻旧版登录节奏：背景入场、粒子下落、Logo 动画、按钮延迟坠落。
- 登录页与注册页统一为同一认证入口，在弹层中切换“登录/注册”模式。
- 应用壳布局新增鉴权页全屏模式：`/login` 与 `/register` 页面隐藏全局 Header。
- 新增认证主题样式变量与动画，整体配色向旧站风格靠拢。
- 新增前端静态资源类型声明（`vite-env.d.ts`、`types/assets.d.ts`），修复资源导入类型错误。
- 前端构建验证通过：`npm run build -w client`。

## 2026-03-16 (Stage 8 - Story Event <-> Chat Search)

- 新增剧情事件与聊天双向检索接口：`GET /api/worlds/:worldId/story-events/search`。
- 检索支持关键词匹配事件文本与聊天文本，并支持按 `sceneId` 过滤场景上下文。
- 检索结果支持双向关联：事件命中可反查关联聊天，聊天命中可反补关联事件。
- 世界页剧情事件面板新增“事件与聊天双向检索”入口与结果展示区。
- 检索增强：新增 `eventStatus`、`channelKey`、`hours` 结构化筛选参数。
- 面板增强：支持一键定位检索命中的聊天消息并在聊天区高亮显示。
- 联动增强：支持一键定位检索命中的剧情事件并在事件区高亮显示。
- 新增聊天精确定位接口：`GET /api/chat/worlds/:worldId/messages/:messageId`，支持定位超出 recent 100 窗口的历史消息。
- 世界页定位逻辑升级：先按 `messageId` 精确读取，再与 recent 列表合并展示，避免“找不到旧消息”。
- 事件定位体验增强：定位时自动滚动到目标事件卡片并触发更显著高亮。
- 新增 AI 助手上下文接口：`GET /api/worlds/:worldId/assistant/context`。
- 上下文返回策略固定为“事件结算卡片优先 + 最近聊天补充”，为后续 AI 助手接入提供稳定输入。
- 新增 AI 助手受控生成接口：`POST /api/worlds/:worldId/assistant/respond`。
- 世界页新增最小触发入口，可生成一条 SYSTEM 频道的 AI 助手草案消息并立即回显。
- tavern 模块新增本地 fallback 草案生成逻辑，为后续真实适配器替换保留边界。
- 修复 server workspace 启动脚本：移除对 `dotenv-cli` 命令的依赖，改为由 `env.ts` 自动加载根目录 `.env`。
- 新增后端检索纯函数测试：覆盖关键词匹配、metadata 事件关联提取、筛选参数归一化与非法参数校验。
- 同步更新接口契约与接口注册表。

## 2026-03-15 (Stage 8 - Story Narrative Request Flow)

- 剧情事件新增物语点提案审核流：玩家可提交提案，GM 可审批通过或驳回。
- `StoryEvent` 新增 `narrativeRequests` 持久化字段，已生成并应用迁移。
- 后端新增接口：
	- `POST /api/worlds/:worldId/story-events/:eventId/narrative-requests`
	- `POST /api/worlds/:worldId/story-events/:eventId/narrative-requests/:requestId/decision`
- 提案与裁决均会写入世界聊天 metadata，便于后续 AI 助手读取上下文。
- 前端 `StoryEventPanel` 新增提案提交区与 GM 裁决区，并在聊天区渲染提案/裁决标签。
- 回归验证通过：server build、client build、server test（38 tests passed）。

## 2026-03-11

- 完成阶段 1 工程骨架初始化。
- 建立 client/server/data/shared/docs 目录。
- 建立酒馆独立模块占位结构。
- 建立世界内组件模块化占位结构。
- 新增命名规范文档和接口注册表，统一后续 AI/人工开发的命名与接口一致性。
- 新增新会话接手引导文档，明确跨会话的必读顺序与更新义务。

## 2026-03-12 (Stage 3)

- 进入阶段 3，建立认证系统与前端登录流程。
- 更新前后端端口（前端 5174，后端 6666）。
- 后端新增认证服务（bcrypt 密码加密 + JWT token 生成）。
- 后端新增认证控制器与路由（/api/auth/register、/api/auth/login、/api/auth/me）。
- 升级认证中间件为完整 JWT 验证和 token 解析。
- 前端新增 Zustand 认证状态管理（支持 localStorage 持久化）。
- 前端新增登录与注册页面（完整表单实现、错误处理、跳转逻辑）。
- 升级前端 HTTP 客户端配置（环境变量支持）。
- 依赖更新：添加 bcrypt^5.1.1、jsonwebtoken^9.0.0 及其 TypeScript 类型定义。
- 集成测试通过：注册 → 登录 → 获取用户信息完整流程验证。
- 新增阶段 3 执行清单文档，记录完成的所有实现细节。

## 2026-03-12 (Stage 4)

- 进入阶段 4，接入大厅与世界管理基础链路。
- 后端新增世界服务与控制器，支持创建世界、世界列表、加入世界、获取世界详情。
- 世界创建自动创建世界成员（GM）与默认场景。
- 接入密码世界逻辑：创建时存储哈希，加入时校验口令。
- 前端大厅页由占位页升级为可用页面，支持创建、查看、加入、进入世界。
- 前端请求层新增 JWT 自动附带与 401 清理本地登录态。
- 路由新增受保护路由守卫，未登录访问大厅/世界将跳转登录页。
- 接口文档与接口注册表更新至 auth + world 新接口。
- 集成联调通过：创建世界 → 查询我的世界 → 其他账号加入世界。

## 2026-03-12 (Stage 5 - In Progress)

- 新增 Socket JWT 鉴权中间件，连接阶段校验 token 并绑定 userId。
- 新增全局聊天事件：global:message:send、global:message:new。
- 新增世界房间基础事件：world:join（成员校验后加入 room）。
- 新增聊天服务与接口：GET /api/chat/global/recent。
- 前端大厅页接入全局聊天实时收发与历史加载。
- 前端 socket 客户端升级为环境变量端口 + token 鉴权连接。
- 验证通过：socket 发送消息 ack=ok，并可通过 recent 接口回读。

## 2026-03-13 (Stage 5 - Wrap Up)

- 服务端新增全局聊天用户维度限流（窗口/阈值支持环境变量配置）。
- 服务端新增聊天内容清洗：控制字符剔除、HTML 转义、敏感词屏蔽（可配置）。
- 服务端新增世界房间离开事件 world:leave。
- 服务端新增世界在线成员广播事件 world:members:update（join/leave/断开连接触发）。
- 前端大厅新增断线、重连中、已连接状态提示，并提供手动重连按钮。
- server 新增基础聊天测试脚本与 chat.service 单元测试样例。

## 2026-03-13 (Stage 6 - Minimal Token Sync)

- 服务端新增 scene:token:moved 广播事件，支持最小 token 位置同步。
- 服务端新增世界房间内 token 内存态缓存，新成员 join 后可收到当前 token 状态。
- 服务端将 token 状态接入 Scene.canvasState 持久化，服务重启后可恢复。
- 世界页接入 socket 生命周期：connection ack 后自动 world:join，离开页面自动 world:leave。
- 世界页接入最小 VTT 交互：点击/移动 token 后发送 scene:token:move。
- 世界页显示实时在线人数与连接状态，接收 world:members:update 更新。
- WorldCanvas 与 TokenPanel 从占位升级为可交互最小组件。
- 新增 token owner 权限控制：GM 可移动任意 token，非 GM 仅可移动自己 token。
- 前端新增“新增我的 token”操作，默认以当前用户作为 token owner。

## 2026-03-13 (Stage 7 - World Chat Kickoff)

- 后端新增世界聊天历史接口：GET /api/chat/worlds/:worldId/recent。
- Socket 新增 world:message:send 与 world:message:new 事件。
- 世界页新增世界内聊天面板，支持历史加载与实时收发。
- 世界聊天发送限制：必须先加入 world room，且必须是世界 ACTIVE 成员。

## 2026-03-13 (Stage 7 - Character Card Minimum)

- 新增角色卡接口：GET/POST /api/worlds/:worldId/characters。
- 世界页新增 CharacterPanel，支持角色列表、创建与当前绑定角色选择。
- token 同步事件新增 characterId/characterName 绑定信息。
- 服务端新增角色绑定权限校验：非 GM 仅可绑定/移动自己的角色 token。

## 2026-03-13 (Stage 7 - Character Detail Edit)

- 新增角色详情更新接口：PUT /api/worlds/:worldId/characters/:characterId。
- 角色列表/创建返回数据补充 stats 与 snapshot。
- 世界页 CharacterPanel 新增角色详情编辑（name/stats/snapshot JSON）与保存。
- 保存时执行权限校验：GM 可编辑任意角色，非 GM 仅可编辑自己角色。
- 世界页角色详情编辑升级为结构化字段（HP/MP/等级/职业），不再依赖手写 JSON。
- 新增角色权限单元测试（character.permission.test.ts），覆盖 GM/PLAYER 创建与编辑边界。

## 2026-03-13 (Stage 7 - World Chat Channels)

- 世界聊天新增多频道支持：OOC / IC / SYSTEM。
- 世界聊天历史接口支持 channelKey 查询参数。
- world:message:send / world:message:new payload 支持 channelKey。
- 世界页聊天面板新增频道切换并按频道拉取历史。
- 新增频道权限：SYSTEM 频道仅 GM 可发送，前后端均增加限制。
- 新增频道权限单元测试（chat.channel.test.ts）。
- 世界页新增频道未读计数（最小版），切换频道后自动清零当前频道未读。
- 世界页未读计数新增 localStorage 持久化（按 worldId+userId 维度）。
- 服务端新增世界频道消息发送审计日志。

## 2026-03-13 (Stage 7 - Multi Scene Minimum)

- 新增场景接口：GET/POST /api/worlds/:worldId/scenes。
- Socket 新增 scene:select 事件用于切换当前场景。
- token 同步升级为 scene 作用域，scene:token:move/moved payload 增加 sceneId。
- 世界页新增 ScenePanel，支持场景列表、切换和创建（最小版）。
- 服务端 token 缓存从 world 级升级为 world+scene 级。

## 2026-03-13 (Stage 7 - Scene Chat Isolation Minimum)

- 世界聊天历史接口支持 sceneId 查询参数，按场景返回频道历史。
- 世界聊天发送链路携带 sceneId，并校验与当前 scene:select 上下文一致。
- 世界聊天消息广播 payload 新增 sceneId 字段。
- 世界页聊天与未读计数改为 world+scene 维度隔离存储。

## 2026-03-13 (Stage 7 - Scene Rename Minimum)

- 新增场景重命名接口：PUT /api/worlds/:worldId/scenes/:sceneId。
- 服务端新增 scene rename 权限校验（仅 GM，可校验 scene 属于当前 world）。
- 世界页 ScenePanel 新增“重命名当前场景”交互。

## 2026-03-13 (Stage 7 - Scene Delete Minimum)

- 新增场景删除接口：DELETE /api/worlds/:worldId/scenes/:sceneId。
- 服务端新增 scene delete 权限与约束（仅 GM，且至少保留一个场景）。
- 世界页 ScenePanel 新增“删除当前场景”交互与前端保护。

## 2026-03-13 (Stage 7 - Scene Sort Minimum)

- 新增场景排序接口：PATCH /api/worlds/:worldId/scenes/:sceneId/sort。
- 服务端新增场景上移/下移逻辑（仅 GM，事务交换 sortOrder）。
- 世界页 ScenePanel 新增上移/下移按钮并接入排序请求。

## 2026-03-13 (Stage 7 - Scene Management Unit Tests)

- 新增 scene.permission.test.ts，覆盖场景管理权限判定与排序目标解析。
- 场景管理核心规则（GM-only、排序边界）具备可回归的纯函数测试。

## 2026-03-13 (Stage 7 - Scene Chat Unit Tests)

- chat.service 抽出 scene 相关纯函数：extractSceneIdFromMetadata、filterMessagesByScene。
- chat.service.test 增加 scene metadata 解析与 scene 过滤规则测试。

## 2026-03-13 (Stage 7 - Scene Routes Integration Tests)

- 新增 scene.routes.test.ts，覆盖场景管理接口的真实 HTTP 链路。
- 验证 GM/非 GM 场景管理权限、排序行为、删除边界（不可删除最后一个场景）。

## 2026-03-13 (Stage 7 - Scene Isolation Socket Tests)

- 新增 scene-isolation.test.ts，覆盖 scene 维度的 socket 组合链路。
- 验证 scene:select、scene:token:move、world:message:send/new 与按 sceneId 的历史读取保持一致隔离。

## 2026-03-13 (Stage 7 - Scene Socket Negative Tests)

- scene-isolation.test.ts 新增异常路径测试。
- 验证未 join 房间即发送/移动，以及 scene mismatch 均会返回正确 ack 错误。

## 2026-03-13 (Stage 7 - Wrap Up)

- 统一更新 README、阶段清单、路线文档与 AI 上下文记忆，确认阶段 7 核心链路已完成。
- 明确阶段 8 为需求确认门槛阶段，酒馆与 GM 助手功能暂不开工。
- 阶段 7 剩余事项归类为体验增强，不再视为主链路阻塞项。

## 2026-03-13 (Stage 8 - Design Draft)

- 新增阶段 8 开发文档：阶段8执行任务清单.md。
- 明确阶段 8 采用“AAF 主控 + SillyTavern 适配层 + 模型 API”结构。
- 明确主持人总结器为手动触发、草案审核后写回。

## 2026-03-13 (Stage 8 - World Requirements Checklist)

- 新增世界需求与填写清单.md，用于冻结“一个世界=完整团务包”的业务边界。
- 清单覆盖战斗场景、营地场景、城镇互动、触发器、智能角色卡、天赋树、自定义规则编辑、扩展包管理、AI 总结审核流。
- 每项均提供可填写优先级与验收标准，便于后续实现拆解。

## 2026-03-13 (Stage 8 - World Implementation Blueprint)

- 补齐世界需求清单中的关键可执行项（测量板模板、首发 P0 子集等）。
- 修复世界需求文档结构错位，恢复章节完整性。
- 新增世界细化开发文档.md，作为世界模块开发主线文档。

## 2026-03-13 (Stage 8 - Iteration A Task Breakdown)

- 新增阶段8-迭代A开发任务单.md，按后端、前端、规则引擎三泳道拆分开工任务。
- 为迭代 A 增加建议文件清单、验收标准、执行顺序与 DoD。
- 在世界细化开发文档中挂载迭代 A 任务单引用。

## 2026-03-13 (Stage 8 - Iteration A Runtime Kickoff)

- 新增 world runtime 模块：world-runtime.types.ts、world-runtime.service.ts。
- 新增运行时单测：world-runtime.service.test.ts。
- 新增接口：GET /api/worlds/:worldId/runtime、PATCH /api/worlds/:worldId/runtime。
- world routes 挂载 runtime 路由，补充接口注册表与 API 契约文档。
- 通过 server build 与 server test 验证（26 tests passed）。

## 2026-03-13 (Stage 8 - Iteration A Module Registry)

- 新增 runtime 模块注册中心：module-registry.ts、module.types.ts。
- 支持 register/enable/disable/get/list 基础能力。
- 增加依赖校验：依赖缺失或未启用时拒绝启用目标模块。
- 增加懒加载钩子入口 invokeRuntimeModuleLazyLoader，并实现单次缓存加载。
- 新增 module-registry.test.ts，覆盖注册排序、依赖校验、启停、懒加载缓存。
- 通过 server build 与 server test 验证（30 tests passed）。

## 2026-03-13 (Stage 8 - Iteration A Event Bus)

- 新增事件命名校验模块：event-naming.ts。
- 新增 Typed Event Bus：event-bus.ts，支持 on/off/once/emit/listenerCount。
- 增加事件命名约束校验（domain:entity:action）。
- 非法事件名返回中文错误提示，事件处理器类型非法返回统一错误结构。
- 新增 event-bus.test.ts，覆盖命名解析、非法命名、订阅/退订、once、错误分支。
- 通过 server build 与 server test 验证（36 tests passed）。

## 2026-03-13 (Stage 8 - Iteration A Runtime Module APIs)

- world runtime 控制器新增模块管理接口：
	- GET /api/worlds/:worldId/runtime/modules
	- PATCH /api/worlds/:worldId/runtime/modules/:moduleKey
- 模块列表接口增加默认模块自动初始化（runtime-core、scene-sync、world-chat、rule-engine）。
- 模块启停接口接入 GM/ASSISTANT 权限校验与依赖错误返回。
- world routes 挂载 runtime module 路由。
- module-registry.test.ts 增加默认模块初始化测试。
- 接口注册表与 API 契约文档同步更新。
- 通过 server build 与 server test 验证（37 tests passed）。

## 2026-03-13 (Stage 8 - Iteration A Runtime Frontend Panels)

- 世界页新增 RuntimePanel，展示运行状态、模块数量、异常摘要与刷新入口。
- 世界页新增 ModulePanel，展示模块清单、依赖关系与启停按钮。
- ModulePanel 按角色控制：GM/ASSISTANT 可启停，其他角色只读。
- 世界页接入 runtime 与 runtime modules 接口加载逻辑。
- 模块启停后本地状态即时刷新，并保留错误提示。
- 通过 client build 验证（tsc + vite build passed）。

## 2026-03-13 (Stage 8 - Iteration A World i18n Baseline)

- 新增世界模块中文文案入口：
	- client/src/world/i18n/zh-CN.ts
	- client/src/world/i18n/messages.ts
- RuntimePanel 与 ModulePanel 文案改为统一读取中文文案中心。
- 新增运行时错误消息映射（英文后端错误 -> 中文可读提示）。
- 世界页 runtime 相关接口错误统一接入中文映射函数。
- 通过 client build 验证（tsc + vite build passed）。

## 2026-03-13 (Stage 8 - Iteration A Rule Type Baseline)

- 新增 shared/rules/context.ts，定义 RuleContext 与构造函数。
- 新增 shared/rules/result.ts，定义 RuleExecutionResult 与构造函数。
- 新增 shared/rules/node-types.ts，定义条件/动作节点协议与光源、测量板参数类型。
- 新增 shared/rules/node-metadata.ts，定义中文节点元数据与校验函数。
- 规则节点元数据强制中文字段（displayNameZh、descriptionZh）。
- 通过 server build 与 client build 验证（双端构建均通过）。

## 2026-03-13 (Stage 8 - Iteration B Combat/Visual Runtime Kickoff)

- 场景视觉状态新增接口：
	- GET /api/worlds/:worldId/scenes/:sceneId/visual
	- PATCH /api/worlds/:worldId/scenes/:sceneId/visual
- 场景战斗状态新增接口：
	- GET /api/worlds/:worldId/scenes/:sceneId/combat
	- PUT /api/worlds/:worldId/scenes/:sceneId/combat
	- POST /api/worlds/:worldId/scenes/:sceneId/combat/next-turn
- scene service 新增视觉状态（网格/光源/迷雾）与战斗状态（先攻/轮次/回合）读写能力。
- scene service 保存 canvasState 改为增量合并，避免 token 状态覆盖其他状态字段。
- 新增 scene.runtime.routes.test.ts，覆盖权限边界与回合推进行为。
- 接口注册表与 API 契约文档同步更新。
- 通过 server build 与 server test 验证（38 tests passed）。

## 2026-03-13 (Stage 8 - Iteration B Runtime Frontend Panels)

- 世界页新增视觉状态面板 SceneVisualPanel，接入 visual 状态查询与增量更新。
- 世界页新增战斗回合面板 SceneCombatPanel，接入 combat 状态查询、保存与 next-turn 推进。
- 视觉面板支持网格开关/尺寸微调、迷雾状态切换、点光源添加与清空。
- 战斗面板支持状态切换、最小先攻列表管理、回合推进按钮。
- 新增 world scene runtime 中文文案中心（视觉/战斗面板文案）与错误映射扩展。
- 通过 client build 验证（tsc + vite build passed）。

## 2026-03-15 (Stage 8 - Rule Spec Draft for Combat/Crafting)

- 新增规则规格文档 docs/规则规格-战斗与造物系统-v1.md。
- 文档固化能力联动机制（主动/被动、触发器、限制、防循环）。
- 文档固化战斗面板结构（能力页/背包页/状态详情页）与快捷栏交互原则。
- 文档固化动作经济、资源系统、多段攻击续攻、范围测量板与半格覆盖判定建议。
- 文档固化造物系统（词条拼装、强化槽位、宝石插槽、跨时间推进、自动造物）与待确认清单。
- 规则文档新增“高频触发响应策略”，支持始终询问/智能询问/自动触发三档机制。
- 补充多段攻击批量确认窗口与预设条件触发方案，降低高频弹窗打断。
- 补充“多次攻击且不同目标”规则：攻击段队列、逐段目标改选、分段结算与效果绑定范围。
- 多目标多段攻击规则升级为“攻击计划 + 动态重定向”模型，支持玩家开局即分配不同目标并在结算中临时切火。
- 规则文档新增“快速模式/精确模式”交互细则，明确默认打断节点、可视化状态条与单次能力临时覆盖行为。
- AI上下文记忆文档新增阶段8文档索引，统一主线文档、规则规格、接口契约与变更日志入口。
- 规则文档新增“剧情事件与扮演交互”章节：支持GM空白事件即时编辑、选项检定与延迟填后果、聊天绑定检定标签、物语点剧情风暴审核流。
- 根目录新增 start.bat，一键启动前后端并自动打开调试页面（http://localhost:5174）。
- 规则文档新增“事件留档与结算卡片”要求：事件结算后生成卡片入聊天频道，供AI助手优先读取剧情经过。

## 2026-03-15 (Stage 8 - Story Event MVP)

- 后端新增剧情事件最小 API：创建事件、编辑事件、追加选项、提交检定、GM结算、结算卡片列表。
- 剧情事件采用 GM 即兴编辑模型，支持 SINGLE/PER_PLAYER/UNLIMITED 三种检定次数规则。
- GM 结算事件后自动向世界 SYSTEM 频道发送“事件结算卡片”消息（含标题、简述、经过、后果）。
- 玩家提交检定时可附带聊天文本，系统会写入带 `storyEventCheckTag` 的绑定消息。
- 聊天消息 payload 增加 metadata 字段。
- 世界页聊天面板新增事件结算卡片与技能检定标签渲染。
- 前后端构建验证通过（server build + client build）。

## 2026-03-15 (Stage 8 - Story Event Persistence)

- 剧情事件服务从进程内存存储迁移为 Prisma 持久化存储（server/src/services/story-event.service.ts）。
- Prisma schema 新增 StoryEvent 模型与 StoryEventScope/StoryEventStatus 枚举。
- 新增数据库迁移：server/prisma/migrations/20260315072102_stage8_story_event_persistence/migration.sql。
- 进行中剧情事件在服务重启后可恢复，解决内存态事件丢失问题。
- 后端构建与后端测试全通过（38/38）。

## 2026-03-15 (Project Final Acceptance Checklist Draft)

- 新增 docs/最终验收清单-完整版路线图.md。
- 文档按“环境/主链路/战斗运行时/剧情事件/造物/剧情扮演/AI上下文/性能/发布前”分层验收。
- 每项均包含可执行操作与预期结果，支持边开发边补全与打勾。