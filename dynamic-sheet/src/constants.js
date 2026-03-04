export const DB_NAME = "DynamicSheetHub";
export const DB_VERSION = 2;
export const SHEET_STORE = "sheets";
export const OP_STORE = "operations";
export const NODE_STORE = "nodes";
export const APP_META_STORE = "app_meta";

export const ROOT_NODE_ID = "root";
export const DEFAULT_ACTIVE_NODE_ID = "sample_sheet";

export const DEFAULT_SCHEMA = {
  name: { label: "物件名稱", type: "text", options: [] },
  price: { label: "購入價格", type: "number", options: [] },
  status: { label: "持有狀態", type: "select", options: ["未發貨", "已持有", "已售出", "願望清單"] }
};

export const DEFAULT_ROWS = [
  { id: "1", name: "Gloomhaven", price: 3500, status: "已持有" },
  { id: "2", name: "Frosthaven", price: 5000, status: "未發貨" }
];

export const DEFAULT_NODES = [
  {
    id: ROOT_NODE_ID,
    type: "folder",
    name: "Workspace",
    parentId: null,
    order: 0,
    createdAt: Date.now()
  },
  {
    id: DEFAULT_ACTIVE_NODE_ID,
    type: "sheet",
    name: "Sample Sheet",
    parentId: ROOT_NODE_ID,
    order: 0,
    spreadsheetId: "local-sample",
    url: "",
    permission: "editor",
    createdAt: Date.now()
  }
];

