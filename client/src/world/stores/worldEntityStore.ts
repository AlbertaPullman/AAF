/**
 * 世界实体数据 Store (Zustand)
 *
 * 管理能力、种族、职业、背景、物品、命刻等实体数据的CRUD状态
 */

import { create } from "zustand";
import { http } from "../../lib/http";

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

interface WorldEntityState {
  abilities: EntitySlice;
  races: EntitySlice;
  professions: EntitySlice;
  backgrounds: EntitySlice;
  items: EntitySlice;
  fateClocks: EntitySlice;
  decks: EntitySlice;
  randomTables: EntitySlice;

  // 通用加载
  loadEntities: (worldId: string, type: EntityType) => Promise<void>;
  createEntity: (worldId: string, type: EntityType, data: Record<string, unknown>) => Promise<EntityRecord>;
  updateEntity: (worldId: string, type: EntityType, id: string, data: Record<string, unknown>) => Promise<EntityRecord>;
  deleteEntity: (worldId: string, type: EntityType, id: string) => Promise<void>;

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

export const useWorldEntityStore = create<WorldEntityState>((set, get) => ({
  abilities: emptySlice(),
  races: emptySlice(),
  professions: emptySlice(),
  backgrounds: emptySlice(),
  items: emptySlice(),
  fateClocks: emptySlice(),
  decks: emptySlice(),
  randomTables: emptySlice(),

  loadEntities: async (worldId, type) => {
    set((s) => ({ [type]: { ...s[type], loading: true, error: null } }));
    try {
      const res = await http.get(`/worlds/${worldId}/${API_PATHS[type]}`);
      const items = res.data?.data ?? [];
      set({ [type]: { items, loading: false, error: null } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载失败";
      set((s) => ({ [type]: { ...s[type], loading: false, error: msg } }));
    }
  },

  createEntity: async (worldId, type, data) => {
    const res = await http.post(`/worlds/${worldId}/${API_PATHS[type]}`, data);
    const created = res.data?.data as EntityRecord;
    set((s) => ({ [type]: { ...s[type], items: [...s[type].items, created] } }));
    return created;
  },

  updateEntity: async (worldId, type, id, data) => {
    const res = await http.put(`/worlds/${worldId}/${API_PATHS[type]}/${id}`, data);
    const updated = res.data?.data as EntityRecord;
    set((s) => ({
      [type]: {
        ...s[type],
        items: s[type].items.map((it) => (it.id === id ? updated : it)),
      },
    }));
    return updated;
  },

  deleteEntity: async (worldId, type, id) => {
    await http.delete(`/worlds/${worldId}/${API_PATHS[type]}/${id}`);
    set((s) => ({
      [type]: {
        ...s[type],
        items: s[type].items.filter((it) => it.id !== id),
      },
    }));
  },

  advanceFateClock: async (worldId, id, amount, reason) => {
    const res = await http.patch(`/worlds/${worldId}/fate-clocks/${id}/advance`, { amount, reason });
    const updated = res.data?.data as EntityRecord;
    set((s) => ({
      fateClocks: {
        ...s.fateClocks,
        items: s.fateClocks.items.map((it) => (it.id === id ? updated : it)),
      },
    }));
  },

  exportPack: async (worldId) => {
    const res = await http.get(`/worlds/${worldId}/collection-pack`);
    return res.data?.data;
  },

  importPack: async (worldId, pack) => {
    const res = await http.post(`/worlds/${worldId}/collection-pack/import`, pack);
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
    });
  },
}));
