import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { io as createClient, type Socket } from "socket.io-client";
import { app } from "../app";
import { initSocketServer } from "./index";
import { prisma } from "../lib/prisma";
import { SOCKET_EVENTS } from "./events";
import { cleanupWorldGraphByOwnerUsername } from "../test-utils/world-cleanup";

type ApiResponse<T = unknown> = {
  status: number;
  json: {
    success: boolean;
    data: T;
    error: { code: string; message: string } | null;
    requestId?: string;
  };
};

type TokenEventPayload = {
  worldId: string;
  sceneId?: string;
  tokens: Array<{
    tokenId: string;
    x: number;
    y: number;
  }>;
};

type WorldMessagePayload = {
  id: string;
  worldId?: string;
  sceneId?: string;
  channelKey?: string;
  content: string;
};

async function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
  initSocketServer(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start test server");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stopTestServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function api<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: typeof body === "undefined" ? undefined : JSON.stringify(body)
  });

  const json = (await response.json()) as ApiResponse<T>["json"];
  return { status: response.status, json };
}

function waitForEvent<T>(socket: Socket, eventName: string, predicate?: (payload: T) => boolean, timeoutMs = 4000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`timeout waiting for ${eventName}`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });
}

function emitAck<T>(socket: Socket, eventName: string, payload: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    socket.emit(eventName, payload, (result: T) => resolve(result));
  });
}

test("scene socket flow keeps token and world chat isolated by scene", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `iso${Date.now()}`;
  const username = `${unique}_gm`;
  let socket: Socket | null = null;

  try {
    const registerResp = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username,
      password: "password123"
    });
    assert.equal(registerResp.status, 201);
    const token = (registerResp.json.data as unknown as { token: string }).token;

    const createWorldResp = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", token, {
      name: `${unique}_world`,
      visibility: "PUBLIC"
    });
    assert.equal(createWorldResp.status, 201);
    const worldId = (createWorldResp.json.data as unknown as { id: string }).id;

    const scenesResp = await api<Array<{ id: string; name: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/scenes`, token);
    assert.equal(scenesResp.status, 200);
    const defaultSceneId = (scenesResp.json.data as unknown as Array<{ id: string; name: string }>)[0].id;

    const createSecondSceneResp = await api<{ id: string }>(baseUrl, "POST", `/api/worlds/${worldId}/scenes`, token, {
      name: "第二场景"
    });
    assert.equal(createSecondSceneResp.status, 201);
    const secondSceneId = (createSecondSceneResp.json.data as unknown as { id: string }).id;

    socket = createClient(baseUrl, {
      transports: ["websocket"],
      auth: { token }
    });

    await waitForEvent(socket, SOCKET_EVENTS.connectionAck);

    const joinAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldJoin, { worldId });
    assert.equal(joinAck.ok, true);

    const selectDefaultAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneSelect, {
      worldId,
      sceneId: defaultSceneId
    });
    assert.equal(selectDefaultAck.ok, true);

    const defaultTokenEventPromise = waitForEvent<TokenEventPayload>(
      socket,
      SOCKET_EVENTS.sceneTokenMoved,
      (payload) => payload.worldId === worldId && payload.sceneId === defaultSceneId && payload.tokens.some((item) => item.tokenId === "token-default")
    );
    const defaultMoveAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneTokenMove, {
      worldId,
      sceneId: defaultSceneId,
      tokenId: "token-default",
      x: 120,
      y: 80
    });
    assert.equal(defaultMoveAck.ok, true);
    const defaultTokenEvent = await defaultTokenEventPromise;
    assert.equal(defaultTokenEvent.tokens[0].tokenId, "token-default");

    const defaultMessagePromise = waitForEvent<WorldMessagePayload>(
      socket,
      SOCKET_EVENTS.worldMessageNew,
      (payload) => payload.worldId === worldId && payload.sceneId === defaultSceneId && payload.content === "scene-default-msg"
    );
    const defaultMessageAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldMessageSend, {
      worldId,
      sceneId: defaultSceneId,
      channelKey: "OOC",
      content: "scene-default-msg"
    });
    assert.equal(defaultMessageAck.ok, true);
    const defaultMessageEvent = await defaultMessagePromise;
    assert.equal(defaultMessageEvent.sceneId, defaultSceneId);

    const selectSecondSnapshotPromise = waitForEvent<TokenEventPayload>(
      socket,
      SOCKET_EVENTS.sceneTokenMoved,
      (payload) => payload.worldId === worldId && payload.sceneId === secondSceneId && payload.tokens.length === 0
    );
    const selectSecondAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneSelect, {
      worldId,
      sceneId: secondSceneId
    });
    assert.equal(selectSecondAck.ok, true);
    await selectSecondSnapshotPromise;

    const secondTokenEventPromise = waitForEvent<TokenEventPayload>(
      socket,
      SOCKET_EVENTS.sceneTokenMoved,
      (payload) => payload.worldId === worldId && payload.sceneId === secondSceneId && payload.tokens.some((item) => item.tokenId === "token-second")
    );
    const secondMoveAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneTokenMove, {
      worldId,
      sceneId: secondSceneId,
      tokenId: "token-second",
      x: 300,
      y: 160
    });
    assert.equal(secondMoveAck.ok, true);
    const secondTokenEvent = await secondTokenEventPromise;
    assert.equal(secondTokenEvent.tokens[0].tokenId, "token-second");

    const secondMessagePromise = waitForEvent<WorldMessagePayload>(
      socket,
      SOCKET_EVENTS.worldMessageNew,
      (payload) => payload.worldId === worldId && payload.sceneId === secondSceneId && payload.content === "scene-second-msg"
    );
    const secondMessageAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldMessageSend, {
      worldId,
      sceneId: secondSceneId,
      channelKey: "OOC",
      content: "scene-second-msg"
    });
    assert.equal(secondMessageAck.ok, true);
    const secondMessageEvent = await secondMessagePromise;
    assert.equal(secondMessageEvent.sceneId, secondSceneId);

    const selectDefaultSnapshotPromise = waitForEvent<TokenEventPayload>(
      socket,
      SOCKET_EVENTS.sceneTokenMoved,
      (payload) => payload.worldId === worldId && payload.sceneId === defaultSceneId && payload.tokens.some((item) => item.tokenId === "token-default")
    );
    const selectBackAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneSelect, {
      worldId,
      sceneId: defaultSceneId
    });
    assert.equal(selectBackAck.ok, true);
    const selectBackSnapshot = await selectDefaultSnapshotPromise;
    assert.equal(selectBackSnapshot.tokens.length, 1);
    assert.equal(selectBackSnapshot.tokens[0].tokenId, "token-default");

    const defaultHistoryResp = await api<Array<{ content: string; sceneId?: string }>>(
      baseUrl,
      "GET",
      `/api/chat/worlds/${worldId}/recent?channelKey=OOC&sceneId=${defaultSceneId}`,
      token
    );
    assert.equal(defaultHistoryResp.status, 200);
    const defaultHistory = defaultHistoryResp.json.data as unknown as Array<{ content: string; sceneId?: string }>;
    assert.equal(defaultHistory.some((item) => item.content === "scene-default-msg" && item.sceneId === defaultSceneId), true);
    assert.equal(defaultHistory.some((item) => item.content === "scene-second-msg"), false);

    const secondHistoryResp = await api<Array<{ content: string; sceneId?: string }>>(
      baseUrl,
      "GET",
      `/api/chat/worlds/${worldId}/recent?channelKey=OOC&sceneId=${secondSceneId}`,
      token
    );
    assert.equal(secondHistoryResp.status, 200);
    const secondHistory = secondHistoryResp.json.data as unknown as Array<{ content: string; sceneId?: string }>;
    assert.equal(secondHistory.some((item) => item.content === "scene-second-msg" && item.sceneId === secondSceneId), true);
    assert.equal(secondHistory.some((item) => item.content === "scene-default-msg"), false);
  } finally {
    if (socket) {
      socket.disconnect();
    }
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(username);
    await prisma.user.deleteMany({ where: { username } });
  }
});

test("scene socket flow rejects send or move before join and rejects scene mismatch", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `isoerr${Date.now()}`;
  const username = `${unique}_gm`;
  let socket: Socket | null = null;

  try {
    const registerResp = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username,
      password: "password123"
    });
    assert.equal(registerResp.status, 201);
    const token = (registerResp.json.data as unknown as { token: string }).token;

    const createWorldResp = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", token, {
      name: `${unique}_world`,
      visibility: "PUBLIC"
    });
    assert.equal(createWorldResp.status, 201);
    const worldId = (createWorldResp.json.data as unknown as { id: string }).id;

    const scenesResp = await api<Array<{ id: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/scenes`, token);
    assert.equal(scenesResp.status, 200);
    const defaultSceneId = (scenesResp.json.data as unknown as Array<{ id: string }>)[0].id;

    const createSecondSceneResp = await api<{ id: string }>(baseUrl, "POST", `/api/worlds/${worldId}/scenes`, token, {
      name: "第二场景"
    });
    assert.equal(createSecondSceneResp.status, 201);
    const secondSceneId = (createSecondSceneResp.json.data as unknown as { id: string }).id;

    socket = createClient(baseUrl, {
      transports: ["websocket"],
      auth: { token }
    });

    await waitForEvent(socket, SOCKET_EVENTS.connectionAck);

    const sendBeforeJoin = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldMessageSend, {
      worldId,
      sceneId: defaultSceneId,
      channelKey: "OOC",
      content: "should fail"
    });
    assert.equal(sendBeforeJoin.ok, false);
    assert.equal(sendBeforeJoin.error, "must join world before sending world message");

    const moveBeforeJoin = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneTokenMove, {
      worldId,
      sceneId: defaultSceneId,
      tokenId: "token-fail",
      x: 10,
      y: 20
    });
    assert.equal(moveBeforeJoin.ok, false);
    assert.equal(moveBeforeJoin.error, "must join world before moving token");

    const joinAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldJoin, { worldId });
    assert.equal(joinAck.ok, true);

    const selectDefaultAck = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneSelect, {
      worldId,
      sceneId: defaultSceneId
    });
    assert.equal(selectDefaultAck.ok, true);

    const sendSceneMismatch = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.worldMessageSend, {
      worldId,
      sceneId: secondSceneId,
      channelKey: "OOC",
      content: "wrong scene"
    });
    assert.equal(sendSceneMismatch.ok, false);
    assert.equal(sendSceneMismatch.error, "scene mismatch");

    const moveSceneMismatch = await emitAck<{ ok: boolean; error?: string }>(socket, SOCKET_EVENTS.sceneTokenMove, {
      worldId,
      sceneId: secondSceneId,
      tokenId: "token-wrong-scene",
      x: 30,
      y: 40
    });
    assert.equal(moveSceneMismatch.ok, false);
    assert.equal(moveSceneMismatch.error, "scene mismatch");
  } finally {
    if (socket) {
      socket.disconnect();
    }
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(username);
    await prisma.user.deleteMany({ where: { username } });
  }
});
