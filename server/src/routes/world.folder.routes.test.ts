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

type FolderPayload = {
  id: string;
  worldId: string;
  parentId: string | null;
  type: string;
  name: string;
  sortOrder: number;
};

type AbilityPayload = {
  id: string;
  folderId: string | null;
  folderPath: string;
  name: string;
  sortOrder: number;
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
  body?: unknown,
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

test("world folder routes persist folders and resource folderId placement", async () => {
  const { server, baseUrl } = await startTestServer();
  const unique = `folder${Date.now()}`;
  const gmUsername = `${unique}_gm`;

  try {
    const gmRegister = await api<{ token: string }>(baseUrl, "POST", "/api/auth/register", undefined, {
      username: gmUsername,
      password: "password123",
    });
    assert.equal(gmRegister.status, 201);
    const gmToken = gmRegister.json.data.token;

    const createWorld = await api<{ id: string }>(baseUrl, "POST", "/api/worlds", gmToken, {
      name: `${unique}_world`,
      visibility: "PRIVATE",
    });
    assert.equal(createWorld.status, 201);
    const worldId = createWorld.json.data.id;

    const rootFolderResp = await api<FolderPayload>(baseUrl, "POST", `/api/worlds/${worldId}/folders/ABILITY`, gmToken, {
      name: "法术",
    });
    assert.equal(rootFolderResp.status, 200);
    const rootFolder = rootFolderResp.json.data;
    assert.equal(rootFolder.parentId, null);
    assert.equal(rootFolder.type, "ABILITY");

    const childFolderResp = await api<FolderPayload>(baseUrl, "POST", `/api/worlds/${worldId}/folders/ABILITY`, gmToken, {
      name: "塑能",
      parentId: rootFolder.id,
    });
    assert.equal(childFolderResp.status, 200);
    const childFolder = childFolderResp.json.data;
    assert.equal(childFolder.parentId, rootFolder.id);

    const abilityResp = await api<AbilityPayload>(baseUrl, "POST", `/api/worlds/${worldId}/abilities`, gmToken, {
      name: "星火箭",
      folderId: childFolder.id,
      category: "spell",
      source: "custom",
      activation: "active",
      actionType: "standard",
      description: "测试能力",
      rulesText: "测试规则",
    });
    assert.equal(abilityResp.status, 200);
    assert.equal(abilityResp.json.data.folderId, childFolder.id);
    assert.equal(abilityResp.json.data.folderPath, "法术/塑能");

    const moveAbilityResp = await api<AbilityPayload>(
      baseUrl,
      "PUT",
      `/api/worlds/${worldId}/abilities/${abilityResp.json.data.id}`,
      gmToken,
      { folderId: rootFolder.id },
    );
    assert.equal(moveAbilityResp.status, 200);
    assert.equal(moveAbilityResp.json.data.folderId, rootFolder.id);
    assert.equal(moveAbilityResp.json.data.folderPath, "法术");

    const secondAbilityResp = await api<AbilityPayload>(baseUrl, "POST", `/api/worlds/${worldId}/abilities`, gmToken, {
      name: "晨星冲击",
      folderId: rootFolder.id,
      category: "spell",
      source: "custom",
      activation: "active",
      actionType: "standard",
      description: "测试能力二",
      rulesText: "测试规则二",
    });
    assert.equal(secondAbilityResp.status, 200);

    const reorderAbilitiesResp = await api<AbilityPayload[]>(baseUrl, "POST", `/api/worlds/${worldId}/abilities/reorder`, gmToken, {
      folderId: rootFolder.id,
      folderPath: "法术",
      orderedIds: [secondAbilityResp.json.data.id, moveAbilityResp.json.data.id],
    });
    assert.equal(reorderAbilitiesResp.status, 200);
    assert.deepEqual(
      reorderAbilitiesResp.json.data.filter((item) => item.folderId === rootFolder.id).map((item) => item.id),
      [secondAbilityResp.json.data.id, moveAbilityResp.json.data.id],
    );
    assert.deepEqual(
      reorderAbilitiesResp.json.data.filter((item) => item.folderId === rootFolder.id).map((item) => item.sortOrder),
      [0, 1],
    );

    const moveFolderResp = await api<FolderPayload>(baseUrl, "PATCH", `/api/worlds/${worldId}/folders/${childFolder.id}`, gmToken, {
      parentId: null,
      sortOrder: 1,
    });
    assert.equal(moveFolderResp.status, 200);
    assert.equal(moveFolderResp.json.data.parentId, null);

    const reorderResp = await api<FolderPayload[]>(baseUrl, "POST", `/api/worlds/${worldId}/folders/ABILITY/reorder`, gmToken, {
      parentId: null,
      orderedIds: [rootFolder.id, childFolder.id],
    });
    assert.equal(reorderResp.status, 200);
    assert.deepEqual(
      reorderResp.json.data.filter((item) => item.parentId === null).map((item) => item.id),
      [rootFolder.id, childFolder.id],
    );

    const foldersResp = await api<FolderPayload[]>(baseUrl, "GET", `/api/worlds/${worldId}/folders/ABILITY`, gmToken);
    assert.equal(foldersResp.status, 200);
    assert.equal(foldersResp.json.data.length, 2);
  } finally {
    await stopTestServer(server);
    await cleanupWorldGraphByOwnerUsername(gmUsername);
    await prisma.user.deleteMany({ where: { username: gmUsername } });
  }
});