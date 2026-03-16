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

test("scene visual and combat runtime routes enforce permissions and support turn progression", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `srtm${Date.now()}`;
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

    const getVisualByPlayer = await api(baseUrl, "GET", `/api/worlds/${worldId}/scenes/${defaultSceneId}/visual`, playerToken);
    assert.equal(getVisualByPlayer.status, 200);
    assert.equal((getVisualByPlayer.json.data as any).grid.unitFeet, 5);

    const patchVisualByPlayer = await api(baseUrl, "PATCH", `/api/worlds/${worldId}/scenes/${defaultSceneId}/visual`, playerToken, {
      fog: { enabled: true, mode: "full", revealedAreas: [] }
    });
    assert.equal(patchVisualByPlayer.status, 403);

    const patchVisualByGm = await api(baseUrl, "PATCH", `/api/worlds/${worldId}/scenes/${defaultSceneId}/visual`, gmToken, {
      fog: { enabled: true, mode: "full", revealedAreas: [] },
      lights: [
        {
          id: "light-1",
          targetType: "point",
          x: 120,
          y: 80,
          brightRadiusFeet: 20,
          dimRadiusFeet: 20,
          colorHex: "#ffffff",
          followTarget: false,
          durationMode: "manual"
        }
      ]
    });
    assert.equal(patchVisualByGm.status, 200);
    assert.equal((patchVisualByGm.json.data as any).fog.enabled, true);
    assert.equal((patchVisualByGm.json.data as any).lights.length, 1);

    const putCombatByPlayer = await api(baseUrl, "PUT", `/api/worlds/${worldId}/scenes/${defaultSceneId}/combat`, playerToken, {
      status: "active",
      round: 1,
      turnIndex: 0,
      participants: []
    });
    assert.equal(putCombatByPlayer.status, 403);

    const putCombatByGm = await api(baseUrl, "PUT", `/api/worlds/${worldId}/scenes/${defaultSceneId}/combat`, gmToken, {
      status: "active",
      round: 1,
      turnIndex: 0,
      participants: [
        { tokenId: "t-low", name: "Low", initiative: 8, rank: 99 },
        { tokenId: "t-high", name: "High", initiative: 15, rank: 1 }
      ]
    });
    assert.equal(putCombatByGm.status, 200);
    const firstCombatState = putCombatByGm.json.data as any;
    assert.equal(firstCombatState.participants[0].tokenId, "t-high");
    assert.equal(firstCombatState.participants[0].rank, 1);

    const nextTurn1 = await api(baseUrl, "POST", `/api/worlds/${worldId}/scenes/${defaultSceneId}/combat/next-turn`, gmToken, {});
    assert.equal(nextTurn1.status, 200);
    assert.equal((nextTurn1.json.data as any).turnIndex, 1);
    assert.equal((nextTurn1.json.data as any).round, 1);

    const nextTurn2 = await api(baseUrl, "POST", `/api/worlds/${worldId}/scenes/${defaultSceneId}/combat/next-turn`, gmToken, {});
    assert.equal(nextTurn2.status, 200);
    assert.equal((nextTurn2.json.data as any).turnIndex, 0);
    assert.equal((nextTurn2.json.data as any).round, 2);

    const getCombatByPlayer = await api(baseUrl, "GET", `/api/worlds/${worldId}/scenes/${defaultSceneId}/combat`, playerToken);
    assert.equal(getCombatByPlayer.status, 200);
    assert.equal((getCombatByPlayer.json.data as any).status, "active");
  } finally {
    await stopTestServer(server);
    await prisma.message.deleteMany({ where: { world: { owner: { username: gmUsername } } } });
    await prisma.character.deleteMany({ where: { world: { owner: { username: gmUsername } } } });
    await prisma.worldMember.deleteMany({ where: { user: { username: { in: [gmUsername, playerUsername] } } } });
    await prisma.scene.deleteMany({ where: { world: { owner: { username: gmUsername } } } });
    await prisma.world.deleteMany({ where: { owner: { username: gmUsername } } });
    await prisma.user.deleteMany({ where: { username: { in: [gmUsername, playerUsername] } } });
  }
});
