import { clearAllData } from "./storage.js";
import { createStore } from "./state.js";
import { createSyncEngine } from "./sync.js";
import { createUI } from "./ui.js";

const store = createStore();
let ui = null;

const syncEngine = createSyncEngine({
  getActiveSheetId: () => store.getState().sheetContextId,
  onStatus: (status) => {
    if (ui) ui.setSyncStatus(status);
  }
});

async function refreshPendingStatus() {
  const pending = await store.getPendingCountSafe();
  const ctx = store.getState().sheetContextId;
  if (!ctx) {
    ui.setSyncStatus({ text: "未選擇 Sheet 節點", tone: "warn", pending: 0 });
    return;
  }
  if (window.dynamicSheetCloudAdapter) {
    ui.setSyncStatus({ text: pending > 0 ? `待同步 ${pending} 筆` : "已同步", tone: pending > 0 ? "warn" : "ok", pending });
  } else {
    ui.setSyncStatus({ text: `未連線 adapter（待同步 ${pending} 筆）`, tone: "warn", pending });
  }
}

async function onSyncNow() {
  const pending = await store.getPendingCountSafe();
  ui.setSyncStatus({ text: "同步中...", tone: "warn", pending });
  await syncEngine.syncNow();
  await refreshPendingStatus();
}

async function onResetData() {
  const confirmed = window.confirm("確定要清除本地資料、同步佇列與 Drawer 節點嗎？");
  if (!confirmed) return;
  await clearAllData();
  window.location.reload();
}

async function boot() {
  ui = createUI({ store, onSyncNow, onResetData });
  store.subscribe((state) => {
    ui.render(state);
    refreshPendingStatus();
  });
  await store.boot();
  await refreshPendingStatus();
}

boot().catch((error) => {
  console.error("dynamic-sheet boot failed", error);
  window.alert("初始化失敗，請重新整理頁面。");
});

