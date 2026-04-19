/**
 * 资源包导入/导出面板
 *
 * 提供 JSON 格式资源包的导入、导出和预览功能
 */

import React, { useCallback, useRef, useState } from "react";
import { useWorldEntityStore } from "../../stores/worldEntityStore";

interface CollectionPackPanelProps {
  worldId: string;
  canEdit: boolean;
}

export const CollectionPackPanel: React.FC<CollectionPackPanelProps> = ({
  worldId,
  canEdit,
}) => {
  const store = useWorldEntityStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  // 导出
  const handleExport = useCallback(async () => {
    setExporting(true);
    setResult(null);
    try {
      const pack = await store.exportPack(worldId);
      const json = JSON.stringify(pack, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `world-pack-${worldId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setResult({ type: "success", message: "资源包已导出" });
    } catch (err) {
      setResult({ type: "error", message: `导出失败: ${err instanceof Error ? err.message : "未知错误"}` });
    } finally {
      setExporting(false);
    }
  }, [worldId, store]);

  // 选择文件
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        setPreview(data);
        setResult(null);
      } catch {
        setResult({ type: "error", message: "无法解析JSON文件" });
        setPreview(null);
      }
    };
    reader.readAsText(file);
    // 重置input以允许重复选择同一文件
    e.target.value = "";
  }, []);

  // 导入
  const handleImport = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    setResult(null);
    try {
      const counts = await store.importPack(worldId, preview as Record<string, unknown>);
      const msgs = Object.entries(counts)
        .filter(([, count]) => (count as number) > 0)
        .map(([type, count]) => `${typeLabel(type)}: ${count}条`);
      setResult({ type: "success", message: `导入成功! ${msgs.join(", ")}` });
      setPreview(null);
      // 刷新所有实体
      await Promise.all([
        store.loadEntities(worldId, "abilities"),
        store.loadEntities(worldId, "races"),
        store.loadEntities(worldId, "professions"),
        store.loadEntities(worldId, "backgrounds"),
        store.loadEntities(worldId, "items"),
        store.loadEntities(worldId, "fateClocks"),
        store.loadEntities(worldId, "decks"),
        store.loadEntities(worldId, "randomTables"),
      ]);
    } catch (err) {
      setResult({ type: "error", message: `导入失败: ${err instanceof Error ? err.message : "未知错误"}` });
    } finally {
      setImporting(false);
    }
  }, [preview, worldId, store]);

  return (
    <div className="pack-panel">
      <h3 className="pack-panel__title">世界资源包</h3>
      <p className="pack-panel__desc">
        导出当前世界的所有实体数据为 JSON 文件，或导入其他世界的资源包。
      </p>

      <div className="pack-panel__actions">
        <button
          type="button"
          className="pack-panel__btn pack-panel__btn--export"
          disabled={exporting}
          onClick={handleExport}
        >
          {exporting ? "导出中..." : "📤 导出资源包"}
        </button>

        {canEdit && (
          <>
            <button
              type="button"
              className="pack-panel__btn pack-panel__btn--import"
              onClick={() => fileInputRef.current?.click()}
            >
              📥 选择导入文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>

      {/* 预览 */}
      {preview && (
        <div className="pack-panel__preview">
          <h4>导入预览</h4>
          <div className="pack-panel__preview-summary">
            {Object.entries(preview)
              .filter(([key]) => key !== "version" && key !== "exportedAt" && key !== "worldName")
              .map(([key, value]) => (
                <div key={key} className="pack-panel__preview-row">
                  <span>{typeLabel(key)}</span>
                  <span>{Array.isArray(value) ? `${value.length} 条` : "—"}</span>
                </div>
              ))}
          </div>
          <div className="pack-panel__preview-actions">
            <button type="button" className="pack-panel__btn" onClick={() => setPreview(null)}>
              取消
            </button>
            <button
              type="button"
              className="pack-panel__btn pack-panel__btn--confirm"
              disabled={importing}
              onClick={handleImport}
            >
              {importing ? "导入中..." : "确认导入"}
            </button>
          </div>
        </div>
      )}

      {/* 结果通知 */}
      {result && (
        <div className={`pack-panel__result pack-panel__result--${result.type}`}>
          {result.message}
        </div>
      )}
    </div>
  );
};

function typeLabel(key: string): string {
  const map: Record<string, string> = {
    abilities: "能力",
    races: "种族",
    professions: "职业",
    backgrounds: "背景",
    items: "物品",
    fateClocks: "命刻",
    decks: "卡组",
    randomTables: "随机表",
  };
  return map[key] ?? key;
}
