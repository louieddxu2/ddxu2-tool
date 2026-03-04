import {
  APP_META_STORE,
  DB_NAME,
  DB_VERSION,
  NODE_STORE,
  OP_STORE,
  SHEET_STORE
} from "./constants.js";

let db = null;

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function waitForTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));
  });
}

export async function initStorage() {
  if (db) return db;

  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const nextDb = event.target.result;

      if (!nextDb.objectStoreNames.contains(SHEET_STORE)) {
        nextDb.createObjectStore(SHEET_STORE, { keyPath: "id" });
      }

      if (!nextDb.objectStoreNames.contains(OP_STORE)) {
        const opStore = nextDb.createObjectStore(OP_STORE, { keyPath: "id", autoIncrement: true });
        opStore.createIndex("by_sheet_next_retry", ["sheetId", "nextRetryAt"]);
      } else {
        const opStore = req.transaction.objectStore(OP_STORE);
        if (!opStore.indexNames.contains("by_sheet_next_retry")) {
          opStore.createIndex("by_sheet_next_retry", ["sheetId", "nextRetryAt"]);
        }
      }

      if (!nextDb.objectStoreNames.contains(NODE_STORE)) {
        nextDb.createObjectStore(NODE_STORE, { keyPath: "id" });
      }

      if (!nextDb.objectStoreNames.contains(APP_META_STORE)) {
        nextDb.createObjectStore(APP_META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });

  return db;
}

export async function loadSheetById(sheetId) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(SHEET_STORE, "readonly");
  const store = tx.objectStore(SHEET_STORE);
  const result = await promisifyRequest(store.get(sheetId));
  await waitForTx(tx);
  return result || null;
}

export async function saveSheetById(sheetId, sheet) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(SHEET_STORE, "readwrite");
  tx.objectStore(SHEET_STORE).put({
    id: sheetId,
    schema: sheet.schema,
    rows: sheet.rows,
    permission: sheet.permission || "viewer",
    updatedAt: Date.now()
  });
  await waitForTx(tx);
}

export async function listNodes() {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(NODE_STORE, "readonly");
  const nodes = await promisifyRequest(tx.objectStore(NODE_STORE).getAll());
  await waitForTx(tx);
  return nodes || [];
}

export async function saveNodes(nodes) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(NODE_STORE, "readwrite");
  const store = tx.objectStore(NODE_STORE);
  store.clear();
  nodes.forEach((node) => store.put(node));
  await waitForTx(tx);
}

export async function getMeta(key) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(APP_META_STORE, "readonly");
  const value = await promisifyRequest(tx.objectStore(APP_META_STORE).get(key));
  await waitForTx(tx);
  return value ? value.value : null;
}

export async function setMeta(key, value) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(APP_META_STORE, "readwrite");
  tx.objectStore(APP_META_STORE).put({ key, value, updatedAt: Date.now() });
  await waitForTx(tx);
}

export async function enqueueOperation(sheetId, type, payload) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readwrite");
  tx.objectStore(OP_STORE).add({
    sheetId,
    type,
    payload,
    status: "pending",
    retries: 0,
    nextRetryAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  await waitForTx(tx);
}

export async function listPendingOperations(sheetId, limit = 100) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readonly");
  const index = tx.objectStore(OP_STORE).index("by_sheet_next_retry");
  const range = IDBKeyRange.bound([sheetId, 0], [sheetId, Date.now()]);
  const items = [];
  await new Promise((resolve, reject) => {
    const req = index.openCursor(range);
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor || items.length >= limit) {
        resolve();
        return;
      }
      const value = cursor.value;
      if (value.status === "pending") items.push(value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error || new Error("Failed listing pending operations"));
  });
  await waitForTx(tx);
  return items;
}

export async function deleteOperation(id) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readwrite");
  tx.objectStore(OP_STORE).delete(id);
  await waitForTx(tx);
}

export async function deferOperation(id, retries) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readwrite");
  const store = tx.objectStore(OP_STORE);
  const item = await promisifyRequest(store.get(id));
  if (!item) {
    await waitForTx(tx);
    return;
  }
  const delay = Math.min(60_000, 2 ** Math.min(retries, 10) * 1000);
  item.retries = retries;
  item.nextRetryAt = Date.now() + delay;
  item.updatedAt = Date.now();
  store.put(item);
  await waitForTx(tx);
}

export async function getPendingCount(sheetId = null) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readonly");
  const store = tx.objectStore(OP_STORE);
  const all = await promisifyRequest(store.getAll());
  await waitForTx(tx);
  if (!sheetId) return all.length;
  return all.filter((item) => item.sheetId === sheetId).length;
}

export async function clearAllData() {
  const readyDb = await initStorage();
  const tx = readyDb.transaction([SHEET_STORE, OP_STORE, NODE_STORE, APP_META_STORE], "readwrite");
  tx.objectStore(SHEET_STORE).clear();
  tx.objectStore(OP_STORE).clear();
  tx.objectStore(NODE_STORE).clear();
  tx.objectStore(APP_META_STORE).clear();
  await waitForTx(tx);
}

