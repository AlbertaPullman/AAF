# 04 规则引擎与结算

## 职责

规则引擎负责把资源模板中的可视化配置转成自动结算：检定、资源消耗、条件、触发器、效果、持续时间、结算日志。

## 入口文件

- `shared/rules/ability-engine.ts`
- `shared/rules/ability-workflow.ts`
- `shared/rules/context.ts`
- `shared/rules/node-types.ts`
- `shared/rules/result.ts`
- `server/src/services/ability-engine.service.ts`
- `server/src/services/settlement.service.ts`
- `server/src/routes/scene.ability.routes.test.ts`
- `server/src/routes/scene.settlement.routes.test.ts`
- `server/src/services/settlement.service.test.ts`
- `docs/规则规格-战斗与造物系统-v1.md`
- `能力系统接口文档.md`

## 当前约定

- 2026-04-30 起，能力执行统一走 `AbilityWorkflowRun`：声明、目标确认、资源、反应窗口、攻击/豁免、伤害、应用伤害、应用效果、后处理、完成日志都必须在 workflow phases 中体现；旧式“公式直接结算并写结果”的描述视为过时。
- 自动化不再使用单个布尔开关，而是 `manual` / `assisted` / `full` 三档。`manual` 只生成预览和等待确认的 workflow，不真实扣资源/扣血/应用效果；`assisted` 是内部测试默认；`full` 预留给一条龙自动结算。
- 执行服务读取顺序为“本次请求 automation/automationMode → `AbilityDefinition.automation` → `assisted` 预设”，不要在场景页或按钮层重新发明默认值。
- `damage-application` 必须写入 `workflow.damageApplications`，至少包含原始伤害、有效伤害、临时 HP 吸收、HP 扣减、抗性/易伤/免疫/固定减伤标记；手动模式保留预览但不改写角色 HP。
- 后端执行入口返回 `workflow`，并将同一份 workflow 写入场景 `canvasState.abilityLogs`，供聊天卡片、审计、撤销和重放使用。
- AAF 不使用整轮动作，不使用法术环位。
- 动作经济为标准、快速、机动、自由、反应、复合、特殊。
- 法术配置使用法术等级序列、MP、AP、学派与法术类别。
- 所有能力效果应尽量走数据表达式，不写死职业或特性。
- 能力系统接口以根目录 `能力系统接口文档.md` 为准；旧版无 workflow 的直接结算描述视为过时。
- 初版能力 registry 位于 `shared/rules/ability-registry.ts`：集中维护状态分类、状态 key、触发时机、效果类型、可视化公式选项和 DC 预设。
- 状态分类已作为运行时概念进入结算：`hasStatusCategory`、`removeStatusCategory`、`grantStatusCategoryImmunity` 必须按分类匹配任意状态。
- 可视化条件会把“力量调整值 + 敏捷调整值 >= 固定 DC 15”这类选择保存为条件表达式和 UI 元数据；服务端按公式上下文解析，不依赖前端手写字符串。
- 结算日志要能让玩家看结果、GM 追细节。

## 常见任务定位

- 修改可执行能力效果：先看 `ability-engine.service.ts`。
- 修改公式/节点/条件类型：先看 `shared/rules/*`。
- 修改战斗结算动作：看 `settlement.service.ts`。
- 规则冲突时只读 `docs/规则规格-战斗与造物系统-v1.md` 的相关章节，不读整本规则书。

## 验证

- `npm run build -w server`
- `npm test -w server`
- 如果共享类型影响前端，再跑 `npm run build -w client`。
