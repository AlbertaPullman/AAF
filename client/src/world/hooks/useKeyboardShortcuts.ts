/**
 * ??????? Hook
 */

import { useCallback, useEffect, useRef } from "react";
import type { KeyBinding } from "../../../../shared/types/world-entities";
import { DEFAULT_KEYBINDINGS } from "../../../../shared/types/world-entities";

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  customBindings?: KeyBinding[];
  onAction: (action: string) => void;
  /** ????????????????? false? */
  ignoreInputFocus?: boolean;
}

export function useKeyboardShortcuts({
  enabled,
  customBindings,
  onAction,
  ignoreInputFocus = false,
}: UseKeyboardShortcutsOptions) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const bindings = customBindings ?? DEFAULT_KEYBINDINGS;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      if (!ignoreInputFocus) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
      }

      const match = bindings.find((b) => {
        if (b.key.toLowerCase() !== e.key.toLowerCase()) return false;
        if (b.ctrl && !e.ctrlKey) return false;
        if (b.shift && !e.shiftKey) return false;
        if (b.alt && !e.altKey) return false;
        if (!b.ctrl && e.ctrlKey) return false;
        if (!b.shift && e.shiftKey) return false;
        if (!b.alt && e.altKey) return false;
        return true;
      });

      if (match) {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current(match.action);
      }
    },
    [enabled, bindings, ignoreInputFocus]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  useEffect(() => {
    if (!enabled) return;
    const preventCtxMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".world-stage-shell")) {
        e.preventDefault();
      }
    };
    window.addEventListener("contextmenu", preventCtxMenu);
    return () => window.removeEventListener("contextmenu", preventCtxMenu);
  }, [enabled]);
}
