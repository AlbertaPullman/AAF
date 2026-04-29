/**
 * 命刻组件 - FateClockWidget
 *
 * 可配置 4-12 刻度的环形刻度盘
 * 支持推进/回退，带历史记录
 */

import React, { useCallback, useState } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings } from "lucide-react";

interface FateClockWidgetProps {
  id: string;
  name: string;
  description?: string;
  segments: number;
  filledSegments: number;
  direction: "advance" | "countdown";
  status: "active" | "completed" | "failed" | "paused";
  successThreshold?: number;
  failureThreshold?: number;
  visibleToPlayers: boolean;
  canEdit: boolean;
  onAdvance?: (id: string, amount: number, reason: string) => void;
  onDelete?: (id: string) => void;
}

export const FateClockWidget: React.FC<FateClockWidgetProps> = ({
  id,
  name,
  segments,
  filledSegments,
  canEdit,
  onAdvance,
}) => {
  const [reason] = useState("");

  const handleAdvance = useCallback(
    (amount: number) => {
      onAdvance?.(id, amount, reason);
    },
    [id, reason, onAdvance]
  );

  return (
    <div className="fate-dial" aria-label={`命刻: ${name}`}>
      <div className="label-cn">命 运 刻 度</div>
      <div className="dial-ring" data-total={segments} data-current={filledSegments}>
        <div className="dial-inner">
          <div className="dial-num">
            {filledSegments}
            <small>/{segments}</small>
          </div>
          <div className="dial-name">{name}</div>
        </div>
      </div>
      {canEdit && (
        <div className="fate-controls">
          <button type="button" className="fate-btn" title="上一个">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button type="button" className="fate-btn" title="下一个">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button type="button" className="fate-btn" title="减刻度" onClick={() => handleAdvance(-1)}>
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button type="button" className="fate-btn" title="加刻度" onClick={() => handleAdvance(1)}>
            <ChevronRight className="w-3 h-3" />
          </button>
          <button type="button" className="fate-btn" title="设置">
            <Settings className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
