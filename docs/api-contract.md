# API Contract

## GET /api/health

- Response 200

## GET /api/worlds/:worldId/story-events

- Headers

```text
Authorization: Bearer <token>
```

- 说明：
  - 返回当前用户可见的剧情事件列表（GM 全量；玩家按作用域过滤）。

## GET /api/worlds/:worldId/story-events/search?q=关键词&sceneId=场景ID&limit=20

- Headers

```text
Authorization: Bearer <token>
```

- 说明：
  - 剧情事件与世界聊天双向检索入口。
  - `q` 必填，按关键词匹配事件标题/描述/选项/提案文本与聊天文本。
  - `sceneId` 可选，传入后仅检索对应场景上下文。
  - `eventStatus` 可选：`ALL` / `DRAFT` / `OPEN` / `RESOLVED` / `CLOSED`。
  - `channelKey` 可选：`ALL` / `OOC` / `IC` / `SYSTEM`。
  - `hours` 可选：仅检索近 N 小时聊天（最大 720）。
  - 返回结构包含 `events` 与 `messages` 两组结果：
    - 事件命中后会关联返回引用这些事件的聊天。
    - 聊天命中后若 metadata 关联剧情事件，也会反向补齐到 `events`。

## GET /api/chat/worlds/:worldId/messages/:messageId

- Headers

```text
Authorization: Bearer <token>
```

- 说明：
  - 按 `messageId` 精确读取世界聊天消息，支持“超出最近窗口”的历史消息定位。
  - 仅世界 ACTIVE 成员可读取。
  - 返回结构与世界聊天 recent 列表的单条消息结构一致。

## GET /api/worlds/:worldId/assistant/context?sceneId=场景ID&hours=24&cardLimit=8&messageLimit=40

- Headers

```text
Authorization: Bearer <token>
```

- 说明：
  - 为 AI 助手生成世界上下文快照。
  - 读取策略固定为“事件结算卡片优先，再补最近聊天消息”。
  - `sceneId` 可选：按场景过滤，避免跨场景串线。
  - `hours` 可选：限制读取近 N 小时数据（最大 720）。
  - `cardLimit` 可选：事件卡片上限（默认 8，最大 30）。
  - `messageLimit` 可选：最近聊天上限（默认 40，最大 120）。
  - 返回 `policy`、`storyEventCards`、`recentMessages` 与 `hints`，供后续 AI 调用链直接消费。

## POST /api/worlds/:worldId/assistant/respond

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "sceneId": "scene_cuid",
  "hours": 24,
  "cardLimit": 8,
  "messageLimit": 40,
  "instruction": "总结当前场景冲突与结果"
}
```

- 说明：
  - 仅世界 `GM` / `ASSISTANT` 可触发。
  - 受控读取 `assistant/context` 的结果，生成一条 AI 助手草案消息并写回世界 `SYSTEM` 频道。
  - 当前为本地 fallback 草案模式，后续可替换为 tavern adapter 的真实模型调用。

## POST /api/worlds/:worldId/story-events

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "title": "卫兵巡检",
  "description": "城门口卫兵要求盘查身份",
  "scope": "ALL",
  "sceneId": "cuid"
}
```

- 说明：
  - 仅 GM 可创建。

## PATCH /api/worlds/:worldId/story-events/:eventId

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "title": "卫兵巡检（夜间）",
  "description": "卫兵要求出示通行凭证",
  "status": "OPEN"
}
```

- 说明：
  - 仅 GM 可更新。

## POST /api/worlds/:worldId/story-events/:eventId/options

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "label": "欺瞒：我是本地商人",
  "check": {
    "skillKey": "deception",
    "dc": 15,
    "checkMode": "SINGLE"
  }
}
```

- 说明：
  - 仅 GM 可新增选项。
  - `checkMode` 支持：`SINGLE` / `PER_PLAYER` / `UNLIMITED`。

## POST /api/worlds/:worldId/story-events/:eventId/options/:optionId/check

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "finalTotal": 17,
  "chatContent": "卫兵先生，我们是来经商的。"
}
```

- 说明：
  - 玩家提交最终检定值。
  - 若传入 `chatContent`，会自动创建一条带检定标签的世界聊天消息。

## POST /api/worlds/:worldId/story-events/:eventId/resolve

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "summary": "卫兵接受解释并放行",
  "processTimeline": [
    "玩家A选择欺瞒",
    "检定结果 17 >= DC15"
  ],
  "finalOutcome": "队伍顺利进入城内"
}
```

- 说明：
  - 仅 GM 可结算。
  - 结算后会自动发送一条事件结算卡片到 SYSTEM 频道，供 AI 助手读取。

## POST /api/worlds/:worldId/story-events/:eventId/narrative-requests

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "cost": 1,
  "reason": "我想消耗物语点，让守卫想起我曾帮过他。"
}
```

- 说明：
  - 玩家可提交物语点提案。
  - 提案会写入剧情事件并自动发送一条带 `storyPointProposalTag` 的世界聊天消息。

## POST /api/worlds/:worldId/story-events/:eventId/narrative-requests/:requestId/decision

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "status": "APPROVED",
  "gmNote": "同意，守卫会给你一次便利。"
}
```

- 说明：
  - 仅 GM 可裁决提案（`APPROVED` 或 `REJECTED`）。
  - 裁决会写回剧情事件并自动发送一条带 `storyPointProposalDecisionTag` 的 SYSTEM 消息。

## GET /api/worlds/:worldId/story-events/cards?limit=20

- Headers

```text
Authorization: Bearer <token>
```

- 说明：
  - 读取世界内历史事件结算卡片（来源于 SYSTEM 频道消息 metadata）。

## Chat Metadata（Stage 8）

世界聊天消息 `data[]` 新增可选 `metadata` 字段，用于事件绑定：

1. `storyEventCheckTag`：技能检定标签（事件ID、选项、DC、结果等）。
2. `storyEventCard`：事件结算卡片（简述、经过、后果）。
3. `storyPointProposalTag`：物语点提案标签（事件、提案人、消耗、理由、状态）。
4. `storyPointProposalDecisionTag`：物语点裁决标签（提案ID、裁决结果、GM备注）。

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "services": {
      "api": "ok",
      "database": "ok"
    },
    "database": {
      "provider": "sqlite",
      "url": "file:../../data/sqlite/aaf.db"
    }
  },
  "error": null,
  "requestId": "uuid"
}
```

- Response 503

```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "timestamp": "2026-01-01T00:00:00.000Z",
    "services": {
      "api": "ok",
      "database": "error"
    },
    "database": {
      "provider": "sqlite",
      "url": "file:../../data/sqlite/aaf.db"
    },
    "details": {
      "database": "database ping failed"
    }
  },
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/auth/register

- Request

```json
{
  "username": "alice",
  "password": "password123"
}
```

- Response 201

```json
{
  "success": true,
  "data": {
    "userId": "cuid",
    "username": "alice",
    "token": "jwt",
    "expiresIn": 31536000
  },
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/auth/login

- Request

```json
{
  "username": "alice",
  "password": "password123"
}
```

- Response 200

```json
{
  "success": true,
  "data": {
    "userId": "cuid",
    "username": "alice",
    "token": "jwt",
    "expiresIn": 31536000
  },
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/auth/me

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "username": "alice",
    "displayName": "alice",
    "avatarUrl": null,
    "platformRole": "PLAYER",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/worlds

- Headers

```text
Authorization: Bearer <token>
```

- Query

```text
scope=mine (optional)
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "name": "测试世界",
      "description": "世界描述",
      "ownerId": "cuid",
      "visibility": "PUBLIC",
      "owner": {
        "id": "cuid",
        "username": "alice",
        "displayName": "alice",
        "platformRole": "PLAYER"
      },
      "_count": {
        "members": 2,
        "scenes": 1
      }
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/worlds

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "name": "测试世界",
  "description": "阶段4",
  "visibility": "PUBLIC"
}
```

- Request (password world)

```json
{
  "name": "秘密世界",
  "description": "仅口令可入",
  "visibility": "PASSWORD",
  "password": "1234"
}
```

- Response 201

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "name": "测试世界",
    "visibility": "PUBLIC",
    "ownerId": "cuid"
  },
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/worlds/:worldId/join

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{}
```

- Request (password world)

```json
{
  "password": "1234"
}
```

- Response 200

```json
{
  "success": true,
  "data": {
    "worldId": "cuid",
    "userId": "cuid",
    "role": "PLAYER"
  },
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/worlds/:worldId

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "name": "测试世界",
    "visibility": "PUBLIC",
    "myRole": "PLAYER",
    "canJoin": false
  },
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/worlds/:worldId/characters

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "worldId": "cuid",
      "userId": "cuid",
      "name": "Alice-PC",
      "type": "PC",
      "avatarUrl": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/worlds/:worldId/characters

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "name": "Alice-PC",
  "type": "PC"
}
```

## PUT /api/worlds/:worldId/characters/:characterId

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "name": "Alice-PC",
  "stats": {
    "hp": 12,
    "mp": 4
  },
  "snapshot": {
    "level": 2,
    "class": "warrior"
  }
}
```

## GET /api/worlds/:worldId/scenes

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "worldId": "cuid",
      "name": "默认场景",
      "sortOrder": 0
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

## POST /api/worlds/:worldId/scenes

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "name": "酒馆门口"
}
```

## PUT /api/worlds/:worldId/scenes/:sceneId

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "name": "地下神殿"
}
```

## DELETE /api/worlds/:worldId/scenes/:sceneId

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "sceneId": "cuid"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅 GM 可删除场景。
- 至少保留 1 个场景，删除最后一个场景会返回错误。

## PATCH /api/worlds/:worldId/scenes/:sceneId/sort

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "direction": "UP"
}
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "worldId": "cuid",
      "name": "地下神殿",
      "sortOrder": 0
    },
    {
      "id": "cuid2",
      "worldId": "cuid",
      "name": "城门广场",
      "sortOrder": 1
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅 GM 可调整场景顺序。
- `direction` 仅支持 `UP`/`DOWN`。

## GET /api/worlds/:worldId/scenes/:sceneId/visual

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "sceneId": "cuid",
    "grid": {
      "enabled": true,
      "unitFeet": 5
    },
    "lights": [],
    "fog": {
      "enabled": false,
      "mode": "hidden",
      "revealedAreas": []
    },
    "updatedAt": "2026-03-13T20:30:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- ACTIVE 成员可读取。

## PATCH /api/worlds/:worldId/scenes/:sceneId/visual

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "grid": { "enabled": true, "unitFeet": 5 },
  "fog": { "enabled": true, "mode": "full", "revealedAreas": [] },
  "lights": [
    {
      "id": "light-1",
      "targetType": "point",
      "x": 120,
      "y": 80,
      "brightRadiusFeet": 20,
      "dimRadiusFeet": 20,
      "colorHex": "#ffffff",
      "followTarget": false,
      "durationMode": "manual"
    }
  ]
}
```

说明：
- 仅 GM 可更新。

## GET /api/worlds/:worldId/scenes/:sceneId/combat

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "sceneId": "cuid",
    "status": "idle",
    "round": 1,
    "turnIndex": 0,
    "participants": [],
    "pauseReason": null,
    "updatedAt": "2026-03-13T20:30:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- ACTIVE 成员可读取。

## PUT /api/worlds/:worldId/scenes/:sceneId/combat

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "status": "active",
  "round": 1,
  "turnIndex": 0,
  "participants": [
    { "tokenId": "t-1", "name": "玩家A", "initiative": 16, "rank": 1 },
    { "tokenId": "t-2", "name": "玩家B", "initiative": 12, "rank": 2 }
  ],
  "pauseReason": null
}
```

说明：
- 仅 GM 可更新。
- 服务端会按先攻降序重排并重置 rank。

## POST /api/worlds/:worldId/scenes/:sceneId/combat/next-turn

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{}
```

说明：
- 仅 GM 可推进回合。
- 当 turnIndex 到达末尾时，round 自动 +1 并回到 turnIndex=0。

## GET /api/worlds/:worldId/runtime

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": {
    "worldId": "cuid",
    "status": "sleeping",
    "message": null,
    "updatedAt": "2026-03-13T18:30:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅世界所有者或 ACTIVE 成员可读取运行时状态。

## PATCH /api/worlds/:worldId/runtime

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "status": "active",
  "message": "world is running"
}
```

- Response 200

```json
{
  "success": true,
  "data": {
    "worldId": "cuid",
    "status": "active",
    "message": "world is running",
    "updatedAt": "2026-03-13T18:30:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅世界内 GM 或 ASSISTANT 可更新运行时状态。
- status 仅支持：`loading` / `active` / `sleeping` / `error`。

## GET /api/worlds/:worldId/runtime/modules

- Headers

```text
Authorization: Bearer <token>
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "worldId": "cuid",
      "key": "runtime-core",
      "displayName": "运行时核心",
      "dependencies": [],
      "status": "disabled",
      "updatedAt": "2026-03-13T19:20:00.000Z"
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅世界所有者或 ACTIVE 成员可读取模块列表。
- 首次读取会自动初始化默认模块定义。

## PATCH /api/worlds/:worldId/runtime/modules/:moduleKey

- Headers

```text
Authorization: Bearer <token>
```

- Request

```json
{
  "status": "enabled"
}
```

- Response 200

```json
{
  "success": true,
  "data": {
    "worldId": "cuid",
    "key": "world-chat",
    "displayName": "世界聊天",
    "dependencies": ["runtime-core"],
    "status": "enabled",
    "updatedAt": "2026-03-13T19:20:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

说明：
- 仅世界内 GM 或 ASSISTANT 可启停模块。
- `status` 仅支持：`enabled` / `disabled`。
- 启用模块时会检查依赖，缺失或未启用依赖将返回错误。

- Response 200

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "worldId": "cuid",
    "name": "地下神殿",
    "sortOrder": 1
  },
  "error": null,
  "requestId": "uuid"
}
```

- Response 201

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "worldId": "cuid",
    "name": "酒馆门口",
    "sortOrder": 1
  },
  "error": null,
  "requestId": "uuid"
}
```

- Response 200

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "worldId": "cuid",
    "userId": "cuid",
    "name": "Alice-PC",
    "type": "PC",
    "avatarUrl": null,
    "stats": {
      "hp": 12,
      "mp": 4
    },
    "snapshot": {
      "level": 2,
      "class": "warrior"
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

- Response 201

```json
{
  "success": true,
  "data": {
    "id": "cuid",
    "worldId": "cuid",
    "userId": "cuid",
    "name": "Alice-PC",
    "type": "PC",
    "avatarUrl": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/chat/global/recent

- Headers

```text
Authorization: Bearer <token>
```

- Query

```text
limit=30 (optional, range: 1-100)
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "content": "hello world",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "fromUser": {
        "id": "cuid",
        "username": "alice",
        "displayName": "Alice"
      }
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

## GET /api/chat/worlds/:worldId/recent

- Headers

```text
Authorization: Bearer <token>
```

- Query

```text
limit=40 (optional, range: 1-100)
channelKey=OOC|IC|SYSTEM (optional, default: OOC)
sceneId=<sceneId> (optional, 指定场景上下文)
```

- Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "cuid",
      "worldId": "cuid",
      "content": "hello world chat",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "fromUser": {
        "id": "cuid",
        "username": "alice",
        "displayName": "Alice"
      }
    }
  ],
  "error": null,
  "requestId": "uuid"
}
```

## Socket Events

### system:connection-ack (server -> client)

```json
{
  "ok": true,
  "socketId": "socket-id",
  "userId": "cuid"
}
```

### global:message:send (client -> server)

- Payload

```json
{
  "content": "hello world"
}
```

- Ack (success)

```json
{
  "ok": true
}
```

- Ack (rate limited)

```json
{
  "ok": false,
  "error": "rate limit exceeded, retry in 10s"
}
```

说明：服务端会对消息进行内容清洗（控制字符与 HTML 转义）并执行用户维度限流。

### global:message:new (server -> client)

```json
{
  "id": "cuid",
  "content": "hello world",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "fromUser": {
    "id": "cuid",
    "username": "alice",
    "displayName": "Alice"
  }
}
```

### world:message:send (client -> server)

```json
{
  "worldId": "cuid",
  "sceneId": "cuid",
  "channelKey": "OOC",
  "content": "hello world room"
}
```

说明：`SYSTEM` 频道仅 GM 可发送，非 GM 发送将收到 ack 错误 `channel permission denied`。

### world:message:new (server -> client)

```json
{
  "id": "cuid",
  "worldId": "cuid",
  "sceneId": "cuid",
  "channelKey": "OOC",
  "content": "hello world room",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "fromUser": {
    "id": "cuid",
    "username": "alice",
    "displayName": "Alice"
  }
}
```

### world:join (client -> server)

```json
{
  "worldId": "cuid"
}
```

### world:leave (client -> server)

```json
{
  "worldId": "cuid"
}
```

### world:members:update (server -> client)

```json
{
  "worldId": "cuid",
  "memberUserIds": ["u1", "u2"],
  "onlineCount": 2,
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### scene:token:move (client -> server)

```json
{
  "worldId": "cuid",
  "tokenId": "token-main",
  "x": 220,
  "y": 150,
  "ownerUserId": "cuid",
  "characterId": "cuid"
}
```

- Ack (success)

```json
{
  "ok": true
}
```

说明：
- GM 可移动任意 token，并可在首次创建 token 时指定 ownerUserId。
- 非 GM 仅可移动自己 owner 的 token，且不能把 ownerUserId 指向其他用户。

### scene:token:moved (server -> client)

```json
{
  "worldId": "cuid",
  "tokens": [
    {
      "tokenId": "token-main",
      "x": 220,
      "y": 150,
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "updatedBy": "cuid",
      "ownerUserId": "cuid",
      "characterId": "cuid",
      "characterName": "Alice-PC"
    }
  ]
}
```