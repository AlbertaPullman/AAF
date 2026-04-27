/**
 * Theme pack registry + applier.
 *
 * Pack precedence (highest → lowest):
 *   1. GM-forced world pack (when a world has `themePack` set, it overrides everyone in that world)
 *   2. World default pack (set by world creator, players can override only if pack is the system default)
 *   3. User preference (only takes effect when world pack is the system default)
 *   4. System default = "jrpg-bright"
 *
 * To register a new pack:
 *   1. Add the CSS file under `client/src/styles/themes/<id>.css`
 *   2. Import it in `client/src/main.tsx` (or via index.css)
 *   3. Add an entry to THEME_PACKS below
 */

export type ThemePackId = "jrpg-bright" | "dark-arcane" | (string & {});

export type ThemePack = {
  id: ThemePackId;
  label: string;
  description: string;
  /** Whether ordinary players can pick this pack as a personal preference. */
  userSelectable: boolean;
};

export const SYSTEM_DEFAULT_THEME: ThemePackId = "jrpg-bright";

export const THEME_PACKS: ThemePack[] = [
  {
    id: "jrpg-bright",
    label: "JRPG 明亮",
    description: "蓝白橙基调的明亮幻想冒险风格（系统默认）",
    userSelectable: true,
  },
  {
    id: "dark-arcane",
    label: "暗影秘典",
    description: "深紫深蓝基调的暗黑奥术风格（验证 token 覆盖完整性）",
    userSelectable: true,
  },
];

export function isKnownPack(id: string): id is ThemePackId {
  return THEME_PACKS.some((p) => p.id === id);
}

/**
 * Resolve the effective theme given the precedence rules.
 */
export function resolveThemePack(input: {
  worldPack?: string | null;
  worldPackForcedByGM?: boolean;
  userPreference?: string | null;
}): ThemePackId {
  const { worldPack, worldPackForcedByGM, userPreference } = input;

  // 1. GM forces world pack
  if (worldPack && worldPackForcedByGM && isKnownPack(worldPack)) {
    return worldPack;
  }

  // 2. World default (non-system) takes precedence over user preference
  if (worldPack && worldPack !== SYSTEM_DEFAULT_THEME && isKnownPack(worldPack)) {
    return worldPack;
  }

  // 3. User preference (only effective when world is using the system default)
  if (userPreference && isKnownPack(userPreference)) {
    return userPreference;
  }

  return SYSTEM_DEFAULT_THEME;
}

/**
 * Apply a pack by setting <html data-theme="...">. Idempotent.
 */
export function applyThemePack(id: ThemePackId): void {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== id) {
    root.setAttribute("data-theme", id);
  }
}
