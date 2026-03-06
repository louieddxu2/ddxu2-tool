const env = window.__ENV_CONFIG__ || {};
const runtimeConfig = window.__DYNAMIC_SHEET_GOOGLE_CONFIG || {};

function resolveRuntimeValue(primary, ...fallbacks) {
  const all = [primary, ...fallbacks];
  for (const value of all) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export const GOOGLE_APP_CONFIG = {
  clientId: resolveRuntimeValue(
    runtimeConfig.clientId,
    window.__DYNAMIC_SHEET_GOOGLE_CLIENT_ID,
    localStorage.getItem("DYNAMIC_SHEET_GOOGLE_CLIENT_ID")
  ),
  apiKey: resolveRuntimeValue(
    runtimeConfig.apiKey,
    window.__DYNAMIC_SHEET_GOOGLE_API_KEY,
    localStorage.getItem("DYNAMIC_SHEET_GOOGLE_API_KEY")
  ),
  // 可選：指定同步到哪個分頁名稱，未設定則用第一個分頁
  sheetTabName: resolveRuntimeValue(
    runtimeConfig.sheetTabName,
    window.__DYNAMIC_SHEET_GOOGLE_SHEET_TAB_NAME,
    localStorage.getItem("DYNAMIC_SHEET_GOOGLE_SHEET_TAB_NAME")
  )
};
