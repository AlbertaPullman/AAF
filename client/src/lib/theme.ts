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

export type ThemePackId =
  | "jrpg-bright"
  | "dark-arcane"
  | "crimson-dynasty"
  | "verdant-forest"
  | "noir-cyber"
  | "parchment-quill"
  | "frost-dawn"
  | (string & {});

export type ThemePack = {
  id: ThemePackId;
  label: string;
  description: string;
  /** Short tone tag for the picker preview (e.g. 明亮 / 暗黑 / 古典). */
  tone: string;
  /** Inline preview swatches (3 hex), used by the theme picker card. */
  swatches: [string, string, string];
  /** Whether ordinary players can pick this pack as a personal preference. */
  userSelectable: boolean;
};

export const SYSTEM_DEFAULT_THEME: ThemePackId = "jrpg-bright";

export const THEME_PACKS: ThemePack[] = [
  {
    id: "jrpg-bright",
    label: "碧空圣典",
    description: "蓝 / 白 / 橙——明亮幻想冒险的系统默认。",
    tone: "明亮 · 默认",
    swatches: ["#1274ff", "#fff7ec", "#f59e0b"],
    userSelectable: true,
  },
  {
    id: "dark-arcane",
    label: "暗影秘典",
    description: "深蓝 / 紫 / 银——暗黑奥术与神秘学。",
    tone: "暗黑 · 奥术",
    swatches: ["#0a1226", "#6cb9ff", "#c084fc"],
    userSelectable: true,
  },
  {
    id: "crimson-dynasty",
    label: "朱砂王朝",
    description: "朱红 / 鎏金 / 墨黑——东方古典宫廷武侠。",
    tone: "古典 · 东方",
    swatches: ["#2a0d0d", "#daa550", "#d62828"],
    userSelectable: true,
  },
  {
    id: "verdant-forest",
    label: "翠野秘林",
    description: "苔绿 / 米黄 / 赤土——森系自然与德鲁伊。",
    tone: "自然 · 森系",
    swatches: ["#4d8a3e", "#f3f6e9", "#c8541a"],
    userSelectable: true,
  },
  {
    id: "noir-cyber",
    label: "霓虹回路",
    description: "黑 / 电青 / 品红——赛博朋克与黑客之夜。",
    tone: "赛博 · 黑夜",
    swatches: ["#0a0a1f", "#00dcff", "#ff3cc8"],
    userSelectable: true,
  },
  {
    id: "parchment-quill",
    label: "羊皮卷宗",
    description: "米黄 / 棕墨 / 暗金——古卷学究与占星师。",
    tone: "古卷 · 学究",
    swatches: ["#f3e3b8", "#8a5a18", "#b03020"],
    userSelectable: true,
  },
  {
    id: "frost-dawn",
    label: "霜晓极光",
    description: "冰蓝 / 银白 / 极光紫——北境冰原与极地。",
    tone: "极地 · 冷调",
    swatches: ["#e8f4ff", "#3a8fcf", "#9b7ad6"],
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
