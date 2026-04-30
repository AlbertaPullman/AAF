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
- `.superdesign/design_iterations/lobby_*.html` 是大厅 superdesign 静态设计稿，当前共有五版：晴空集结、冒险公告板、飞空艇控制台、蔚蓝酒馆桌面、碧空图书馆。它们用于评审方向，不代表 `LobbyPage.tsx` 已落实现。
- 大厅真实实现需保留现有功能面：左侧/侧栏聊天、世界列表搜索筛选排序、创建/进入/加入/删除世界、星语论坛占位、角色卡预创建、规则书、天赋树预览等外部工具入口。
- 大厅聊天频道必须单独占用一个稳定边栏和独立容器；不要把聊天与角色卡、规则书、天赋树、图鉴等工具挤在同一个可压缩侧栏里。
- 角色卡预创建、规则书、天赋树预览、token 绘制、怪物图鉴、世界设定等都归入工具箱；静态稿通过 `lobby_design_interactions.js` 演示频道切换、工具箱切换、按钮 toast 和本地消息追加。

## 常见任务定位

- 登录/注册体验：打开 `client/src/pages/auth/*` 和 `auth.service.ts`。
- 大厅世界列表：打开 `LobbyPage.tsx` 和 `world.service.ts`。
- 社交关系：打开 `social.routes.ts` 和 `social.service.ts`。

## 验证

- 前端页面改动跑 `npm run build -w client`。
- 后端账号社交改动跑 `npm run build -w server`，必要时补测试。
- 仅新增 `.superdesign/design_iterations` 静态稿时，可用浏览器直接打开对应 HTML 预览；真正改 React/CSS 后再跑 client build。
- 静态稿交互验证至少点一遍：聊天频道切换、工具箱 tab/目录切换、消息输入发送预览。
