# Socket 事件契约

## 1. 连接

- 地址：`ws://<host>:3000`
- 认证：握手阶段传入 JWT

## 2. 事件清单

### 2.1 系统

- `system:connection-ack`（server -> client）

### 2.2 世界聊天

- `world:message:send`（client -> server）
- `world:message:new`（server -> client）

### 2.3 世界成员状态

- `world:members:update`（server -> client）
- `world:latency:probe`（双向）
- `world:latency:update`（server -> client）

### 2.4 场景与棋子

- `scene:select`（client -> server）
- `scene:token:move`（client -> server）
- `scene:token:moved`（server -> client）

## 3. 权限要点

- 旁观者禁止发送世界聊天。
- 旁观者禁止移动棋子。
- 非 GM 不能执行核心世界配置改写。
