import { ROOT_NODE_ID } from "./constants.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function walkTree(nodes, parentId = ROOT_NODE_ID, depth = 0, out = []) {
  const children = nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const node of children) {
    out.push({ node, depth });
    if (node.type === "folder") walkTree(nodes, node.id, depth + 1, out);
  }
  return out;
}

export function createUI({
  store,
  onSyncNow,
  onResetData,
  onGoogleConnect,
  onGoogleDisconnect,
  onGoogleSearchSheets,
  onGoogleLinkSheetFromSearch,
  onGoogleLinkSheetByUrl
}) {
  const mainContent = document.getElementById("main-content");
  const searchBar = document.getElementById("search-bar");
  const inputSearch = document.getElementById("input-search");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const syncStatus = document.getElementById("sync-status");
  const pendingCount = document.getElementById("pending-count");

  const editorOverlay = document.getElementById("editor-overlay");
  const editorSheet = document.getElementById("editor-sheet");
  const editorTitle = document.getElementById("editor-title");
  const editorSubtitle = document.getElementById("editor-subtitle");
  const editorBody = document.getElementById("editor-body");

  const drawerTree = document.getElementById("drawer-tree");
  const btnNewFolder = document.getElementById("btn-new-folder");
  const btnNewSheet = document.getElementById("btn-new-sheet");

  const googleAuthStatus = document.getElementById("google-auth-status");
  const googleAuthDetail = document.getElementById("google-auth-detail");
  const btnGoogleConnect = document.getElementById("btn-google-connect");
  const btnGoogleDisconnect = document.getElementById("btn-google-disconnect");
  const btnGoogleFind = document.getElementById("btn-google-find");
  const btnGoogleLinkUrl = document.getElementById("btn-google-link-url");

  let googleState = {
    connected: false,
    hasConfig: false,
    status: "尚未連線",
    detail: ""
  };

  function initTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = localStorage.getItem("theme");
    const useDark = theme ? theme === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", useDark);
    document.getElementById("icon-theme").setAttribute("data-lucide", useDark ? "sun" : "moon");
  }

  function setSyncStatus({ text, tone, pending }) {
    syncStatus.textContent = text;
    syncStatus.className = "text-sm font-semibold";
    if (tone === "ok") syncStatus.classList.add("text-emerald-600");
    if (tone === "warn") syncStatus.classList.add("text-amber-600");
    if (tone === "error") syncStatus.classList.add("text-rose-600");
    pendingCount.textContent = `待同步 ${pending} 筆`;
  }

  function setGoogleState(state) {
    googleState = { ...googleState, ...state };

    googleAuthStatus.textContent = googleState.status || "尚未連線";
    googleAuthStatus.className = "text-sm font-semibold";
    if (googleState.tone === "ok") googleAuthStatus.classList.add("text-emerald-600");
    if (googleState.tone === "warn") googleAuthStatus.classList.add("text-amber-600");
    if (googleState.tone === "error") googleAuthStatus.classList.add("text-rose-600");

    googleAuthDetail.textContent = googleState.detail || "";

    btnGoogleConnect.disabled = !googleState.hasConfig;
    btnGoogleConnect.classList.toggle("opacity-50", !googleState.hasConfig);

    btnGoogleDisconnect.disabled = !googleState.connected;
    btnGoogleDisconnect.classList.toggle("opacity-50", !googleState.connected);

    const canUseGoogleActions = googleState.connected;
    btnGoogleFind.disabled = !canUseGoogleActions;
    btnGoogleFind.classList.toggle("opacity-50", !canUseGoogleActions);

    btnGoogleLinkUrl.disabled = !canUseGoogleActions;
    btnGoogleLinkUrl.classList.toggle("opacity-50", !canUseGoogleActions);
  }

  function toggleSidebar() {
    if (sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      sidebarOverlay.classList.add("opacity-0");
      setTimeout(() => sidebarOverlay.classList.add("hidden"), 200);
    } else {
      sidebarOverlay.classList.remove("hidden");
      setTimeout(() => {
        sidebarOverlay.classList.remove("opacity-0");
        sidebar.classList.add("open");
      }, 10);
    }
  }

  function closeEditor() {
    editorSheet.classList.remove("scale-100", "opacity-100");
    editorSheet.classList.add("scale-95", "opacity-0");
    setTimeout(() => editorOverlay.classList.add("hidden"), 200);
  }

  function showEditor(title, subtitle, html) {
    editorTitle.textContent = title;
    editorSubtitle.textContent = subtitle;
    editorBody.innerHTML = html;
    editorOverlay.classList.remove("hidden");
    setTimeout(() => {
      editorSheet.classList.remove("scale-95", "opacity-0");
      editorSheet.classList.add("scale-100", "opacity-100");
    }, 10);
  }

  function collectFolderOptions() {
    const nodes = store.getState().nodes.filter((node) => node.type === "folder");
    if (nodes.length === 0) return `<option value="${ROOT_NODE_ID}">Workspace</option>`;
    return nodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.name)}</option>`).join("");
  }

  function renderDrawer(state) {
    const rows = walkTree(state.nodes);
    if (rows.length === 0) {
      drawerTree.innerHTML = '<p class="text-xs text-slate-500">No nodes</p>';
      return;
    }

    let html = "";
    for (const { node, depth } of rows) {
      const active = state.activeNodeId === node.id;
      const isFolder = node.type === "folder";
      const pad = 10 + depth * 16;
      const base = active
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
      const icon = isFolder ? "folder" : "table-2";
      const sub = !isFolder
        ? `<span class="text-[10px] ${node.permission === "editor" ? "text-emerald-600" : "text-amber-600"}">${node.permission || "viewer"}</span>`
        : "";

      html += `
        <button class="w-full text-left rounded-lg border px-2 py-2 mb-1 ${base}" data-node-id="${escapeHtml(node.id)}" style="padding-left:${pad}px">
          <span class="inline-flex items-center gap-2">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
            <span class="font-medium text-sm">${escapeHtml(node.name)}</span>
            ${sub}
          </span>
        </button>
      `;
    }
    drawerTree.innerHTML = html;
    window.lucide.createIcons({ root: drawerTree });
  }

  function renderGrid(state) {
    const schemaKeys = Object.keys(state.schema);
    const filteredRows = state.rows.filter((row) => {
      if (!state.searchQuery) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(state.searchQuery));
    });

    let html = '<table class="w-full text-sm whitespace-nowrap">';
    html += "<thead><tr>";
    html += '<th class="sticky-corner bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-700 p-3 text-left text-slate-500 dark:text-slate-400 font-bold min-w-[140px] shadow-sm">物件名稱</th>';
    for (const key of schemaKeys) {
      if (key === "name") continue;
      html += `<th class="sticky-header clickable bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-700 p-3 text-center text-slate-500 dark:text-slate-400 font-bold min-w-[110px] shadow-sm cursor-pointer transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" data-col-edit="${escapeHtml(key)}">${escapeHtml(state.schema[key].label)}</th>`;
    }
    html += "</tr></thead>";

    html += "<tbody>";
    if (!state.sheetContextId) {
      html += `<tr><td colspan="${Math.max(1, schemaKeys.length)}" class="p-10 text-center text-slate-400">請先在左側選擇一個 Sheet</td></tr>`;
    } else if (filteredRows.length === 0) {
      html += `<tr><td colspan="${schemaKeys.length}" class="p-10 text-center text-slate-400">目前沒有符合搜尋結果</td></tr>`;
    } else {
      for (const row of filteredRows) {
        html += "<tr>";
        html += `<td class="sticky-col clickable bg-slate-100 dark:bg-slate-800/90 border-b border-r border-slate-300 dark:border-slate-700 p-3 font-bold text-slate-800 dark:text-slate-200 shadow-sm max-w-[170px] overflow-hidden text-ellipsis cursor-pointer transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" data-row-edit="${escapeHtml(row.id)}">${escapeHtml(row.name)}</td>`;
        for (const key of schemaKeys) {
          if (key === "name") continue;
          html += `<td class="data-cell bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-3 text-center text-slate-700 dark:text-slate-300 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" data-cell-edit="${escapeHtml(row.id)}" data-cell-key="${escapeHtml(key)}">${escapeHtml(row[key] || "")}</td>`;
        }
        html += "</tr>";
      }
    }
    html += "</tbody></table>";
    mainContent.innerHTML = html;
  }

  function setEditButtonsEnabled(enabled) {
    document.getElementById("btn-add-row").disabled = !enabled;
    document.getElementById("btn-add-column").disabled = !enabled;
    document.getElementById("btn-add-row").classList.toggle("opacity-50", !enabled);
    document.getElementById("btn-add-column").classList.toggle("opacity-50", !enabled);
  }

  function openCellEditor(rowId, key) {
    if (!store.canEditCurrentSheet()) return;
    const state = store.getState();
    const row = state.rows.find((item) => item.id === rowId);
    const config = state.schema[key];
    if (!row || !config) return;

    if (config.type === "select") {
      let html = '<div class="flex flex-col gap-3">';
      for (const option of config.options || []) {
        const selected = option === row[key];
        const style = selected
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600";
        html += `<button class="btn-select-option w-full py-3 rounded-xl border text-base font-semibold ${style}" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
      }
      html += '<button class="btn-select-option w-full py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 font-semibold" data-value="">清空</button>';
      html += "</div>";
      showEditor(config.label, row.name, html);
      editorBody.querySelectorAll(".btn-select-option").forEach((button) => {
        button.addEventListener("click", async () => {
          await store.updateCell(rowId, key, button.getAttribute("data-value") || "");
          closeEditor();
        });
      });
      return;
    }

    const inputType = config.type === "number" ? "number" : "text";
    const html = `
      <input id="editor-input" type="${inputType}" value="${escapeHtml(row[key] || "")}" class="w-full p-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <button id="editor-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">儲存</button>
    `;
    showEditor(config.label, row.name, html);
    const input = document.getElementById("editor-input");
    setTimeout(() => input.focus(), 80);
    document.getElementById("editor-save").addEventListener("click", async () => {
      await store.updateCell(rowId, key, input.value);
      closeEditor();
    });
  }

  function openRowEditor(rowId) {
    if (!store.canEditCurrentSheet()) return;
    const state = store.getState();
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;

    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">物件名稱</label>
      <input id="row-name-input" type="text" value="${escapeHtml(row.name)}" class="w-full p-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <button id="row-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">儲存</button>
      <button id="row-delete" class="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 py-3 rounded-xl font-semibold">刪除這列</button>
    `;
    showEditor("編輯資料列", "可修改名稱或刪除", html);

    const input = document.getElementById("row-name-input");
    setTimeout(() => input.focus(), 80);

    document.getElementById("row-save").addEventListener("click", async () => {
      const val = input.value.trim();
      if (!val) return;
      await store.renameRow(rowId, val);
      closeEditor();
    });

    document.getElementById("row-delete").addEventListener("click", async () => {
      if (!window.confirm(`確定刪除資料列「${row.name}」嗎？`)) return;
      await store.deleteRow(rowId);
      closeEditor();
    });
  }

  function openColumnEditor(key) {
    if (!store.canEditCurrentSheet()) return;
    const state = store.getState();
    const config = state.schema[key];
    if (!config) return;

    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">欄位名稱</label>
      <input id="col-label-input" type="text" value="${escapeHtml(config.label)}" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">欄位類型</label>
      <select id="col-type-input" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base">
        <option value="text" ${config.type === "text" ? "selected" : ""}>文字</option>
        <option value="number" ${config.type === "number" ? "selected" : ""}>數字</option>
        <option value="select" ${config.type === "select" ? "selected" : ""}>選單</option>
      </select>
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">選單項目（逗號分隔）</label>
      <input id="col-options-input" type="text" value="${escapeHtml((config.options || []).join(","))}" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <button id="col-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">儲存欄位設定</button>
      ${key === "name" ? "" : '<button id="col-delete" class="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 py-3 rounded-xl font-semibold">刪除欄位</button>'}
    `;
    showEditor("欄位設定", config.label, html);

    document.getElementById("col-save").addEventListener("click", async () => {
      const label = document.getElementById("col-label-input").value.trim();
      const type = document.getElementById("col-type-input").value;
      const options = document.getElementById("col-options-input").value.split(",").map((v) => v.trim()).filter(Boolean);
      if (!label) return;
      await store.updateColumn(key, { label, type, options });
      closeEditor();
    });

    const deleteBtn = document.getElementById("col-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!window.confirm(`確定刪除欄位「${config.label}」嗎？`)) return;
        await store.deleteColumn(key);
        closeEditor();
      });
    }
  }

  function openCreateFolderModal() {
    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">資料夾名稱</label>
      <input id="new-folder-name" type="text" placeholder="例如：桌遊專案" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">放到哪個資料夾</label>
      <select id="new-folder-parent" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base">${collectFolderOptions()}</select>
      <button id="new-folder-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">建立資料夾</button>
    `;
    showEditor("新增資料夾", "Drawer 樹狀節點", html);

    const input = document.getElementById("new-folder-name");
    setTimeout(() => input.focus(), 80);

    document.getElementById("new-folder-save").addEventListener("click", async () => {
      const name = input.value.trim();
      const parentId = document.getElementById("new-folder-parent").value;
      if (!name) return;
      await store.addFolder(name, parentId);
      closeEditor();
    });
  }

  function openCreateSheetModal() {
    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">Sheet 顯示名稱</label>
      <input id="new-sheet-name" type="text" placeholder="例如：庫存清單" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">Google Sheet 網址或 ID</label>
      <input id="new-sheet-url" type="text" placeholder="https://docs.google.com/spreadsheets/d/..." class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">權限</label>
      <select id="new-sheet-permission" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base">
        <option value="viewer">Viewer (read only)</option>
        <option value="editor">Editor</option>
      </select>
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">放到哪個資料夾</label>
      <select id="new-sheet-parent" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base">${collectFolderOptions()}</select>
      <button id="new-sheet-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">建立 Sheet 節點</button>
    `;
    showEditor("新增 Sheet", "可貼網址或直接貼 ID", html);

    const input = document.getElementById("new-sheet-name");
    setTimeout(() => input.focus(), 80);

    document.getElementById("new-sheet-save").addEventListener("click", async () => {
      const name = document.getElementById("new-sheet-name").value.trim();
      const url = document.getElementById("new-sheet-url").value.trim();
      const permission = document.getElementById("new-sheet-permission").value;
      const parentId = document.getElementById("new-sheet-parent").value;
      try {
        await store.addSheetNode({ name, url, parentId, permission });
        closeEditor();
      } catch (error) {
        window.alert(error.message || "Google Sheet 網址無效");
      }
    });
  }

  function openGoogleSearchModal() {
    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">搜尋關鍵字</label>
      <input id="google-search-query" type="text" placeholder="輸入試算表名稱" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <div class="grid grid-cols-2 gap-2">
        <select id="google-search-permission" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <select id="google-search-parent" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm">${collectFolderOptions()}</select>
      </div>
      <button id="google-search-run" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">搜尋我的試算表</button>
      <div id="google-search-results" class="border border-slate-200 dark:border-slate-700 rounded-xl max-h-64 overflow-y-auto p-2 text-sm text-slate-600 dark:text-slate-200">尚未搜尋</div>
    `;

    showEditor("尋找我的試算表", "選擇後會自動建立 Drawer 節點", html);

    const input = document.getElementById("google-search-query");
    const resultEl = document.getElementById("google-search-results");
    setTimeout(() => input.focus(), 80);

    document.getElementById("google-search-run").addEventListener("click", async () => {
      const query = input.value.trim();
      const permission = document.getElementById("google-search-permission").value;
      const parentId = document.getElementById("google-search-parent").value;

      resultEl.textContent = "搜尋中...";
      try {
        const files = await onGoogleSearchSheets(query);
        if (!files.length) {
          resultEl.textContent = "找不到符合條件的試算表";
          return;
        }

        resultEl.innerHTML = files.map((file) => {
          const id = escapeHtml(file.id);
          const name = escapeHtml(file.name || "Untitled");
          const url = escapeHtml(file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`);
          const canEdit = Boolean(file.capabilities?.canEdit);
          const editTag = canEdit ? "可編輯" : "唯讀";
          return `
            <button class="google-sheet-result w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 mb-2 hover:bg-slate-50 dark:hover:bg-slate-800" data-id="${id}" data-name="${name}" data-url="${url}">
              <p class="font-medium">${name}</p>
              <p class="text-xs text-slate-500">${editTag} · ${id}</p>
            </button>
          `;
        }).join("");

        resultEl.querySelectorAll(".google-sheet-result").forEach((button) => {
          button.addEventListener("click", async () => {
            await onGoogleLinkSheetFromSearch({
              spreadsheetId: button.getAttribute("data-id"),
              name: button.getAttribute("data-name"),
              webViewLink: button.getAttribute("data-url"),
              permission,
              parentId
            });
            closeEditor();
          });
        });
      } catch (error) {
        resultEl.textContent = error.message || "搜尋失敗";
      }
    });
  }

  function openGoogleUrlLinkModal() {
    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">Google Sheet 網址或 ID</label>
      <input id="google-link-input" type="text" placeholder="https://docs.google.com/spreadsheets/d/..." class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">顯示名稱（可留空）</label>
      <input id="google-link-name" type="text" placeholder="留空將使用試算表標題" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <div class="grid grid-cols-2 gap-2">
        <select id="google-link-permission" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <select id="google-link-parent" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm">${collectFolderOptions()}</select>
      </div>
      <button id="google-link-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">驗證並連結</button>
    `;

    showEditor("貼網址連結試算表", "會先驗證權限，再建立節點", html);
    const input = document.getElementById("google-link-input");
    setTimeout(() => input.focus(), 80);

    document.getElementById("google-link-save").addEventListener("click", async () => {
      const inputValue = document.getElementById("google-link-input").value.trim();
      const customName = document.getElementById("google-link-name").value.trim();
      const permission = document.getElementById("google-link-permission").value;
      const parentId = document.getElementById("google-link-parent").value;
      if (!inputValue) return;

      try {
        await onGoogleLinkSheetByUrl({ input: inputValue, customName, permission, parentId });
        closeEditor();
      } catch (error) {
        window.alert(error.message || "連結失敗");
      }
    });
  }

  function bindEvents() {
    document.getElementById("btn-menu").addEventListener("click", toggleSidebar);
    sidebarOverlay.addEventListener("click", toggleSidebar);
    document.getElementById("btn-close-editor").addEventListener("click", closeEditor);
    editorOverlay.addEventListener("click", closeEditor);
    editorSheet.addEventListener("click", (event) => event.stopPropagation());

    document.getElementById("btn-search").addEventListener("click", () => {
      searchBar.classList.toggle("hidden");
      if (!searchBar.classList.contains("hidden")) inputSearch.focus();
    });

    inputSearch.addEventListener("input", (event) => store.setSearchQuery(event.target.value));
    document.getElementById("btn-clear-search").addEventListener("click", () => {
      inputSearch.value = "";
      store.setSearchQuery("");
      searchBar.classList.add("hidden");
    });

    document.getElementById("btn-theme").addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      const dark = document.documentElement.classList.contains("dark");
      localStorage.setItem("theme", dark ? "dark" : "light");
      document.getElementById("icon-theme").setAttribute("data-lucide", dark ? "sun" : "moon");
      window.lucide.createIcons();
    });

    document.getElementById("btn-add-row").addEventListener("click", () => store.addRow());
    document.getElementById("btn-add-column").addEventListener("click", () => store.addColumn());
    document.getElementById("btn-sync-now").addEventListener("click", onSyncNow);
    document.getElementById("btn-reset-data").addEventListener("click", onResetData);

    btnNewFolder.addEventListener("click", openCreateFolderModal);
    btnNewSheet.addEventListener("click", openCreateSheetModal);

    btnGoogleConnect.addEventListener("click", async () => {
      try {
        await onGoogleConnect();
      } catch (error) {
        setGoogleState({ tone: "error", status: "Google 連線失敗", detail: error.message || "請稍後再試" });
      }
    });

    btnGoogleDisconnect.addEventListener("click", async () => {
      try {
        await onGoogleDisconnect();
      } catch (error) {
        setGoogleState({ tone: "error", status: "中斷連線失敗", detail: error.message || "請稍後再試" });
      }
    });

    btnGoogleFind.addEventListener("click", openGoogleSearchModal);
    btnGoogleLinkUrl.addEventListener("click", openGoogleUrlLinkModal);

    drawerTree.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-node-id]");
      if (!btn) return;
      await store.setActiveNode(btn.getAttribute("data-node-id"));
    });

    mainContent.addEventListener("click", (event) => {
      const cellEl = event.target.closest("[data-cell-edit]");
      if (cellEl) {
        openCellEditor(cellEl.getAttribute("data-cell-edit"), cellEl.getAttribute("data-cell-key"));
        return;
      }
      const rowEl = event.target.closest("[data-row-edit]");
      if (rowEl) {
        openRowEditor(rowEl.getAttribute("data-row-edit"));
        return;
      }
      const colEl = event.target.closest("[data-col-edit]");
      if (colEl) openColumnEditor(colEl.getAttribute("data-col-edit"));
    });
  }

  initTheme();
  bindEvents();
  window.lucide.createIcons();

  return {
    render(state) {
      renderDrawer(state);
      renderGrid(state);
      setEditButtonsEnabled(store.canEditCurrentSheet());
      window.lucide.createIcons();
    },
    setSyncStatus,
    setGoogleState
  };
}
