import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { app } from "../app";
import { prisma } from "../lib/prisma";
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

test("scene settlement routes resolve action and persist logs", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `sstl${Date.now()}`;
  const gmUsername = `${unique}_gm`;
  const playerUsername = `${unique}_pl`;
  const outsiderUsername = `${unique}_out`;

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

    const outsiderRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: outsiderUsername,
      password: "password123"
    });
    assert.equal(outsiderRegister.status, 201);
    const outsiderToken = (outsiderRegister.json.data as unknown as { token: string }).token;

    const createWorld = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", gmToken, {
      name: `${unique}_world`,
      visibility: "PUBLIC"
    });
    assert.equal(createWorld.status, 201);
    const worldId = (createWorld.json.data as unknown as { id: string }).id;

    const joinWorld = await api(baseUrl, "POST", `/api/worlds/${worldId}/join`, playerToken, {});
    assert.equal(joinWorld.status, 200);

    const scenesResp = await api<Array<{ id: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/scenes`, gmToken);
    assert.equal(scenesResp.status, 200);
    const sceneId = (scenesResp.json.data as unknown as Array<{ id: string }>)[0].id;

    const resolveResp = await api(baseUrl, "POST", `/api/worlds/${worldId}/scenes/${sceneId}/settlement/resolve`, playerToken, {
      actionId: "basic-slash",
      actorTokenId: "pc-1",
      targetTokenId: "mob-1",
      check: {
        targetType: "AC",
        targetValue: 12,
        attributeMod: 3,
        proficiency: 2
      },
      damage: {
        formula: "1d8+2",
        damageType: "slashing"
      },
      resourceCost: 1,
      resourceTiming: "hit",
      fixedRolls: {
        d20: [16],
        damageDice: [6]
      }
    });

    assert.equal(resolveResp.status, 200);
    const settlementData = resolveResp.json.data as any;
    assert.equal(settlementData.result.success, true);
    assert.equal(settlementData.result.check.success, true);
    assert.equal(settlementData.result.damage.total, 8);
    assert.equal(settlementData.logEntry.actionId, "basic-slash");

    const logsResp = await api(baseUrl, "GET", `/api/worlds/${worldId}/scenes/${sceneId}/settlement/logs`, playerToken);
    assert.equal(logsResp.status, 200);
    const logs = logsResp.json.data as any[];
    assert.equal(logs.length >= 1, true);
    assert.equal(logs[logs.length - 1].actionId, "basic-slash");

    const outsiderLogs = await api(baseUrl, "GET", `/api/worlds/${worldId}/scenes/${sceneId}/settlement/logs`, outsiderToken);
    assert.equal(outsiderLogs.status, 403);
  } finally {
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(gmUsername);
    await prisma.user.deleteMany({ where: { username: { in: [gmUsername, playerUsername, outsiderUsername] } } });
  }
});
