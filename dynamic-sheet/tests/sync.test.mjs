import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";

import { clearAllData, enqueueOperation, getPendingCount } from "../src/storage.js";
import { createSyncEngine } from "../src/sync.js";

test("sync: no adapter keeps operation queued", async () => {
  await clearAllData();
  await enqueueOperation("sheetA", "cell_update", { rowId: "1", key: "name", value: "A" });

  global.window = {};
  const sync = createSyncEngine({
    getActiveSheetId: () => "sheetA",
    onStatus: () => {}
  });
  await sync.syncNow();
  assert.equal(await getPendingCount("sheetA"), 1);
});

test("sync: ok adapter removes queued operations", async () => {
  await clearAllData();
  await enqueueOperation("sheetA", "cell_update", { rowId: "1", key: "name", value: "A" });

  global.window = {
    dynamicSheetCloudAdapter: {
      async applyOperations() {
        return { ok: true };
      }
    }
  };

  const sync = createSyncEngine({
    getActiveSheetId: () => "sheetA",
    onStatus: () => {}
  });
  await sync.syncNow();
  assert.equal(await getPendingCount("sheetA"), 0);
});

test("sync: transient failure keeps operation for retry", async () => {
  await clearAllData();
  await enqueueOperation("sheetA", "cell_update", { rowId: "1", key: "name", value: "A" });

  global.window = {
    dynamicSheetCloudAdapter: {
      async applyOperations() {
        return { ok: false, transient: true };
      }
    }
  };

  const sync = createSyncEngine({
    getActiveSheetId: () => "sheetA",
    onStatus: () => {}
  });
  await sync.syncNow();
  assert.equal(await getPendingCount("sheetA"), 1);
});

