專案開發指南：Dynamic Sheet Hub (動態表單中心)

1. 專案背景與核心願景

本專案旨在解決「在手機上操作傳統 Excel/Google 試算表極度困難」的痛點。
目標是打造一款**「手機優先、大按鈕操作、架構動態可調」**的 PWA 雲端試算表編輯器。

核心設計理念：

介面分離： 視覺上維持二維表格（Grid）的總覽感，但所有編輯動作必須透過底部彈出窗（Bottom Sheet）的專屬控制項（大選單、數字鍵盤等）進行，避免在小格子內直接輸入文字。

Metadata 與 Data 分離： 試算表的「欄位架構（Schema）」與「實際資料（Data）」分開定義。修改屬性類型不影響底層資料，賦予極高的擴充彈性。

本地優先 (Local-First)： 目前階段所有操作皆以 IndexedDB 儲存，確保無網路狀態下依然具備極速的操作體感。

2. 當前技術架構 (Baseline Stack)

為維持小工具的輕量化與隨插即用，本專案目前不依賴任何建置流程 (No Webpack/Vite/Node.js)。

核心框架： 單一 index.html 包含所有 HTML/CSS/JS。

UI 樣式： Tailwind CSS (CDN 版本) + 內建暗色模式 (.dark class)。

圖示庫： Lucide Icons (CDN 版本)。

資料庫： 原生 window.indexedDB，已用 Promise 封裝為非同步函式 (initDB, loadFromDB, saveToDB)。

狀態儲存： 深淺色主題紀錄使用 localStorage。

3. 核心資料結構 (Data Structure)

專案的靈魂在於動態生成的 JSON 結構。目前 IndexedDB 內的單一試算表資料如下：

{
  id: 'current_sheet', // 預留給未來多表單管理的主鍵
  schema: {
    // 鍵值(key)通常為隨機字串(如 col_12345)，name 為保留字(物件名稱)
    name: { label: '遊戲名稱', type: 'text' },
    col_1: { label: '購入價格', type: 'number' },
    col_2: { label: '持有狀態', type: 'select', options: ['未發貨', '已持有', '已售出'] }
  },
  data: [
    { id: '1700000000001', name: 'Gloomhaven', col_1: 3500, col_2: '已持有' },
    { id: '1700000000002', name: 'Frosthaven', col_1: 5000, col_2: '未發貨' }
  ]
}


⚠️ 重要開發守則：ID 綁定原則

絕對不要使用 Array Index 來綁定 UI 事件！ 由於系統實作了即時查詢（Search Filter）功能，畫面上的 Row Index 會偏移。所有資料列的編輯、刪除操作，必須強制傳遞並比對 row.id，以確保操作對象正確。

4. UI 架構與設計模式

表格凍結窗格： 使用純 CSS position: sticky 實現 X 軸（表頭）與 Y 軸（第一欄：物件名稱）的固定，維持試算表的查閱手感。

EditorFactory (策略模式/工廠模式)： 所有屬性的編輯器 UI 都封裝在 EditorFactory 物件中。這是為未來高擴充性留下的接口。新增一種屬性（例如：計算機），只需在 Factory 內新增一個回傳 HTML 字串的函式即可。

置中懸浮編輯器 (Modal)： 編輯視窗採用 bg-white/75 與 backdrop-blur-md 實現無明顯遮罩的毛玻璃效果，確保使用者能同時參考背後的表格數據。

5. 未來開發藍圖與擴充準備 (Roadmap)

階段一：屬性編輯器擴充 (Editor Expansion)

目前的 EditorFactory 僅有 text, number, select。未來可直接擴充：

calculator: 點擊跳出滿版的九宮格數字計算機，包含 +5, +10 等快速加總按鈕（適用於桌遊計分）。

auto_sum: 公式欄位，由使用者勾選要加總的屬性，該欄位變為 Read-only 自動計算結果。

image: 串接手機原生相機 API 或圖片上傳。

階段二：架構模組化 (Refactoring)

當程式碼超過 1000 行時，建議將單一 HTML 拆分為 ES Modules (<script type="module">)：

db.js: 處理 IndexedDB 邏輯。

factory.js: 獨立 EditorFactory。

app.js: 處理 DOM 操作與事件監聽。

階段三：多表單與側欄管理 (Multiple Sheets)

目前 IndexedDB 的 ID 寫死為 current_sheet。

下一步應完善側邊欄 (Sidebar) 功能，允許使用者「新增專案」，產生新的 Sheet ID 並動態切換 loadFromDB(sheetId)。

階段四：終極目標 - Google Sheets 同步 (Google API)

通訊協定： 引入 Google Identity Services (OAuth 2.0) 與 Google Sheets API。

權限級別： 強烈建議使用 https://www.googleapis.com/auth/drive.file 權限，結合 Google Picker API，確保 App 只能讀寫使用者指定的試算表，保障資安。

同步策略 (Lazy Sync)： 維持 Local-First 架構。使用者操作時先寫入 IndexedDB 並更新 UI，背後建立一個 Sync Queue (同步佇列)，定時或在網路順暢時將 Queue 中的差異（Diff）推送到 Google Sheets。

6. 給接手 AI 的協作指引 (Prompt Guidelines)

嗨，接手的 AI 開發者：

遵守現有架構： 請維持 Tailwind CSS + Vanilla JS 的無建置架構，除非使用者明確要求導入 React/Vue 等框架。

編輯模式的鐵則： 任何新增的屬性類型，其編輯行為「必須」發生在 EditorFactory 生成的 Bottom Sheet / Modal 內，禁止使用原生的 prompt() 或覆蓋掉目前的二維表格視圖。

資料正確性： 處理資料增刪改查時，請務必以 row.id 為主要 Key，忽略畫面上的 Index。

CSS 注意事項： 本專案依賴 position: sticky 實現表格凍結，若修改 main 或 table 容器的 overflow 屬性時，請務必確認不會破壞凍結窗格的效果。