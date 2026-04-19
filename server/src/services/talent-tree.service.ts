import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type TalentTreeType = "PROFESSION" | "GENERAL";
export type TalentTreeStatus = "DRAFT" | "PUBLISHED";

export type TalentTreeTemplateItem = {
  id: string;
  name: string;
  description: string;
  treeType: TalentTreeType;
  category: string;
  status: TalentTreeStatus;
  version: number;
  graphData: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type TalentTreeDirectoryItem = {
  id: string;
  path: string[];
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type TalentTreeTemplateStore = {
  templates: TalentTreeTemplateItem[];
  directories: TalentTreeDirectoryItem[];
};

const TALENT_TREE_FILE_NAME = "talent-tree-templates.json";
const TALENT_DIRECTORY_ROOTS = {
  profession: "职业天赋树",
  general: "通用天赋树"
} as const;

const TALENT_DIRECTORY_ROOT_ALIAS = new Map<string, string>([
  ["职业天赋树", TALENT_DIRECTORY_ROOTS.profession],
  ["职业天赋", TALENT_DIRECTORY_ROOTS.profession],
  ["职业", TALENT_DIRECTORY_ROOTS.profession],
  ["PROFESSION", TALENT_DIRECTORY_ROOTS.profession],
  ["通用天赋树", TALENT_DIRECTORY_ROOTS.general],
  ["通用天赋", TALENT_DIRECTORY_ROOTS.general],
  ["通用", TALENT_DIRECTORY_ROOTS.general],
  ["GENERAL", TALENT_DIRECTORY_ROOTS.general]
]);

function resolveDataSqliteDir() {
  const candidates = [
    path.resolve(process.cwd(), "data/sqlite"),
    path.resolve(process.cwd(), "../data/sqlite")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveTemplateFilePath() {
  return path.join(resolveDataSqliteDir(), TALENT_TREE_FILE_NAME);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTreeType(value: unknown): TalentTreeType {
  if (typeof value === "string" && value.trim().toUpperCase() === "GENERAL") {
    return "GENERAL";
  }
  return "PROFESSION";
}

function defaultCategoryPath(treeType: TalentTreeType) {
  return [treeType === "GENERAL" ? TALENT_DIRECTORY_ROOTS.general : TALENT_DIRECTORY_ROOTS.profession];
}

function normalizeRootDirectoryName(value: string) {
  return TALENT_DIRECTORY_ROOT_ALIAS.get(value.trim().toUpperCase())
    || TALENT_DIRECTORY_ROOT_ALIAS.get(value.trim())
    || null;
}

function inferTreeTypeByPath(pathValue: string[], fallback: TalentTreeType = "PROFESSION"): TalentTreeType {
  const root = normalizeRootDirectoryName(pathValue[0] ?? "");
  if (root === TALENT_DIRECTORY_ROOTS.general) {
    return "GENERAL";
  }
  if (root === TALENT_DIRECTORY_ROOTS.profession) {
    return "PROFESSION";
  }
  return fallback;
}

function normalizeDirectoryPath(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 6)
    .map((item) => item.slice(0, 32));
}

function parseCategoryToPath(value: unknown, treeType: TalentTreeType) {
  const raw = typeof value === "string" ? value.trim() : "";
  const fromCategory = raw ? normalizeDirectoryPath(raw.split("/")) : [];
  if (!fromCategory.length) {
    return defaultCategoryPath(treeType);
  }

  const root = normalizeRootDirectoryName(fromCategory[0]);
  if (root) {
    return [root, ...fromCategory.slice(1)];
  }

  return [defaultCategoryPath(treeType)[0], ...fromCategory.slice(0, 5)];
}

function pathKey(pathValue: string[]) {
  return pathValue.join("::");
}

function getDirectoryParentPath(pathValue: string[]) {
  if (!pathValue.length) {
    return [] as string[];
  }
  return pathValue.slice(0, -1);
}

function normalizeDirectorySortOrders(store: TalentTreeTemplateStore) {
  const groups = new Map<string, TalentTreeDirectoryItem[]>();

  for (const directory of store.directories) {
    const parentKey = pathKey(getDirectoryParentPath(directory.path));
    const bucket = groups.get(parentKey) ?? [];
    bucket.push(directory);
    groups.set(parentKey, bucket);
  }

  groups.forEach((items) => {
    items
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        const createdDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        if (createdDiff !== 0) {
          return createdDiff;
        }
        return pathKey(left.path).localeCompare(pathKey(right.path), "zh-Hans-CN");
      })
      .forEach((item, index) => {
        item.sortOrder = index + 1;
      });
  });
}

function getNextDirectorySortOrder(store: TalentTreeTemplateStore, parentPath: string[]) {
  const parent = pathKey(parentPath);
  const siblings = store.directories.filter((item) => pathKey(getDirectoryParentPath(item.path)) === parent);
  const maxSortOrder = siblings.reduce((max, item) => Math.max(max, item.sortOrder), 0);
  return maxSortOrder + 1;
}

function ensureDirectoryInStore(
  store: TalentTreeTemplateStore,
  pathValue: string[],
  userId: string,
  timestamp: string,
  fixedSortOrder?: number
) {
  if (!pathValue.length) {
    return;
  }

  const key = pathKey(pathValue);
  if (store.directories.some((item) => pathKey(item.path) === key)) {
    return;
  }

  store.directories.push({
    id: `talent_dir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    path: pathValue,
    sortOrder: Number.isFinite(fixedSortOrder)
      ? Number(fixedSortOrder)
      : getNextDirectorySortOrder(store, getDirectoryParentPath(pathValue)),
    createdBy: userId,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function collectDirectoryKeysFromTemplates(templates: TalentTreeTemplateItem[]) {
  const keys = new Set<string>();
  for (const template of templates) {
    const pathValue = parseCategoryToPath(template.category, template.treeType);
    for (let index = 0; index < pathValue.length; index += 1) {
      keys.add(pathKey(pathValue.slice(0, index + 1)));
    }
  }
  return keys;
}

function normalizeStore(raw: unknown): TalentTreeTemplateStore {
  if (!raw || typeof raw !== "object") {
    return { templates: [], directories: [] };
  }

  const source = (raw as { templates?: unknown }).templates;
  const sourceDirectories = (raw as { directories?: unknown }).directories;

  const templates = (Array.isArray(source) ? source : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<TalentTreeTemplateItem>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name) {
        return null;
      }

      const rawTreeType = normalizeTreeType(row.treeType);
      const categoryPath = parseCategoryToPath((row as { category?: unknown }).category, rawTreeType);
      const treeType = inferTreeTypeByPath(categoryPath, rawTreeType);
      const status = row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
      const category = categoryPath.join("/");

      return {
        id,
        name,
        description: typeof row.description === "string" ? row.description : "",
        treeType,
        category,
        status,
        version: Number.isFinite(row.version) ? Number(row.version) : 1,
        graphData: row.graphData ?? { cells: [] },
        createdBy: typeof row.createdBy === "string" && row.createdBy ? row.createdBy : "unknown",
        createdAt: typeof row.createdAt === "string" && row.createdAt ? row.createdAt : nowIso(),
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : nowIso(),
        publishedAt: typeof row.publishedAt === "string" && row.publishedAt ? row.publishedAt : undefined
      } as TalentTreeTemplateItem;
    })
    .filter((item): item is TalentTreeTemplateItem => !!item);

  const directories = (Array.isArray(sourceDirectories) ? sourceDirectories : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<TalentTreeDirectoryItem>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const pathValue = normalizeDirectoryPath((row as { path?: unknown }).path);
      if (!id || !pathValue.length) {
        return null;
      }

      return {
        id,
        path: pathValue,
        sortOrder: Number.isFinite((row as { sortOrder?: unknown }).sortOrder)
          ? Number((row as { sortOrder?: unknown }).sortOrder)
          : Number.MAX_SAFE_INTEGER,
        createdBy: typeof row.createdBy === "string" && row.createdBy ? row.createdBy : "unknown",
        createdAt: typeof row.createdAt === "string" && row.createdAt ? row.createdAt : nowIso(),
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : nowIso()
      } as TalentTreeDirectoryItem;
    })
    .filter((item): item is TalentTreeDirectoryItem => !!item);

  const normalized: TalentTreeTemplateStore = {
    templates,
    directories
  };

  for (const template of templates) {
    const pathValue = parseCategoryToPath(template.category, template.treeType);
    ensureDirectoryInStore(normalized, pathValue, template.createdBy, template.createdAt, Number.MAX_SAFE_INTEGER);
  }

  normalizeDirectorySortOrders(normalized);

  return normalized;
}

async function readStore(): Promise<TalentTreeTemplateStore> {
  const filePath = resolveTemplateFilePath();
  const raw = await fsp.readFile(filePath, "utf8").catch(() => "");
  if (!raw) {
    const initial = { templates: [], directories: [] };
    await writeStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    await writeStore(normalized);
    return normalized;
  } catch {
    const fallback = { templates: [], directories: [] };
    await writeStore(fallback);
    return fallback;
  }
}

async function writeStore(store: TalentTreeTemplateStore) {
  const filePath = resolveTemplateFilePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

async function getActor(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true }
  });

  if (!actor) {
    throw new Error("user not found");
  }

  return actor;
}

function canManageTemplate(platformRole: PlatformRole) {
  return platformRole === PlatformRole.MASTER || platformRole === PlatformRole.ADMIN;
}

export async function getTemplateById(templateId: string): Promise<TalentTreeTemplateItem | null> {
  const store = await readStore();
  return store.templates.find((item) => item.id === templateId) ?? null;
}

export async function listTalentTreeTemplates(userId: string) {
  const actor = await getActor(userId);
  const store = await readStore();
  const editable = canManageTemplate(actor.platformRole);
  const templates = editable ? store.templates : store.templates.filter((item) => item.status === "PUBLISHED");
  const visibleDirectoryKeys = collectDirectoryKeysFromTemplates(templates);
  const directories = store.directories
    .filter((item) => editable || visibleDirectoryKeys.has(pathKey(item.path)))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return pathKey(left.path).localeCompare(pathKey(right.path), "zh-Hans-CN");
    });

  return {
    editable,
    templates: templates.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    directories
  };
}

export async function createTalentTreeTemplate(
  userId: string,
  input: { name: string; treeType?: TalentTreeType; description?: string; category?: string }
) {
  const actor = await getActor(userId);
  if (!canManageTemplate(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("template name is required");
  }

  const store = await readStore();
  if (store.templates.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("template name already exists");
  }

  const now = nowIso();
  const rawTreeType = normalizeTreeType(input.treeType);
  const categoryPath = parseCategoryToPath(input.category, rawTreeType);
  const treeType = inferTreeTypeByPath(categoryPath, rawTreeType);
  const created: TalentTreeTemplateItem = {
    id: `talent_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: input.description?.trim() || "",
    treeType,
    category: categoryPath.join("/"),
    status: "DRAFT",
    version: 1,
    graphData: { cells: [] },
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };

  store.templates.push(created);
  ensureDirectoryInStore(store, categoryPath, userId, now);
  normalizeDirectorySortOrders(store);
  await writeStore(store);
  return created;
}

export async function updateTalentTreeTemplate(
  userId: string,
  templateId: string,
  input: { name?: string; description?: string; treeType?: TalentTreeType; category?: string; graphData?: unknown }
) {
  const actor = await getActor(userId);
  if (!canManageTemplate(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.templates.findIndex((item) => item.id === templateId);
  if (index < 0) {
    throw new Error("template not found");
  }

  const current = store.templates[index];
  const nextName = typeof input.name === "string" ? input.name.trim() : current.name;
  if (!nextName) {
    throw new Error("template name is required");
  }

  if (
    nextName.toLowerCase() !== current.name.toLowerCase()
    && store.templates.some((item) => item.id !== templateId && item.name.toLowerCase() === nextName.toLowerCase())
  ) {
    throw new Error("template name already exists");
  }

  const fallbackTreeType = typeof input.treeType === "undefined" ? current.treeType : normalizeTreeType(input.treeType);
  const nextCategoryPath = typeof input.category === "undefined"
    ? parseCategoryToPath(current.category, fallbackTreeType)
    : parseCategoryToPath(input.category, fallbackTreeType);
  const nextTreeType = inferTreeTypeByPath(nextCategoryPath, fallbackTreeType);
  const updated: TalentTreeTemplateItem = {
    ...current,
    name: nextName,
    description: typeof input.description === "string" ? input.description.trim() : current.description,
    treeType: nextTreeType,
    category: nextCategoryPath.join("/"),
    graphData: input.graphData ?? current.graphData,
    updatedAt: nowIso()
  };

  store.templates[index] = updated;
  ensureDirectoryInStore(store, nextCategoryPath, userId, updated.updatedAt);
  normalizeDirectorySortOrders(store);
  await writeStore(store);
  return updated;
}

export async function createTalentTreeDirectory(userId: string, input: { path: unknown }) {
  const actor = await getActor(userId);
  if (!canManageTemplate(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const pathValue = normalizeDirectoryPath(input.path);
  if (!pathValue.length) {
    throw new Error("directory path is required");
  }

  const normalizedRoot = normalizeRootDirectoryName(pathValue[0] ?? "");
  if (!normalizedRoot) {
    throw new Error("一级目录必须为通用天赋树或职业天赋树");
  }
  pathValue[0] = normalizedRoot;

  const store = await readStore();
  const key = pathKey(pathValue);
  const existing = store.directories.find((item) => pathKey(item.path) === key);
  if (existing) {
    return existing;
  }

  const now = nowIso();
  const created: TalentTreeDirectoryItem = {
    id: `talent_dir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    path: pathValue,
    sortOrder: getNextDirectorySortOrder(store, getDirectoryParentPath(pathValue)),
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };

  store.directories.push(created);
  normalizeDirectorySortOrders(store);
  await writeStore(store);
  return created;
}

export async function publishTalentTreeTemplate(userId: string, templateId: string) {
  const actor = await getActor(userId);
  if (!canManageTemplate(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.templates.findIndex((item) => item.id === templateId);
  if (index < 0) {
    throw new Error("template not found");
  }

  const current = store.templates[index];
  const now = nowIso();
  const published: TalentTreeTemplateItem = {
    ...current,
    status: "PUBLISHED",
    version: current.version + 1,
    publishedAt: now,
    updatedAt: now
  };

  store.templates[index] = published;
  await writeStore(store);
  return published;
}

export async function deleteTalentTreeTemplate(userId: string, templateId: string) {
  const actor = await getActor(userId);
  if (!canManageTemplate(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.templates.findIndex((item) => item.id === templateId);
  if (index < 0) {
    throw new Error("template not found");
  }

  const deleted = store.templates[index];
  store.templates.splice(index, 1);
  await writeStore(store);
  return deleted;
}
