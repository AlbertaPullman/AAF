# 05 角色与权限

## 职责

本模块管理角色、成员身份、可见性和操作边界。四类身份是 GM、玩家助手、玩家、旁观者。

## 入口文件

- `shared/constants/roles.ts`
- `shared/types/permissions.ts`
- `server/src/services/character.service.ts`
- `server/src/services/world.service.ts`
- `server/src/services/character.permission.test.ts`
- `server/src/services/scene.permission.test.ts`
- `client/src/world/components/CharacterPanel.tsx`
- `client/src/pages/world/WorldPage.tsx`

## 当前约定

- GM 拥有世界管理权。
- GM 可以从系统页或快捷面板进入本地“玩家视角”调试模式；该模式只影响当前客户端的前端权限展示和可操作入口，不修改服务端身份，且必须始终提供退出玩家视角入口。
- 玩家助手协助现场，但不默认拥有世界模板所有权。
- 玩家操作自己的角色、棋子、HUD、聊天和公开规则。
- 旁观者只读公开信息。
- 玩家必须始终有返回大厅入口。
- 左侧队伍简卡展示关键数据，角色详细数据进入角色卡弹窗。

## 常见任务定位

- 改权限规则：先看 `shared/constants/roles.ts`、`world.service.ts`、相关 permission test。
- 改角色创建/编辑：看 `character.service.ts` 和角色卡 UI 调用处。
- 改队伍简卡：看 `CharacterPanel.tsx`。
- 改成员管理：看 `WorldPage.tsx` 内 PlayerManagePane，后续应独立拆出组件。

## 验证

- 权限改动必须跑 `npm test -w server`。
- 角色 UI 改动跑 `npm run build -w client`。
