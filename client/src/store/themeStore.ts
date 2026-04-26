import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SYSTEM_DEFAULT_THEME,
  THEME_PACKS,
  ThemePackId,
  applyThemePack,
  isKnownPack,
  resolveThemePack,
} from "../lib/theme";

type ThemeState = {
  /** User's personal preference. Only takes effect when current world uses the system default pack. */
  userPreference: ThemePackId;
  /** Pack declared by the active world (if any). */
  worldPack: ThemePackId | null;
  /** Whether the world's GM forced this pack on everyone. */
  worldPackForcedByGM: boolean;
  /** The currently effective pack after precedence resolution. Mirror of <html data-theme>. */
  effective: ThemePackId;

  /** Player picks a personal preference (lobby/profile screen). */
  setUserPreference: (id: ThemePackId) => void;
  /** Called when entering a world — pass world's pack settings. */
  enterWorld: (input: { worldPack: ThemePackId | null; forcedByGM: boolean }) => void;
  /** Called when leaving a world (back to lobby) — reverts to user preference. */
  leaveWorld: () => void;

  availablePacks: typeof THEME_PACKS;
};

function recompute(state: Pick<ThemeState, "userPreference" | "worldPack" | "worldPackForcedByGM">): ThemePackId {
  const id = resolveThemePack({
    worldPack: state.worldPack,
    worldPackForcedByGM: state.worldPackForcedByGM,
    userPreference: state.userPreference,
  });
  applyThemePack(id);
  return id;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      userPreference: SYSTEM_DEFAULT_THEME,
      worldPack: null,
      worldPackForcedByGM: false,
      effective: SYSTEM_DEFAULT_THEME,
      availablePacks: THEME_PACKS,

      setUserPreference: (id) => {
        if (!isKnownPack(id)) return;
        const next = { ...get(), userPreference: id };
        set({ userPreference: id, effective: recompute(next) });
      },

      enterWorld: ({ worldPack, forcedByGM }) => {
        const safePack = worldPack && isKnownPack(worldPack) ? worldPack : null;
        const next = { ...get(), worldPack: safePack, worldPackForcedByGM: forcedByGM };
        set({
          worldPack: safePack,
          worldPackForcedByGM: forcedByGM,
          effective: recompute(next),
        });
      },

      leaveWorld: () => {
        const next = { ...get(), worldPack: null, worldPackForcedByGM: false };
        set({ worldPack: null, worldPackForcedByGM: false, effective: recompute(next) });
      },
    }),
    {
      name: "theme-storage",
      partialize: (state) => ({ userPreference: state.userPreference }),
      onRehydrateStorage: () => (state) => {
        // After persisted state loads, apply theme to <html>.
        if (state) {
          state.effective = recompute(state);
        }
      },
    },
  ),
);

/** Apply once on app boot, before React renders, to avoid a flash. */
export function bootstrapTheme(): void {
  const stored = (() => {
    try {
      const raw = localStorage.getItem("theme-storage");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.userPreference ?? null;
    } catch {
      return null;
    }
  })();

  const id = isKnownPack(stored ?? "") ? (stored as ThemePackId) : SYSTEM_DEFAULT_THEME;
  applyThemePack(id);
}
