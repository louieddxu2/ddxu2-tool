import { GOOGLE_APP_CONFIG } from "./googleAppConfig.js";
import { createGoogleAuthManager } from "./googleAuth.js";
import { parseSpreadsheetId, resolveSheetFromInput, searchUserSheets } from "./googleSheets.js";
import { pickSpreadsheet } from "./googlePicker.js";
import { createGoogleSyncAdapter } from "./googleSyncAdapter.js";
import { clearAllData, getMeta, resetOperationBackoff, setMeta } from "./storage.js";
import { createStore } from "./state.js";
import { createSyncEngine } from "./sync.js";
import { createUI } from "./ui.js";

const GOOGLE_SCOPE = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid"
].join(" ");

const store = createStore();
let ui = null;

const googleConfig = {
  clientId: GOOGLE_APP_CONFIG.clientId,
  apiKey: GOOGLE_APP_CONFIG.apiKey,
  sheetTabName: GOOGLE_APP_CONFIG.sheetTabName
};

const googleAuth = createGoogleAuthManager({
  getClientId: () => googleConfig.clientId,
  scope: GOOGLE_SCOPE
});

let autoSyncTimer = null;

async function ensureGoogleToken() {
  await googleAuth.init();
  return googleAuth.ensureToken();
}

if (googleConfig.clientId) {
  window.dynamicSheetCloudAdapter = createGoogleSyncAdapter({
    getAccessToken: ensureGoogleToken,
    sheetTabName: googleConfig.sheetTabName
  });
}

const syncEngine = createSyncEngine({
  getActiveSheetId: () => store.getState().sheetContextId,
  getSchema: () => store.getState().schema,
  onStatus: (status) => {
    if (ui) ui.setSyncStatus(status);
  }
});

function getGoogleUiState(errorMessage = "") {
  const auth = googleAuth.getState();
  const hasConfig = Boolean(googleConfig.clientId);
  
  // Consider connected if we genuinely have a token, OR if we have the persistent flag 
  // (which means a token will just auto-refresh/prompt silently on first use).
  const connected = auth.connected || googleAuth.getPersistentState();

  return {
    connected,
    hasConfig,
    errorMessage
  };
}

function refreshGoogleStatus(errorMessage = "") {
  ui.setGoogleState(getGoogleUiState(errorMessage));
}

async function refreshPendingStatus() {
  const pending = await store.getPendingCountSafe();
  const ctx = store.getState().sheetContextId;
  if (!ctx) {
    ui.setSyncStatus({ text: "請先選擇一個 Sheet", tone: "warn", pending: 0 });
    return;
  }

  if (window.dynamicSheetCloudAdapter) {
    ui.setSyncStatus({
      text: pending > 0 ? `待同步 ${pending} 筆` : "同步佇列為空",
      tone: pending > 0 ? "warn" : "ok",
      pending
    });
  } else {
    ui.setSyncStatus({ text: `未啟用雲端同步（待同步 ${pending} 筆）`, tone: "warn", pending });
  }
}

async function runSyncFlow(options = {}) {
  const pending = await store.getPendingCountSafe();
  // Silently run sync
  if (pending === 0) return;
  await syncEngine.syncNow(options);
  await refreshPendingStatus();
}

function scheduleAutoSync() {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(async () => {
    const pending = await store.getPendingCountSafe();
    if (pending > 0 && googleAuth.getPersistentState() && window.dynamicSheetCloudAdapter) {
      await runSyncFlow();
    }
  }, 2000); // Debounce sync by 2 seconds
}



async function onResetData() {
  const confirmed = window.confirm("確定要清除所有本地資料嗎？這會重置目前 Drawer 與資料內容。\n(不會刪除你的 Google 試算表)");
  if (!confirmed) return;
  await clearAllData();
  window.location.reload();
}

async function onGoogleConnect() {
  await googleAuth.init();
  await googleAuth.connect();
  refreshGoogleStatus();
}

async function onGoogleDisconnect() {
  await googleAuth.disconnect();
  refreshGoogleStatus();
}

async function onGoogleSearchSheets(query) {
  const accessToken = await ensureGoogleToken();
  return searchUserSheets({ accessToken, query });
}

async function onGoogleLinkSheetFromSearch({ spreadsheetId, name, webViewLink, permission, parentId }) {
  const url = webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const safePermission = permission === "editor" ? "editor" : "viewer";
  await store.addSheetNode({
    name: name || "Google Sheet",
    url,
    parentId,
    permission: safePermission
  });

  if (window.dynamicSheetCloudAdapter?.pullData) {
    if (ui) ui.setSyncStatus({ text: "正在下載試算表資料...", tone: "warn", pending: 0 });
    const imported = await window.dynamicSheetCloudAdapter.pullData({ spreadsheetId });
    if (imported.ok) {
       await store.overwriteSheetData(imported.schema, imported.rows);
       if (ui) ui.setSyncStatus({ text: "資料下載完成", tone: "ok", pending: 0 });
    } else {
       if (ui) ui.setSyncStatus({ text: `下載資料失敗: ${imported.reason}`, tone: "error", pending: 0 });
       window.alert(`無法下載該試算表資料：${imported.reason}`);
    }
  }
}

async function onGoogleLinkSheetByUrl({ input, customName, permission, parentId, fromPickerOnly }) {
  const accessToken = await ensureGoogleToken();
  const picked = await pickSpreadsheet({
    accessToken,
    apiKey: googleConfig.apiKey,
    title: "請選擇試算表"
  });

  const finalTitle = customName || picked.name || "Untitled Sheet";
  const finalUrl = picked.url || `https://docs.google.com/spreadsheets/d/${picked.id}/edit`;

  const safePermission = permission === "editor" ? "editor" : "viewer";
  await store.addSheetNode({
    name: finalTitle,
    url: finalUrl,
    parentId,
    permission: safePermission
  });

  if (window.dynamicSheetCloudAdapter?.pullData) {
    const imported = await window.dynamicSheetCloudAdapter.pullData({ spreadsheetId: picked.id });
    if (imported.ok) {
       await store.overwriteSheetData(imported.schema, imported.rows);
       window.alert("匯入成功！");
    } else {
       window.alert(`無法下載該試算表資料：${imported.reason}`);
    }
  }

  return { spreadsheetId: picked.id, title: finalTitle, url: finalUrl };
}

async function onPullNow() {
  const activeNodeId = store.getState().activeNodeId;
  const node = store.getState().nodes.find(n => n.id === activeNodeId);
  if (!node || node.type !== "sheet") {
    window.alert("請先在左側選擇一個試算表節點");
    return;
  }
  
  const pending = await store.getPendingCountSafe();
  if (pending > 0) {
    if (!window.confirm(`目前有 ${pending} 筆尚未上傳的修改。若直接從雲端下載，將會遺失這些本地修改。\n是否確定要下載並覆寫本地資料？`)) return;
  } else {
    if (!window.confirm("確定要從雲端下載並覆寫目前的表格內容嗎？")) return;
  }
  
  if (window.dynamicSheetCloudAdapter?.pullData) {
    if (ui) ui.setSyncStatus({ text: "正在下載雲端資料...", tone: "warn", pending });
    const imported = await window.dynamicSheetCloudAdapter.pullData({ spreadsheetId: node.spreadsheetId });
    if (imported.ok) {
       await store.overwriteSheetData(imported.schema, imported.rows);
       if (ui) ui.setSyncStatus({ text: "下載覆蓋完成", tone: "ok", pending: await store.getPendingCountSafe() });
       window.alert("下載完成！");
    } else {
       if (ui) ui.setSyncStatus({ text: `下載失敗: ${imported.reason}`, tone: "error", pending });
       window.alert(`無法下載該試算表資料：${imported.reason}`);
    }
  } else {
    window.alert("系統尚未正確設定 Google 連線。");
  }
}

async function boot() {
  ui = createUI({
    store,
    onSyncNow,
    onPullNow,
    onSyncRetryFailed,
    onSyncRetryAll,
    onResetData,
    onGoogleConnect,
    onGoogleDisconnect,
    onGoogleSearchSheets,
    onGoogleLinkSheetFromSearch,
    onGoogleLinkSheetByUrl
  });

  const transposeButton = document.getElementById("btn-transpose");
  if (transposeButton) {
    transposeButton.addEventListener("click", async () => {
      await store.transposeSheet();
    });
  }

  store.subscribe((state) => {
    ui.render(state);
    refreshPendingStatus();
    scheduleAutoSync();
  });

  await googleAuth.init();
  refreshGoogleStatus();

  await store.boot();
  await refreshPendingStatus();
}

boot().catch((error) => {
  console.error("dynamic-sheet boot failed", error);
  if (ui) refreshGoogleStatus(error.message || "啟動失敗");
  window.alert(`初始化失敗：${error.message || "未知錯誤"}`);
});
