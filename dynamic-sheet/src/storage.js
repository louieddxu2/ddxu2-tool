import { DB_NAME, DB_VERSION, OP_STORE, SHEET_ID, SHEET_STORE } from "./constants.js";

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
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
  return db;
}

export async function loadSheet() {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(SHEET_STORE, "readonly");
  const store = tx.objectStore(SHEET_STORE);
  const result = await promisifyRequest(store.get(SHEET_ID));
  await waitForTx(tx);
  return result || null;
}

export async function saveSheet(sheet) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(SHEET_STORE, "readwrite");
  tx.objectStore(SHEET_STORE).put({
    id: SHEET_ID,
    schema: sheet.schema,
    rows: sheet.rows,
    updatedAt: Date.now()
  });
  await waitForTx(tx);
}

export async function enqueueOperation(type, payload) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readwrite");
  tx.objectStore(OP_STORE).add({
    sheetId: SHEET_ID,
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

export async function listPendingOperations(limit = 100) {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readonly");
  const index = tx.objectStore(OP_STORE).index("by_sheet_next_retry");
  const range = IDBKeyRange.bound([SHEET_ID, 0], [SHEET_ID, Date.now()]);
  const items = [];
  await new Promise((resolve, reject) => {
    index.openCursor(range).onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor || items.length >= limit) return resolve();
      const value = cursor.value;
      if (value.status === "pending") items.push(value);
      cursor.continue();
    };
    tx.onerror = () => reject(tx.error || new Error("Failed listing pending operations"));
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

export async function clearAllData() {
  const readyDb = await initStorage();
  const tx = readyDb.transaction([SHEET_STORE, OP_STORE], "readwrite");
  tx.objectStore(SHEET_STORE).clear();
  tx.objectStore(OP_STORE).clear();
  await waitForTx(tx);
}

export async function getPendingCount() {
  const readyDb = await initStorage();
  const tx = readyDb.transaction(OP_STORE, "readonly");
  const store = tx.objectStore(OP_STORE);
  const count = await promisifyRequest(store.count());
  await waitForTx(tx);
  return count;
}

