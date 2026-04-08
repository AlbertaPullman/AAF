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

type TalentTreeTemplateStore = {
  templates: TalentTreeTemplateItem[];
};

const TALENT_TREE_FILE_NAME = "talent-tree-templates.json";

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

function normalizeCategory(value: unknown, treeType: TalentTreeType) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw) {
    return raw.slice(0, 30);
  }
  return treeType === "GENERAL" ? "通用天赋" : "职业天赋";
}

function normalizeStore(raw: unknown): TalentTreeTemplateStore {
  if (!raw || typeof raw !== "object") {
    return { templates: [] };
  }

  const source = (raw as { templates?: unknown }).templates;
  if (!Array.isArray(source)) {
    return { templates: [] };
  }

  const normalized = source
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

      const treeType = normalizeTreeType(row.treeType);
      const status = row.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
      const category = normalizeCategory((row as { category?: unknown }).category, treeType);

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

  return { templates: normalized };
}

async function readStore(): Promise<TalentTreeTemplateStore> {
  const filePath = resolveTemplateFilePath();
  const raw = await fsp.readFile(filePath, "utf8").catch(() => "");
  if (!raw) {
    const initial = { templates: [] };
    await writeStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    await writeStore(normalized);
    return normalized;
  } catch {
    const fallback = { templates: [] };
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

export async function listTalentTreeTemplates(userId: string) {
  const actor = await getActor(userId);
  const store = await readStore();
  const editable = canManageTemplate(actor.platformRole);
  const templates = editable ? store.templates : store.templates.filter((item) => item.status === "PUBLISHED");

  return {
    editable,
    templates: templates.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
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
  const treeType = normalizeTreeType(input.treeType);
  const created: TalentTreeTemplateItem = {
    id: `talent_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: input.description?.trim() || "",
    treeType,
    category: normalizeCategory(input.category, treeType),
    status: "DRAFT",
    version: 1,
    graphData: { cells: [] },
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  };

  store.templates.push(created);
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

  const nextTreeType = typeof input.treeType === "undefined" ? current.treeType : normalizeTreeType(input.treeType);
  const updated: TalentTreeTemplateItem = {
    ...current,
    name: nextName,
    description: typeof input.description === "string" ? input.description.trim() : current.description,
    treeType: nextTreeType,
    category: normalizeCategory(input.category, nextTreeType),
    graphData: input.graphData ?? current.graphData,
    updatedAt: nowIso()
  };

  store.templates[index] = updated;
  await writeStore(store);
  return updated;
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
