/**
 * ?????? - ??????
 *
 * ???????????GM > ASSISTANT > PLAYER > OBSERVER
 */

export type WorldRoleType = "GM" | "ASSISTANT" | "PLAYER" | "OBSERVER";

/** ?????? */
export const PERMISSIONS = {
  // ????
  SYSTEM_VIEW_SETTINGS: "system:view:settings",
  SYSTEM_EDIT_SETTINGS: "system:edit:settings",
  SYSTEM_MANAGE_EXTENSIONS: "system:manage:extensions",
  SYSTEM_MANAGE_PLUGINS: "system:manage:plugins",
  SYSTEM_VIEW_WORLD_INFO: "system:view:worldInfo",
  SYSTEM_EDIT_WORLD_INFO: "system:edit:worldInfo",
  SYSTEM_MANAGE_PLAYERS: "system:manage:players",
  SYSTEM_IMPORT_COLLECTION: "system:import:collection",

  // ????
  ABILITY_VIEW: "ability:view",
  ABILITY_CREATE: "ability:create",
  ABILITY_EDIT: "ability:edit",
  ABILITY_DELETE: "ability:delete",

  // ??/??/??
  ENTITY_VIEW: "entity:view",
  ENTITY_CREATE: "entity:create",
  ENTITY_EDIT: "entity:edit",
  ENTITY_DELETE: "entity:delete",

  // ??
  ITEM_VIEW: "item:view",
  ITEM_CREATE: "item:create",
  ITEM_EDIT: "item:edit",
  ITEM_DELETE: "item:delete",

  // ??
  SCENE_VIEW: "scene:view",
  SCENE_CREATE: "scene:create",
  SCENE_EDIT: "scene:edit",
  SCENE_DELETE: "scene:delete",
  SCENE_SWITCH: "scene:switch",
  SCENE_EDIT_VISUAL: "scene:edit:visual",

  // ??
  COMBAT_VIEW_INITIATIVE: "combat:view:initiative",
  COMBAT_MANAGE: "combat:manage",
  COMBAT_ROLL_INITIATIVE: "combat:roll:initiative",
  COMBAT_ADVANCE_TURN: "combat:advance:turn",

  // Token/??
  TOKEN_MOVE_OWN: "token:move:own",
  TOKEN_MOVE_ANY: "token:move:any",
  TOKEN_CREATE: "token:create",
  TOKEN_DELETE: "token:delete",

  // ???
  CHARACTER_VIEW_OWN: "character:view:own",
  CHARACTER_VIEW_ALL: "character:view:all",
  CHARACTER_CREATE: "character:create",
  CHARACTER_EDIT_OWN: "character:edit:own",
  CHARACTER_EDIT_ALL: "character:edit:all",
  CHARACTER_DELETE: "character:delete",

  // ??
  CHAT_SEND: "chat:send",
  CHAT_VIEW: "chat:view",
  CHAT_MANAGE_CHANNELS: "chat:manage:channels",
  CHAT_SEND_SYSTEM: "chat:send:system",

  // ??
  FATE_CLOCK_VIEW: "fateClock:view",
  FATE_CLOCK_CREATE: "fateClock:create",
  FATE_CLOCK_ADVANCE: "fateClock:advance",
  FATE_CLOCK_DELETE: "fateClock:delete",

  // ??
  LOG_VIEW: "log:view",
  LOG_VIEW_ALL: "log:view:all",

  // ??/???
  DECK_VIEW: "deck:view",
  DECK_CREATE: "deck:create",
  DECK_DRAW: "deck:draw",
  RANDOM_TABLE_VIEW: "randomTable:view",
  RANDOM_TABLE_CREATE: "randomTable:create",
  RANDOM_TABLE_ROLL: "randomTable:roll",

  // ??
  MEASURE_PLACE: "measure:place",
  MEASURE_REMOVE: "measure:remove",

  // ??
  DRAW_ON_MAP: "draw:onMap",
  DRAW_REMOVE: "draw:remove",

  // HUD
  HUD_CUSTOMIZE: "hud:customize",

  // ??
  MUSIC_CONTROL: "music:control",
  MUSIC_LISTEN: "music:listen",

  // ??
  VISION_SEE_HIDDEN: "vision:see:hidden",
  VISION_SEE_INVISIBLE: "vision:see:invisible",
  VISION_SEE_GM_NOTES: "vision:see:gmNotes",
  VISION_GOD_MODE: "vision:godMode",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const GM_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

const ASSISTANT_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.SYSTEM_VIEW_SETTINGS,
  PERMISSIONS.SYSTEM_MANAGE_EXTENSIONS,
  PERMISSIONS.SYSTEM_VIEW_WORLD_INFO,
  PERMISSIONS.ABILITY_VIEW,
  PERMISSIONS.ENTITY_VIEW,
  PERMISSIONS.ITEM_VIEW,
  PERMISSIONS.SCENE_VIEW,
  PERMISSIONS.COMBAT_VIEW_INITIATIVE,
  PERMISSIONS.COMBAT_ROLL_INITIATIVE,
  PERMISSIONS.TOKEN_MOVE_OWN,
  PERMISSIONS.TOKEN_MOVE_ANY,
  PERMISSIONS.CHARACTER_VIEW_OWN,
  PERMISSIONS.CHARACTER_VIEW_ALL,
  PERMISSIONS.CHARACTER_CREATE,
  PERMISSIONS.CHARACTER_EDIT_OWN,
  PERMISSIONS.CHAT_SEND,
  PERMISSIONS.CHAT_VIEW,
  PERMISSIONS.FATE_CLOCK_VIEW,
  PERMISSIONS.LOG_VIEW,
  PERMISSIONS.DECK_VIEW,
  PERMISSIONS.DECK_DRAW,
  PERMISSIONS.RANDOM_TABLE_VIEW,
  PERMISSIONS.RANDOM_TABLE_ROLL,
  PERMISSIONS.MEASURE_PLACE,
  PERMISSIONS.MEASURE_REMOVE,
  PERMISSIONS.DRAW_ON_MAP,
  PERMISSIONS.DRAW_REMOVE,
  PERMISSIONS.HUD_CUSTOMIZE,
  PERMISSIONS.MUSIC_LISTEN,
];

const PLAYER_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.ABILITY_VIEW,
  PERMISSIONS.ENTITY_VIEW,
  PERMISSIONS.ITEM_VIEW,
  PERMISSIONS.SCENE_VIEW,
  PERMISSIONS.SCENE_SWITCH,
  PERMISSIONS.COMBAT_VIEW_INITIATIVE,
  PERMISSIONS.TOKEN_MOVE_OWN,
  PERMISSIONS.CHARACTER_VIEW_OWN,
  PERMISSIONS.CHARACTER_CREATE,
  PERMISSIONS.CHARACTER_EDIT_OWN,
  PERMISSIONS.CHAT_SEND,
  PERMISSIONS.CHAT_VIEW,
  PERMISSIONS.FATE_CLOCK_VIEW,
  PERMISSIONS.LOG_VIEW,
  PERMISSIONS.DECK_VIEW,
  PERMISSIONS.DECK_DRAW,
  PERMISSIONS.RANDOM_TABLE_VIEW,
  PERMISSIONS.RANDOM_TABLE_ROLL,
  PERMISSIONS.MEASURE_PLACE,
  PERMISSIONS.HUD_CUSTOMIZE,
  PERMISSIONS.MUSIC_LISTEN,
];

const OBSERVER_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.ABILITY_VIEW,
  PERMISSIONS.ENTITY_VIEW,
  PERMISSIONS.ITEM_VIEW,
  PERMISSIONS.SCENE_VIEW,
  PERMISSIONS.COMBAT_VIEW_INITIATIVE,
  PERMISSIONS.CHARACTER_VIEW_ALL,
  PERMISSIONS.CHAT_VIEW,
  PERMISSIONS.FATE_CLOCK_VIEW,
  PERMISSIONS.LOG_VIEW,
  PERMISSIONS.DECK_VIEW,
  PERMISSIONS.RANDOM_TABLE_VIEW,
  PERMISSIONS.MUSIC_LISTEN,
];

const ROLE_PERMISSION_MAP: Record<WorldRoleType, Set<PermissionKey>> = {
  GM: new Set(GM_PERMISSIONS),
  ASSISTANT: new Set(ASSISTANT_PERMISSIONS),
  PLAYER: new Set(PLAYER_PERMISSIONS),
  OBSERVER: new Set(OBSERVER_PERMISSIONS),
};

export function hasPermission(role: WorldRoleType | null, permission: PermissionKey): boolean {
  if (!role) return false;
  return ROLE_PERMISSION_MAP[role]?.has(permission) ?? false;
}

export function hasAllPermissions(role: WorldRoleType | null, permissions: PermissionKey[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function hasAnyPermission(role: WorldRoleType | null, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** ???? Tab ??? */
export const SYSTEM_TAB_VISIBILITY: Record<
  string,
  { minRole: WorldRoleType; requiredPermissions?: PermissionKey[] }
> = {
  chat: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.CHAT_VIEW] },
  battle: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.COMBAT_VIEW_INITIATIVE] },
  scene: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.SCENE_VIEW] },
  character: { minRole: "OBSERVER" },
  item: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.ITEM_VIEW] },
  log: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.LOG_VIEW] },
  random: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.RANDOM_TABLE_VIEW] },
  deck: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.DECK_VIEW] },
  music: { minRole: "OBSERVER", requiredPermissions: [PERMISSIONS.MUSIC_LISTEN] },
  pack: { minRole: "GM", requiredPermissions: [PERMISSIONS.SYSTEM_IMPORT_COLLECTION] },
  system: { minRole: "OBSERVER" },
};

const ROLE_HIERARCHY: Record<WorldRoleType, number> = {
  GM: 4,
  ASSISTANT: 3,
  PLAYER: 2,
  OBSERVER: 1,
};

export function meetsMinRole(role: WorldRoleType | null, minRole: WorldRoleType): boolean {
  if (!role) return false;
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

export function isTabVisible(tabKey: string, role: WorldRoleType | null): boolean {
  const config = SYSTEM_TAB_VISIBILITY[tabKey];
  if (!config) return true;
  if (!meetsMinRole(role, config.minRole)) return false;
  if (config.requiredPermissions) {
    return hasAllPermissions(role, config.requiredPermissions);
  }
  return true;
}
