import { loadGoogleConfig, saveGoogleConfig } from "./googleConfig.js";
import { createGoogleAuthManager } from "./googleAuth.js";
import { resolveSheetFromInput, searchUserSheets } from "./googleSheets.js";
import { clearAllData } from "./storage.js";
import { createStore } from "./state.js";
import { createSyncEngine } from "./sync.js";
import { createUI } from "./ui.js";

const GOOGLE_SCOPE = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.file"
].join(" ");

const store = createStore();
let ui = null;

let googleConfig = { clientId: "", apiKey: "" };
const googleAuth = createGoogleAuthManager({
  getClientId: () => googleConfig.clientId,
  scope: GOOGLE_SCOPE
});

const syncEngine = createSyncEngine({
  getActiveSheetId: () => store.getState().sheetContextId,
  onStatus: (status) => {
    if (ui) ui.setSyncStatus(status);
  }
});

function getGoogleUiState(errorMessage = "") {
  const auth = googleAuth.getState();
  const hasConfig = Boolean(googleConfig.clientId);
  const email = auth.profile?.email || "";

  if (!hasConfig) {
    return {
      tone: "warn",
      status: "尚未設定 Google Client ID",
      detail: "先在 Drawer 設定 API 後再連結帳戶",
      connected: false,
      hasConfig,
      email,
      errorMessage
    };
  }

  if (!auth.connected) {
    return {
      tone: "warn",
      status: "尚未連結 Google 帳戶",
      detail: errorMessage || "連線成功後可搜尋自己的試算表",
      connected: false,
      hasConfig,
      email,
      errorMessage
    };
  }

  return {
    tone: "ok",
    status: "Google 已連線",
    detail: email || "已授權",
    connected: true,
    hasConfig,
    email,
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
    ui.setSyncStatus({ text: `尚未接上雲端 adapter（待同步 ${pending} 筆）`, tone: "warn", pending });
  }
}

async function onSyncNow() {
  const pending = await store.getPendingCountSafe();
  ui.setSyncStatus({ text: "同步中...", tone: "warn", pending });
  await syncEngine.syncNow();
  await refreshPendingStatus();
}

async function onResetData() {
  const confirmed = window.confirm("確定要清除所有本地資料嗎？這會重置目前 Drawer 與資料內容。\n(不會刪除你的 Google 試算表)");
  if (!confirmed) return;
  await clearAllData();
  window.location.reload();
}

async function onGoogleOpenConfig() {
  ui.openGoogleConfigModal(googleConfig);
}

async function onGoogleSaveConfig(payload) {
  googleConfig = await saveGoogleConfig(payload);
  await googleAuth.init();
  refreshGoogleStatus();
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

async function ensureGoogleToken() {
  await googleAuth.init();
  return googleAuth.ensureToken();
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
}

async function onGoogleLinkSheetByUrl({ input, customName, permission, parentId }) {
  const accessToken = await ensureGoogleToken();
  const resolved = await resolveSheetFromInput({
    accessToken,
    input,
    apiKey: googleConfig.apiKey
  });

  const safePermission = permission === "editor" ? "editor" : "viewer";
  await store.addSheetNode({
    name: customName || resolved.title,
    url: resolved.url,
    parentId,
    permission: safePermission
  });

  return resolved;
}

async function boot() {
  ui = createUI({
    store,
    onSyncNow,
    onResetData,
    onGoogleOpenConfig,
    onGoogleSaveConfig,
    onGoogleConnect,
    onGoogleDisconnect,
    onGoogleSearchSheets,
    onGoogleLinkSheetFromSearch,
    onGoogleLinkSheetByUrl
  });

  store.subscribe((state) => {
    ui.render(state);
    refreshPendingStatus();
  });

  googleConfig = await loadGoogleConfig();
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
