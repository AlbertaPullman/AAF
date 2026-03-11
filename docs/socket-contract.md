# Socket Contract

## 连接约定

- 连接地址：`ws://localhost:3000`
- 认证方案：阶段 1 占位，阶段 3 接入 JWT 握手鉴权

## 事件

- `system:connection-ack`
  - direction: server -> client
  - payload: `{ ok: boolean, socketId: string }`