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

test("world ability route executes cloned template feature and persists actor state", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `abl${Date.now()}`;
  const gmUsername = `${unique}_gm`;
  const playerUsername = `${unique}_pl`;

  try {
    const gmRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: gmUsername,
      password: "password123"
    });
    assert.equal(gmRegister.status, 201);
    const gmToken = (gmRegister.json.data as { token: string }).token;

    const playerRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: playerUsername,
      password: "password123"
    });
    assert.equal(playerRegister.status, 201);
    const playerToken = (playerRegister.json.data as { token: string }).token;

    const createWorld = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", gmToken, {
      name: `${unique}_world`,
      visibility: "PUBLIC"
    });
    assert.equal(createWorld.status, 201);
    const worldId = (createWorld.json.data as { id: string }).id;

    const joinWorld = await api(baseUrl, "POST", `/api/worlds/${worldId}/join`, playerToken, {});
    assert.equal(joinWorld.status, 200);

    const scenesResp = await api<Array<{ id: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/scenes`, gmToken);
    assert.equal(scenesResp.status, 200);
    const sceneId = (scenesResp.json.data as Array<{ id: string }>)[0].id;

    const actorCharacter = await prisma.character.create({
      data: {
        worldId,
        userId: (await prisma.user.findUnique({ where: { username: playerUsername }, select: { id: true } }))?.id ?? null,
        name: "Ability Tester",
        type: "PC",
        stats: { hp: 12, mp: 6, fury: 3 },
        snapshot: { level: 2, maxHp: 12, proficiencyBonus: 2, ac: 12, statusEffects: [] }
      }
    });

    const battleFocusAbility = await prisma.abilityDefinition.findFirst({
      where: {
        worldId,
        category: "feature",
        actionType: "quick",
        durationValue: 1
      },
      orderBy: { sortOrder: "asc" }
    });
    assert.ok(battleFocusAbility);

    const executeResp = await api(baseUrl, "POST", `/api/worlds/${worldId}/scenes/${sceneId}/abilities/${battleFocusAbility!.id}/execute`, playerToken, {
      actorCharacterId: actorCharacter.id,
      metadata: { source: "route-test" }
    });

    assert.equal(executeResp.status, 200);
    const result = executeResp.json.data as {
      actor: { stats: Record<string, unknown>; snapshot: Record<string, unknown> };
      costs: Array<{ type: string; amount: number }>;
      effects: Array<{ type: string }>;
      settlement: unknown;
    };

    assert.equal(result.settlement, null);
    assert.equal(result.costs[0]?.type, "fury");
    assert.equal(result.actor.stats.fury, 2);
    assert.equal(Array.isArray(result.actor.snapshot.statusEffects), true);
    assert.equal((result.actor.snapshot.statusEffects as unknown[]).length > 0, true);
    assert.equal(result.effects.some((item) => item.type === "applyState"), true);
  } finally {
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(gmUsername);
    await prisma.user.deleteMany({ where: { username: { in: [gmUsername, playerUsername] } } });
  }
});
