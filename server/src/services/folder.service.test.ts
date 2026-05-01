import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFolderPath,
  buildFolderTree,
  wouldCreateFolderCycle,
  validateFolderName,
} from "./folder.service";
import type { FolderRecord } from "../../../shared/types/world-entities";

/* ──────────── parseFolderPath ──────────── */

test("parseFolderPath: empty / null / undefined → []", () => {
  assert.deepEqual(parseFolderPath(""), []);
  assert.deepEqual(parseFolderPath(null), []);
  assert.deepEqual(parseFolderPath(undefined), []);
});

test("parseFolderPath: single segment", () => {
  assert.deepEqual(parseFolderPath("卡拉塔纳"), ["卡拉塔纳"]);
});

test("parseFolderPath: nested segments", () => {
  assert.deepEqual(parseFolderPath("卡拉塔纳/危险生物/精魂纳迦"), [
    "卡拉塔纳",
    "危险生物",
    "精魂纳迦",
  ]);
});

test("parseFolderPath: ignores leading / trailing / repeated slashes", () => {
  assert.deepEqual(parseFolderPath("/a//b/"), ["a", "b"]);
  assert.deepEqual(parseFolderPath("///"), []);
});

test("parseFolderPath: trims segment whitespace", () => {
  assert.deepEqual(parseFolderPath("  a / b  /  c "), ["a", "b", "c"]);
});

/* ──────────── buildFolderTree ──────────── */

function makeFolder(
  id: string,
  parentId: string | null,
  name: string,
  sortOrder = 0,
  createdAt = "2026-01-01T00:00:00.000Z",
): FolderRecord {
  return {
    id,
    worldId: "w1",
    parentId,
    type: "SCENE",
    name,
    color: null,
    icon: null,
    sortOrder,
    collapsed: false,
    permissionMode: "DEFAULT",
    createdAt,
    updatedAt: createdAt,
  };
}

test("buildFolderTree: empty → []", () => {
  assert.deepEqual(buildFolderTree([]), []);
});

test("buildFolderTree: single root", () => {
  const tree = buildFolderTree([makeFolder("a", null, "A")]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "a");
  assert.deepEqual(tree[0].children, []);
});

test("buildFolderTree: nested 3 levels", () => {
  const tree = buildFolderTree([
    makeFolder("root", null, "Root"),
    makeFolder("child", "root", "Child"),
    makeFolder("grand", "child", "Grand"),
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "root");
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].id, "child");
  assert.equal(tree[0].children[0].children.length, 1);
  assert.equal(tree[0].children[0].children[0].id, "grand");
});

test("buildFolderTree: orphans treated as roots", () => {
  // 父 ID 不存在视为孤儿 → 顶层
  const tree = buildFolderTree([makeFolder("orphan", "missing-parent", "Orphan")]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "orphan");
});

test("buildFolderTree: sorts by sortOrder then createdAt", () => {
  const tree = buildFolderTree([
    makeFolder("b", null, "B", 1, "2026-01-01T00:00:00.000Z"),
    makeFolder("a", null, "A", 0, "2026-01-02T00:00:00.000Z"),
    makeFolder("c", null, "C", 1, "2026-01-03T00:00:00.000Z"),
  ]);
  // sortOrder=0 (A) 排前；sortOrder=1 同分时按 createdAt 升序 (B before C)
  assert.deepEqual(
    tree.map((node) => node.id),
    ["a", "b", "c"],
  );
});

/* ──────────── wouldCreateFolderCycle ──────────── */

test("wouldCreateFolderCycle: target=null (顶层) → 永不循环", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
  ];
  assert.equal(wouldCreateFolderCycle(folders, "a", null), false);
});

test("wouldCreateFolderCycle: 移到自己 → 循环", () => {
  const folders = [{ id: "a", parentId: null }];
  assert.equal(wouldCreateFolderCycle(folders, "a", "a"), true);
});

test("wouldCreateFolderCycle: 移到自己直接子节点 → 循环", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
  ];
  assert.equal(wouldCreateFolderCycle(folders, "a", "b"), true);
});

test("wouldCreateFolderCycle: 移到自己孙节点 → 循环", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
  ];
  assert.equal(wouldCreateFolderCycle(folders, "a", "c"), true);
});

test("wouldCreateFolderCycle: 移到兄弟节点 → 不循环", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: null },
  ];
  assert.equal(wouldCreateFolderCycle(folders, "a", "b"), false);
});

test("wouldCreateFolderCycle: 移到无关分支 → 不循环", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "x", parentId: null },
    { id: "y", parentId: "x" },
  ];
  assert.equal(wouldCreateFolderCycle(folders, "a", "y"), false);
});

/* ──────────── validateFolderName ──────────── */

test("validateFolderName: 正常名 → 返回 trimmed", () => {
  assert.equal(validateFolderName("  卡拉塔纳  "), "卡拉塔纳");
});

test("validateFolderName: 空 / 仅空白 → 抛错", () => {
  assert.throws(() => validateFolderName(""), /folder name is required/);
  assert.throws(() => validateFolderName("   "), /folder name is required/);
});

test("validateFolderName: 含 / → 抛错", () => {
  assert.throws(() => validateFolderName("a/b"), /cannot contain '\/'/);
});
