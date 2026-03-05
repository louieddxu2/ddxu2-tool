import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";

import {
  clearAllData,
  enqueueOperation,
  getMeta,
  listNodes,
  listPendingOperations,
  loadSheetById,
  saveNodes,
  saveSheetById,
  setMeta
} from "../src/storage.js";

test("storage: save/load sheet by id", async () => {
  await clearAllData();
  await saveSheetById("sheet:test", {
    schema: { name: { label: "Name", type: "text", options: [] } },
    rows: [{ id: "r1", name: "Alpha" }],
    permission: "editor"
  });

  const loaded = await loadSheetById("sheet:test");
  assert.equal(loaded.permission, "editor");
  assert.deepEqual(loaded.rows, [{ id: "r1", name: "Alpha" }]);
});

test("storage: save/list nodes", async () => {
  await clearAllData();
  const nodes = [
    { id: "root", type: "folder", name: "Root", parentId: null, order: 0 },
    { id: "s1", type: "sheet", name: "S1", parentId: "root", order: 0, spreadsheetId: "abc", permission: "viewer" }
  ];
  await saveNodes(nodes);
  const loaded = await listNodes();
  assert.equal(loaded.length, 2);
  assert.equal(loaded.find((n) => n.id === "s1").spreadsheetId, "abc");
});

test("storage: pending operations are isolated by sheetId", async () => {
  await clearAllData();
  await enqueueOperation("sheetA", "cell_update", { rowId: "1", key: "name", value: "A" });
  await enqueueOperation("sheetB", "cell_update", { rowId: "1", key: "name", value: "B" });

  const aPending = await listPendingOperations("sheetA");
  const bPending = await listPendingOperations("sheetB");
  assert.equal(aPending.length, 1);
  assert.equal(bPending.length, 1);
  assert.equal(aPending[0].payload.value, "A");
  assert.equal(bPending[0].payload.value, "B");
});

test("storage: meta roundtrip", async () => {
  await clearAllData();
  await setMeta("activeNodeId", "sheet_1");
  const value = await getMeta("activeNodeId");
  assert.equal(value, "sheet_1");
});

