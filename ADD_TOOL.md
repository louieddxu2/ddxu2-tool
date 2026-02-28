# 新增工具流程（單資料夾、單檔）

## 核心規則
- 每個工具放在根目錄下一個資料夾，例如 `your-tool/`。
- 該資料夾至少有 `index.html`。
- 工具頁維持單檔，不依賴額外 bootstrap 檔案。
- 建議直接複製 `TOOL_TEMPLATE.html` 作為起始模板。

## 目錄結構

```text
/
  index.html
  your-tool/
    index.html
```

## 部署流程
1. 新增或修改 `your-tool/index.html`。
2. Commit 並 push 到 GitHub。
3. Vercel 自動部署。
4. 使用者首次開啟 `/your-tool/`。
5. 該工具會自動註冊到首頁大廳（透過 localStorage）。

## 快取與更新策略
- `vercel.json` 對 HTML 使用 `no-cache, must-revalidate`。
- 沒有更新時通常回 `304`，不會重新下載完整內容。
- 有更新時，使用者下次打開頁面就會拿到新版本。

## 設計與實作約束（給其他 AI）
- 視覺風格跟首頁一致：淺底、藍色主題、圓角、低干擾動畫。
- 手機優先，內容容器建議 `max-w-md`。
- 資料保存使用 `localStorage` 或 `IndexedDB`。
- 不要引入建置流程與後端 API 依賴。
- 第三方 CDN 請鎖定版本，不要使用 `@latest`。
