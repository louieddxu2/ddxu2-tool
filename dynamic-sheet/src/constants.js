export const DB_NAME = "DynamicSheetHub";
export const DB_VERSION = 1;
export const SHEET_STORE = "sheets";
export const OP_STORE = "operations";
export const SHEET_ID = "current_sheet";

export const DEFAULT_SCHEMA = {
  name: { label: "物件名稱", type: "text", options: [] },
  price: { label: "購入價格", type: "number", options: [] },
  status: { label: "持有狀態", type: "select", options: ["未發貨", "已持有", "已售出", "願望清單"] }
};

export const DEFAULT_ROWS = [
  { id: "1", name: "Gloomhaven", price: 3500, status: "已持有" },
  { id: "2", name: "Frosthaven", price: 5000, status: "未發貨" }
];

