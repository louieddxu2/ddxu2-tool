let currentObserver = null;
window.activePanzooms = [];
window.isGridViewMode = false;
window.isSelectionMode = false;
window.selectedCardIds = new Set();

window.renderGallery = () => {
  if (UIState.isCropViewOpen) return;
  // 🌟 如果目前正開啟編輯彈窗，不要重新渲染畫廊，避免打擾使用者的編輯輸入
  const editModal = document.getElementById("modal-edit");
  if (editModal && !editModal.classList.contains("hidden")) return;

  // 🌟 銷毀舊的 Panzoom 實例，避免重複監聽與記憶體洩漏
  if (window.activePanzooms) {
    window.activePanzooms.forEach(pz => {
      try { pz.destroy(); } catch (e) {}
    });
    window.activePanzooms = [];
  }

  // 恢復滾動容器狀態，避免維持在被鎖定的狀態
  const containerReset = document.getElementById("gallery-container");
  if (containerReset) {
    containerReset.classList.add("snap-y", "snap-mandatory");
    containerReset.style.overflowY = "auto";
  }
  const gQ = (document.getElementById("inp-game").value || "").toLowerCase();
  const tQ = (document.getElementById("inp-type").value || "").toLowerCase();
  const nQ = (document.getElementById("inp-number").value || "").toLowerCase();

  let filtered = [];
  try {
    filtered = window.dbCards
      .filter((c) => {
        try {
          return (
            (c.game || "").toLowerCase().includes(gQ) &&
            (c.type || "").toLowerCase().includes(tQ) &&
            ((c.number || "").toLowerCase().includes(nQ) ||
              (c.memo && (c.memo || "").toLowerCase().includes(nQ)))
          );
        } catch (e) { return false; }
      })
      .sort((a, b) => ((b && b.timestamp) || 0) - ((a && a.timestamp) || 0));
  } catch (e) {
    console.error("Filtering/Sorting failed:", e);
    filtered = window.dbCards.filter(c => c && c.blob instanceof Blob);
  }

  const displayed = filtered.slice(0, 50);

  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";

  const footer = document.getElementById("gallery-footer");
  const emptyState = document.getElementById("empty-state");

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    footer.innerHTML = "";
    return;
  } else {
    emptyState.classList.add("hidden");
  }

  const container = document.getElementById("gallery-container");

  if (window.isGridViewMode) {
    container.classList.remove("snap-y", "snap-mandatory", "snap-x");
    grid.className = "grid grid-cols-3 md:grid-cols-5 gap-2 h-auto";
    grid.style.gridAutoRows = "";
  } else {
    container.classList.remove("snap-x");
    container.classList.add("snap-y", "snap-mandatory");
    grid.className = "grid grid-cols-1 h-full";
    grid.style.gridAutoRows = "100%";
  }

  displayed.forEach((c, index) => {
    if (!c.blob || !(c.blob instanceof Blob)) return;
    const url = URL.createObjectURL(c.blob);
    const div = document.createElement("div");

    div.setAttribute("data-id", c.id);
    div.setAttribute("data-game", c.game);
    div.setAttribute("data-type", c.type);
    div.setAttribute("data-number", c.number || "未命名");
    div.setAttribute("data-memo", c.memo || "");

    if (window.isGridViewMode) {
      div.className = "relative aspect-square bg-white rounded-lg overflow-hidden cursor-pointer shadow-sm p-1";
      const isSelected = window.selectedCardIds.has(c.id);
      const overlayClass = isSelected ? "opacity-100" : "opacity-0";
      const borderClass = isSelected ? "border-4 border-emerald-500 rounded-lg" : "border-0";
      const scaleClass = isSelected ? "scale-90" : "";

      div.innerHTML = `
          <img src="${url}" class="w-full h-full object-contain transition-transform duration-200 ${scaleClass} ${borderClass}">
          <div class="selection-overlay absolute inset-0 bg-emerald-500/10 transition-opacity duration-200 ${overlayClass} pointer-events-none"></div>
          <div class="selection-badge absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transition-opacity duration-200 ${overlayClass} pointer-events-none">
             <i data-lucide="check" class="w-4 h-4 text-emerald-600"></i>
          </div>
        `;

      div.onclick = () => {
        if (window.isSelectionMode) {
          const img = div.querySelector('img');
          const overlay = div.querySelector('.selection-overlay');
          const badge = div.querySelector('.selection-badge');

          if (window.selectedCardIds.has(c.id)) {
            window.selectedCardIds.delete(c.id);
            img.classList.remove('scale-90', 'border-4', 'border-emerald-500');
            overlay.classList.remove('opacity-100'); overlay.classList.add('opacity-0');
            badge.classList.remove('opacity-100'); badge.classList.add('opacity-0');
          } else {
            window.selectedCardIds.add(c.id);
            img.classList.add('scale-90', 'border-4', 'border-emerald-500');
            overlay.classList.remove('opacity-0'); overlay.classList.add('opacity-100');
            badge.classList.remove('opacity-0'); badge.classList.add('opacity-100');
          }

          // Update footer counter dynamically
          const counter = document.getElementById("selection-counter");
          if (counter) counter.innerText = `已選取 ${window.selectedCardIds.size} 張`;

        } else {
          window.isGridViewMode = false;
          renderGallery();
          // Disable smooth scroll temporarily for an instant jump
          setTimeout(() => {
            const target = document.querySelector(`div[data-id="${c.id}"]`);
            if (target) {
              const container = document.getElementById("gallery-container");
              container.classList.remove("scroll-smooth");
              target.scrollIntoView({ behavior: 'auto', block: 'start' });
              setTimeout(() => container.classList.add("scroll-smooth"), 50);
            }
          }, 50);
        }
      };
    } else {
      div.className = "snap-start flex items-center justify-center w-full h-full overflow-hidden shrink-0";
      div.innerHTML = `
          <div class="w-full h-full flex items-center justify-center">
             <img src="${url}" class="max-w-full max-h-full object-contain shadow-2xl rounded-sm select-none" draggable="false">
          </div>
        `;

      // 🌟 整合 Panzoom 實現雙指與雙擊縮放
      const img = div.querySelector("img");
      if (img) {
        setTimeout(() => {
          try {
            if (typeof window.Panzoom === "function") {
              const pz = window.Panzoom(img, {
                maxScale: 4,
                minScale: 1
              });
              window.activePanzooms.push(pz);

              const container = document.getElementById("gallery-container");
              img.addEventListener("panzoomchange", (e) => {
                const { scale } = e.detail;
                if (scale > 1.01) {
                  container.classList.remove("snap-y", "snap-mandatory");
                  container.style.overflowY = "hidden";
                } else {
                  container.classList.add("snap-y", "snap-mandatory");
                  container.style.overflowY = "auto";
                }
              });

              // 雙擊縮放/重設
              img.parentElement.addEventListener("dblclick", (e) => {
                const currentScale = pz.getScale();
                if (currentScale > 1.01) {
                  pz.reset({ animate: true });
                  container.classList.add("snap-y", "snap-mandatory");
                  container.style.overflowY = "auto";
                } else {
                  pz.zoomToPoint(2, e, { animate: true });
                  container.classList.remove("snap-y", "snap-mandatory");
                  container.style.overflowY = "hidden";
                }
              });
            }
          } catch (err) {
            console.error("Panzoom init error:", err);
          }
        }, 50);
      }
    }

    grid.appendChild(div);

    // 🌟 專業影像解碼與記憶體安全回收機制 (相容 iOS WebKit 與舊型設備)
    const img = div.querySelector("img");
    if (img) {
      let isRevoked = false;
      const safeRevoke = () => {
        if (!isRevoked) {
          isRevoked = true;
          try { URL.revokeObjectURL(url); } catch (e) {}
        }
      };

      if (typeof img.decode === "function") {
        img.decode()
          .then(safeRevoke)
          .catch(() => setTimeout(safeRevoke, 1000));
      } else {
        img.onload = () => setTimeout(safeRevoke, 1000);
        img.onerror = safeRevoke;
      }

      // 🛡️ 終極防線：5秒最大安全超時。無論加載卡死、用戶斷網或設備突發異常，5秒後絕對回收指標，永不洩漏記憶體！
      setTimeout(safeRevoke, 5000);
    }
  });

  if (currentObserver) currentObserver.disconnect();

  const options = {
    root: document.getElementById("gallery-container"),
    threshold: 0.6
  };

  currentObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        updateStationaryFooter(entry.target);
      }
    });
  }, options);

  document.querySelectorAll("#gallery-grid > div").forEach((card) => {
    currentObserver.observe(card);
  });

  // If in Grid view, we don't need the observer tracking a specific card
  if (window.isGridViewMode) {
    updateStationaryFooter(null);
  } else {
    // Manually trigger initial footer content for the first card
    const firstCard = grid.firstElementChild;
    if (firstCard) {
      updateStationaryFooter(firstCard);
    }
  }
};

const updateStationaryFooter = (target) => {
  const footer = document.getElementById("gallery-footer");

  if (window.isSelectionMode) {
    footer.innerHTML = `
        <div class="w-full flex flex-wrap items-center justify-between gap-1 md:gap-2">
          <div class="flex items-center gap-1 md:gap-2 shrink-0">
             <span id="selection-counter" class="text-xs md:text-sm font-bold text-slate-700">已選 ${window.selectedCardIds.size} 張</span>
             <button onclick="toggleSelectionMode()" class="text-[10px] md:text-xs font-bold text-slate-500 hover:text-slate-800 p-1 md:px-2">取消</button>
          </div>
          <button onclick="confirmBatchDelete()" class="px-2 md:px-4 py-1.5 md:py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all active:scale-95 shadow-sm text-xs md:text-sm shrink-0">
            刪除
          </button>
        </div>
      `;
    try { lucide.createIcons({ props: { class: "w-4 h-4" }, elements: [footer] }); } catch (e) { }
    return;
  }

  if (window.isGridViewMode) {
    footer.innerHTML = `
        <div class="w-full flex flex-wrap items-center justify-between gap-1 md:gap-2">
          <div class="min-w-0 shrink-0">
             <span class="text-xs md:text-sm font-bold text-slate-500">目錄檢視</span>
          </div>
          <div class="flex gap-1 md:gap-1.5 shrink-0">
            <button onclick="toggleSelectionMode()" class="px-2 md:px-3 py-1.5 md:py-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 font-bold rounded-lg transition-all active:scale-95 border border-slate-100 flex items-center gap-1">
              <i data-lucide="check-square" class="w-3.5 h-3.5 md:w-4 md:h-4"></i> <span class="text-[10px] md:text-xs">選取刪除</span>
            </button>
            <button onclick="toggleGridView()" class="p-1.5 md:p-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-lg transition-all active:scale-90 border border-emerald-100">
              <i data-lucide="monitor" class="w-3.5 h-3.5 md:w-4 md:h-4"></i>
            </button>
          </div>
        </div>
      `;
    try { lucide.createIcons(); } catch (e) { }
    return;
  }

  // Single View (requires target)
  if (!target) return;

  const id = target.getAttribute("data-id");
  const game = target.getAttribute("data-game");
  const type = target.getAttribute("data-type");
  const number = target.getAttribute("data-number");
  const memo = target.getAttribute("data-memo");

  const gQ = document.getElementById("inp-game").value.trim();
  const tQ = document.getElementById("inp-type").value.trim();

  const showGame = !gQ;
  const showType = !tQ;
  const metaStr = [showGame ? game : "", showType ? type : ""].filter(Boolean).join(" | ");

  footer.innerHTML = `
    <div class="max-w-4xl mx-auto w-full flex items-center justify-between gap-3">
      <div class="flex-grow min-w-0">
        ${metaStr ? `<div class="text-[8px] font-bold text-emerald-600 uppercase tracking-[0.15em] mb-0 truncate">${metaStr}</div>` : ""}
        <div class="text-base md:text-lg font-black text-slate-800 truncate leading-tight">${number}</div>
        ${memo ? `<div class="text-[9px] text-slate-500 truncate mt-0.5 italic flex items-center gap-1 opacity-70"><i data-lucide="sticky-note" class="w-2 h-2"></i> ${memo}</div>` : ""}
      </div>
      <div class="flex gap-1.5 shrink-0">
        <button onclick="openEditModal('${id}')" class="p-2.5 bg-slate-50 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-lg transition-all active:scale-90 border border-slate-100">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
        </button>
        <button onclick="deleteCard('${id}')" class="p-2.5 bg-slate-50 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all active:scale-90 border border-slate-100">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
        <button onclick="toggleGridView()" class="p-2.5 bg-slate-50 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-lg transition-all active:scale-90 border border-slate-100">
          <i data-lucide="layout-grid" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
  try { lucide.createIcons({ props: { class: "w-4 h-4" }, elements: [footer] }); } catch (e) { }

  // NEW: Also update compact-bar if it's active
  const compactCard = document.getElementById("compact-card-card");
  const compactLabel = document.getElementById("compact-label");
  const compactActions = document.getElementById("compact-actions");
  const compactMemo = document.getElementById("compact-memo");
  
  if (compactCard && compactLabel && compactActions) {
    if (window.isGridViewMode) {
      compactCard.classList.add("hidden");
      compactActions.classList.add("hidden");
    } else {
      compactCard.classList.remove("hidden");
      compactActions.classList.remove("hidden");
      compactLabel.innerText = number;
      
      // Render Memo if it exists
      if (compactMemo) {
        if (memo) {
          compactMemo.innerHTML = `<i data-lucide="sticky-note" class="w-3 h-3"></i> <span>${memo}</span>`;
          compactMemo.classList.remove("hidden");
        } else {
          compactMemo.classList.add("hidden");
        }
      }

      compactActions.innerHTML = `
        <button onclick="openEditModal('${id}')" class="p-1 bg-slate-50 border border-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-all active:scale-95" title="編輯"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
        <button onclick="deleteCard('${id}')" class="p-1 bg-slate-50 border border-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all active:scale-95" title="刪除"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        <button onclick="toggleGridView()" class="p-1 bg-slate-50 border border-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-all active:scale-95" title="目錄檢視"><i data-lucide="layout-grid" class="w-3.5 h-3.5"></i></button>
      `;
      try { 
        lucide.createIcons({ props: { class: "w-3.5 h-3.5" }, elements: [compactActions] });
        if (memo && compactMemo) {
          lucide.createIcons({ props: { class: "w-3 h-3" }, elements: [compactMemo] });
        }
      } catch (e) { }
    }
  }
};

window.toggleGridView = () => {
  window.isGridViewMode = !window.isGridViewMode;
  window.isSelectionMode = false;
  window.selectedCardIds.clear();
  renderGallery();
};

window.toggleSelectionMode = () => {
  window.isSelectionMode = !window.isSelectionMode;
  window.selectedCardIds.clear();
  renderGallery();
};

window.confirmBatchDelete = async () => {
  if (window.selectedCardIds.size === 0) return;
  if (!confirm(`確定要刪除選取的 ${window.selectedCardIds.size} 張照片嗎？這項操作無法復原。`)) return;

  const idsToDelete = Array.from(window.selectedCardIds);
  const remaining = window.dbCards.filter(c => !idsToDelete.includes(c.id));
  window.dbCards.length = 0;
  window.dbCards.push(...remaining);
  await window.idbKeyval.set("bgCards", window.dbCards);

  window.isSelectionMode = false;
  window.selectedCardIds.clear();
  renderGallery();
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inp-game").oninput = renderGallery;
  document.getElementById("inp-type").oninput = renderGallery;
  document.getElementById("inp-number").oninput = renderGallery;
  document.getElementById("inp-number").onfocus = function () { this.select(); };
  document.getElementById("edit-number").onfocus = function () { this.select(); };
});
