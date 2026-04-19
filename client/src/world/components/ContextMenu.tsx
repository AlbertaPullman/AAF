/**
 * ???????
 *
 * ?????????????????????
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ContextMenuItem, ContextMenuArea } from "../../../../shared/types/world-entities";
import type { PermissionKey, WorldRoleType } from "../../../../shared/types/permissions";
import { hasPermission } from "../../../../shared/types/permissions";

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  area: ContextMenuArea;
  role: WorldRoleType | null;
  onAction: (action: string, area: ContextMenuArea, targetId?: string) => void;
  onClose: () => void;
  targetId?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  position,
  area,
  role,
  onAction,
  onClose,
  targetId,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [position, onClose]);

  const adjustedPosition = useCallback(() => {
    if (!position || !menuRef.current) return position;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: position.x + rect.width > vw ? vw - rect.width - 4 : position.x,
      y: position.y + rect.height > vh ? vh - rect.height - 4 : position.y,
    };
  }, [position]);

  const filteredItems = items.filter((item) => {
    if (item.requiredPermission) {
      return hasPermission(role, item.requiredPermission as PermissionKey);
    }
    return true;
  });

  if (!position || filteredItems.length === 0) return null;

  const pos = adjustedPosition() ?? position;

  return (
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      aria-label="?????"
    >
      {filteredItems.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="ctx-menu__divider" role="separator" />;
        }

        const hasChildren = item.children && item.children.length > 0;

        return (
          <div
            key={item.id}
            className="ctx-menu__item-wrapper"
            onMouseEnter={() => hasChildren && setSubmenuOpen(item.id)}
            onMouseLeave={() => hasChildren && setSubmenuOpen(null)}
          >
            <button
              type="button"
              role="menuitem"
              className={[
                "ctx-menu__item",
                item.disabled && "ctx-menu__item--disabled",
                item.danger && "ctx-menu__item--danger",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={item.disabled}
              onClick={() => {
                if (item.action && !item.disabled) {
                  onAction(item.action, area, targetId);
                  onClose();
                }
              }}
            >
              {item.icon && <span className="ctx-menu__icon">{item.icon}</span>}
              <span className="ctx-menu__label">{item.label}</span>
              {item.shortcut && <span className="ctx-menu__shortcut">{item.shortcut}</span>}
              {hasChildren && <span className="ctx-menu__arrow">?</span>}
            </button>

            {hasChildren && submenuOpen === item.id && (
              <div className="ctx-menu ctx-menu--sub" role="menu">
                {item.children!.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    role="menuitem"
                    className={[
                      "ctx-menu__item",
                      child.disabled && "ctx-menu__item--disabled",
                      child.danger && "ctx-menu__item--danger",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={child.disabled}
                    onClick={() => {
                      if (child.action && !child.disabled) {
                        onAction(child.action, area, targetId);
                        onClose();
                      }
                    }}
                  >
                    {child.icon && <span className="ctx-menu__icon">{child.icon}</span>}
                    <span className="ctx-menu__label">{child.label}</span>
                    {child.shortcut && <span className="ctx-menu__shortcut">{child.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface ContextMenuState {
  position: { x: number; y: number } | null;
  area: ContextMenuArea;
  targetId?: string;
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    position: null,
    area: "canvas",
  });

  const open = useCallback((e: React.MouseEvent, area: ContextMenuArea, targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ position: { x: e.clientX, y: e.clientY }, area, targetId });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, position: null }));
  }, []);

  return { ...state, open, close };
}
