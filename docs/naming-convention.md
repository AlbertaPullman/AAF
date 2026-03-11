# 命名规范（强制）

本文档用于统一后续所有 AI 与人工开发的命名方式，防止接口、事件、文件命名不一致导致串联失败。

## 1. 通用规则

1. 语义优先，避免缩写。
2. 一个概念只保留一种拼写。
3. 文件名与导出符号尽量同名。
4. 不使用中文命名代码符号。

## 2. 前端命名

1. 组件：PascalCase，例如 `WorldCanvas.tsx`。
2. hooks：camelCase 且前缀 `use`，例如 `useAuthStore`。
3. 页面组件：`XxxPage.tsx`，例如 `LobbyPage.tsx`。
4. 样式文件：小写短横线或目录聚合文件，例如 `index.css`。

## 3. 后端命名

1. 路由文件：`*.routes.ts`。
2. 控制器文件：`*.controller.ts`。
3. 服务文件：`*.service.ts`。
4. 中间件文件：`*.ts`，函数名以 `Middleware` 结尾（例如 `authMiddleware`）。
5. 配置文件：放入 `config/`，按用途命名（例如 `env.ts`、`logger.ts`）。

## 4. API 命名

1. 基础前缀固定：`/api`。
2. 资源路径用复数名词：`/api/worlds`、`/api/users`。
3. 动词体现在 HTTP 方法，不写进路径。
4. 子资源层级：`/api/worlds/:worldId/scenes`。
5. 健康检查保留：`/api/health`。

## 5. Socket 事件命名

1. 命名格式：`domain:entity:action`。
2. 示例：
   1. `global:message:send`
   2. `global:message:new`
   3. `world:member:join`
   4. `scene:token:move`
3. 系统事件使用 `system:*` 前缀。

## 6. 角色与权限常量

1. 平台角色：`MASTER`、`ADMIN`、`PLAYER`。
2. 世界角色：`GM`、`PLAYER`、`OBSERVER`、`ASSISTANT`。
3. 常量必须集中在 `shared/constants/roles.ts`。

## 7. 数据目录命名

1. 数据库：`data/sqlite/`。
2. 备份：`data/backups/`。
3. 上传：`data/uploads/`。
4. 子目录：`avatars`、`maps`、`audio`。

## 8. 酒馆模块命名

1. 酒馆后端模块固定放在 `server/src/modules/tavern/`。
2. 若替换为外部 API，仅替换 tavern 模块实现，不改业务主链路模块名。
3. 开关字段统一命名为 `enabled`。

## 9. 变更流程（强制）

1. 如果新增命名规则，必须同步更新本文档。
2. 如果新增 API 或事件，必须同步更新 `docs/interface-registry.json`。
3. 每次阶段完成后，必须同步更新 `AI上下文记忆文档.md`。