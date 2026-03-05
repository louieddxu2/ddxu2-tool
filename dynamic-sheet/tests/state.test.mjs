import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ACTIVE_NODE_ID } from "../src/constants.js";
import { clearAllData } from "../src/storage.js";
import { createStore } from "../src/state.js";

test("state: parseSpreadsheetId handles url / id / invalid", () => {
  const store = createStore();
  const fromUrl = store.parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0");
  const fromId = store.parseSpreadsheetId("1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
  const invalid = store.parseSpreadsheetId("https://example.com/not-sheet");
  assert.equal(fromUrl, "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
  assert.equal(fromId, "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
  assert.equal(invalid, null);
});

test("state: addSheetNode rejects invalid url", async () => {
  await clearAllData();
  const store = createStore();
  await store.boot();
  await assert.rejects(
    () => store.addSheetNode({ name: "Bad", url: "not-a-sheet-url", permission: "editor" }),
    /Invalid Google Sheet URL/
  );
});

test("state: sheets keep separate local caches", async () => {
  await clearAllData();
  const store = createStore();
  await store.boot();

  // Sample sheet default rows: 2 -> add one
  await store.addRow();
  const sampleRowsAfterAdd = store.getState().rows.length;
  assert.equal(sampleRowsAfterAdd, 3);

  await store.addSheetNode({
    name: "Remote A",
    url: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit",
    permission: "editor"
  });
  const newSheetRowsInitial = store.getState().rows.length;
  assert.equal(newSheetRowsInitial, 2);

  await store.addRow();
  assert.equal(store.getState().rows.length, 3);

  await store.setActiveNode(DEFAULT_ACTIVE_NODE_ID);
  assert.equal(store.getState().rows.length, 3);
});

test("state: viewer mode blocks editing actions", async () => {
  await clearAllData();
  const store = createStore();
  await store.boot();

  await store.addSheetNode({
    name: "Viewer Sheet",
    url: "https://docs.google.com/spreadsheets/d/1ViewerOnlySheetId1234567890/edit",
    permission: "viewer"
  });
  assert.equal(store.canEditCurrentSheet(), false);

  const before = store.getState().rows.length;
  await store.addRow();
  const after = store.getState().rows.length;
  assert.equal(after, before);
});

