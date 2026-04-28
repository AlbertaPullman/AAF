/**
 * Folder service (CP-01)
 *
 * 跨资源类型的多级分类容器。本模块包含：
 *   1. 纯函数：路径解析 / 树构建 / 移动循环检测（不依赖 DB，便于单测）
 *   2. Prisma CRUD：list / create / rename / move / delete / 树查询
 *   3. folderPath → folderId 数据迁移（lazy，首次 listFolders 触发）
 *
 * 设计要点：
 *   - 同 (worldId, type, parentId) 下文件夹名唯一，避免歧义。
 *   - 移动文件夹需检测循环（不能把祖先移到自己的子孙下）。
 *   - 删除文件夹时，子文件夹与子资源的 folderId 通过 ON DELETE SET NULL 自动清空，
 *     不级联删资源（用户期望"移出文件夹"而非毁掉资源）。
 *   - folderPath 兼容：lazy migrate，避免一次性 UPSERT 拖慢部署。
 */

import { prisma } from "../lib/prisma";
import type { FolderType, FolderRecord, FolderTreeNode } from "../../../shared/types/world-entities";

/* ──────────── 纯函数：路径与树 ──────────── */

/**
 * 解析 folderPath 字符串为路径段数组。
 *   "卡拉塔纳/危险生物/精魂纳迦" → ["卡拉塔纳", "危险生物", "精魂纳迦"]
 *   "" / 空格 / 仅斜杠 → []
 *   首尾斜杠会被忽略；连续斜杠的空段会被丢弃。
 */
export function parseFolderPath(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/**
 * 把扁平的 FolderRecord 数组组装成树（按 sortOrder + createdAt 排序）。
 * 顶层节点的 parentId 为 null。
 */
export function buildFolderTree(records: FolderRecord[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const record of records) {
    byId.set(record.id, { ...record, children: [] });
  }

  const roots: FolderTreeNode[] = [];
  for (const record of records) {
    const node = byId.get(record.id);
    if (!node) continue;
    if (record.parentId && byId.has(record.parentId)) {
      byId.get(record.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  return roots;
}

/**
 * 检测把 `folderId` 移到 `targetParentId` 之下是否会产生循环（自引用 / 祖先变子孙）。
 * folders 是同 (worldId, type) 的全量扁平数组。
 *   - targetParentId === folderId  → 禁止
 *   - targetParentId 是 folderId 的子孙  → 禁止
 *   - 其他情况  → 允许
 */
export function wouldCreateFolderCycle(
  folders: Pick<FolderRecord, "id" | "parentId">[],
  folderId: string,
  targetParentId: string | null,
): boolean {
  if (targetParentId === null) return false;
  if (targetParentId === folderId) return true;

  // 收集 folderId 的所有子孙
  const childrenOf = new Map<string | null, string[]>();
  for (const f of folders) {
    const list = childrenOf.get(f.parentId) ?? [];
    list.push(f.id);
    childrenOf.set(f.parentId, list);
  }

  const descendants = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const kids = childrenOf.get(current) ?? [];
    for (const kid of kids) {
      if (!descendants.has(kid)) {
        descendants.add(kid);
        stack.push(kid);
      }
    }
  }

  return descendants.has(targetParentId);
}

/**
 * 校验文件夹名（去首尾空白后非空，且不含 /）。
 */
export function validateFolderName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("folder name is required");
  }
  if (trimmed.includes("/")) {
    throw new Error("folder name cannot contain '/'");
  }
  return trimmed;
}

/* ──────────── Prisma CRUD ──────────── */

/**
 * 把 Prisma 记录转换为 FolderRecord（DateTime → ISO string）。
 */
function toFolderRecord(row: {
  id: string;
  worldId: string;
  parentId: string | null;
  type: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  collapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FolderRecord {
  return {
    id: row.id,
    worldId: row.worldId,
    parentId: row.parentId,
    type: row.type as FolderType,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sortOrder,
    collapsed: row.collapsed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 列出某 worldId+type 下所有文件夹（扁平）。
 */
export async function listFolders(worldId: string, type: FolderType): Promise<FolderRecord[]> {
  const rows = await prisma.folder.findMany({
    where: { worldId, type },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toFolderRecord);
}

/**
 * 列出某 worldId+type 下文件夹树。
 */
export async function listFolderTree(worldId: string, type: FolderType): Promise<FolderTreeNode[]> {
  const folders = await listFolders(worldId, type);
  return buildFolderTree(folders);
}

/**
 * 创建文件夹。parentId 为 null = 顶层。
 * 同 (worldId, type, parentId) 下名字必须唯一。
 */
export async function createFolder(input: {
  worldId: string;
  type: FolderType;
  name: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
}): Promise<FolderRecord> {
  const name = validateFolderName(input.name);
  const parentId = input.parentId ?? null;

  // 校验 parent 同 worldId 同 type
  if (parentId) {
    const parent = await prisma.folder.findUnique({
      where: { id: parentId },
      select: { worldId: true, type: true },
    });
    if (!parent || parent.worldId !== input.worldId || parent.type !== input.type) {
      throw new Error("parent folder mismatch (worldId or type)");
    }
  }

  // 同级查重
  const sibling = await prisma.folder.findFirst({
    where: { worldId: input.worldId, type: input.type, parentId, name },
    select: { id: true },
  });
  if (sibling) {
    throw new Error(`folder name already exists at this level: ${name}`);
  }

  const row = await prisma.folder.create({
    data: {
      worldId: input.worldId,
      type: input.type,
      parentId,
      name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return toFolderRecord(row);
}

/**
 * 重命名文件夹。同 (parent, type) 下查重。
 */
export async function renameFolder(folderId: string, newName: string): Promise<FolderRecord> {
  const name = validateFolderName(newName);
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("folder not found");

  const sibling = await prisma.folder.findFirst({
    where: {
      worldId: folder.worldId,
      type: folder.type,
      parentId: folder.parentId,
      name,
      NOT: { id: folderId },
    },
    select: { id: true },
  });
  if (sibling) {
    throw new Error(`folder name already exists at this level: ${name}`);
  }

  const row = await prisma.folder.update({ where: { id: folderId }, data: { name } });
  return toFolderRecord(row);
}

/**
 * 移动文件夹到新 parent（null = 顶层）。检测循环 + 校验同 worldId+type。
 */
export async function moveFolder(folderId: string, newParentId: string | null): Promise<FolderRecord> {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("folder not found");

  if (newParentId) {
    const target = await prisma.folder.findUnique({
      where: { id: newParentId },
      select: { id: true, worldId: true, type: true },
    });
    if (!target || target.worldId !== folder.worldId || target.type !== folder.type) {
      throw new Error("target parent mismatch (worldId or type)");
    }
  }

  // 循环检测
  const allInScope = await prisma.folder.findMany({
    where: { worldId: folder.worldId, type: folder.type },
    select: { id: true, parentId: true },
  });
  if (wouldCreateFolderCycle(allInScope, folderId, newParentId)) {
    throw new Error("cannot move folder into its own descendant");
  }

  // 同级查重
  const sibling = await prisma.folder.findFirst({
    where: {
      worldId: folder.worldId,
      type: folder.type,
      parentId: newParentId,
      name: folder.name,
      NOT: { id: folderId },
    },
    select: { id: true },
  });
  if (sibling) {
    throw new Error(`folder name already exists at target parent: ${folder.name}`);
  }

  const row = await prisma.folder.update({
    where: { id: folderId },
    data: { parentId: newParentId },
  });
  return toFolderRecord(row);
}

/**
 * 删除文件夹。子文件夹和子资源的 folderId 自动 SET NULL（迁移已处理）。
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("folder not found");
  await prisma.folder.delete({ where: { id: folderId } });
}

/**
 * 设置折叠状态（GM UI 偏好）。
 */
export async function setFolderCollapsed(folderId: string, collapsed: boolean): Promise<FolderRecord> {
  const row = await prisma.folder.update({ where: { id: folderId }, data: { collapsed } });
  return toFolderRecord(row);
}

/* ──────────── folderPath → folderId 数据迁移（lazy） ──────────── */

/**
 * Lazy 迁移入口：扫描某 (worldId, type) 下用 folderPath 的资源，自动建 Folder 树并回写 folderId。
 * 调用方决定何时触发（首次 listFolders / 首次 list 资源等）。
 *
 * 返回值：迁移的资源数。0 表示已无需迁移。
 *
 * resourceLoader：返回扁平资源列表，每条至少含 id + folderPath。
 * resourceUpdater：把 (resourceId, folderId) 写回对应资源表。
 */
export async function migrateFolderPaths(
  worldId: string,
  type: FolderType,
  resourceLoader: () => Promise<{ id: string; folderPath: string | null }[]>,
  resourceUpdater: (resourceId: string, folderId: string) => Promise<void>,
): Promise<number> {
  const resources = await resourceLoader();
  const candidates = resources.filter((r) => r.folderPath && parseFolderPath(r.folderPath).length > 0);
  if (candidates.length === 0) return 0;

  // 现有该 (worldId, type) 下文件夹，按"全路径 → id"建立映射
  const existing = await listFolders(worldId, type);
  const pathToId = new Map<string, string>();
  const childrenByParent = new Map<string | null, FolderRecord[]>();
  for (const f of existing) {
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f);
    childrenByParent.set(f.parentId, list);
  }
  // 递归算出每个现有文件夹的全路径（用 / 拼接）
  function visit(node: FolderRecord, prefix: string[]) {
    const fullPath = [...prefix, node.name].join("/");
    pathToId.set(fullPath, node.id);
    const kids = childrenByParent.get(node.id) ?? [];
    for (const kid of kids) {
      visit(kid, [...prefix, node.name]);
    }
  }
  for (const root of childrenByParent.get(null) ?? []) {
    visit(root, []);
  }

  // 对每条资源，确保中间路径都存在
  let migrated = 0;
  for (const resource of candidates) {
    const segments = parseFolderPath(resource.folderPath);
    let parentId: string | null = null;
    let cumulative: string[] = [];
    for (const segment of segments) {
      cumulative.push(segment);
      const fullPath = cumulative.join("/");
      let id = pathToId.get(fullPath);
      if (!id) {
        const created = await createFolder({ worldId, type, parentId, name: segment });
        id = created.id;
        pathToId.set(fullPath, id);
      }
      parentId = id;
    }
    if (parentId) {
      await resourceUpdater(resource.id, parentId);
      migrated++;
    }
  }

  return migrated;
}
