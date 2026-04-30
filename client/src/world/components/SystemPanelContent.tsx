import { useState, type ReactNode } from "react";
import {
  Map as MapIcon,
  Users,
  Zap,
  Package,
  Shuffle,
  Music,
  Settings,
  MessageSquare,
  Swords,
  ChevronDown,
} from "lucide-react";

// ========== 类型定义 ==========

export type SystemTabKey =
  | "scene"
  | "char"
  | "ability"
  | "item"
  | "random"
  | "music"
  | "collect"
  | "chat"
  | "battle"
  | "system";

export type TreeNodeType = "dir" | "leaf";

export interface TreeNode {
  id: string;
  type: TreeNodeType;
  icon?: string;
  label: string;
  meta?: string;
  tagType?: "foe" | "npc" | "ok";
  children?: TreeNode[];
  collapsed?: boolean;
  active?: boolean;
}

export interface ToolbarButton {
  label: string;
  variant?: "gold" | "blue" | "danger" | "default";
  onClick: () => void;
}

export interface SystemPanelContentProps {
  activeTab: SystemTabKey;
  toolbarButtons?: ToolbarButton[];
  treeData?: TreeNode[];
  footerNote?: string;
  onTreeNodeClick?: (node: TreeNode) => void;
  onTreeNodeToggle?: (nodeId: string) => void;
  children?: ReactNode;
}

// ========== 工具栏组件 ==========

function ResToolbar({ buttons }: { buttons: ToolbarButton[] }) {
  if (buttons.length === 0) return null;

  return (
    <div className="res-toolbar">
      {buttons.map((btn, idx) => (
        <button
          key={idx}
          type="button"
          className={`sc-btn ${btn.variant ? `sc-btn--${btn.variant}` : ""}`.trim()}
          onClick={btn.onClick}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

// ========== 目录树组件 ==========

interface ResTreeProps {
  nodes: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  onNodeToggle?: (nodeId: string) => void;
}

function ResTree({ nodes, onNodeClick, onNodeToggle }: ResTreeProps) {
  if (nodes.length === 0) return null;

  return (
    <div className="res-tree">
      <TreeNodeList nodes={nodes} onNodeClick={onNodeClick} onNodeToggle={onNodeToggle} />
    </div>
  );
}

function TreeNodeList({
  nodes,
  onNodeClick,
  onNodeToggle,
}: {
  nodes: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  onNodeToggle?: (nodeId: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
          onNodeToggle={onNodeToggle}
        />
      ))}
    </ul>
  );
}

function TreeNodeItem({
  node,
  onNodeClick,
  onNodeToggle,
}: {
  node: TreeNode;
  onNodeClick?: (node: TreeNode) => void;
  onNodeToggle?: (nodeId: string) => void;
}) {
  const handleClick = () => {
    if (node.type === "dir" && onNodeToggle) {
      onNodeToggle(node.id);
    }
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <>
      <li
        className={`${node.type} ${node.collapsed ? "collapsed" : ""} ${node.active ? "active" : ""}`.trim()}
        onClick={handleClick}
      >
        {node.type === "dir" && <span className="caret">▾</span>}
        {node.icon && <span className="ic">{node.icon}</span>}
        <span>{node.label}</span>
        {node.meta && (
          <span className={`meta ${node.tagType ? `tag-${node.tagType}` : ""}`.trim()}>
            {node.meta}
          </span>
        )}
      </li>
      {node.type === "dir" && node.children && !node.collapsed && (
        <TreeNodeList nodes={node.children} onNodeClick={onNodeClick} onNodeToggle={onNodeToggle} />
      )}
    </>
  );
}

// ========== 主组件 ==========

export function SystemPanelContent({
  activeTab,
  toolbarButtons = [],
  treeData = [],
  footerNote,
  onTreeNodeClick,
  onTreeNodeToggle,
  children,
}: SystemPanelContentProps) {
  // 如果提供了 children，直接渲染（用于聊天、战斗等特殊 tab）
  if (children) {
    return <div className="sys-body__content">{children}</div>;
  }

  // 否则渲染标准的 toolbar + tree 结构
  return (
    <div className="sys-body__content">
      <ResToolbar buttons={toolbarButtons} />
      <ResTree nodes={treeData} onNodeClick={onTreeNodeClick} onNodeToggle={onTreeNodeToggle} />
      {footerNote && (
        <div className="res-tree-footer" style={{ color: "var(--sc-ink-mute)", marginTop: "8px", fontSize: "11px" }}>
          {footerNote}
        </div>
      )}
    </div>
  );
}

// ========== 默认数据生成器（示例） ==========

export function getDefaultToolbarButtons(tab: SystemTabKey): ToolbarButton[] {
  switch (tab) {
    case "scene":
      return [
        { label: "新 建 场 景", variant: "gold", onClick: () => console.log("新建场景") },
        { label: "新 建 目 录", onClick: () => console.log("新建目录") },
        { label: "导 入", onClick: () => console.log("导入") },
        { label: "导 出", onClick: () => console.log("导出") },
      ];
    case "char":
      return [
        { label: "新 建 角 色", variant: "gold", onClick: () => console.log("新建角色") },
        { label: "新 建 目 录", onClick: () => console.log("新建目录") },
        { label: "导 入", onClick: () => console.log("导入") },
        { label: "导 出", onClick: () => console.log("导出") },
      ];
    case "ability":
      return [
        { label: "新 建 能 力", variant: "gold", onClick: () => console.log("新建能力") },
        { label: "新 建 目 录", onClick: () => console.log("新建目录") },
        { label: "DSL 编 辑", onClick: () => console.log("DSL 编辑") },
        { label: "导 入", onClick: () => console.log("导入") },
        { label: "导 出", onClick: () => console.log("导出") },
      ];
    case "item":
      return [
        { label: "新 建 物 品", variant: "gold", onClick: () => console.log("新建物品") },
        { label: "新 建 目 录", onClick: () => console.log("新建目录") },
        { label: "导 入", onClick: () => console.log("导入") },
        { label: "导 出", onClick: () => console.log("导出") },
      ];
    case "random":
      return [
        { label: "新 建 随 机 表", variant: "gold", onClick: () => console.log("新建随机表") },
        { label: "新 建 牌 堆", variant: "blue", onClick: () => console.log("新建牌堆") },
        { label: "新 建 目 录", onClick: () => console.log("新建目录") },
        { label: "导 入", onClick: () => console.log("导入") },
        { label: "导 出", onClick: () => console.log("导出") },
      ];
    case "music":
      return [
        { label: "🎵 导 入 音 乐", variant: "gold", onClick: () => console.log("导入音乐") },
        { label: "新 建 歌 单", onClick: () => console.log("新建歌单") },
        { label: "导 出 歌 单", onClick: () => console.log("导出歌单") },
      ];
    default:
      return [];
  }
}

export function getDefaultTreeData(tab: SystemTabKey): TreeNode[] {
  switch (tab) {
    case "scene":
      return [
        {
          id: "scene-battle",
          type: "dir",
          icon: "⚔️",
          label: "战 斗 场 景",
          meta: "3",
          children: [
            { id: "scene-1", type: "leaf", icon: "🏰", label: "王城广场", meta: "Boss", tagType: "foe" },
            { id: "scene-2", type: "leaf", icon: "🌲", label: "暗影森林", meta: "遭遇", tagType: "foe" },
            { id: "scene-3", type: "leaf", icon: "🏞️", label: "魔王之棺", meta: "Boss", tagType: "foe" },
          ],
        },
        {
          id: "scene-resource",
          type: "dir",
          icon: "📁",
          label: "资 源 场 景",
          meta: "5",
          collapsed: true,
          children: [
            { id: "scene-4", type: "leaf", icon: "🏪", label: "旅店 · 月购市集" },
          ],
        },
      ];
    case "char":
      return [
        {
          id: "char-party",
          type: "dir",
          icon: "👥",
          label: "玩 家 队 伍",
          meta: "3",
          children: [
            { id: "char-1", type: "leaf", icon: "🛡️", label: "莉雅 · 圣骑士 12", meta: "绑定", tagType: "ok", active: true },
            { id: "char-2", type: "leaf", icon: "🏹", label: "奥森 · 游侠 11", meta: "绑定", tagType: "ok" },
            { id: "char-3", type: "leaf", icon: "✨", label: "塔莎 · 法师 10", meta: "绑定", tagType: "ok" },
          ],
        },
        {
          id: "char-npc",
          type: "dir",
          icon: "👥",
          label: "NPC · 友方",
          meta: "2",
          children: [
            { id: "char-4", type: "leaf", icon: "👨‍🌾", label: "贾老丈", meta: "村长", tagType: "npc" },
            { id: "char-5", type: "leaf", icon: "🧙", label: "魅影", meta: "资信", tagType: "npc" },
          ],
        },
        {
          id: "char-monster",
          type: "dir",
          icon: "👿",
          label: "怪 物 · 本 局",
          meta: "3",
          children: [
            { id: "char-6", type: "leaf", icon: "🗡️", label: "暗影刺客", meta: "CR 4", tagType: "foe" },
            { id: "char-7", type: "leaf", icon: "💀", label: "骷髅兵 ×3", meta: "CR ½", tagType: "foe" },
            { id: "char-8", type: "leaf", icon: "🐉", label: "梦魇龙", meta: "Boss", tagType: "foe" },
          ],
        },
        {
          id: "char-bestiary",
          type: "dir",
          icon: "📁",
          label: "怪 物 图 鉴",
          meta: "42",
          collapsed: true,
          children: [],
        },
      ];
    case "ability":
      return [
        {
          id: "ability-class",
          type: "dir",
          icon: "📜",
          label: "职 业 特 性",
          meta: "8",
          children: [
            { id: "ability-1", type: "leaf", icon: "🛡️", label: "圣盾姿态", meta: "姿态" },
            { id: "ability-2", type: "leaf", icon: "⚔️", label: "强力攻击", meta: "被动" },
          ],
        },
        {
          id: "ability-spell",
          type: "dir",
          icon: "📜",
          label: "法 术",
          meta: "12",
          children: [
            { id: "ability-3", type: "leaf", icon: "🔥", label: "火球术", meta: "3 环" },
            { id: "ability-4", type: "leaf", icon: "✨", label: "神圣打击", meta: "1 环" },
            { id: "ability-5", type: "leaf", icon: "💧", label: "治疗术", meta: "1 环" },
          ],
        },
        {
          id: "ability-status",
          type: "dir",
          icon: "📜",
          label: "状 态",
          meta: "6",
          collapsed: true,
          children: [],
        },
        {
          id: "ability-trigger",
          type: "dir",
          icon: "📜",
          label: "触 发 器",
          meta: "4",
          collapsed: true,
          children: [],
        },
      ];
    case "item":
      return [
        {
          id: "item-weapon",
          type: "dir",
          icon: "⚔️",
          label: "武 器",
          meta: "8",
          children: [
            { id: "item-1", type: "leaf", icon: "🗡️", label: "圣光长剑 +1", meta: "稀有", tagType: "ok" },
            { id: "item-2", type: "leaf", icon: "🏹", label: "风之长弓", meta: "普通" },
          ],
        },
        {
          id: "item-armor",
          type: "dir",
          icon: "🛡️",
          label: "防 具",
          meta: "5",
          children: [
            { id: "item-3", type: "leaf", icon: "🛡️", label: "秩序之盾", meta: "稀有", tagType: "ok" },
            { id: "item-4", type: "leaf", icon: "🦺", label: "板甲", meta: "普通" },
          ],
        },
        {
          id: "item-consumable",
          type: "dir",
          icon: "🧪",
          label: "消 耗 品",
          meta: "12",
          children: [
            { id: "item-5", type: "leaf", icon: "🧪", label: "治疗药水", meta: "绑 「治疗」" },
            { id: "item-6", type: "leaf", icon: "📜", label: "火球卷轴", meta: "1 次性" },
          ],
        },
        {
          id: "item-magic",
          type: "dir",
          icon: "🔮",
          label: "魔 法 道 具",
          meta: "7",
          collapsed: true,
          children: [],
        },
        {
          id: "item-treasure",
          type: "dir",
          icon: "💰",
          label: "财 宝",
          meta: "17",
          collapsed: true,
          children: [],
        },
      ];
    case "random":
      return [
        {
          id: "random-table",
          type: "dir",
          icon: "📜",
          label: "随 机 表",
          meta: "4",
          children: [
            { id: "random-1", type: "leaf", icon: "📜", label: "旅店 NPC 名字", meta: "d20" },
            { id: "random-2", type: "leaf", icon: "📜", label: "路上遭遇", meta: "d12" },
            { id: "random-3", type: "leaf", icon: "📜", label: "宝箱掉落", meta: "d100" },
            { id: "random-4", type: "leaf", icon: "📜", label: "天气", meta: "d6" },
          ],
        },
        {
          id: "random-deck",
          type: "dir",
          icon: "🃏",
          label: "牌 堆",
          meta: "3",
          children: [
            { id: "random-5", type: "leaf", icon: "🃏", label: "塔罗", meta: "22 张" },
            { id: "random-6", type: "leaf", icon: "🃏", label: "命运", meta: "52 张" },
            { id: "random-7", type: "leaf", icon: "🃏", label: "随机遇袭", meta: "36 张" },
          ],
        },
      ];
    default:
      return [];
  }
}
