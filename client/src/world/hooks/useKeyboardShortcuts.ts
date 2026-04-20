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

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

function modifiersMatch(binding: KeyBinding, event: KeyboardEvent | MouseEvent) {
  return (
    Boolean(binding.ctrl) === event.ctrlKey &&
    Boolean(binding.shift) === event.shiftKey &&
    Boolean(binding.alt) === event.altKey &&
    Boolean(binding.meta) === event.metaKey
  );
}

function parseMouseButton(key: string) {
  const match = /^Mouse(\d+)$/i.exec(key);
  return match ? Number(match[1]) : null;
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

      if (!ignoreInputFocus && isEditableTarget(e.target)) {
        return;
      }

      const match = bindings.find((b) => {
        if (b.disabled) return false;
        if (b.device && b.device !== "keyboard") return false;
        if (MODIFIER_KEYS.has(e.key)) return false;
        if (b.key.toLowerCase() !== e.key.toLowerCase() && b.key.toLowerCase() !== e.code.toLowerCase()) return false;
        return modifiersMatch(b, e);
      });

      if (match) {
        e.preventDefault();
        e.stopPropagation();
        onActionRef.current(match.action);
      }
    },
    [enabled, bindings, ignoreInputFocus]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;

      if (!ignoreInputFocus && isEditableTarget(e.target)) {
        return;
      }

      const match = bindings.find((b) => {
        if (b.disabled) return false;
        if (b.device !== "mouse") return false;
        const button = typeof b.button === "number" ? b.button : parseMouseButton(b.key);
        if (button !== e.button) return false;
        return modifiersMatch(b, e);
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
    window.addEventListener("mousedown", handleMouseDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown, true);
    };
  }, [enabled, handleKeyDown, handleMouseDown]);

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
