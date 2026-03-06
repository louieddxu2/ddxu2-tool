import {
  DEFAULT_ACTIVE_NODE_ID,
  DEFAULT_NODES,
  DEFAULT_ROWS,
  DEFAULT_SCHEMA,
  ROOT_NODE_ID
} from "./constants.js";
import {
  enqueueOperation,
  getMeta,
  getPendingCount,
  listNodes,
  loadSheetById,
  saveNodes,
  saveSheetById,
  setMeta
} from "./storage.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseSpreadsheetId(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function createStore() {
  const state = {
    nodes: [],
    activeNodeId: null,
    schema: deepClone(DEFAULT_SCHEMA),
    rows: deepClone(DEFAULT_ROWS),
    searchQuery: "",
    sheetPermission: "editor",
    sheetContextId: "local-sample"
  };

  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  function getNode(nodeId) {
    return state.nodes.find((node) => node.id === nodeId) || null;
  }

  function getChildren(parentId) {
    return state.nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getSheetStorageIdFromNode(node) {
    return `sheet:${node.spreadsheetId}`;
  }

  async function persistNodes() {
    await saveNodes(state.nodes);
  }

  async function persistCurrentSheet() {
    const active = getNode(state.activeNodeId);
    if (!active || active.type !== "sheet") return;
    await saveSheetById(getSheetStorageIdFromNode(active), {
      schema: state.schema,
      rows: state.rows,
      permission: state.sheetPermission
    });
  }

  async function ensureDefaultData() {
    state.nodes = deepClone(DEFAULT_NODES);
    await persistNodes();
    await setMeta("activeNodeId", DEFAULT_ACTIVE_NODE_ID);
    const sample = state.nodes.find((node) => node.id === DEFAULT_ACTIVE_NODE_ID);
    await saveSheetById(getSheetStorageIdFromNode(sample), {
      schema: deepClone(DEFAULT_SCHEMA),
      rows: deepClone(DEFAULT_ROWS),
      permission: "editor"
    });
  }

  async function loadActiveSheet(nodeId) {
    const node = getNode(nodeId);
    if (!node || node.type !== "sheet") {
      state.activeNodeId = nodeId;
      state.sheetContextId = "";
      state.sheetPermission = "viewer";
      state.schema = deepClone(DEFAULT_SCHEMA);
      state.rows = [];
      notify();
      return;
    }

    state.activeNodeId = node.id;
    state.sheetContextId = node.spreadsheetId;
    state.sheetPermission = node.permission || "viewer";
    const saved = await loadSheetById(getSheetStorageIdFromNode(node));
    if (saved && saved.schema && saved.rows) {
      state.schema = saved.schema;
      state.rows = saved.rows;
      state.sheetPermission = saved.permission || state.sheetPermission;
    } else {
      state.schema = deepClone(DEFAULT_SCHEMA);
      state.rows = deepClone(DEFAULT_ROWS);
      await persistCurrentSheet();
    }
    await setMeta("activeNodeId", node.id);
    notify();
  }

  async function boot() {
    let nodes = await listNodes();
    if (!nodes || nodes.length === 0) {
      await ensureDefaultData();
      nodes = await listNodes();
    }
    state.nodes = nodes;
    const activeFromMeta = await getMeta("activeNodeId");
    const nextActive = activeFromMeta && getNode(activeFromMeta) ? activeFromMeta : DEFAULT_ACTIVE_NODE_ID;
    await loadActiveSheet(nextActive);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return state;
  }

  function setSearchQuery(query) {
    state.searchQuery = (query || "").toLowerCase();
    notify();
  }

  async function setActiveNode(nodeId) {
    await loadActiveSheet(nodeId);
  }

  function canEditCurrentSheet() {
    return state.sheetPermission === "editor";
  }

  async function addFolder(name, parentId = ROOT_NODE_ID) {
    const cleanName = (name || "").trim();
    if (!cleanName) throw new Error("Folder name is required");
    const siblings = getChildren(parentId);
    const node = {
      id: `folder_${Date.now()}`,
      type: "folder",
      name: cleanName,
      parentId,
      order: siblings.length,
      createdAt: Date.now()
    };
    state.nodes.push(node);
    await persistNodes();
    notify();
  }

  async function addSheetNode({ name, url, parentId = ROOT_NODE_ID, permission = "viewer" }) {
    const spreadsheetId = parseSpreadsheetId(url);
    if (!spreadsheetId) throw new Error("Invalid Google Sheet URL");
    const cleanName = (name || "").trim() || `Sheet ${state.nodes.length + 1}`;

    const siblings = getChildren(parentId);
    const node = {
      id: `sheet_${Date.now()}`,
      type: "sheet",
      name: cleanName,
      parentId,
      order: siblings.length,
      spreadsheetId,
      url: (url || "").trim(),
      permission,
      createdAt: Date.now()
    };
    state.nodes.push(node);
    await persistNodes();
    await saveSheetById(getSheetStorageIdFromNode(node), {
      schema: deepClone(DEFAULT_SCHEMA),
      rows: deepClone(DEFAULT_ROWS),
      permission
    });
    await loadActiveSheet(node.id);
  }

  async function addRow() {
    if (!canEditCurrentSheet()) return;
    const nextIndex = state.rows.length + 1;
    const newRow = { id: String(Date.now()), name: `物件 ${nextIndex}` };
    state.rows.push(newRow);
    await enqueueOperation(state.sheetContextId, "row_add", { row: newRow });
    await persistCurrentSheet();
    notify();
  }

  async function addColumn() {
    if (!canEditCurrentSheet()) return;
    const key = `col_${Date.now()}`;
    const index = Object.keys(state.schema).length;
    state.schema[key] = { label: `屬性 ${index}`, type: "text", options: [] };
    await enqueueOperation(state.sheetContextId, "column_add", { key, config: state.schema[key] });
    await persistCurrentSheet();
    notify();
  }

  async function updateCell(rowId, key, value) {
    if (!canEditCurrentSheet()) return;
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;
    row[key] = value;
    await enqueueOperation(state.sheetContextId, "cell_update", { rowId, key, value });
    await persistCurrentSheet();
    notify();
  }

  async function renameRow(rowId, name) {
    if (!canEditCurrentSheet()) return;
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;
    row.name = name;
    await enqueueOperation(state.sheetContextId, "row_rename", { rowId, name });
    await persistCurrentSheet();
    notify();
  }

  async function deleteRow(rowId) {
    if (!canEditCurrentSheet()) return;
    const before = state.rows.length;
    state.rows = state.rows.filter((item) => item.id !== rowId);
    if (state.rows.length === before) return;
    await enqueueOperation(state.sheetContextId, "row_delete", { rowId });
    await persistCurrentSheet();
    notify();
  }

  async function updateColumn(key, config) {
    if (!canEditCurrentSheet()) return;
    if (!state.schema[key]) return;
    state.schema[key] = { ...state.schema[key], ...config };
    await enqueueOperation(state.sheetContextId, "column_update", { key, config: state.schema[key] });
    await persistCurrentSheet();
    notify();
  }

  async function deleteColumn(key) {
    if (!canEditCurrentSheet()) return;
    if (key === "name" || !state.schema[key]) return;
    delete state.schema[key];
    state.rows.forEach((row) => delete row[key]);
    await enqueueOperation(state.sheetContextId, "column_delete", { key });
    await persistCurrentSheet();
    notify();
  }
  function createTransposeResult() {
    const oldSchemaKeys = Object.keys(state.schema).filter((key) => key !== "name");
    const oldRows = state.rows.map((row) => ({ ...row }));
    const oldSchema = { ...state.schema };

    const nameConfig = oldSchema.name || { label: "物件名稱", type: "text", options: [] };
    const nextSchema = { name: { ...nameConfig, type: "text", options: [] } };
    const ts = Date.now();
    const generatedColumnKeys = oldRows.map((_, index) => `col_t_${ts}_${index + 1}`);
    generatedColumnKeys.forEach((key, index) => {
      const label = String(oldRows[index]?.name || `物件 ${index + 1}`);
      nextSchema[key] = { label, type: "text", options: [] };
    });

    const nextRows = oldSchemaKeys.map((oldKey, rowIndex) => {
      const sourceConfig = oldSchema[oldKey] || {};
      const row = {
        id: `row_t_${ts}_${rowIndex + 1}`,
        name: String(sourceConfig.label || oldKey)
      };
      generatedColumnKeys.forEach((newKey, colIndex) => {
        row[newKey] = oldRows[colIndex]?.[oldKey] ?? "";
      });
      return row;
    });

    return { nextSchema, nextRows, oldRows, oldSchemaKeys, generatedColumnKeys };
  }

  async function transposeSheet() {
    if (!canEditCurrentSheet()) return;
    if (!state.sheetContextId) return;

    const { nextSchema, nextRows, oldRows, oldSchemaKeys, generatedColumnKeys } = createTransposeResult();

    state.schema = nextSchema;
    state.rows = nextRows;

    for (const row of oldRows) {
      await enqueueOperation(state.sheetContextId, "row_delete", { rowId: row.id });
    }
    for (const key of oldSchemaKeys) {
      await enqueueOperation(state.sheetContextId, "column_delete", { key });
    }
    for (const key of generatedColumnKeys) {
      await enqueueOperation(state.sheetContextId, "column_add", { key, config: state.schema[key] });
    }
    for (const row of nextRows) {
      await enqueueOperation(state.sheetContextId, "row_add", { row });
    }

    await persistCurrentSheet();
    notify();
  }

  async function getPendingCountSafe() {
    if (!state.sheetContextId) return 0;
    return getPendingCount(state.sheetContextId);
  }

  return {
    boot,
    subscribe,
    getState,
    setSearchQuery,
    setActiveNode,
    canEditCurrentSheet,
    addFolder,
    addSheetNode,
    addRow,
    addColumn,
    updateCell,
    renameRow,
    deleteRow,
    updateColumn,
    deleteColumn,
    transposeSheet,
    getPendingCountSafe,
    parseSpreadsheetId
  };
}



