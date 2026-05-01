/**
 * 世界实体数据 Store (Zustand)
 *
 * 管理能力、种族、职业、背景、物品、命刻等实体数据的CRUD状态
 */

import { create } from "zustand";
import { http } from "../../lib/http";
import {
  cacheGet,
  cachePut,
  cacheInvalidateWorld,
  shallowEqualById,
} from "../lib/worldCache";
import type { FolderRecord, FolderType } from "../../../../shared/types/world-entities";

/* ──── 类型 ──── */

export interface EntityRecord {
  id: string;
  worldId: string;
  name: string;
  [key: string]: unknown;
}

interface EntitySlice<T extends EntityRecord = EntityRecord> {
  items: T[];
  loading: boolean;
  error: string | null;
}

interface FolderSlice {
  items: FolderRecord[];
  loading: boolean;
  error: string | null;
}

interface WorldEntityState {
  abilities: EntitySlice;
  races: EntitySlice;
  professions: EntitySlice;
  backgrounds: EntitySlice;
  items: EntitySlice;
  fateClocks: EntitySlice;
  decks: EntitySlice;
  randomTables: EntitySlice;
  folders: Record<FolderType, FolderSlice>;

  // 通用加载
  loadEntities: (worldId: string, type: EntityType) => Promise<void>;
  createEntity: (worldId: string, type: EntityType, data: Record<string, unknown>) => Promise<EntityRecord>;
  updateEntity: (worldId: string, type: EntityType, id: string, data: Record<string, unknown>) => Promise<EntityRecord>;
  deleteEntity: (worldId: string, type: EntityType, id: string) => Promise<void>;
  reorderEntities: (worldId: string, type: EntityType, data: { folderId?: string | null; folderPath?: string; orderedIds: string[] }) => Promise<EntityRecord[]>;

  // 目录
  loadFolders: (worldId: string, type: FolderType) => Promise<void>;
  createFolder: (worldId: string, type: FolderType, data: Record<string, unknown>) => Promise<FolderRecord>;
  updateFolder: (worldId: string, folderId: string, data: Record<string, unknown>) => Promise<FolderRecord>;
  deleteFolder: (worldId: string, folderId: string, type: FolderType) => Promise<void>;
  reorderFolders: (worldId: string, type: FolderType, data: { parentId?: string | null; orderedIds: string[] }) => Promise<FolderRecord[]>;

  // 命刻专用
  advanceFateClock: (worldId: string, id: string, amount: number, reason: string) => Promise<void>;

  // 导入/导出
  exportPack: (worldId: string) => Promise<unknown>;
  importPack: (worldId: string, pack: Record<string, unknown>) => Promise<Record<string, number>>;

  // 重置
  resetAll: () => void;
}

export type EntityType = "abilities" | "races" | "professions" | "backgrounds" | "items" | "fateClocks" | "decks" | "randomTables";

const API_PATHS: Record<EntityType, string> = {
  abilities: "abilities",
  races: "races",
  professions: "professions",
  backgrounds: "backgrounds",
  items: "items",
  fateClocks: "fate-clocks",
  decks: "decks",
  randomTables: "random-tables",
};

const emptySlice = (): EntitySlice => ({ items: [], loading: false, error: null });
const emptyFolderSlice = (): FolderSlice => ({ items: [], loading: false, error: null });
const createEmptyFolderState = (): Record<FolderType, FolderSlice> => ({
  SCENE: emptyFolderSlice(),
  CHARACTER: emptyFolderSlice(),
  ABILITY: emptyFolderSlice(),
  ITEM: emptyFolderSlice(),
  PROFESSION: emptyFolderSlice(),
  RACE: emptyFolderSlice(),
  BACKGROUND: emptyFolderSlice(),
  FATE_CLOCK: emptyFolderSlice(),
  DECK: emptyFolderSlice(),
  RANDOM_TABLE: emptyFolderSlice(),
});

export const useWorldEntityStore = create<WorldEntityState>((set, get) => ({
  abilities: emptySlice(),
  races: emptySlice(),
  professions: emptySlice(),
  backgrounds: emptySlice(),
  items: emptySlice(),
  fateClocks: emptySlice(),
  decks: emptySlice(),
  randomTables: emptySlice(),
  folders: createEmptyFolderState(),

  loadEntities: async (worldId, type) => {
    // 1) 先尝试本地缓存即时渲染（stale-while-revalidate）
    const cached = await cacheGet<EntityRecord>(worldId, type);
    if (cached && cached.items.length > 0) {
      set({ [type]: { items: cached.items, loading: true, error: null } });
    } else {
      set((s) => ({ [type]: { ...s[type], loading: true, error: null } }));
    }

    // 2) 网络拉取最新；失败时若有缓存则保留缓存数据，仅展示错误
    try {
      const res = await http.get(`/worlds/${worldId}/${API_PATHS[type]}`);
      const items: EntityRecord[] = res.data?.data ?? [];
      const prevItems = cached?.items ?? [];
      const sameSet = shallowEqualById(prevItems, items);
      if (!sameSet || JSON.stringify(prevItems) !== JSON.stringify(items)) {
        await cachePut(worldId, type, items);
      }
      set({ [type]: { items, loading: false, error: null } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载失败";
      // 网络失败时保留缓存条目（如有），不清空
      set((s) => ({ [type]: { ...s[type], loading: false, error: msg } }));
    }
  },

  createEntity: async (worldId, type, data) => {
    const res = await http.post(`/worlds/${worldId}/${API_PATHS[type]}`, data);
    const created = res.data?.data as EntityRecord;
    const nextItems = [...get()[type].items, created];
    set((s) => ({ [type]: { ...s[type], items: nextItems } }));
    void cachePut(worldId, type, nextItems);
    return created;
  },

  updateEntity: async (worldId, type, id, data) => {
    const res = await http.put(`/worlds/${worldId}/${API_PATHS[type]}/${id}`, data);
    const updated = res.data?.data as EntityRecord;
    const nextItems = get()[type].items.map((it) => (it.id === id ? updated : it));
    set((s) => ({ [type]: { ...s[type], items: nextItems } }));
    void cachePut(worldId, type, nextItems);
    return updated;
  },

  deleteEntity: async (worldId, type, id) => {
    await http.delete(`/worlds/${worldId}/${API_PATHS[type]}/${id}`);
    const nextItems = get()[type].items.filter((it) => it.id !== id);
    set((s) => ({ [type]: { ...s[type], items: nextItems } }));
    void cachePut(worldId, type, nextItems);
  },

  reorderEntities: async (worldId, type, data) => {
    const res = await http.post(`/worlds/${worldId}/${API_PATHS[type]}/reorder`, data);
    const items = res.data?.data as EntityRecord[];
    set((s) => ({ [type]: { ...s[type], items } }));
    void cachePut(worldId, type, items);
    return items;
  },

  loadFolders: async (worldId, type) => {
    set((s) => ({ folders: { ...s.folders, [type]: { ...s.folders[type], loading: true, error: null } } }));
    try {
      const res = await http.get(`/worlds/${worldId}/folders/${type}`);
      const items = (res.data?.data ?? []) as FolderRecord[];
      set((s) => ({ folders: { ...s.folders, [type]: { items, loading: false, error: null } } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载目录失败";
      set((s) => ({ folders: { ...s.folders, [type]: { ...s.folders[type], loading: false, error: msg } } }));
    }
  },

  createFolder: async (worldId, type, data) => {
    const res = await http.post(`/worlds/${worldId}/folders/${type}`, data);
    const created = res.data?.data as FolderRecord;
    set((s) => ({
      folders: { ...s.folders, [type]: { ...s.folders[type], items: [...s.folders[type].items, created] } },
    }));
    return created;
  },

  updateFolder: async (worldId, folderId, data) => {
    const res = await http.patch(`/worlds/${worldId}/folders/${folderId}`, data);
    const updated = res.data?.data as FolderRecord;
    set((s) => ({
      folders: Object.fromEntries(
        Object.entries(s.folders).map(([type, slice]) => [
          type,
          { ...slice, items: slice.items.map((item) => (item.id === updated.id ? updated : item)) },
        ]),
      ) as Record<FolderType, FolderSlice>,
    }));
    return updated;
  },

  deleteFolder: async (worldId, folderId, type) => {
    await http.delete(`/worlds/${worldId}/folders/${folderId}`);
    set((s) => ({
      folders: { ...s.folders, [type]: { ...s.folders[type], items: s.folders[type].items.filter((item) => item.id !== folderId) } },
    }));
  },

  reorderFolders: async (worldId, type, data) => {
    const res = await http.post(`/worlds/${worldId}/folders/${type}/reorder`, data);
    const items = res.data?.data as FolderRecord[];
    set((s) => ({ folders: { ...s.folders, [type]: { ...s.folders[type], items } } }));
    return items;
  },

  advanceFateClock: async (worldId, id, amount, reason) => {
    const res = await http.patch(`/worlds/${worldId}/fate-clocks/${id}/advance`, { amount, reason });
    const updated = res.data?.data as EntityRecord;
    const nextItems = get().fateClocks.items.map((it) => (it.id === id ? updated : it));
    set((s) => ({ fateClocks: { ...s.fateClocks, items: nextItems } }));
    void cachePut(worldId, "fateClocks", nextItems);
  },

  exportPack: async (worldId) => {
    const res = await http.get(`/worlds/${worldId}/collection-pack`);
    return res.data?.data;
  },

  importPack: async (worldId, pack) => {
    const res = await http.post(`/worlds/${worldId}/collection-pack/import`, pack);
    // 大批量导入后，本地缓存全部失效，下次 loadEntities 会重新拉取
    await cacheInvalidateWorld(worldId);
    return res.data?.data as Record<string, number>;
  },

  resetAll: () => {
    set({
      abilities: emptySlice(),
      races: emptySlice(),
      professions: emptySlice(),
      backgrounds: emptySlice(),
      items: emptySlice(),
      fateClocks: emptySlice(),
      decks: emptySlice(),
      randomTables: emptySlice(),
      folders: createEmptyFolderState(),
    });
  },
}));
