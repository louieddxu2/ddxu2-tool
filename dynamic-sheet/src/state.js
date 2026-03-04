import { DEFAULT_ROWS, DEFAULT_SCHEMA } from "./constants.js";
import { enqueueOperation, getPendingCount, loadSheet, saveSheet } from "./storage.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore() {
  const state = {
    schema: deepClone(DEFAULT_SCHEMA),
    rows: deepClone(DEFAULT_ROWS),
    searchQuery: ""
  };
  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  async function persist() {
    await saveSheet({ schema: state.schema, rows: state.rows });
  }

  async function boot() {
    const saved = await loadSheet();
    if (saved && saved.schema && saved.rows) {
      state.schema = saved.schema;
      state.rows = saved.rows;
    } else {
      await persist();
    }
    notify();
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

  async function addRow() {
    const nextIndex = state.rows.length + 1;
    const newRow = { id: String(Date.now()), name: `物件 ${nextIndex}` };
    state.rows.push(newRow);
    await enqueueOperation("row_add", { row: newRow });
    await persist();
    notify();
  }

  async function addColumn() {
    const key = `col_${Date.now()}`;
    const index = Object.keys(state.schema).length;
    state.schema[key] = { label: `屬性 ${index}`, type: "text", options: [] };
    await enqueueOperation("column_add", { key, config: state.schema[key] });
    await persist();
    notify();
  }

  async function updateCell(rowId, key, value) {
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;
    row[key] = value;
    await enqueueOperation("cell_update", { rowId, key, value });
    await persist();
    notify();
  }

  async function renameRow(rowId, name) {
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;
    row.name = name;
    await enqueueOperation("row_rename", { rowId, name });
    await persist();
    notify();
  }

  async function deleteRow(rowId) {
    const before = state.rows.length;
    state.rows = state.rows.filter((item) => item.id !== rowId);
    if (state.rows.length === before) return;
    await enqueueOperation("row_delete", { rowId });
    await persist();
    notify();
  }

  async function updateColumn(key, config) {
    if (!state.schema[key]) return;
    state.schema[key] = { ...state.schema[key], ...config };
    await enqueueOperation("column_update", { key, config: state.schema[key] });
    await persist();
    notify();
  }

  async function deleteColumn(key) {
    if (key === "name" || !state.schema[key]) return;
    delete state.schema[key];
    state.rows.forEach((row) => delete row[key]);
    await enqueueOperation("column_delete", { key });
    await persist();
    notify();
  }

  async function getPendingCountSafe() {
    return getPendingCount();
  }

  return {
    boot,
    subscribe,
    getState,
    setSearchQuery,
    addRow,
    addColumn,
    updateCell,
    renameRow,
    deleteRow,
    updateColumn,
    deleteColumn,
    getPendingCountSafe
  };
}

