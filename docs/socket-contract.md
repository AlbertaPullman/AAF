# Socket Contract

## 连接约定

- 连接地址：`ws://localhost:3000`
- 认证方案：阶段 1 占位，阶段 3 接入 JWT 握手鉴权

## 事件

- `system:connection-ack`
  - direction: server -> client
  - payload: `{ ok: boolean, socketId: string }`

- `world:message:send`
  - direction: client -> server
  - payload: `{ worldId: string, sceneId: string, channelKey: "OOC"|"IC"|"SYSTEM", content: string }`
  - 说明：必须先在该 world 完成 `scene:select`，服务端会校验 sceneId 与当前选中场景一致。

- `world:message:new`
  - direction: server -> client
  - payload: `{ id: string, worldId: string, sceneId: string, channelKey: string, content: string, createdAt: string, fromUser: {...} }`