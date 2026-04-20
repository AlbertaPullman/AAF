import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

export type FloatingToolWindowPlacement = {
  left: number;
  top: number;
  width: number;
  zIndex: number;
};

type FloatingToolWindowProps = {
  id: string;
  title: string;
  placement: FloatingToolWindowPlacement;
  componentName: string;
  compact?: boolean;
  onMove: (id: string, next: { left: number; top: number }) => void;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  children: ReactNode;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function FloatingToolWindow({
  id,
  title,
  placement,
  componentName,
  compact,
  onMove,
  onFocus,
  onClose,
  children,
}: FloatingToolWindowProps) {
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const maxLeft = Math.max(12, window.innerWidth - placement.width - 12);
      const maxTop = Math.max(12, window.innerHeight - 120);
      onMove(id, {
        left: clamp(drag.startLeft + event.clientX - drag.startX, 12, maxLeft),
        top: clamp(drag.startTop + event.clientY - drag.startY, 12, maxTop),
      });
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [id, onMove, placement.width]);

  const onHeaderPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    onFocus(id);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: placement.left,
      startTop: placement.top,
    };
  };

  return (
    <section
      className={`world-tool-window ${compact ? "world-tool-window--compact" : ""}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      data-world-layer="floating-window"
      data-world-component={componentName}
      style={{
        "--tool-window-left": `${placement.left}px`,
        "--tool-window-top": `${placement.top}px`,
        "--tool-window-width": `${placement.width}px`,
        zIndex: placement.zIndex,
      } as CSSProperties}
      onMouseDown={() => onFocus(id)}
    >
      <div className="world-tool-window__head" onPointerDown={onHeaderPointerDown}>
        <strong>{title}</strong>
        <button
          type="button"
          className="world-tool-window__close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onClose(id)}
        >
          关闭
        </button>
      </div>
      <div className="world-tool-window__body">{children}</div>
    </section>
  );
}
