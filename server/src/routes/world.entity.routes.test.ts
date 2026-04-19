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
    baseUrl: `http://127.0.0.1:${address.port}`,
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });

  const json = (await response.json()) as ApiResponse<T>["json"];
  return { status: response.status, json };
}

test("world entity routes update fate clocks/decks/random tables and import pack contents", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `entity${Date.now()}`;
  const gmUsername = `${unique}_gm`;

  try {
    const gmRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: gmUsername,
      password: "password123",
    });
    assert.equal(gmRegister.status, 201);
    const gmToken = (gmRegister.json.data as { token: string }).token;

    const createWorld = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", gmToken, {
      name: `${unique}_world`,
      visibility: "PRIVATE",
    });
    assert.equal(createWorld.status, 201);
    const worldId = (createWorld.json.data as { id: string }).id;

    const createFateClockResp = await api<{ id: string; segments: number; filledSegments: number }>(
      baseUrl,
      "POST",
      `/api/worlds/${worldId}/fate-clocks`,
      gmToken,
      {
        name: "暴风雨迫近",
        description: "危险计时",
        segments: 8,
        visibleToPlayers: false,
      }
    );
    assert.equal(createFateClockResp.status, 200);
    const fateClockId = (createFateClockResp.json.data as { id: string }).id;

    const createDeckResp = await api<{ id: string }>(baseUrl, "POST", `/api/worlds/${worldId}/decks`, gmToken, {
      name: "旅途事件牌堆",
      description: "JRPG 风格旅途事件",
      replacement: false,
      cards: [{ id: "card-1", name: "流星雨", description: "全员抬头仰望夜空", weight: 1 }],
    });
    assert.equal(createDeckResp.status, 200);
    const deckId = (createDeckResp.json.data as { id: string }).id;

    const createTableResp = await api<{ id: string }>(
      baseUrl,
      "POST",
      `/api/worlds/${worldId}/random-tables`,
      gmToken,
      {
        name: "荒野掉落",
        description: "探索战利品",
        diceFormula: "1d20",
        entries: [{ rangeMin: 1, rangeMax: 5, result: "药草" }],
      }
    );
    assert.equal(createTableResp.status, 200);
    const tableId = (createTableResp.json.data as { id: string }).id;

    const updateFateClockResp = await api<{
      name: string;
      filledSegments: number;
      visibleToPlayers: boolean;
      status: string;
    }>(baseUrl, "PUT", `/api/worlds/${worldId}/fate-clocks/${fateClockId}`, gmToken, {
      name: "王都沦陷倒计时",
      filledSegments: 3,
      visibleToPlayers: true,
      status: "paused",
    });
    assert.equal(updateFateClockResp.status, 200);
    assert.equal((updateFateClockResp.json.data as { name: string }).name, "王都沦陷倒计时");
    assert.equal((updateFateClockResp.json.data as { filledSegments: number }).filledSegments, 3);
    assert.equal((updateFateClockResp.json.data as { visibleToPlayers: boolean }).visibleToPlayers, true);
    assert.equal((updateFateClockResp.json.data as { status: string }).status, "paused");

    const updateDeckResp = await api<{ cards: Array<{ name: string }>; replacement: boolean }>(
      baseUrl,
      "PUT",
      `/api/worlds/${worldId}/decks/${deckId}`,
      gmToken,
      {
        description: "更新后的旅途牌堆",
        replacement: true,
        cards: [
          { id: "card-1", name: "流星雨", description: "夜空璀璨", weight: 1 },
          { id: "card-2", name: "空艇补给", description: "获得补给箱", weight: 2 },
        ],
      }
    );
    assert.equal(updateDeckResp.status, 200);
    assert.equal((updateDeckResp.json.data as { replacement: boolean }).replacement, true);
    assert.equal((updateDeckResp.json.data as { cards: Array<{ name: string }> }).cards.length, 2);

    const updateTableResp = await api<{ diceFormula: string; entries: Array<{ result: string }> }>(
      baseUrl,
      "PUT",
      `/api/worlds/${worldId}/random-tables/${tableId}`,
      gmToken,
      {
        diceFormula: "1d12",
        entries: [
          { rangeMin: 1, rangeMax: 4, result: "药草" },
          { rangeMin: 5, rangeMax: 8, result: "晶石" },
        ],
      }
    );
    assert.equal(updateTableResp.status, 200);
    assert.equal((updateTableResp.json.data as { diceFormula: string }).diceFormula, "1d12");
    assert.equal((updateTableResp.json.data as { entries: Array<{ result: string }> }).entries[1]?.result, "晶石");

    const importResp = await api<Record<string, number>>(
      baseUrl,
      "POST",
      `/api/worlds/${worldId}/collection-pack/import`,
      gmToken,
      {
        contents: {
          fateClocks: [
            {
              name: "魔潮逼近",
              description: "大型事件命刻",
              segments: 6,
              filledSegments: 2,
              visibleToPlayers: true,
              direction: "countdown",
              status: "active",
              history: [],
            },
          ],
          decks: [
            {
              name: "酒馆传闻",
              description: "支线牌堆",
              replacement: true,
              cards: [{ id: "rumor-1", name: "古遗迹线索", description: "酒馆客人低声议论", weight: 1 }],
              drawnHistory: [],
            },
          ],
          randomTables: [
            {
              name: "工坊产出",
              description: "造物素材表",
              diceFormula: "1d10",
              entries: [{ rangeMin: 1, rangeMax: 3, result: "下级矿石" }],
            },
          ],
        },
      }
    );
    assert.equal(importResp.status, 200);
    assert.equal((importResp.json.data as Record<string, number>).fateClocks, 1);
    assert.equal((importResp.json.data as Record<string, number>).decks, 1);
    assert.equal((importResp.json.data as Record<string, number>).randomTables, 1);

    const fateClocksResp = await api<Array<{ name: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/fate-clocks`, gmToken);
    assert.equal(fateClocksResp.status, 200);
    assert.equal((fateClocksResp.json.data as Array<{ name: string }>).length >= 2, true);

    const decksResp = await api<Array<{ name: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/decks`, gmToken);
    assert.equal(decksResp.status, 200);
    assert.equal((decksResp.json.data as Array<{ name: string }>).some((item) => item.name === "酒馆传闻"), true);

    const tablesResp = await api<Array<{ name: string }>>(baseUrl, "GET", `/api/worlds/${worldId}/random-tables`, gmToken);
    assert.equal(tablesResp.status, 200);
    assert.equal((tablesResp.json.data as Array<{ name: string }>).some((item) => item.name === "工坊产出"), true);
  } finally {
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(gmUsername);
    await prisma.user.deleteMany({ where: { username: gmUsername } });
  }
});
