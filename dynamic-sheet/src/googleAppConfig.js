const runtimeConfig = window.__DYNAMIC_SHEET_GOOGLE_CONFIG || {};

export const GOOGLE_APP_CONFIG = {
  clientId: String(runtimeConfig.clientId || "").trim(),
  apiKey: String(runtimeConfig.apiKey || "").trim(),
  // 可選：指定同步到哪個分頁名稱，未設定則用第一個分頁
  sheetTabName: String(runtimeConfig.sheetTabName || "").trim()
};
