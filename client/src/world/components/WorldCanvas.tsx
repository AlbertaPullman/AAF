import type { MouseEvent } from "react";

type TokenItem = {
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
};

const BOARD_WIDTH = 640;
const BOARD_HEIGHT = 360;
const TOKEN_SIZE = 40;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WorldCanvas({ tokens, onMoveToken }: WorldCanvasProps) {
  const handleTokenDrag = (event: MouseEvent<HTMLButtonElement>, tokenId: string) => {
    const board = event.currentTarget.parentElement;
    if (!board) {
      return;
    }

    const rect = board.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left - TOKEN_SIZE / 2, 0, BOARD_WIDTH - TOKEN_SIZE);
    const y = clamp(event.clientY - rect.top - TOKEN_SIZE / 2, 0, BOARD_HEIGHT - TOKEN_SIZE);
    const token = tokens.find((item) => item.tokenId === tokenId);
    onMoveToken(tokenId, Math.round(x), Math.round(y), token?.ownerUserId, token?.characterId);
  };

  return (
    <div className="world-card">
      <strong>WorldCanvas</strong>
      <p>点击 token 快速移动（阶段 6 最小交互）。</p>
      <div className="world-board">
        {tokens.map((token) => (
          <button
            className="world-token"
            key={token.tokenId}
            onClick={(event) => handleTokenDrag(event, token.tokenId)}
            style={{ left: `${token.x}px`, top: `${token.y}px` }}
            type="button"
            title={`${token.tokenId} (${token.x}, ${token.y})${token.ownerUserId ? ` owner=${token.ownerUserId}` : ""}${token.characterName ? ` character=${token.characterName}` : ""}`}
          >
            T
          </button>
        ))}
      </div>
    </div>
  );
}