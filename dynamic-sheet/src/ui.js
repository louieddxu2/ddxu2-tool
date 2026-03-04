function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createUI({ store, onSyncNow, onResetData }) {
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

  function setSyncStatus({ text, tone, pending }) {
    syncStatus.textContent = text;
    syncStatus.className = "text-sm font-semibold";
    if (tone === "ok") syncStatus.classList.add("text-emerald-600");
    if (tone === "warn") syncStatus.classList.add("text-amber-600");
    if (tone === "error") syncStatus.classList.add("text-rose-600");
    pendingCount.textContent = `待同步 ${pending} 筆`;
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

  function renderGrid(state) {
    const schemaKeys = Object.keys(state.schema);
    const filteredRows = state.rows.filter((row) => {
      if (!state.searchQuery) return true;
      return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(state.searchQuery));
    });

    let html = '<table class="w-full text-sm whitespace-nowrap">';
    html += '<thead><tr>';
    html += '<th class="sticky-corner bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-700 p-3 text-left text-slate-500 dark:text-slate-400 font-bold min-w-[140px] shadow-sm">物件名稱</th>';
    schemaKeys.forEach((key) => {
      if (key === "name") return;
      html += `<th class="sticky-header clickable bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-300 dark:border-slate-700 p-3 text-center text-slate-500 dark:text-slate-400 font-bold min-w-[110px] shadow-sm cursor-pointer transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" data-col-edit="${escapeHtml(key)}">${escapeHtml(state.schema[key].label)}</th>`;
    });
    html += "</tr></thead>";

    html += "<tbody>";
    if (filteredRows.length === 0) {
      html += `<tr><td colspan="${schemaKeys.length}" class="p-10 text-center text-slate-400">找不到符合資料</td></tr>`;
    } else {
      filteredRows.forEach((row) => {
        html += "<tr>";
        html += `<td class="sticky-col clickable bg-slate-100 dark:bg-slate-800/90 border-b border-r border-slate-300 dark:border-slate-700 p-3 font-bold text-slate-800 dark:text-slate-200 shadow-sm max-w-[170px] overflow-hidden text-ellipsis cursor-pointer transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" data-row-edit="${escapeHtml(row.id)}">${escapeHtml(row.name)}</td>`;
        schemaKeys.forEach((key) => {
          if (key === "name") return;
          html += `<td class="data-cell bg-white dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 p-3 text-center text-slate-700 dark:text-slate-300 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800" data-cell-edit="${escapeHtml(row.id)}" data-cell-key="${escapeHtml(key)}">${escapeHtml(row[key] || "")}</td>`;
        });
        html += "</tr>";
      });
    }
    html += "</tbody></table>";
    mainContent.innerHTML = html;
    window.lucide.createIcons();
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
      if (colEl) {
        openColumnEditor(colEl.getAttribute("data-col-edit"));
      }
    });
  }

  function openCellEditor(rowId, key) {
    const state = store.getState();
    const row = state.rows.find((item) => item.id === rowId);
    const config = state.schema[key];
    if (!row || !config) return;

    if (config.type === "select") {
      let html = '<div class="flex flex-col gap-3">';
      config.options.forEach((option) => {
        const selected = option === row[key];
        const style = selected
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600";
        html += `<button class="btn-select-option w-full py-3 rounded-xl border text-base font-semibold ${style}" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
      });
      html += '<button class="btn-select-option w-full py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 font-semibold" data-value="">清除欄位</button>';
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
    const state = store.getState();
    const row = state.rows.find((item) => item.id === rowId);
    if (!row) return;
    const html = `
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">物件名稱</label>
      <input id="row-name-input" type="text" value="${escapeHtml(row.name)}" class="w-full p-4 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <button id="row-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">儲存</button>
      <button id="row-delete" class="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 py-3 rounded-xl font-semibold">刪除此列</button>
    `;
    showEditor("編輯物件", "可改名或刪除", html);
    const input = document.getElementById("row-name-input");
    setTimeout(() => input.focus(), 80);
    document.getElementById("row-save").addEventListener("click", async () => {
      const val = input.value.trim();
      if (!val) return;
      await store.renameRow(rowId, val);
      closeEditor();
    });
    document.getElementById("row-delete").addEventListener("click", async () => {
      if (!window.confirm(`確定刪除「${row.name}」嗎？`)) return;
      await store.deleteRow(rowId);
      closeEditor();
    });
  }

  function openColumnEditor(key) {
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
      <label class="text-sm font-semibold text-slate-600 dark:text-slate-300">選單選項（逗號分隔）</label>
      <input id="col-options-input" type="text" value="${escapeHtml((config.options || []).join(","))}" class="w-full p-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-base outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white">
      <button id="col-save" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">儲存設定</button>
      ${key === "name" ? "" : '<button id="col-delete" class="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 py-3 rounded-xl font-semibold">刪除此欄</button>'}
    `;
    showEditor("欄位設定", config.label, html);
    document.getElementById("col-save").addEventListener("click", async () => {
      const label = document.getElementById("col-label-input").value.trim();
      const type = document.getElementById("col-type-input").value;
      const options = document.getElementById("col-options-input").value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
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

  function initTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = localStorage.getItem("theme");
    const useDark = theme ? theme === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", useDark);
    document.getElementById("icon-theme").setAttribute("data-lucide", useDark ? "sun" : "moon");
  }

  initTheme();
  bindEvents();
  window.lucide.createIcons();

  return {
    renderGrid,
    setSyncStatus
  };
}

