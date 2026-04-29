/**
 * 世界资源本地缓存层（IndexedDB）
 * ================================
 *
 * 设计原则（来自用户原始需求）：
 *   "前端方面的资源都缓存在用户本地…只有涉及到规则自动化结算、棋子token移动位置、
 *    各类数值变动之类的才会让后端下发数据重新同步。"
 *
 * 因此本层只负责**相对静态的世界资源模板**（能力 / 种族 / 职业 / 背景 / 物品 /
 * 命刻 / 牌堆 / 随机表），不涉及战斗结算、token 位置、HP/MP 等动态数值。
 *
 * 用法：stale-while-revalidate
 *   1. UI 触发 `loadEntities` → store 先 `cacheGet()` 立即渲染（如有）。
 *   2. 同时发起网络请求；返回后 `cachePut()` 并更新 store 状态。
 *   3. CRUD 写操作（create / update / delete）同步通过 `cachePut()` 写穿透。
 *
 * 不引入 `idb` 等第三方依赖，保持包体积。所有 API 返回 Promise<T | null>，
 * 缓存失败不影响主流程（store 会回退到网络）。
 */

const DB_NAME = "aaf-world-cache";
const DB_VERSION = 1;
const STORE_ENTITIES = "entities";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_ENTITIES)) {
            db.createObjectStore(STORE_ENTITIES);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[worldCache] IndexedDB open failed", req.error);
          resolve(null);
        };
        req.onblocked = () => {
          console.warn("[worldCache] IndexedDB open blocked");
          resolve(null);
        };
      } catch (err) {
        console.warn("[worldCache] IndexedDB open threw", err);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function makeKey(worldId: string, entityType: string): string {
  return `${worldId}:${entityType}`;
}

export interface CachedEntityList<T = unknown> {
  items: T[];
  ts: number;
  version: number;
}

/** 读取某 (worldId, entityType) 的缓存列表。失败返回 null。 */
export async function cacheGet<T = unknown>(
  worldId: string,
  entityType: string
): Promise<CachedEntityList<T> | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENTITIES, "readonly");
      const store = tx.objectStore(STORE_ENTITIES);
      const req = store.get(makeKey(worldId, entityType));
      req.onsuccess = () => resolve((req.result as CachedEntityList<T>) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 写入/覆盖某 (worldId, entityType) 的缓存列表。失败静默返回 false。 */
export async function cachePut<T = unknown>(
  worldId: string,
  entityType: string,
  items: T[],
  version = 1
): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENTITIES, "readwrite");
      const store = tx.objectStore(STORE_ENTITIES);
      const payload: CachedEntityList<T> = { items, ts: Date.now(), version };
      const req = store.put(payload, makeKey(worldId, entityType));
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** 失效某 (worldId, entityType) 的缓存。 */
export async function cacheDelete(worldId: string, entityType: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENTITIES, "readwrite");
      const store = tx.objectStore(STORE_ENTITIES);
      const req = store.delete(makeKey(worldId, entityType));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 失效某 worldId 下所有实体类型缓存（适用于 importPack / 删除世界）。 */
export async function cacheInvalidateWorld(worldId: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENTITIES, "readwrite");
      const store = tx.objectStore(STORE_ENTITIES);
      const req = store.openCursor();
      const prefix = `${worldId}:`;
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 清空整个缓存（仅用于退出登录或调试）。 */
export async function cacheClearAll(): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ENTITIES, "readwrite");
      tx.objectStore(STORE_ENTITIES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 浅比较两个 items 数组是否在 id 集合层面一致（用于 stale-while-revalidate 跳过更新）。 */
export function shallowEqualById(a: { id: string }[], b: { id: string }[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}
