import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { PlatformRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type RulebookEntryStatus = "DRAFT" | "PUBLISHED";

export type RulebookEntryItem = {
  id: string;
  title: string;
  summary: string;
  directoryPath: string[];
  contentHtml: string;
  sortOrder: number;
  status: RulebookEntryStatus;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type RulebookDirectoryItem = {
  id: string;
  path: string[];
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type RulebookEntryStore = {
  entries: RulebookEntryItem[];
  directories: RulebookDirectoryItem[];
};

const RULEBOOK_FILE_NAME = "rulebook-entries.json";

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

function resolveRulebookFilePath() {
  return path.join(resolveDataSqliteDir(), RULEBOOK_FILE_NAME);
}

function nowIso() {
  return new Date().toISOString();
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

function normalizeStore(raw: unknown): RulebookEntryStore {
  if (!raw || typeof raw !== "object") {
    return { entries: [], directories: [] };
  }

  const sourceEntries = (raw as { entries?: unknown }).entries;
  const sourceDirectories = (raw as { directories?: unknown }).directories;

  const entries = (Array.isArray(sourceEntries) ? sourceEntries : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<RulebookEntryItem>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const title = typeof row.title === "string" ? row.title.trim() : "";
      if (!id || !title) {
        return null;
      }

      return {
        id,
        title,
        summary: typeof row.summary === "string" ? row.summary : "",
        directoryPath: normalizeDirectoryPath((row as { directoryPath?: unknown }).directoryPath),
        contentHtml: typeof row.contentHtml === "string" ? row.contentHtml : "",
        sortOrder: Number.isFinite((row as { sortOrder?: unknown }).sortOrder)
          ? Number((row as { sortOrder?: unknown }).sortOrder)
          : Number.MAX_SAFE_INTEGER,
        status: row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        version: Number.isFinite(row.version) ? Number(row.version) : 1,
        createdBy: typeof row.createdBy === "string" && row.createdBy ? row.createdBy : "unknown",
        createdAt: typeof row.createdAt === "string" && row.createdAt ? row.createdAt : nowIso(),
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : nowIso(),
        publishedAt: typeof row.publishedAt === "string" && row.publishedAt ? row.publishedAt : undefined
      } as RulebookEntryItem;
    })
    .filter((item): item is RulebookEntryItem => !!item);

  const directories = (Array.isArray(sourceDirectories) ? sourceDirectories : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const row = item as Partial<RulebookDirectoryItem>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const path = normalizeDirectoryPath((row as { path?: unknown }).path);
      if (!id || !path.length) {
        return null;
      }

      return {
        id,
        path,
        sortOrder: Number.isFinite((row as { sortOrder?: unknown }).sortOrder)
          ? Number((row as { sortOrder?: unknown }).sortOrder)
          : Number.MAX_SAFE_INTEGER,
        createdBy: typeof row.createdBy === "string" && row.createdBy ? row.createdBy : "unknown",
        createdAt: typeof row.createdAt === "string" && row.createdAt ? row.createdAt : nowIso(),
        updatedAt: typeof row.updatedAt === "string" && row.updatedAt ? row.updatedAt : nowIso()
      } as RulebookDirectoryItem;
    })
    .filter((item): item is RulebookDirectoryItem => !!item);

  const normalizedEntries = entries.slice();

  const directoryMap = new Map<string, RulebookDirectoryItem>();
  for (const directory of directories) {
    directoryMap.set(directory.path.join("::"), directory);
  }
  for (const entry of normalizedEntries) {
    if (!entry.directoryPath.length) {
      continue;
    }
    const key = entry.directoryPath.join("::");
    if (!directoryMap.has(key)) {
      const now = nowIso();
      directoryMap.set(key, {
        id: `rulebook_dir_${Math.random().toString(36).slice(2, 10)}`,
        path: entry.directoryPath,
        sortOrder: Number.MAX_SAFE_INTEGER,
        createdBy: entry.createdBy,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  const normalized: RulebookEntryStore = {
    entries: normalizedEntries,
    directories: Array.from(directoryMap.values())
  };

  normalizeSiblingSortOrders(normalized);
  return normalized;
}

async function readStore(): Promise<RulebookEntryStore> {
  const filePath = resolveRulebookFilePath();
  const raw = await fsp.readFile(filePath, "utf8").catch(() => "");
  if (!raw) {
    const initial = { entries: [], directories: [] };
    await writeStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    await writeStore(normalized);
    return normalized;
  } catch {
    const fallback = { entries: [], directories: [] };
    await writeStore(fallback);
    return fallback;
  }
}

async function writeStore(store: RulebookEntryStore) {
  const filePath = resolveRulebookFilePath();
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

function canManageRulebook(platformRole: PlatformRole) {
  return platformRole === PlatformRole.MASTER || platformRole === PlatformRole.ADMIN;
}

function pathStartsWith(fullPath: string[], basePath: string[]) {
  if (basePath.length > fullPath.length) {
    return false;
  }

  for (let index = 0; index < basePath.length; index += 1) {
    if (fullPath[index] !== basePath[index]) {
      return false;
    }
  }

  return true;
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

function normalizeSiblingSortOrders(store: RulebookEntryStore) {
  const groups = new Map<string, { directories: RulebookDirectoryItem[]; entries: RulebookEntryItem[] }>();

  const ensureGroup = (parentPath: string[]) => {
    const key = pathKey(parentPath);
    let group = groups.get(key);
    if (!group) {
      group = { directories: [], entries: [] };
      groups.set(key, group);
    }
    return group;
  };

  for (const directory of store.directories) {
    ensureGroup(getDirectoryParentPath(directory.path)).directories.push(directory);
  }
  for (const entry of store.entries) {
    ensureGroup(entry.directoryPath).entries.push(entry);
  }

  for (const group of groups.values()) {
    const merged = [
      ...group.directories.map((item) => ({ kind: "directory" as const, item })),
      ...group.entries.map((item) => ({ kind: "entry" as const, item }))
    ].sort((left, right) => {
      if (left.item.sortOrder !== right.item.sortOrder) {
        return left.item.sortOrder - right.item.sortOrder;
      }
      return new Date(left.item.createdAt).getTime() - new Date(right.item.createdAt).getTime();
    });

    merged.forEach((row, index) => {
      row.item.sortOrder = index + 1;
    });
  }
}

function getNextSiblingSortOrder(store: RulebookEntryStore, parentPath: string[]) {
  const parent = pathKey(parentPath);
  const maxDirectorySort = store.directories
    .filter((item) => pathKey(getDirectoryParentPath(item.path)) === parent)
    .reduce((max, item) => Math.max(max, item.sortOrder), 0);
  const maxEntrySort = store.entries
    .filter((item) => pathKey(item.directoryPath) === parent)
    .reduce((max, item) => Math.max(max, item.sortOrder), 0);

  return Math.max(maxDirectorySort, maxEntrySort) + 1;
}

type RulebookTreeNode = {
  key: string;
  label: string;
  path: string[];
  children: RulebookTreeNode[];
  entries: RulebookEntryItem[];
};

function stripHtmlToText(html: string) {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h1|h2|h3|h4|h5|h6|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRulebookTree(entries: RulebookEntryItem[], directories: RulebookDirectoryItem[]) {
  const roots: RulebookTreeNode[] = [];
  const nodeMap = new Map<string, RulebookTreeNode>();

  const ensureNode = (pathValue: string[]) => {
    if (!pathValue.length) {
      return null;
    }

    let parent: RulebookTreeNode | null = null;
    for (let index = 0; index < pathValue.length; index += 1) {
      const currentPath = pathValue.slice(0, index + 1);
      const key = currentPath.join("::");
      let current = nodeMap.get(key);
      if (!current) {
        current = {
          key,
          label: currentPath[currentPath.length - 1],
          path: currentPath,
          children: [],
          entries: []
        };
        nodeMap.set(key, current);
        if (parent) {
          if (!parent.children.some((child) => child.key === current?.key)) {
            parent.children.push(current);
          }
        } else if (!roots.some((root) => root.key === current?.key)) {
          roots.push(current);
        }
      }
      parent = current;
    }

    return parent;
  };

  for (const directory of directories.slice().sort((left, right) => left.sortOrder - right.sortOrder)) {
    ensureNode(directory.path);
  }

  const uncategorizedEntries: RulebookEntryItem[] = [];
  const sortedEntries = entries
    .slice()
    .sort((left, right) => (left.sortOrder - right.sortOrder) || (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()));

  for (const entry of sortedEntries) {
    const node = ensureNode(entry.directoryPath);
    if (node) {
      node.entries.push(entry);
    } else {
      uncategorizedEntries.push(entry);
    }
  }

  const sortNodes = (nodes: RulebookTreeNode[]) => {
    for (const node of nodes) {
      node.entries.sort((left, right) => left.sortOrder - right.sortOrder);
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return {
    roots,
    uncategorizedEntries
  };
}

export async function listRulebookEntries(userId: string) {
  const actor = await getActor(userId);
  const editable = canManageRulebook(actor.platformRole);
  const store = await readStore();
  const entries = editable ? store.entries : store.entries.filter((item) => item.status === "PUBLISHED");
  const directories = store.directories
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    editable,
    entries: entries
      .slice()
      .sort((left, right) => (left.sortOrder - right.sortOrder) || (new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())),
    directories
  };
}

export async function createRulebookEntry(
  userId: string,
  input: { title: string; summary?: string; directoryPath?: unknown; contentHtml?: string }
) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("entry title is required");
  }

  const store = await readStore();
  const now = nowIso();
  const directoryPath = normalizeDirectoryPath(input.directoryPath);
  const created: RulebookEntryItem = {
    id: `rulebook_entry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    summary: typeof input.summary === "string" ? input.summary.trim().slice(0, 120) : "",
    directoryPath,
    contentHtml: typeof input.contentHtml === "string" ? input.contentHtml : "",
    sortOrder: getNextSiblingSortOrder(store, directoryPath),
    status: "DRAFT",
    version: 1,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };

  store.entries.push(created);
  if (directoryPath.length) {
    const key = directoryPath.join("::");
    if (!store.directories.some((item) => item.path.join("::") === key)) {
      store.directories.push({
        id: `rulebook_dir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        path: directoryPath,
        sortOrder: getNextSiblingSortOrder(store, getDirectoryParentPath(directoryPath)),
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  await writeStore(store);
  return created;
}

export async function updateRulebookEntry(
  userId: string,
  entryId: string,
  input: { title?: string; summary?: string; directoryPath?: unknown; contentHtml?: string; sortOrder?: number }
) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.entries.findIndex((item) => item.id === entryId);
  if (index < 0) {
    throw new Error("entry not found");
  }

  const current = store.entries[index];
  const nextTitle = typeof input.title === "string" ? input.title.trim() : current.title;
  if (!nextTitle) {
    throw new Error("entry title is required");
  }

  const nextDirectoryPath = typeof input.directoryPath === "undefined" ? current.directoryPath : normalizeDirectoryPath(input.directoryPath);
  const nextSortOrder = Number.isFinite(input.sortOrder) ? Math.max(1, Math.trunc(Number(input.sortOrder))) : current.sortOrder;

  const updated: RulebookEntryItem = {
    ...current,
    title: nextTitle,
    summary: typeof input.summary === "string" ? input.summary.trim().slice(0, 120) : current.summary,
    directoryPath: nextDirectoryPath,
    contentHtml: typeof input.contentHtml === "string" ? input.contentHtml : current.contentHtml,
    sortOrder: nextSortOrder,
    updatedAt: nowIso()
  };

  store.entries[index] = updated;
  if (nextDirectoryPath.length) {
    const key = nextDirectoryPath.join("::");
    if (!store.directories.some((item) => item.path.join("::") === key)) {
      const now = nowIso();
      store.directories.push({
        id: `rulebook_dir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        path: nextDirectoryPath,
        sortOrder: getNextSiblingSortOrder(store, getDirectoryParentPath(nextDirectoryPath)),
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  await writeStore(store);
  return updated;
}

export async function publishRulebookEntry(userId: string, entryId: string) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.entries.findIndex((item) => item.id === entryId);
  if (index < 0) {
    throw new Error("entry not found");
  }

  const current = store.entries[index];
  const now = nowIso();
  const updated: RulebookEntryItem = {
    ...current,
    status: "PUBLISHED",
    version: current.version + 1,
    publishedAt: now,
    updatedAt: now
  };

  store.entries[index] = updated;
  await writeStore(store);
  return updated;
}

export async function deleteRulebookEntry(userId: string, entryId: string) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const store = await readStore();
  const index = store.entries.findIndex((item) => item.id === entryId);
  if (index < 0) {
    throw new Error("entry not found");
  }

  const deleted = store.entries[index];
  store.entries.splice(index, 1);
  await writeStore(store);
  return deleted;
}

export async function createRulebookDirectory(userId: string, input: { path: unknown }) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const pathValue = normalizeDirectoryPath(input.path);
  if (!pathValue.length) {
    throw new Error("directory path is required");
  }

  const store = await readStore();
  const key = pathValue.join("::");
  const existing = store.directories.find((item) => item.path.join("::") === key);
  if (existing) {
    return existing;
  }

  const now = nowIso();
  const created: RulebookDirectoryItem = {
    id: `rulebook_dir_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    path: pathValue,
    sortOrder: getNextSiblingSortOrder(store, getDirectoryParentPath(pathValue)),
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };
  store.directories.push(created);
  await writeStore(store);
  return created;
}

export async function reorderRulebookEntries(userId: string, input: { entryIds: unknown }) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  if (!Array.isArray(input.entryIds)) {
    throw new Error("entryIds must be an array");
  }

  const orderedIds = input.entryIds
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (!orderedIds.length) {
    throw new Error("entryIds is empty");
  }

  const store = await readStore();
  const entryMap = new Map(store.entries.map((item) => [item.id, item]));
  if (orderedIds.some((id) => !entryMap.has(id))) {
    throw new Error("entry not found in reorder list");
  }

  const rest = store.entries.filter((item) => !orderedIds.includes(item.id));
  const ordered = orderedIds.map((id) => entryMap.get(id) as RulebookEntryItem);
  const merged = [...ordered, ...rest];
  const now = nowIso();
  store.entries = merged.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    updatedAt: now
  }));

  await writeStore(store);
  return store.entries;
}

export async function deleteRulebookDirectory(userId: string, input: { path: unknown }) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const pathValue = normalizeDirectoryPath(input.path);
  if (!pathValue.length) {
    throw new Error("directory path is required");
  }

  const store = await readStore();
  const hasTarget = store.directories.some((item) => item.path.join("::") === pathValue.join("::"));
  if (!hasTarget) {
    throw new Error("directory not found");
  }

  const deletedDirectoryCount = store.directories.filter((item) => pathStartsWith(item.path, pathValue)).length;
  const deletedEntryCount = store.entries.filter((item) => pathStartsWith(item.directoryPath, pathValue)).length;

  store.directories = store.directories
    .filter((item) => !pathStartsWith(item.path, pathValue));
  store.entries = store.entries
    .filter((item) => !pathStartsWith(item.directoryPath, pathValue))
    .sort((left, right) => (left.sortOrder - right.sortOrder) || (new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()))
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));

  normalizeSiblingSortOrders(store);

  await writeStore(store);
  return {
    deletedPath: pathValue,
    deletedDirectoryCount,
    deletedEntryCount
  };
}

export async function reorderRulebookDirectories(userId: string, input: { directoryIds: unknown }) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  if (!Array.isArray(input.directoryIds)) {
    throw new Error("directoryIds must be an array");
  }

  const orderedIds = input.directoryIds
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (!orderedIds.length) {
    throw new Error("directoryIds is empty");
  }

  const store = await readStore();
  const directoryMap = new Map(store.directories.map((item) => [item.id, item]));
  if (orderedIds.some((id) => !directoryMap.has(id))) {
    throw new Error("directory not found in reorder list");
  }

  const rest = store.directories.filter((item) => !orderedIds.includes(item.id));
  const ordered = orderedIds.map((id) => directoryMap.get(id) as RulebookDirectoryItem);
  const merged = [...ordered, ...rest];
  const now = nowIso();
  store.directories = merged.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    updatedAt: now
  }));

  await writeStore(store);
  return store.directories;
}

export async function reorderRulebookTreeNodes(
  userId: string,
  input: { parentPath: unknown; items: unknown }
) {
  const actor = await getActor(userId);
  if (!canManageRulebook(actor.platformRole)) {
    throw new Error("forbidden");
  }

  const parentPath = normalizeDirectoryPath(input.parentPath);
  if (!Array.isArray(input.items)) {
    throw new Error("items must be an array");
  }

  const store = await readStore();
  const parentKey = pathKey(parentPath);
  const siblingDirectories = store.directories.filter((item) => pathKey(getDirectoryParentPath(item.path)) === parentKey);
  const siblingEntries = store.entries.filter((item) => pathKey(item.directoryPath) === parentKey);

  const directoryMap = new Map(siblingDirectories.map((item) => [item.id, item]));
  const entryMap = new Map(siblingEntries.map((item) => [item.id, item]));

  const parsed = input.items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("invalid tree reorder item");
    }

    const typeRaw = (item as { type?: unknown }).type;
    const idRaw = (item as { id?: unknown }).id;
    const type = typeof typeRaw === "string" ? typeRaw.trim().toUpperCase() : "";
    const id = typeof idRaw === "string" ? idRaw.trim() : "";

    if (!id || (type !== "ENTRY" && type !== "DIRECTORY")) {
      throw new Error("invalid tree reorder item");
    }

    if (type === "DIRECTORY") {
      const target = directoryMap.get(id);
      if (!target) {
        throw new Error("directory not found in siblings");
      }
      return { type: "DIRECTORY" as const, item: target };
    }

    const target = entryMap.get(id);
    if (!target) {
      throw new Error("entry not found in siblings");
    }
    return { type: "ENTRY" as const, item: target };
  });

  const seen = new Set<string>();
  for (const row of parsed) {
    const key = `${row.type}:${row.item.id}`;
    if (seen.has(key)) {
      throw new Error("duplicate tree reorder item");
    }
    seen.add(key);
  }

  const rest = [
    ...siblingDirectories
      .filter((item) => !seen.has(`DIRECTORY:${item.id}`))
      .map((item) => ({ type: "DIRECTORY" as const, item })),
    ...siblingEntries
      .filter((item) => !seen.has(`ENTRY:${item.id}`))
      .map((item) => ({ type: "ENTRY" as const, item }))
  ].sort((left, right) => left.item.sortOrder - right.item.sortOrder);

  const merged = [...parsed, ...rest];
  const now = nowIso();
  merged.forEach((row, index) => {
    row.item.sortOrder = index + 1;
    row.item.updatedAt = now;
  });

  await writeStore(store);
  return {
    entries: store.entries,
    directories: store.directories
  };
}

export async function exportRulebookPdf(userId: string) {
  const data = await listRulebookEntries(userId);
  const tree = buildRulebookTree(data.entries, data.directories);

  const doc = new PDFDocument({
    size: "A4",
    margin: 56,
    autoFirstPage: false,
    info: {
      Title: "AAF 规则书",
      Author: "AAF",
      Subject: "Rulebook Export",
      Creator: "AAF Rulebook Exporter"
    }
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const outlineRoot = doc.outline;
  let hasEntryPage = false;

  if (tree.roots.length || tree.uncategorizedEntries.length) {
    // Keep the first page available so outline items can bind to a valid page.
    doc.addPage();
  }

  const writeEntryPage = (entry: RulebookEntryItem, pathValue: string[], outlineParent: PDFKit.PDFOutline) => {
    if (hasEntryPage) {
      doc.addPage();
    }
    hasEntryPage = true;
    outlineParent.addItem(entry.title || "未命名条目");

    for (let index = 0; index < pathValue.length; index += 1) {
      const level = index + 1;
      const size = Math.max(16, 26 - level * 2);
      doc.font("Helvetica-Bold").fontSize(size).fillColor("#1f2937").text(pathValue[index], { align: "left" });
      doc.moveDown(0.2);
    }

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(entry.title || "未命名条目");
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(entry.summary?.trim() || "（无摘要）");
    doc.moveDown(0.8);

    const body = stripHtmlToText(entry.contentHtml || "") || "（无正文）";
    doc.font("Helvetica").fontSize(12).fillColor("#111827").text(body, {
      align: "left",
      lineGap: 4
    });
  };

  const walkNodes = (nodes: RulebookTreeNode[], parentOutline: PDFKit.PDFOutline) => {
    for (const node of nodes) {
      const nodeOutline = parentOutline.addItem(node.label);
      for (const entry of node.entries) {
        writeEntryPage(entry, node.path, nodeOutline);
      }
      walkNodes(node.children, nodeOutline);
    }
  };

  if (!tree.roots.length && !tree.uncategorizedEntries.length) {
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111827").text("规则书导出");
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(12).fillColor("#4b5563").text("当前没有可导出的规则条目。");
  } else {
    walkNodes(tree.roots, outlineRoot);
    if (tree.uncategorizedEntries.length) {
      const uncategorizedOutline = outlineRoot.addItem("未分类");
      for (const entry of tree.uncategorizedEntries) {
        writeEntryPage(entry, ["未分类"], uncategorizedOutline);
      }
    }
  }

  doc.end();
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return {
    fileName: `rulebook-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
    buffer
  };
}
