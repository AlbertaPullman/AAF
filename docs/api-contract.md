# API Contract

## GET /api/health

- Response 200

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