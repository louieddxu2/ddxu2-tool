Dynamic Sheet README (更新於 2026-03-05)

1. 專案定位

Dynamic Sheet 是一個手機優先 (mobile-first) 的資料編輯小工具，目標是讓使用者在小螢幕上也能快速維護類試算表資料。
核心原則：
- Local-first：所有操作先寫入本地 IndexedDB，再考慮同步雲端。
- Grid + Bottom Sheet/Modal：維持表格總覽，但編輯互動集中在可點擊的大型控制元件。
- Schema/Data 分離：欄位結構與資料列獨立儲存，降低擴充成本。

2. 目前已完成功能

- 多節點 Drawer：支援 `folder` 與 `sheet` 節點。
- 多 Sheet 本地快取：每個 sheet 以 `sheet:<spreadsheetId>` 隔離儲存。
- 權限模式：`viewer`（唯讀）與 `editor`（可編輯）。
- 資料編輯：新增/刪除列、新增/刪除欄、修改儲存格、改名列與欄位。
- 搜尋過濾：即時搜尋列資料。
- 同步佇列骨架：每次編輯會 enqueue operation，支援延遲重試 (backoff)。
- 手動 Sync 按鈕與 pending 顯示。
- 主題切換：light/dark，並記錄在 localStorage。

3. 程式架構（現況）

專案維持「無 bundler」的輕量部署方式，但已改為 ES Modules，不再是單一 HTML 包全部邏輯。

- `dynamic-sheet/index.html`
  - 頁面骨架、樣式、模組入口。
- `dynamic-sheet/src/app.js`
  - 啟動流程、UI 與 store wiring、sync status 更新。
- `dynamic-sheet/src/state.js`
  - 應用狀態管理與所有資料操作入口。
- `dynamic-sheet/src/storage.js`
  - IndexedDB 存取層（sheet/nodes/meta/operations）。
- `dynamic-sheet/src/sync.js`
  - 同步引擎與 adapter 呼叫流程。
- `dynamic-sheet/src/ui.js`
  - 渲染與事件綁定（drawer、grid、editor modal）。
- `dynamic-sheet/src/constants.js`
  - DB/store 名稱、預設 schema/rows/nodes。

4. 儲存模型

IndexedDB stores:
- `sheets`: 以 `id = sheet:<spreadsheetId>` 儲存 sheet 內容。
- `nodes`: Drawer 樹狀節點。
- `operations`: 待同步操作佇列（含 retry 與 nextRetryAt）。
- `app_meta`: app 級別設定（例如 `activeNodeId`）。

範例（簡化）：

{
  id: "sheet:local-sample",
  schema: {
    name: { label: "物件名稱", type: "text" },
    price: { label: "購入價格", type: "number" },
    status: { label: "持有狀態", type: "select", options: ["未到貨", "持有中"] }
  },
  rows: [
    { id: "1", name: "Gloomhaven", price: 3500, status: "持有中" }
  ],
  permission: "editor"
}

5. 測試與執行

可用指令（在 repo root 執行）：
- `npm run dev`：本地啟動靜態伺服器。
- `npm test`：執行 dynamic-sheet 測試（state/storage/sync）。
- `npm run test:dynamic-sheet:watch`：測試 watch 模式。

目前測試覆蓋重點：
- Google Sheet URL/ID 解析。
- viewer 權限不可編輯。
- 不同 sheet 的本地快取隔離。
- operations queue 在成功/失敗情境的行為。

6. 開發守則（重要）

- 任何資料列操作一律以 `row.id` 當主鍵，不可依賴畫面 index。
- 新增欄位型別時，編輯流程必須走 modal/bottom-sheet 互動，不使用 `prompt()`。
- 修改 table/layout overflow 時，需重新驗證 sticky header/first column 沒被破壞。
- 不要把雲端同步邏輯耦合進 UI；統一由 sync engine + adapter 處理。

7. 後續 Roadmap（建議）

階段 A（近期）
- 補齊文字與編碼清理（避免中文亂碼）。
- 統一同步狀態訊息與錯誤分類。
- 增加 UI 關鍵流程 smoke tests。

階段 B（中期）
- 實作 Google OAuth + Picker + Sheets API adapter（最小可用版）。
- 完成批次同步、衝突策略、手動重試 UX。
- 加入 network offline/online 狀態導向提示。

階段 C（長期）
- 新欄位型別：`calculator`、`auto_sum`、`image`。
- 多人協作衝突解決（版本戳或 operation-log merge）。
- 大資料量效能優化（虛擬捲動/分批渲染）。
