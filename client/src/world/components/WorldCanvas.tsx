import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

export type TokenItem = {
  tokenId: string;
  x: number;
  y: number;
  ownerUserId?: string | null;
  characterId?: string | null;
  characterName?: string | null;
};

type WorldCanvasProps = {
  tokens: TokenItem[];
  onMoveToken: (tokenId: string, x: number, y: number, ownerUserId?: string | null, characterId?: string | null) => void;
  gridEnabled?: boolean;
  gridUnitFeet?: number;
  showHeader?: boolean;
  canDragToken?: boolean;
  selectedTokenId?: string | null;
  onSelectToken?: (tokenId: string) => void;
  onCanvasContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  onTokenContextMenu?: (event: MouseEvent<HTMLButtonElement>, token: TokenItem) => void;
};

const BOARD_WIDTH = 1120;
const BOARD_HEIGHT = 640;
const TOKEN_SIZE = 44;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type DragState = {
  tokenId: string;
  ownerUserId?: string | null;
  characterId?: string | null;
};

export function WorldCanvas({
  tokens,
  onMoveToken,
  gridEnabled = true,
  gridUnitFeet = 5,
  showHeader = true,
  canDragToken = true,
  selectedTokenId,
  onSelectToken,
  onCanvasContextMenu,
  onTokenContextMenu,
}: WorldCanvasProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    for (const token of tokens) {
      next[token.tokenId] = { x: token.x, y: token.y };
    }
    setDraftPositions(next);
  }, [tokens]);

  const gridCellSize = useMemo(() => clamp(Math.round(gridUnitFeet * 7.2), 24, 72), [gridUnitFeet]);

  const getClampedPosition = (clientX: number, clientY: number) => {
    const board = boardRef.current;
    if (!board) {
      return null;
    }

    const rect = board.getBoundingClientRect();
    const xRatio = BOARD_WIDTH / rect.width;
    const yRatio = BOARD_HEIGHT / rect.height;
    const x = clamp((clientX - rect.left) * xRatio - TOKEN_SIZE / 2, 0, BOARD_WIDTH - TOKEN_SIZE);
    const y = clamp((clientY - rect.top) * yRatio - TOKEN_SIZE / 2, 0, BOARD_HEIGHT - TOKEN_SIZE);

    return { x: Math.round(x), y: Math.round(y) };
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const position = getClampedPosition(event.clientX, event.clientY);
      if (!position) {
        return;
      }

      setDraftPositions((prev) => ({
        ...prev,
        [dragging.tokenId]: position,
      }));
    };

    const handlePointerUp = (event: PointerEvent) => {
      const position = getClampedPosition(event.clientX, event.clientY);
      if (position) {
        onMoveToken(dragging.tokenId, position.x, position.y, dragging.ownerUserId, dragging.characterId);
      }
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, onMoveToken]);

  return (
    <div className={`world-card world-canvas-card ${showHeader ? "" : "world-canvas-card--embedded"}`.trim()}>
      {showHeader ? (
        <div className="world-canvas-card__header">
          <div>
            <strong>战术场景画布</strong>
            <div className="world-canvas-card__badges">
              <span className="world-canvas-card__badge">战术视窗</span>
              <span className="world-canvas-card__badge">网格 {gridEnabled ? `${gridUnitFeet} 英尺` : "关闭"}</span>
              <span className="world-canvas-card__badge">拖拽即时同步</span>
            </div>
          </div>
          <p>拖拽 token 到目标位置，松手后自动同步到同场景。</p>
        </div>
      ) : null}
      <div
        className="world-board"
        ref={boardRef}
        onContextMenu={(event) => {
          onCanvasContextMenu?.(event);
        }}
        style={{
          backgroundImage: gridEnabled
            ? `
              linear-gradient(rgba(47, 127, 216, 0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(47, 127, 216, 0.14) 1px, transparent 1px),
              radial-gradient(circle at 30% 20%, rgba(120, 190, 255, 0.34), transparent 55%),
              radial-gradient(circle at 78% 70%, rgba(255, 183, 90, 0.26), transparent 48%),
              linear-gradient(165deg, rgba(249, 253, 255, 0.96), rgba(225, 240, 255, 0.94))
            `
            : "radial-gradient(circle at 35% 25%, rgba(120, 190, 255, 0.36), transparent 55%), radial-gradient(circle at 80% 72%, rgba(255, 183, 90, 0.24), transparent 48%), linear-gradient(165deg, rgba(249, 253, 255, 0.96), rgba(225, 240, 255, 0.94))",
          backgroundSize: gridEnabled ? `${gridCellSize}px ${gridCellSize}px, ${gridCellSize}px ${gridCellSize}px, auto, auto, auto` : "auto",
        }}
      >
        <div className="world-board__hud world-board__hud--top-left">主舞台</div>
        <div className="world-board__hud world-board__hud--top-right">{gridEnabled ? `网格 ${gridUnitFeet} 英尺` : "自由舞台"}</div>
        <div className="world-board__hud world-board__hud--bottom-left">拖拽棋子可实时调整站位</div>
        <div className="world-board__glow world-board__glow--one" />
        <div className="world-board__glow world-board__glow--two" />
        {tokens.map((token) => (
          <button
            className={`world-token ${selectedTokenId === token.tokenId ? "world-token--selected" : ""}`.trim()}
            key={token.tokenId}
            onPointerDown={(event) => {
              if (event.button !== 0 || !canDragToken) {
                return;
              }
              event.preventDefault();
              setDragging({
                tokenId: token.tokenId,
                ownerUserId: token.ownerUserId,
                characterId: token.characterId,
              });
            }}
            onClick={() => {
              onSelectToken?.(token.tokenId);
            }}
            onContextMenu={(event) => {
              onTokenContextMenu?.(event, token);
            }}
            style={{
              left: `${draftPositions[token.tokenId]?.x ?? token.x}px`,
              top: `${draftPositions[token.tokenId]?.y ?? token.y}px`,
            }}
            type="button"
            title={`${token.tokenId} (${token.x}, ${token.y})${token.ownerUserId ? ` owner=${token.ownerUserId}` : ""}${token.characterName ? ` character=${token.characterName}` : ""}`}
          >
            {token.characterName ? token.characterName.slice(0, 2).toUpperCase() : "TK"}
          </button>
        ))}
      </div>
    </div>
  );
}

