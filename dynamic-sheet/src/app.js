import { clearAllData } from "./storage.js";
import { createStore } from "./state.js";
import { createSyncEngine } from "./sync.js";
import { createUI } from "./ui.js";

const store = createStore();
let ui = null;

const syncEngine = createSyncEngine((status) => {
  if (ui) ui.setSyncStatus(status);
});

async function refreshPendingStatus() {
  const pending = await store.getPendingCountSafe();
  if (window.dynamicSheetCloudAdapter) {
    ui.setSyncStatus({ text: pending > 0 ? `待同步 ${pending} 筆` : "已同步", tone: pending > 0 ? "warn" : "ok", pending });
  } else {
    ui.setSyncStatus({ text: `未連線 adapter（待同步 ${pending} 筆）`, tone: "warn", pending });
  }
}

async function onSyncNow() {
  ui.setSyncStatus({ text: "同步中...", tone: "warn", pending: await store.getPendingCountSafe() });
  await syncEngine.syncNow();
  await refreshPendingStatus();
}

async function onResetData() {
  const confirmed = window.confirm("確定要清除本地資料與同步佇列嗎？");
  if (!confirmed) return;
  await clearAllData();
  window.location.reload();
}

async function boot() {
  ui = createUI({ store, onSyncNow, onResetData });
  store.subscribe((state) => {
    ui.renderGrid(state);
    refreshPendingStatus();
  });
  await store.boot();
  await refreshPendingStatus();
}

boot().catch((error) => {
  console.error("dynamic-sheet boot failed", error);
  window.alert("初始化失敗，請重新整理頁面。");
});

