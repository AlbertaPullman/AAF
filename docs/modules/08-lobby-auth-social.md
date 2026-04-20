# 08 大厅账号与外部页面

## 职责

本模块管理世界外的页面：登录、注册、大厅、社交、世界列表、公开入口。当前优先级低于可玩世界模板。

## 入口文件

- `client/src/pages/auth/*`
- `client/src/pages/lobby/LobbyPage.tsx`
- `client/src/router/index.tsx`
- `client/src/store/authStore.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/routes/social.routes.ts`
- `server/src/services/auth.service.ts`
- `server/src/services/social.service.ts`

## 当前约定

- 大厅可以暂缓深做，但玩家从世界返回大厅的入口必须可靠。
- 登录注册不应影响世界模板开发节奏。
- 世界内权限不要和大厅社交权限混在一起。

## 常见任务定位

- 登录/注册体验：打开 `client/src/pages/auth/*` 和 `auth.service.ts`。
- 大厅世界列表：打开 `LobbyPage.tsx` 和 `world.service.ts`。
- 社交关系：打开 `social.routes.ts` 和 `social.service.ts`。

## 验证

- 前端页面改动跑 `npm run build -w client`。
- 后端账号社交改动跑 `npm run build -w server`，必要时补测试。
