import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { app } from "../app";
import { prisma } from "../lib/prisma";

type ApiResponse<T = unknown> = {
  status: number;
  json: {
    success: boolean;
    data: T;
    error: { code: string; message: string } | null;
    requestId?: string;
  };
};

async function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(app);
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

test("scene routes support gm-only management and sort/delete boundaries", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `srt${Date.now()}`;
  const gmUsername = `${unique}_gm`;
  const playerUsername = `${unique}_pl`;

  try {
    const gmRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: gmUsername,
      password: "password123"
    });
    assert.equal(gmRegister.status, 201);
    const gmToken = (gmRegister.json.data as unknown as { token: string }).token;

    const playerRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: playerUsername,
      password: "password123"
    });
    assert.equal(playerRegister.status, 201);
    const playerToken = (playerRegister.json.data as unknown as { token: string }).token;

    const createWorld = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", gmToken, {
      name: `${unique}_world`,
      visibility: "PUBLIC"
    });
    assert.equal(createWorld.status, 201);
    const worldId = (createWorld.json.data as unknown as { id: string }).id;

    const joinWorld = await api(baseUrl, "POST", `/api/worlds/${worldId}/join`, playerToken, {});
    assert.equal(joinWorld.status, 200);

    const scenesResp = await api<Array<{ id: string; name: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/scenes`, gmToken);
    assert.equal(scenesResp.status, 200);
    const defaultSceneId = (scenesResp.json.data as unknown as Array<{ id: string; name: string }>)[0].id;

    const renameByGm = await api(baseUrl, "PUT", `/api/worlds/${worldId}/scenes/${defaultSceneId}`, gmToken, {
      name: "重命名场景A"
    });
    assert.equal(renameByGm.status, 200);
    assert.equal((renameByGm.json.data as unknown as { name: string }).name, "重命名场景A");

    const renameByPlayer = await api(baseUrl, "PUT", `/api/worlds/${worldId}/scenes/${defaultSceneId}`, playerToken, {
      name: "玩家试图改名"
    });
    assert.equal(renameByPlayer.status, 403);

    const createSceneB = await api(baseUrl, "POST", `/api/worlds/${worldId}/scenes`, gmToken, {
      name: "场景B"
    });
    assert.equal(createSceneB.status, 201);
    const sceneBId = (createSceneB.json.data as unknown as { id: string }).id;

    const sortDown = await api<Array<{ id: string }>>(baseUrl, "PATCH", `/api/worlds/${worldId}/scenes/${defaultSceneId}/sort`, gmToken, {
      direction: "DOWN"
    });
    assert.equal(sortDown.status, 200);
    const sortedAfterDown = sortDown.json.data as unknown as Array<{ id: string }>;
    assert.equal(sortedAfterDown[0].id, sceneBId);
    assert.equal(sortedAfterDown[1].id, defaultSceneId);

    const deleteSceneB = await api(baseUrl, "DELETE", `/api/worlds/${worldId}/scenes/${sceneBId}`, gmToken);
    assert.equal(deleteSceneB.status, 200);

    const deleteLastScene = await api(baseUrl, "DELETE", `/api/worlds/${worldId}/scenes/${defaultSceneId}`, gmToken);
    assert.equal(deleteLastScene.status, 400);
    assert.equal(deleteLastScene.json.error?.message, "cannot delete last scene");
  } finally {
    await stopTestServer(server);
    await prisma.worldMember.deleteMany({ where: { user: { username: { in: [gmUsername, playerUsername] } } } });
    await prisma.scene.deleteMany({ where: { world: { owner: { username: gmUsername } } } });
    await prisma.world.deleteMany({ where: { owner: { username: gmUsername } } });
    await prisma.user.deleteMany({ where: { username: { in: [gmUsername, playerUsername] } } });
  }
});
