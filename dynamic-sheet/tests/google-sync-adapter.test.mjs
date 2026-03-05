import test from "node:test";
import assert from "node:assert/strict";

import { createGoogleSyncAdapter } from "../src/googleSyncAdapter.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

function withMockFetch(responses, fn) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("No mock response left");
    return next;
  };
  return Promise.resolve()
    .then(() => fn(calls))
    .finally(() => {
      global.fetch = originalFetch;
    });
}

function makeAdapter() {
  return createGoogleSyncAdapter({
    getAccessToken: async () => "token",
    sheetTabName: ""
  });
}

test("googleSyncAdapter: column_add appends missing header key", async () => {
  const adapter = makeAdapter();
  await withMockFetch(
    [
      jsonResponse({ sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }] }),
      jsonResponse({ values: [["id", "name"]] }),
      jsonResponse({})
    ],
    async (calls) => {
      const result = await adapter.applyOperations(
        [{ type: "column_add", payload: { key: "new_col", config: {} } }],
        { spreadsheetId: "sheetA" }
      );

      assert.equal(result.ok, true);
      assert.equal(calls.length, 3);
      assert.equal(calls[2].init.method, "PUT");
      assert.match(calls[2].init.body, /new_col/);
    }
  );
});

test("googleSyncAdapter: row_rename updates name cell by row id", async () => {
  const adapter = makeAdapter();
  await withMockFetch(
    [
      jsonResponse({ sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }] }),
      jsonResponse({ values: [["id", "name"], ["r1", "Old"]] }),
      jsonResponse({})
    ],
    async (calls) => {
      const result = await adapter.applyOperations(
        [{ type: "row_rename", payload: { rowId: "r1", name: "New Name" } }],
        { spreadsheetId: "sheetA" }
      );

      assert.equal(result.ok, true);
      assert.equal(calls.length, 3);
      assert.equal(calls[2].init.method, "PUT");
      assert.match(calls[2].init.body, /New Name/);
    }
  );
});

test("googleSyncAdapter: column_delete removes matched column", async () => {
  const adapter = makeAdapter();
  await withMockFetch(
    [
      jsonResponse({ sheets: [{ properties: { sheetId: 10, title: "Sheet1", index: 0 } }] }),
      jsonResponse({ values: [["id", "name", "price"], ["r1", "A", "100"]] }),
      jsonResponse({})
    ],
    async (calls) => {
      const result = await adapter.applyOperations(
        [{ type: "column_delete", payload: { key: "price" } }],
        { spreadsheetId: "sheetA" }
      );

      assert.equal(result.ok, true);
      assert.equal(calls.length, 3);
      assert.equal(calls[2].init.method, "POST");
      assert.match(calls[2].init.body, /"dimension":"COLUMNS"/);
      assert.match(calls[2].init.body, /"startIndex":2/);
    }
  );
});

test("googleSyncAdapter: unknown operation does not block queue", async () => {
  const adapter = makeAdapter();
  await withMockFetch(
    [
      jsonResponse({ sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }] }),
      jsonResponse({ values: [["id"]] })
    ],
    async (calls) => {
      const result = await adapter.applyOperations(
        [{ type: "unknown_op", payload: {} }],
        { spreadsheetId: "sheetA" }
      );

      assert.equal(result.ok, true);
      assert.equal(calls.length, 2);
    }
  );
});
