# 04 规则引擎与结算

## 职责

规则引擎负责把资源模板中的可视化配置转成自动结算：检定、资源消耗、条件、触发器、效果、持续时间、结算日志。

## 入口文件

- `shared/rules/ability-engine.ts`
- `shared/rules/context.ts`
- `shared/rules/node-types.ts`
- `shared/rules/result.ts`
- `server/src/services/ability-engine.service.ts`
- `server/src/services/settlement.service.ts`
- `server/src/routes/scene.ability.routes.test.ts`
- `server/src/routes/scene.settlement.routes.test.ts`
- `server/src/services/settlement.service.test.ts`
- `docs/规则规格-战斗与造物系统-v1.md`

## 当前约定

- AAF 不使用整轮动作，不使用法术环位。
- 动作经济为标准、快速、机动、自由、反应、复合、特殊。
- 法术配置使用法术等级序列、MP、AP、学派与法术类别。
- 所有能力效果应尽量走数据表达式，不写死职业或特性。
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
