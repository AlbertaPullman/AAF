import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { http } from "../../lib/http";
import { useAuthStore } from "../../store/authStore";

type RulebookEntryStatus = "DRAFT" | "PUBLISHED";

type RulebookEntryItem = {
  id: string;
  title: string;
  summary: string;
  directoryPath: string[];
  contentHtml: string;
  sortOrder: number;
  status: RulebookEntryStatus;
  version: number;
  updatedAt: string;
};

type RulebookDirectoryItem = {
  id: string;
  path: string[];
  sortOrder: number;
};

type RulebookEntryListResponse = {
  editable: boolean;
  entries: RulebookEntryItem[];
  directories: RulebookDirectoryItem[];
};

type RulebookTreeNode = {
  key: string;
  directoryId: string | null;
  sortOrder: number;
  label: string;
  path: string[];
  children: RulebookTreeNode[];
  entries: RulebookEntryItem[];
};

function parseDirectoryPath(text: string) {
  return text
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeEntrySort(left: RulebookEntryItem, right: RulebookEntryItem) {
  return (left.sortOrder - right.sortOrder) || (new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function getDirectoryParentPath(path: string[]) {
  if (!path.length) {
    return [] as string[];
  }
  return path.slice(0, -1);
}

function toDirectoryKey(path: string[]) {
  return path.join("::");
}

function buildRulebookTree(entries: RulebookEntryItem[], directories: RulebookDirectoryItem[]) {
  const roots: RulebookTreeNode[] = [];
  const nodeMap = new Map<string, RulebookTreeNode>();

  const ensureNode = (path: string[]) => {
    if (!path.length) {
      return null;
    }

    let parent: RulebookTreeNode | null = null;
    for (let index = 0; index < path.length; index += 1) {
      const currentPath = path.slice(0, index + 1);
      const key = currentPath.join("::");
      let current = nodeMap.get(key);
      if (!current) {
        current = {
          key,
          directoryId: null,
          sortOrder: Number.MAX_SAFE_INTEGER,
          label: currentPath[currentPath.length - 1],
          path: currentPath,
          children: [],
          entries: []
        };
        const ensuredCurrent = current;
        nodeMap.set(key, current);
        if (parent) {
          if (!parent.children.some((child) => child.key === ensuredCurrent.key)) {
            parent.children.push(ensuredCurrent);
          }
        } else if (!roots.some((node) => node.key === ensuredCurrent.key)) {
          roots.push(ensuredCurrent);
        }
      }
      parent = current;
    }

    return parent;
  };

  for (const directory of directories.slice().sort((left, right) => left.sortOrder - right.sortOrder)) {
    const node = ensureNode(parseDirectoryPath((directory.path ?? []).join("/")));
    if (node) {
      node.directoryId = directory.id;
      node.sortOrder = directory.sortOrder;
    }
  }

  const uncategorizedEntries: RulebookEntryItem[] = [];
  for (const entry of entries.slice().sort(normalizeEntrySort)) {
    const path = parseDirectoryPath((entry.directoryPath ?? []).join("/"));
    const node = ensureNode(path);
    if (node) {
      node.entries.push(entry);
    } else {
      uncategorizedEntries.push(entry);
    }
  }

  if (uncategorizedEntries.length) {
    roots.unshift({
      key: "__root__",
      directoryId: null,
      sortOrder: Number.MIN_SAFE_INTEGER,
      label: "未分类",
      path: [],
      children: [],
      entries: uncategorizedEntries
    });
  }

  const sortTreeEntries = (nodes: RulebookTreeNode[]) => {
    for (const node of nodes) {
      node.entries.sort(normalizeEntrySort);
      sortTreeEntries(node.children);
    }
  };
  sortTreeEntries(roots);

  return roots;
}

export default function RulebookEditorPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [entries, setEntries] = useState<RulebookEntryItem[]>([]);
  const [directories, setDirectories] = useState<RulebookDirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [creatingDirectory, setCreatingDirectory] = useState(false);
  const [reorderingEntries, setReorderingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editable, setEditable] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [summaryInput, setSummaryInput] = useState("");
  const [directoryInput, setDirectoryInput] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [expandedDirectoryKeys, setExpandedDirectoryKeys] = useState<string[]>([]);
  const [activeDirectoryPath, setActiveDirectoryPath] = useState<string[]>([]);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [draggingDirectoryKey, setDraggingDirectoryKey] = useState<string | null>(null);

  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [newDirectoryLevel, setNewDirectoryLevel] = useState(1);
  const [newDirectoryNames, setNewDirectoryNames] = useState<string[]>([""]);

  const quillRef = useRef<Quill | null>(null);
  const quillContainerRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = user?.platformRole === "MASTER" || user?.platformRole === "ADMIN";

  const selectedEntry = useMemo(
    () => entries.find((item) => item.id === selectedEntryId) ?? entries[0] ?? null,
    [entries, selectedEntryId]
  );

  const tree = useMemo(() => buildRulebookTree(entries, directories), [entries, directories]);
  const directoryMap = useMemo(() => {
    const map = new Map<string, RulebookDirectoryItem>();
    for (const directory of directories) {
      map.set((directory.path ?? []).join("::"), directory);
    }
    return map;
  }, [directories]);

  useEffect(() => {
    if (!quillContainerRef.current || quillRef.current) {
      return;
    }

    const editor = new Quill(quillContainerRef.current, {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }],
          ["link", "image"],
          ["clean"]
        ]
      }
    });

    const onTextChange = () => {
      setContentHtml(editor.root.innerHTML);
    };
    editor.on("text-change", onTextChange);

    const toolbar = editor.getModule("toolbar") as { addHandler?: (name: string, fn: () => void) => void } | undefined;
    toolbar?.addHandler?.("image", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "file");
      input.setAttribute("accept", "image/*");
      input.click();
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const range = editor.getSelection(true);
          editor.insertEmbed(range?.index ?? 0, "image", String(reader.result ?? ""));
        };
        reader.readAsDataURL(file);
      };
    });

    quillRef.current = editor;

    return () => {
      editor.off("text-change", onTextChange);
      quillRef.current = null;
      if (quillContainerRef.current) {
        quillContainerRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    const editor = quillRef.current;
    if (!editor) {
      return;
    }

    const nextHtml = contentHtml || "";
    if (editor.root.innerHTML !== nextHtml) {
      editor.root.innerHTML = nextHtml;
    }
  }, [contentHtml]);

  const refreshEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await http.get("/rulebook/entries");
      const data = (resp.data?.data ?? { editable: false, entries: [], directories: [] }) as RulebookEntryListResponse;
      setEditable(Boolean(data.editable));
      setEntries(data.entries ?? []);
      setDirectories(data.directories ?? []);
      setSelectedEntryId((prev) => {
        if (prev && (data.entries ?? []).some((item) => item.id === prev)) {
          return prev;
        }
        return data.entries?.[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "加载规则书条目失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedEntryToForm = useCallback((entry: RulebookEntryItem | null) => {
    if (!entry) {
      setTitleInput("");
      setSummaryInput("");
      setDirectoryInput("");
      setContentHtml("");
      return;
    }

    setTitleInput(entry.title);
    setSummaryInput(entry.summary || "");
    setDirectoryInput(entry.directoryPath.join("/"));
    setContentHtml(entry.contentHtml || "");
    setActiveDirectoryPath(entry.directoryPath ?? []);
  }, []);

  useEffect(() => {
    loadSelectedEntryToForm(selectedEntry);
  }, [loadSelectedEntryToForm, selectedEntry]);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    if (!directories.length) {
      setExpandedDirectoryKeys((prev) => (prev.includes("__root__") ? prev : [...prev, "__root__"]));
      return;
    }

    const allDirectoryKeys = directories
      .map((item) => parseDirectoryPath((item.path ?? []).join("/")))
      .filter((path) => path.length > 0)
      .flatMap((path) => path.map((_, index) => toDirectoryKey(path.slice(0, index + 1))));

    setExpandedDirectoryKeys((prev) => {
      const merged = new Set(prev);
      for (const key of allDirectoryKeys) {
        merged.add(key);
      }
      return Array.from(merged);
    });
  }, [directories]);

  useEffect(() => {
    if (!selectedEntry?.directoryPath?.length) {
      return;
    }

    const path = parseDirectoryPath(selectedEntry.directoryPath.join("/"));
    if (!path.length) {
      return;
    }

    const keysToExpand = path.map((_, index) => toDirectoryKey(path.slice(0, index + 1)));
    setExpandedDirectoryKeys((prev) => {
      const merged = new Set(prev);
      for (const key of keysToExpand) {
        merged.add(key);
      }
      return Array.from(merged);
    });
  }, [selectedEntry]);

  const onCreateEntry = async () => {
    if (!editable) {
      setError("当前账号无编辑权限");
      return;
    }

    const title = window.prompt("请输入新规则条目名称");
    if (!title?.trim()) {
      return;
    }

    try {
      setError(null);
      const resp = await http.post("/rulebook/entries", {
        title: title.trim(),
        summary: "",
        directoryPath: activeDirectoryPath,
        contentHtml: "<p>请输入规则内容...</p>"
      });

      const created = resp.data?.data as RulebookEntryItem;
      await refreshEntries();
      setSelectedEntryId(created.id);
      setActiveDirectoryPath(created.directoryPath ?? activeDirectoryPath);
      setNotice("规则条目已创建");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建规则条目失败");
    }
  };

  const onCreateDirectory = async () => {
    if (!editable) {
      setError("当前账号无编辑权限");
      return;
    }

    const path = newDirectoryNames.slice(0, newDirectoryLevel).map((item) => item.trim()).filter(Boolean);
    if (path.length !== newDirectoryLevel) {
      setError("请完整填写每一级目录名");
      return;
    }

    setCreatingDirectory(true);
    setError(null);
    try {
      await http.post("/rulebook/directories", { path });
      await refreshEntries();
      const key = toDirectoryKey(path);
      setExpandedDirectoryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setActiveDirectoryPath(path);
      setShowDirectoryModal(false);
      setNotice("目录已创建");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "创建目录失败");
    } finally {
      setCreatingDirectory(false);
    }
  };

  const onDeleteDirectory = async (path: string[]) => {
    if (!editable || !path.length) {
      return;
    }

    const directoryLabel = path.join("/");
    const confirmed = window.confirm(`确认删除目录【${directoryLabel}】及其子目录/条目吗？`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await http.delete("/rulebook/directories", {
        data: { path }
      });
      await refreshEntries();
      const deletingKey = toDirectoryKey(path);
      setExpandedDirectoryKeys((prev) => prev.filter((item) => !item.startsWith(deletingKey)));
      setActiveDirectoryPath((prev) => (toDirectoryKey(prev).startsWith(deletingKey) ? [] : prev));
      setNotice("目录已删除");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "删除目录失败");
    } finally {
      setDeleting(false);
    }
  };

  const onMoveEntryToDirectory = async (entryId: string, nextPath: string[]) => {
    if (!editable) {
      return;
    }

    const entry = entries.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    if (entry.directoryPath.join("::") === nextPath.join("::")) {
      return;
    }

    setReorderingEntries(true);
    setError(null);
    try {
      await http.put(`/rulebook/entries/${entry.id}`, {
        directoryPath: nextPath
      });
      await refreshEntries();
      setSelectedEntryId(entry.id);
      setActiveDirectoryPath(nextPath);
      setNotice("条目已移动到新目录");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "条目跨目录移动失败");
    } finally {
      setReorderingEntries(false);
    }
  };

  const onExportPdf = async () => {
    setExportingPdf(true);
    setError(null);
    try {
      const response = await http.get("/rulebook/export/pdf", {
        responseType: "blob"
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers?.["content-disposition"] as string | undefined;
      const matched = contentDisposition?.match(/filename="?([^";]+)"?/i);
      const fileName = matched?.[1] ?? "rulebook.pdf";

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = decodeURIComponent(fileName);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setNotice("规则书 PDF 导出完成");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "导出 PDF 失败");
    } finally {
      setExportingPdf(false);
    }
  };

  const onReorderTreeSiblings = async (
    parentPath: string[],
    dragged: { type: "ENTRY" | "DIRECTORY"; id: string },
    target: { type: "ENTRY" | "DIRECTORY"; id: string }
  ) => {
    if (!editable) {
      return;
    }

    const parentKey = parentPath.join("::");
    const siblingDirectories = directories
      .filter((item) => getDirectoryParentPath(item.path).join("::") === parentKey)
      .map((item) => ({ type: "DIRECTORY" as const, id: item.id, sortOrder: item.sortOrder }));
    const siblingEntries = entries
      .filter((item) => item.directoryPath.join("::") === parentKey)
      .map((item) => ({ type: "ENTRY" as const, id: item.id, sortOrder: item.sortOrder }));

    const ordered = [...siblingDirectories, ...siblingEntries]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({ type: item.type, id: item.id }));

    const draggedKey = `${dragged.type}:${dragged.id}`;
    const targetKey = `${target.type}:${target.id}`;
    const dragIndex = ordered.findIndex((item) => `${item.type}:${item.id}` === draggedKey);
    const targetIndex = ordered.findIndex((item) => `${item.type}:${item.id}` === targetKey);
    if (dragIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextItems = [...ordered];
    const [draggedItem] = nextItems.splice(dragIndex, 1);
    nextItems.splice(targetIndex, 0, draggedItem);

    setReorderingEntries(true);
    setError(null);
    try {
      const resp = await http.post("/rulebook/tree/reorder", {
        parentPath,
        items: nextItems
      });

      const data = (resp.data?.data ?? { entries: [], directories: [] }) as RulebookEntryListResponse;
      setEntries(data.entries ?? []);
      setDirectories(data.directories ?? []);
      setNotice("同级顺序已更新");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "同级拖拽排序失败");
    } finally {
      setReorderingEntries(false);
    }
  };

  const onSaveEntry = async () => {
    if (!selectedEntry || !editable) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const resp = await http.put(`/rulebook/entries/${selectedEntry.id}`, {
        title: titleInput,
        summary: summaryInput,
        directoryPath: parseDirectoryPath(directoryInput),
        contentHtml
      });
      const updated = resp.data?.data as RulebookEntryItem;
      setEntries((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNotice("规则条目已保存");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const onPublishEntry = async () => {
    if (!selectedEntry || !editable) {
      return;
    }

    await onSaveEntry();
    setPublishing(true);
    setError(null);
    try {
      const resp = await http.post(`/rulebook/entries/${selectedEntry.id}/publish`);
      const published = resp.data?.data as RulebookEntryItem;
      setEntries((prev) => prev.map((item) => (item.id === published.id ? published : item)));
      setNotice("规则条目已发布");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "发布失败");
    } finally {
      setPublishing(false);
    }
  };

  const onDeleteEntry = async () => {
    if (!selectedEntry || !editable) {
      return;
    }

    const confirmed = window.confirm(`确认删除规则条目【${selectedEntry.title}】吗？`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await http.delete(`/rulebook/entries/${selectedEntry.id}`);
      setEntries((prev) => prev.filter((item) => item.id !== selectedEntry.id));
      setSelectedEntryId((prev) => (prev === selectedEntry.id ? null : prev));
      setNotice("规则条目已删除");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "删除失败");
    } finally {
      setDeleting(false);
    }
  };

  const onReorderEntries = async (draggedId: string, targetId: string) => {
    if (!editable || draggedId === targetId) {
      return;
    }

    const dragged = entries.find((item) => item.id === draggedId);
    const target = entries.find((item) => item.id === targetId);
    if (!dragged || !target) {
      return;
    }

    if (dragged.directoryPath.join("::") !== target.directoryPath.join("::")) {
      await onMoveEntryToDirectory(draggedId, target.directoryPath);
      return;
    }

    await onReorderTreeSiblings(
      dragged.directoryPath,
      { type: "ENTRY", id: dragged.id },
      { type: "ENTRY", id: target.id }
    );
  };

  const renderTreeNode = (node: RulebookTreeNode, level = 1) => {
    const expanded = expandedDirectoryKeys.includes(node.key);
    const mixedChildren = [
      ...node.children.map((child) => ({ kind: "DIRECTORY" as const, sortOrder: child.sortOrder, node: child })),
      ...node.entries.map((entry) => ({ kind: "ENTRY" as const, sortOrder: entry.sortOrder, entry }))
    ].sort((left, right) => left.sortOrder - right.sortOrder);

    return (
      <div key={node.key} className="rulebook-editor__tree-group">
        <button
          type="button"
          className={`rulebook-editor__tree-node level-${level} ${expanded ? "is-active" : ""}`}
          draggable={editable && node.path.length > 0 && !!node.directoryId}
          onDragStart={() => {
            if (editable && node.path.length > 0 && node.directoryId) {
              setDraggingDirectoryKey(node.key);
            }
          }}
          onDragEnd={() => setDraggingDirectoryKey(null)}
          onDragOver={(event) => {
            if (editable && (draggingEntryId || draggingDirectoryKey)) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            if (!editable) {
              return;
            }
            event.preventDefault();
            if (draggingEntryId) {
              const draggedEntry = entries.find((item) => item.id === draggingEntryId);
              const targetParentPath = getDirectoryParentPath(node.path);
              if (draggedEntry && node.directoryId && draggedEntry.directoryPath.join("::") === targetParentPath.join("::")) {
                void onReorderTreeSiblings(
                  targetParentPath,
                  { type: "ENTRY", id: draggedEntry.id },
                  { type: "DIRECTORY", id: node.directoryId }
                );
              } else {
                void onMoveEntryToDirectory(draggingEntryId, node.path);
              }
              setDraggingEntryId(null);
              return;
            }

            if (draggingDirectoryKey) {
              const draggedPath = draggingDirectoryKey.split("::").filter(Boolean);
              const draggedDirectory = directoryMap.get(draggedPath.join("::"));
              if (draggedDirectory && node.directoryId) {
                const draggedParentPath = getDirectoryParentPath(draggedPath);
                const targetParentPath = getDirectoryParentPath(node.path);
                if (draggedParentPath.join("::") === targetParentPath.join("::")) {
                  void onReorderTreeSiblings(
                    targetParentPath,
                    { type: "DIRECTORY", id: draggedDirectory.id },
                    { type: "DIRECTORY", id: node.directoryId }
                  );
                } else {
                  setNotice("当前仅支持同级目录拖拽排序");
                }
              }
              setDraggingDirectoryKey(null);
            }
          }}
          onContextMenu={(event) => {
            if (!editable || !node.path.length) {
              return;
            }
            event.preventDefault();
            void onDeleteDirectory(node.path);
          }}
          onClick={() => {
            setActiveDirectoryPath(node.path);
            setExpandedDirectoryKeys((prev) => (
              prev.includes(node.key)
                ? prev.filter((item) => item !== node.key)
                : [...prev, node.key]
            ));
          }}
        >
          <span>{expanded ? "▾" : "▸"}</span>
          <strong>{node.label}</strong>
        </button>

        {expanded ? (
          <div className="rulebook-editor__tree-children">
            {mixedChildren.map((item) => {
              if (item.kind === "DIRECTORY") {
                return renderTreeNode(item.node, level + 1);
              }

              const entry = item.entry;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`rulebook-editor__tree-entry ${selectedEntry?.id === entry.id ? "is-active" : ""} ${draggingEntryId === entry.id ? "is-dragging" : ""}`}
                  draggable={editable}
                  onDragStart={() => setDraggingEntryId(entry.id)}
                  onDragEnd={() => setDraggingEntryId(null)}
                  onDragOver={(event) => {
                    if (editable) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingEntryId) {
                      void onReorderEntries(draggingEntryId, entry.id);
                      setDraggingEntryId(null);
                      return;
                    }

                    if (draggingDirectoryKey) {
                      const draggedPath = draggingDirectoryKey.split("::").filter(Boolean);
                      const draggedDirectory = directoryMap.get(draggedPath.join("::"));
                      if (draggedDirectory && draggedPath.length > 0) {
                        const draggedParentPath = getDirectoryParentPath(draggedPath);
                        if (draggedParentPath.join("::") === entry.directoryPath.join("::")) {
                          void onReorderTreeSiblings(
                            entry.directoryPath,
                            { type: "DIRECTORY", id: draggedDirectory.id },
                            { type: "ENTRY", id: entry.id }
                          );
                        } else {
                          setNotice("当前仅支持同级目录拖拽排序");
                        }
                      }
                      setDraggingDirectoryKey(null);
                    }
                  }}
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                    setActiveDirectoryPath(entry.directoryPath);
                  }}
                >
                  <strong>{entry.title}</strong>
                  <span>v{entry.version} · {entry.status}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rulebook-editor-page">
      {!isAdmin ? (
        <section className="rulebook-editor-main">
          <div className="rulebook-editor-main__empty">仅平台管理员可进入规则书编辑器。</div>
          <div className="rulebook-editor-toolbar">
            <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <>
          <header className="rulebook-editor-page__header">
            <div>
              <h1>规则书编辑器</h1>
              <p>支持多级目录、富文本、图片导入，发布后可在大厅与世界侧只读查看。</p>
            </div>
            <div className="rulebook-editor-page__actions">
              <button type="button" onClick={() => navigate("/lobby")}>返回大厅</button>
              <button type="button" onClick={() => void onExportPdf()} disabled={exportingPdf || loading}>
                {exportingPdf ? "导出中..." : "导出 PDF"}
              </button>
              <button type="button" onClick={() => void refreshEntries()} disabled={loading}>
                {loading ? "刷新中..." : "刷新"}
              </button>
            </div>
          </header>

          {error ? <div className="rulebook-editor-page__error">{error}</div> : null}
          {notice ? <div className="rulebook-editor-page__notice">{notice}</div> : null}

          <section className="rulebook-editor-layout">
            <aside className="rulebook-editor-sidebar">
              <div className="rulebook-editor-sidebar__head">
                <h2>目录</h2>
                {editable ? (
                  <div className="rulebook-editor-sidebar__actions">
                    <button type="button" onClick={() => void onCreateEntry()}>新增条目</button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = activeDirectoryPath.length ? activeDirectoryPath : [""];
                        setNewDirectoryLevel(base.length);
                        setNewDirectoryNames(base);
                        setShowDirectoryModal(true);
                      }}
                    >
                      新增目录
                    </button>
                  </div>
                ) : null}
              </div>
              {editable ? <p className="rulebook-editor-sidebar__hint">提示：条目可拖拽排序或拖到其他目录；目录可同级拖拽排序；目录节点右键可删除。</p> : null}
              {entries.length === 0 ? <p className="rulebook-editor-sidebar__empty">暂无规则条目</p> : null}
              <div className="rulebook-editor-sidebar__list">
                {tree.map((node) => renderTreeNode(node))}
              </div>
            </aside>

            <main className="rulebook-editor-main">
              {!selectedEntry ? (
                <div className="rulebook-editor-main__empty">请选择条目进行编辑</div>
              ) : (
                <>
                  <div className="rulebook-editor-form">
                    <label>
                      条目标题
                      <input value={titleInput} onChange={(event) => setTitleInput(event.target.value)} maxLength={80} />
                    </label>
                    <label>
                      目录路径（用 / 分级）
                      <input
                        value={directoryInput}
                        onChange={(event) => setDirectoryInput(event.target.value)}
                        placeholder="例如：核心规则/战斗/命中"
                        maxLength={200}
                      />
                    </label>
                    <label>
                      摘要
                      <input value={summaryInput} onChange={(event) => setSummaryInput(event.target.value)} maxLength={120} />
                    </label>
                  </div>

                  <div className="rulebook-editor-richtext">
                    <div ref={quillContainerRef} className="rulebook-editor-richtext__quill" />
                  </div>

                  <div className="rulebook-editor-toolbar">
                    <button type="button" onClick={() => void onSaveEntry()} disabled={!editable || saving || reorderingEntries}>
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button type="button" onClick={() => void onPublishEntry()} disabled={!editable || publishing || reorderingEntries}>
                      {publishing ? "发布中..." : "发布"}
                    </button>
                    <button type="button" className="is-danger" onClick={() => void onDeleteEntry()} disabled={!editable || deleting || reorderingEntries}>
                      {deleting ? "删除中..." : "删除条目"}
                    </button>
                  </div>
                </>
              )}
            </main>
          </section>

          {showDirectoryModal ? (
            <div className="rulebook-directory-modal" onClick={() => setShowDirectoryModal(false)}>
              <section className="rulebook-directory-modal__panel" onClick={(event) => event.stopPropagation()}>
                <header className="rulebook-directory-modal__header">
                  <h3>新增目录</h3>
                  <button type="button" onClick={() => setShowDirectoryModal(false)}>关闭</button>
                </header>

                <div className="rulebook-directory-modal__body">
                  <label>
                    目录级数
                    <select
                      value={newDirectoryLevel}
                      onChange={(event) => {
                        const level = Math.max(1, Math.min(6, Number(event.target.value || 1)));
                        setNewDirectoryLevel(level);
                        setNewDirectoryNames((prev) => {
                          const next = prev.slice(0, level);
                          while (next.length < level) {
                            next.push("");
                          }
                          return next;
                        });
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value} value={value}>{value} 级</option>
                      ))}
                    </select>
                  </label>

                  <div className="rulebook-directory-modal__levels">
                    {Array.from({ length: newDirectoryLevel }).map((_, index) => (
                      <label key={`dir_level_${index}`}>
                        第 {index + 1} 级目录名
                        <input
                          value={newDirectoryNames[index] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setNewDirectoryNames((prev) => {
                              const next = [...prev];
                              next[index] = value;
                              return next;
                            });
                          }}
                          maxLength={32}
                          placeholder={`请输入第 ${index + 1} 级目录名`}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rulebook-directory-modal__actions">
                  <button type="button" onClick={() => setShowDirectoryModal(false)}>取消</button>
                  <button type="button" onClick={() => void onCreateDirectory()} disabled={creatingDirectory}>
                    {creatingDirectory ? "创建中..." : "创建目录"}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
