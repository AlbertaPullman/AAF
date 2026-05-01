import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Database,
  FlaskConical,
  Layers,
  Package,
  Settings,
  Shuffle,
  Swords,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";
import "../../world/styles/world-shell.css";
import {
  SystemPanelContent,
  type ToolbarButton,
  type TreeNode,
} from "../../world/components/SystemPanelContent";
import { CollectionPackPanel } from "../../world/components/system/CollectionPackPanel";
import { EntityManager } from "../../world/components/system/EntityManager";
import {
  useWorldEntityStore,
  type EntityRecord,
  type EntityType,
} from "../../world/stores/worldEntityStore";
import {
  PERMISSIONS,
  hasPermission,
  type WorldRoleType,
} from "../../../../shared/types/permissions";

type LabWorld = {
  id: string;
  name: string;
  description: string | null;
  owner?: {
    id: string;
    username: string;
    displayName: string | null;
  };
  myRole?: string;
  _count?: {
    members?: number;
    scenes?: number;
  };
};

type LabTabKey = "char" | "ability" | "item" | "random" | "collect" | "system";

type EntityEditorTarget = {
  entityType: EntityType;
  label: string;
};

type LabCharacterFolder = {
  id: string;
  name: string;
  collapsed: boolean;
};

type LabCharacter = {
  id: string;
  folderId: string;
  name: string;
  level: number;
  role: string;
  abilityIds: string[];
  itemIds: string[];
};

type LabTabConfig = {
  key: LabTabKey;
  label: string;
  Icon: LucideIcon;
};

const LAB_WORLD_STORAGE_KEY = "aaf:ability-lab:world-id";

const ENTITY_TYPES: EntityType[] = [
  "abilities",
  "races",
  "professions",
  "backgrounds",
  "items",
  "fateClocks",
  "decks",
  "randomTables",
];

const ENTITY_LABELS: Record<EntityType, string> = {
  abilities: "能力库",
  races: "种族资料",
  professions: "职业资料",
  backgrounds: "背景资料",
  items: "物品库",
  fateClocks: "命刻库",
  decks: "牌组库",
  randomTables: "随机表库",
};

const ENTITY_SHORT_LABELS: Record<EntityType, string> = {
  abilities: "能力",
  races: "种族",
  professions: "职业",
  backgrounds: "背景",
  items: "物品",
  fateClocks: "命刻",
  decks: "牌组",
  randomTables: "随机表",
};

const ENTITY_TREE_ICON: Record<EntityType, string> = {
  abilities: "能",
  races: "族",
  professions: "职",
  backgrounds: "景",
  items: "物",
  fateClocks: "刻",
  decks: "牌",
  randomTables: "表",
};

const ABILITY_CATEGORY_LABELS: Record<string, string> = {
  spell: "法术",
  combatTechnique: "战技",
  feature: "职业特性",
  racial: "种族能力",
  item: "物品能力",
  custom: "自定义",
};

const ITEM_CATEGORY_LABELS: Record<string, string> = {
  gear: "装备",
  weapon: "武器",
  armor: "护甲",
  consumable: "消耗品",
  material: "素材",
  custom: "自定义",
};

const LAB_TABS: LabTabConfig[] = [
  { key: "char", label: "角色", Icon: UserRound },
  { key: "ability", label: "能力", Icon: Wand2 },
  { key: "item", label: "物品", Icon: Package },
  { key: "random", label: "随机", Icon: Shuffle },
  { key: "collect", label: "资源包", Icon: Database },
  { key: "system", label: "系统", Icon: Settings },
];

const DEFAULT_CHARACTER_FOLDERS: LabCharacterFolder[] = [
  { id: "party", name: "测试队伍", collapsed: false },
  { id: "npc", name: "NPC 与召唤物", collapsed: false },
];

const DEFAULT_TEST_CHARACTERS: LabCharacter[] = [
  {
    id: "lab-char-a",
    folderId: "party",
    name: "能力测试角色",
    level: 1,
    role: "玩家角色",
    abilityIds: [],
    itemIds: [],
  },
  {
    id: "lab-char-b",
    folderId: "npc",
    name: "豁免测试目标",
    level: 1,
    role: "目标单位",
    abilityIds: [],
    itemIds: [],
  },
];

function canEditEntityType(role: WorldRoleType | null, entityType: EntityType) {
  switch (entityType) {
    case "abilities":
    case "races":
    case "professions":
    case "backgrounds":
      return (
        hasPermission(role, PERMISSIONS.ABILITY_CREATE) ||
        hasPermission(role, PERMISSIONS.ABILITY_EDIT) ||
        hasPermission(role, PERMISSIONS.ENTITY_CREATE) ||
        hasPermission(role, PERMISSIONS.ENTITY_EDIT)
      );
    case "items":
      return hasPermission(role, PERMISSIONS.ITEM_CREATE) || hasPermission(role, PERMISSIONS.ITEM_EDIT);
    case "fateClocks":
      return hasPermission(role, PERMISSIONS.FATE_CLOCK_CREATE);
    case "decks":
      return hasPermission(role, PERMISSIONS.DECK_CREATE);
    case "randomTables":
      return hasPermission(role, PERMISSIONS.RANDOM_TABLE_CREATE);
    default:
      return hasPermission(role, PERMISSIONS.ENTITY_CREATE) || hasPermission(role, PERMISSIONS.ENTITY_EDIT);
  }
}

function getRecordText(record: EntityRecord, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getCategoryLabel(entityType: EntityType, category: string) {
  if (entityType === "abilities") return ABILITY_CATEGORY_LABELS[category] ?? category;
  if (entityType === "items") return ITEM_CATEGORY_LABELS[category] ?? category;
  return category;
}

function getRecordMeta(entityType: EntityType, record: EntityRecord) {
  if (entityType === "abilities") {
    return getRecordText(record, "activation", getRecordText(record, "actionType", getRecordText(record, "category")));
  }
  if (entityType === "items") {
    return getRecordText(record, "subcategory", getRecordText(record, "category"));
  }
  if (entityType === "professions") {
    return getRecordText(record, "type");
  }
  if (entityType === "fateClocks") {
    const filled = Number(record.filledSegments ?? 0);
    const segments = Number(record.segments ?? 0);
    return segments > 0 ? `${filled}/${segments}` : "";
  }
  return getRecordText(record, "category", getRecordText(record, "type"));
}

function asEntityType(value: string): EntityType | null {
  return ENTITY_TYPES.includes(value as EntityType) ? (value as EntityType) : null;
}

function buildLibraryRootNode(
  entityType: EntityType,
  records: EntityRecord[],
  collapsedNodes: Set<string>
): TreeNode {
  const rootId = `library-root:${entityType}`;
  const groups = new Map<string, EntityRecord[]>();

  for (const record of records) {
    const folder = getRecordText(record, "folderPath");
    const category = getRecordText(record, "category", "未分类");
    const groupLabel = folder || getCategoryLabel(entityType, category) || "未分类";
    groups.set(groupLabel, [...(groups.get(groupLabel) ?? []), record]);
  }

  const children: TreeNode[] =
    records.length === 0
      ? [
          {
            id: `empty:${entityType}`,
            type: "leaf",
            icon: "+",
            label: `创建${ENTITY_SHORT_LABELS[entityType]}`,
            meta: "0",
          },
        ]
      : [...groups.entries()]
          .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"))
          .map(([label, items]) => {
            const groupId = `library-group:${entityType}:${label}`;
            return {
              id: groupId,
              type: "dir" as const,
              icon: "目",
              label,
              meta: `${items.length}`,
              collapsed: collapsedNodes.has(groupId),
              children: items
                .slice()
                .sort((left, right) =>
                  getRecordText(left, "name", "未命名").localeCompare(getRecordText(right, "name", "未命名"), "zh-Hans-CN")
                )
                .map((item) => ({
                  id: `entity:${entityType}:${item.id}`,
                  type: "leaf" as const,
                  icon: ENTITY_TREE_ICON[entityType],
                  label: getRecordText(item, "name", "未命名"),
                  meta: getRecordMeta(entityType, item),
                })),
            };
          });

  return {
    id: rootId,
    type: "dir",
    icon: ENTITY_TREE_ICON[entityType],
    label: ENTITY_SHORT_LABELS[entityType],
    meta: `${records.length}`,
    collapsed: collapsedNodes.has(rootId),
    children,
  };
}

function buildCharacterTree(
  folders: LabCharacterFolder[],
  characters: LabCharacter[],
  activeFolderId: string,
  selectedCharacterId: string | null
): TreeNode[] {
  return folders.map((folder) => {
    const children = characters.filter((character) => character.folderId === folder.id);
    return {
      id: `char-folder:${folder.id}`,
      type: "dir" as const,
      icon: "目",
      label: folder.name,
      meta: `${children.length}`,
      active: activeFolderId === folder.id,
      collapsed: folder.collapsed,
      children: children.map((character) => ({
        id: `char:${character.id}`,
        type: "leaf" as const,
        icon: "角",
        label: character.name,
        meta: `Lv.${character.level}`,
        active: selectedCharacterId === character.id,
      })),
    };
  });
}

function joinRecordNames(records: EntityRecord[]) {
  if (records.length === 0) return "未绑定";
  return records.map((record) => getRecordText(record, "name", "未命名")).join("、");
}

export default function AbilityLabPage() {
  const navigate = useNavigate();
  const { worldId: routeWorldId } = useParams<{ worldId?: string }>();
  const user = useAuthStore((state) => state.user);
  const loadEntities = useWorldEntityStore((state) => state.loadEntities);
  const resetWorldEntities = useWorldEntityStore((state) => state.resetAll);
  const abilityRecords = useWorldEntityStore((state) => state.abilities.items);
  const raceRecords = useWorldEntityStore((state) => state.races.items);
  const professionRecords = useWorldEntityStore((state) => state.professions.items);
  const backgroundRecords = useWorldEntityStore((state) => state.backgrounds.items);
  const itemRecords = useWorldEntityStore((state) => state.items.items);
  const fateClockRecords = useWorldEntityStore((state) => state.fateClocks.items);
  const deckRecords = useWorldEntityStore((state) => state.decks.items);
  const randomTableRecords = useWorldEntityStore((state) => state.randomTables.items);

  const [worlds, setWorlds] = useState<LabWorld[]>([]);
  const [worldsLoading, setWorldsLoading] = useState(false);
  const [worldsError, setWorldsError] = useState<string | null>(null);
  const [manualWorldId, setManualWorldId] = useState(routeWorldId ?? "");
  const [activeTab, setActiveTab] = useState<LabTabKey>("ability");
  const [activeEditor, setActiveEditor] = useState<EntityEditorTarget | null>({
    entityType: "abilities",
    label: ENTITY_LABELS.abilities,
  });
  const [resourceCollapsedNodes, setResourceCollapsedNodes] = useState<Set<string>>(() => new Set());
  const [characterFolders, setCharacterFolders] = useState<LabCharacterFolder[]>(DEFAULT_CHARACTER_FOLDERS);
  const [activeCharacterFolderId, setActiveCharacterFolderId] = useState(DEFAULT_CHARACTER_FOLDERS[0].id);
  const [testCharacters, setTestCharacters] = useState<LabCharacter[]>(DEFAULT_TEST_CHARACTERS);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(DEFAULT_TEST_CHARACTERS[0].id);

  const selectedWorldId = routeWorldId ?? "";
  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId),
    [selectedWorldId, worlds]
  );
  const role = useMemo<WorldRoleType | null>(() => {
    if (selectedWorld?.myRole) return selectedWorld.myRole as WorldRoleType;
    if (selectedWorld?.owner?.id && selectedWorld.owner.id === user?.id) return "GM";
    return null;
  }, [selectedWorld, user?.id]);

  const recordsByType = useMemo<Record<EntityType, EntityRecord[]>>(
    () => ({
      abilities: abilityRecords,
      races: raceRecords,
      professions: professionRecords,
      backgrounds: backgroundRecords,
      items: itemRecords,
      fateClocks: fateClockRecords,
      decks: deckRecords,
      randomTables: randomTableRecords,
    }),
    [
      abilityRecords,
      backgroundRecords,
      deckRecords,
      fateClockRecords,
      itemRecords,
      professionRecords,
      raceRecords,
      randomTableRecords,
    ]
  );

  const selectedCharacter = useMemo(
    () => testCharacters.find((character) => character.id === selectedCharacterId) ?? null,
    [selectedCharacterId, testCharacters]
  );

  const selectedCharacterAbilities = useMemo(() => {
    if (!selectedCharacter) return [];
    return abilityRecords.filter((record) => selectedCharacter.abilityIds.includes(record.id));
  }, [abilityRecords, selectedCharacter]);

  const selectedCharacterItems = useMemo(() => {
    if (!selectedCharacter) return [];
    return itemRecords.filter((record) => selectedCharacter.itemIds.includes(record.id));
  }, [itemRecords, selectedCharacter]);

  const canEditTarget = useCallback(
    (entityType: EntityType) => {
      if (!selectedWorldId) return false;
      if (!selectedWorld) return true;
      return canEditEntityType(role, entityType);
    },
    [role, selectedWorld, selectedWorldId]
  );

  const openEntityEditor = useCallback((entityType: EntityType) => {
    setActiveEditor({ entityType, label: ENTITY_LABELS[entityType] });
  }, []);

  const loadWorlds = useCallback(async () => {
    setWorldsLoading(true);
    setWorldsError(null);
    try {
      const res = await http.get("/worlds", { params: { scope: "mine" } });
      setWorlds(res.data?.data ?? []);
    } catch (err) {
      setWorldsError(err instanceof Error ? err.message : "世界列表加载失败");
    } finally {
      setWorldsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorlds();
  }, [loadWorlds]);

  useEffect(() => {
    if (routeWorldId || worldsLoading || worlds.length === 0) return;
    const remembered = window.localStorage.getItem(LAB_WORLD_STORAGE_KEY);
    const fallbackWorldId = remembered && worlds.some((world) => world.id === remembered) ? remembered : worlds[0].id;
    window.localStorage.setItem(LAB_WORLD_STORAGE_KEY, fallbackWorldId);
    navigate(`/system/ability-lab/${fallbackWorldId}`, { replace: true });
  }, [navigate, routeWorldId, worlds, worldsLoading]);

  useEffect(() => {
    setManualWorldId(routeWorldId ?? "");
    if (routeWorldId) {
      window.localStorage.setItem(LAB_WORLD_STORAGE_KEY, routeWorldId);
    }
  }, [routeWorldId]);

  useEffect(() => {
    if (!selectedWorldId) return;
    void Promise.all(ENTITY_TYPES.map((entityType) => loadEntities(selectedWorldId, entityType)));
  }, [loadEntities, selectedWorldId]);

  useEffect(() => {
    return () => resetWorldEntities();
  }, [resetWorldEntities]);

  const abilityTree = useMemo<TreeNode[]>(
    () =>
      [
        buildLibraryRootNode("abilities", abilityRecords, resourceCollapsedNodes),
        buildLibraryRootNode("races", raceRecords, resourceCollapsedNodes),
        buildLibraryRootNode("professions", professionRecords, resourceCollapsedNodes),
        buildLibraryRootNode("backgrounds", backgroundRecords, resourceCollapsedNodes),
      ],
    [abilityRecords, backgroundRecords, professionRecords, raceRecords, resourceCollapsedNodes]
  );

  const itemTree = useMemo<TreeNode[]>(
    () => [buildLibraryRootNode("items", itemRecords, resourceCollapsedNodes)],
    [itemRecords, resourceCollapsedNodes]
  );

  const randomTree = useMemo<TreeNode[]>(
    () =>
      [
        buildLibraryRootNode("randomTables", randomTableRecords, resourceCollapsedNodes),
        buildLibraryRootNode("decks", deckRecords, resourceCollapsedNodes),
        buildLibraryRootNode("fateClocks", fateClockRecords, resourceCollapsedNodes),
      ],
    [deckRecords, fateClockRecords, randomTableRecords, resourceCollapsedNodes]
  );

  const characterTree = useMemo<TreeNode[]>(
    () => buildCharacterTree(characterFolders, testCharacters, activeCharacterFolderId, selectedCharacterId),
    [activeCharacterFolderId, characterFolders, selectedCharacterId, testCharacters]
  );

  const toggleResourceNode = useCallback((nodeId: string) => {
    setResourceCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const toggleCharacterFolder = useCallback((nodeId: string) => {
    const folderId = nodeId.replace("char-folder:", "");
    setCharacterFolders((prev) =>
      prev.map((folder) =>
        folder.id === folderId ? { ...folder, collapsed: !folder.collapsed } : folder
      )
    );
  }, []);

  const createCharacterFolder = useCallback(() => {
    const name = window.prompt("目录名，例如：前台角色/临时目标");
    const trimmed = name?.trim();
    if (!trimmed) return;
    const folderId = `folder-${Date.now()}`;
    setCharacterFolders((prev) => [...prev, { id: folderId, name: trimmed, collapsed: false }]);
    setActiveCharacterFolderId(folderId);
  }, []);

  const createTestCharacter = useCallback(() => {
    const name = `测试角色 ${testCharacters.length + 1}`;
    const id = `lab-char-${Date.now()}`;
    const nextCharacter: LabCharacter = {
      id,
      folderId: activeCharacterFolderId,
      name,
      level: 1,
      role: "测试单位",
      abilityIds: [],
      itemIds: [],
    };
    setTestCharacters((prev) => [...prev, nextCharacter]);
    setSelectedCharacterId(id);
  }, [activeCharacterFolderId, testCharacters.length]);

  const updateSelectedCharacterLinks = useCallback(
    (kind: "abilityIds" | "itemIds", recordId: string) => {
      if (!selectedCharacterId) return;
      setTestCharacters((prev) =>
        prev.map((character) => {
          if (character.id !== selectedCharacterId || character[kind].includes(recordId)) return character;
          return { ...character, [kind]: [...character[kind], recordId] };
        })
      );
    },
    [selectedCharacterId]
  );

  const removeSelectedCharacterLink = useCallback(
    (kind: "abilityIds" | "itemIds", recordId: string) => {
      if (!selectedCharacterId) return;
      setTestCharacters((prev) =>
        prev.map((character) => {
          if (character.id !== selectedCharacterId) return character;
          return { ...character, [kind]: character[kind].filter((id) => id !== recordId) };
        })
      );
    },
    [selectedCharacterId]
  );

  const handleTreeNodeToggle = useCallback(
    (nodeId: string) => {
      if (nodeId.startsWith("char-folder:")) {
        toggleCharacterFolder(nodeId);
        return;
      }
      toggleResourceNode(nodeId);
    },
    [toggleCharacterFolder, toggleResourceNode]
  );

  const handleTreeNodeClick = useCallback(
    (node: TreeNode) => {
      if (node.id.startsWith("char-folder:")) {
        setActiveCharacterFolderId(node.id.replace("char-folder:", ""));
        return;
      }
      if (node.id.startsWith("char:")) {
        setSelectedCharacterId(node.id.replace("char:", ""));
        setActiveTab("char");
        return;
      }
      if (node.type === "dir") return;
      if (node.id.startsWith("empty:")) {
        const entityType = asEntityType(node.id.replace("empty:", ""));
        if (entityType) openEntityEditor(entityType);
        return;
      }
      if (node.id.startsWith("entity:")) {
        const [, entityTypeValue] = node.id.split(":");
        const entityType = asEntityType(entityTypeValue);
        if (entityType) openEntityEditor(entityType);
      }
    },
    [openEntityEditor]
  );

  const applyManualWorldId = useCallback(() => {
    const trimmed = manualWorldId.trim();
    if (!trimmed) return;
    window.localStorage.setItem(LAB_WORLD_STORAGE_KEY, trimmed);
    navigate(`/system/ability-lab/${trimmed}`);
  }, [manualWorldId, navigate]);

  const selectWorld = useCallback(
    (nextWorldId: string) => {
      if (!nextWorldId) return;
      window.localStorage.setItem(LAB_WORLD_STORAGE_KEY, nextWorldId);
      navigate(`/system/ability-lab/${nextWorldId}`);
    },
    [navigate]
  );

  const abilityToolbarButtons = useMemo<ToolbarButton[]>(
    () => [
      { label: "新 建 能 力", variant: "gold", onClick: () => openEntityEditor("abilities") },
      { label: "种 族", onClick: () => openEntityEditor("races") },
      { label: "职 业", onClick: () => openEntityEditor("professions") },
      { label: "背 景", onClick: () => openEntityEditor("backgrounds") },
    ],
    [openEntityEditor]
  );

  const itemToolbarButtons = useMemo<ToolbarButton[]>(
    () => [
      { label: "新 建 物 品", variant: "gold", onClick: () => openEntityEditor("items") },
      { label: "物 品 库", onClick: () => openEntityEditor("items") },
    ],
    [openEntityEditor]
  );

  const randomToolbarButtons = useMemo<ToolbarButton[]>(
    () => [
      { label: "随 机 表", variant: "gold", onClick: () => openEntityEditor("randomTables") },
      { label: "牌 组", variant: "blue", onClick: () => openEntityEditor("decks") },
      { label: "命 刻", onClick: () => openEntityEditor("fateClocks") },
    ],
    [openEntityEditor]
  );

  const characterToolbarButtons = useMemo<ToolbarButton[]>(
    () => [
      { label: "新 建 角 色", variant: "gold", onClick: createTestCharacter },
      { label: "新 建 目 录", onClick: createCharacterFolder },
    ],
    [createCharacterFolder, createTestCharacter]
  );

  const renderSystemPanelBody = () => {
    if (activeTab === "collect") {
      return (
        <SystemPanelContent activeTab="collect">
          {selectedWorldId ? (
            <CollectionPackPanel worldId={selectedWorldId} canEdit={canEditTarget("abilities")} />
          ) : (
            <div className="ability-lab-empty">请选择测试世界。</div>
          )}
        </SystemPanelContent>
      );
    }

    if (activeTab === "system") {
      return (
        <SystemPanelContent activeTab="system">
          <div className="ability-lab-system-block">
            <label>
              <span>测试世界</span>
              <select
                value={selectedWorldId}
                onChange={(event) => selectWorld(event.target.value)}
                disabled={worldsLoading || worlds.length === 0}
              >
                <option value="">{worldsLoading ? "加载中" : "选择世界"}</option>
                {worlds.map((world) => (
                  <option value={world.id} key={world.id}>
                    {world.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ability-lab-world-id">
              <input
                value={manualWorldId}
                onChange={(event) => setManualWorldId(event.target.value)}
                placeholder="手动输入 worldId"
              />
              <button type="button" className="sc-btn" onClick={applyManualWorldId}>
                接入
              </button>
            </div>
            {worldsError && <p className="ability-lab-error">{worldsError}</p>}
          </div>
          <div className="ability-lab-stats">
            {ENTITY_TYPES.map((entityType) => (
              <button
                type="button"
                className="ability-lab-stat"
                key={entityType}
                onClick={() => openEntityEditor(entityType)}
              >
                <span>{ENTITY_SHORT_LABELS[entityType]}</span>
                <strong>{recordsByType[entityType].length}</strong>
              </button>
            ))}
          </div>
        </SystemPanelContent>
      );
    }

    if (activeTab === "char") {
      return (
        <SystemPanelContent
          activeTab="char"
          toolbarButtons={characterToolbarButtons}
          treeData={characterTree}
          footerNote="角色栏为实验页本地测试数据；能力、物品来自当前世界资源库。"
          onTreeNodeClick={handleTreeNodeClick}
          onTreeNodeToggle={handleTreeNodeToggle}
        />
      );
    }

    if (activeTab === "item") {
      return (
        <SystemPanelContent
          activeTab="item"
          toolbarButtons={itemToolbarButtons}
          treeData={itemTree}
          footerNote="分类在物品库左侧创建，条目保存到当前世界。"
          onTreeNodeClick={handleTreeNodeClick}
          onTreeNodeToggle={handleTreeNodeToggle}
        />
      );
    }

    if (activeTab === "random") {
      return (
        <SystemPanelContent
          activeTab="random"
          toolbarButtons={randomToolbarButtons}
          treeData={randomTree}
          footerNote="随机表、牌组和命刻暂作为能力触发资源的候选库。"
          onTreeNodeClick={handleTreeNodeClick}
          onTreeNodeToggle={handleTreeNodeToggle}
        />
      );
    }

    return (
      <SystemPanelContent
        activeTab="ability"
        toolbarButtons={abilityToolbarButtons}
        treeData={abilityTree}
        footerNote="能力、种族、职业和背景共用模板编辑器，支持目录分类与可视化规则配置。"
        onTreeNodeClick={handleTreeNodeClick}
        onTreeNodeToggle={handleTreeNodeToggle}
      />
    );
  };

  const renderCharacterWorkbench = () => {
    if (!selectedCharacter) {
      return (
        <div className="ability-lab-character-empty">
          <UserRound size={20} />
          <span>未选择测试角色</span>
        </div>
      );
    }

    return (
      <div className="ability-lab-character-sheet">
        <div className="ability-lab-character-sheet__head">
          <div>
            <span>{selectedCharacter.role}</span>
            <h2>{selectedCharacter.name}</h2>
          </div>
          <strong>Lv.{selectedCharacter.level}</strong>
        </div>
        <div className="ability-lab-loadout">
          <section>
            <h3>已绑定能力</h3>
            <p>{joinRecordNames(selectedCharacterAbilities)}</p>
            <div className="ability-lab-token-list">
              {selectedCharacterAbilities.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() => removeSelectedCharacterLink("abilityIds", record.id)}
                >
                  {getRecordText(record, "name", "未命名")}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3>携带物品</h3>
            <p>{joinRecordNames(selectedCharacterItems)}</p>
            <div className="ability-lab-token-list">
              {selectedCharacterItems.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  onClick={() => removeSelectedCharacterLink("itemIds", record.id)}
                >
                  {getRecordText(record, "name", "未命名")}
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="ability-lab-binding-pool">
          <section>
            <h3>能力快捷绑定</h3>
            <div>
              {abilityRecords.slice(0, 12).map((record) => (
                <button
                  type="button"
                  className="sc-btn"
                  key={record.id}
                  onClick={() => updateSelectedCharacterLinks("abilityIds", record.id)}
                >
                  {getRecordText(record, "name", "未命名")}
                </button>
              ))}
              {abilityRecords.length === 0 && <span>能力库暂无条目</span>}
            </div>
          </section>
          <section>
            <h3>物品快捷绑定</h3>
            <div>
              {itemRecords.slice(0, 12).map((record) => (
                <button
                  type="button"
                  className="sc-btn"
                  key={record.id}
                  onClick={() => updateSelectedCharacterLinks("itemIds", record.id)}
                >
                  {getRecordText(record, "name", "未命名")}
                </button>
              ))}
              {itemRecords.length === 0 && <span>物品库暂无条目</span>}
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="world-shell ability-lab-page">
      <header className="ability-lab-header">
        <div className="ability-lab-header__title">
          <FlaskConical size={22} />
          <div>
            <span>内部测试</span>
            <h1>能力系统实验室</h1>
          </div>
        </div>
        <div className="ability-lab-header__world">
          <select
            value={selectedWorldId}
            onChange={(event) => selectWorld(event.target.value)}
            disabled={worldsLoading || worlds.length === 0}
          >
            <option value="">{worldsLoading ? "加载世界中" : "选择测试世界"}</option>
            {worlds.map((world) => (
              <option value={world.id} key={world.id}>
                {world.name}
              </option>
            ))}
          </select>
          <button type="button" className="sc-btn" onClick={() => navigate("/lobby")}>
            大厅
          </button>
          {selectedWorldId && (
            <button type="button" className="sc-btn sc-btn--gold" onClick={() => navigate(`/world/${selectedWorldId}`)}>
              进入世界
            </button>
          )}
        </div>
      </header>

      <main className="ability-lab-layout">
        <aside className="ability-lab-character-rail">
          <div className="ability-lab-panel-title">
            <UserRound size={18} />
            <strong>角色栏</strong>
          </div>
          <SystemPanelContent
            activeTab="char"
            toolbarButtons={characterToolbarButtons}
            treeData={characterTree}
            onTreeNodeClick={handleTreeNodeClick}
            onTreeNodeToggle={handleTreeNodeToggle}
          />
        </aside>

        <section className="ability-lab-stage">
          <div className="ability-lab-stage__top">
            <div>
              <span>{selectedWorld?.name ?? (selectedWorldId ? "手动世界" : "未选择世界")}</span>
              <h2>{activeEditor?.label ?? "能力系统调试"}</h2>
            </div>
            <div className="ability-lab-quick-actions">
              <button type="button" className="sc-btn sc-btn--gold" onClick={() => openEntityEditor("abilities")}>
                能力
              </button>
              <button type="button" className="sc-btn" onClick={() => openEntityEditor("races")}>
                种族
              </button>
              <button type="button" className="sc-btn" onClick={() => openEntityEditor("professions")}>
                职业
              </button>
              <button type="button" className="sc-btn" onClick={() => openEntityEditor("items")}>
                物品
              </button>
            </div>
          </div>

          <div className="ability-lab-workspace">
            {selectedWorldId && activeEditor ? (
              <EntityManager
                worldId={selectedWorldId}
                entityType={activeEditor.entityType}
                label={activeEditor.label}
                canEdit={canEditTarget(activeEditor.entityType)}
              />
            ) : (
              <div className="ability-lab-empty ability-lab-empty--large">
                <Layers size={32} />
                <span>选择一个测试世界后开始编辑能力库。</span>
              </div>
            )}
          </div>

          <div className="ability-lab-bottom">
            <div className="ability-lab-panel-title">
              <Swords size={18} />
              <strong>角色绑定预览</strong>
            </div>
            {renderCharacterWorkbench()}
          </div>
        </section>

        <aside className="sys-panel ability-lab-system-panel">
          <div className="ability-lab-tabs">
            {LAB_TABS.map(({ key, label, Icon }) => (
              <button
                type="button"
                className={`ability-lab-tab ${activeTab === key ? "is-active" : ""}`}
                onClick={() => setActiveTab(key)}
                key={key}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="sys-body">{renderSystemPanelBody()}</div>
        </aside>
      </main>
    </div>
  );
}
