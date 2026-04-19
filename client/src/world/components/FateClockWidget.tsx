/**
 * 命刻组件 - FateClockWidget
 *
 * 可配置 4-12 刻度的环形刻度盘
 * 支持推进/回退，带历史记录
 */

import React, { useCallback, useMemo, useState } from "react";

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
  description,
  segments,
  filledSegments,
  direction,
  status,
  successThreshold,
  failureThreshold,
  canEdit,
  onAdvance,
  onDelete,
}) => {
  const [reason, setReason] = useState("");

  const cx = 50;
  const cy = 50;
  const r = 40;

  const segmentPaths = useMemo(() => {
    const paths: { d: string; filled: boolean; isThreshold: boolean }[] = [];
    const anglePerSeg = (Math.PI * 2) / segments;
    const gap = 0.02; // 小间距

    for (let i = 0; i < segments; i++) {
      const startAngle = i * anglePerSeg - Math.PI / 2 + gap;
      const endAngle = (i + 1) * anglePerSeg - Math.PI / 2 - gap;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const innerR = r * 0.55;
      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(startAngle);
      const y4 = cy + innerR * Math.sin(startAngle);

      const largeArc = anglePerSeg - 2 * gap > Math.PI ? 1 : 0;

      const d = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        `Z`,
      ].join(" ");

      const filled = i < filledSegments;
      const isThreshold =
        (successThreshold != null && i + 1 === successThreshold) ||
        (failureThreshold != null && i + 1 === failureThreshold);

      paths.push({ d, filled, isThreshold });
    }
    return paths;
  }, [segments, filledSegments, successThreshold, failureThreshold]);

  const handleAdvance = useCallback(
    (amount: number) => {
      onAdvance?.(id, amount, reason);
      setReason("");
    },
    [id, reason, onAdvance]
  );

  const statusLabel = status === "completed" ? "已完成" : status === "failed" ? "已失败" : status === "paused" ? "已暂停" : "进行中";
  const dirLabel = direction === "advance" ? "推进" : "倒计时";

  return (
    <div className={`fate-clock fate-clock--${status}`} aria-label={`命刻: ${name}`}>
      <div className="fate-clock__header">
        <h4 className="fate-clock__name">{name}</h4>
        <span className="fate-clock__meta">
          {dirLabel} · {statusLabel} · {filledSegments}/{segments}
        </span>
      </div>

      <svg className="fate-clock__ring" viewBox="0 0 100 100" aria-hidden="true">
        {segmentPaths.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            className={[
              "fate-clock__segment",
              seg.filled && "fate-clock__segment--filled",
              seg.isThreshold && "fate-clock__segment--threshold",
            ].filter(Boolean).join(" ")}
          />
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" className="fate-clock__center-text">
          {filledSegments}
        </text>
      </svg>

      {description && <p className="fate-clock__desc">{description}</p>}

      {canEdit && status === "active" && (
        <div className="fate-clock__controls">
          <input
            className="fate-clock__reason"
            type="text"
            placeholder="推进原因..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="fate-clock__btns">
            <button type="button" className="fate-clock__btn fate-clock__btn--retreat" onClick={() => handleAdvance(-1)}>
              -1
            </button>
            <button type="button" className="fate-clock__btn fate-clock__btn--advance" onClick={() => handleAdvance(1)}>
              +1
            </button>
            <button type="button" className="fate-clock__btn fate-clock__btn--advance2" onClick={() => handleAdvance(2)}>
              +2
            </button>
          </div>
        </div>
      )}

      {canEdit && onDelete && (
        <button type="button" className="fate-clock__delete" onClick={() => onDelete(id)}>
          删除命刻
        </button>
      )}
    </div>
  );
};
