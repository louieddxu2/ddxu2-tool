// ============================================================
// UI STATE ARCHITECTURE (Refactor V1)
// ============================================================
window.UIState = {
  viewMode: localStorage.getItem("bg_compact_mode") === "1" ? "compact" : "normal",
  isDBReady: false,
  orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
  isCropViewOpen: false,
  editingId: null,
  cropOrientation: "portrait", // "portrait" or "landscape" for the cropper

  init() {
    this.updateLayoutAttributes();
    this.setupListeners();
    this.restoreInputs();
  },

  updateLayoutAttributes() {
    document.body.setAttribute("data-view-mode", this.viewMode);
    document.body.setAttribute("data-orientation", this.orientation);
    // Backward compatibility for existing CSS
    document.body.classList.toggle("compact-mode", this.viewMode === "compact");
  },

  setupListeners() {
    window.addEventListener("resize", () => {
      const newOri = window.innerWidth > window.innerHeight ? "landscape" : "portrait";
      if (newOri !== this.orientation) {
        this.orientation = newOri;
        this.updateLayoutAttributes();
      }
    });
  },

  restoreInputs() {
    const roots = ["inp-game", "inp-type", "inp-number"];
    roots.forEach(root => {
      const val = localStorage.getItem("bg_last_" + root) || "";
      const normalEl = document.getElementById(root);
      const compactEl = document.getElementById("compact-" + root);
      if (normalEl) normalEl.value = val;
      if (compactEl) compactEl.value = val;
    });
  },

  setMode(mode) {
    this.viewMode = mode;
    localStorage.setItem("bg_compact_mode", mode === "compact" ? "1" : "0");
    this.updateLayoutAttributes();
    renderGallery();
    try { lucide.createIcons(); } catch (e) { }
  },

  toggleCropOrientation() {
    this.cropOrientation = this.cropOrientation === "portrait" ? "landscape" : "portrait";
    const p = document.getElementById("icon-portrait");
    const l = document.getElementById("icon-landscape");
    if (p && l) {
      if (this.cropOrientation === "landscape") {
        p.classList.add("hidden");
        l.classList.remove("hidden");
      } else {
        p.classList.remove("hidden");
        l.classList.add("hidden");
      }
    }
    
    // Sync with cropper logic
    const activeBtn = document.querySelector(".ratio-btn.bg-emerald-600");
    if (activeBtn) {
      const ratioStr = activeBtn.getAttribute("data-ratio").split(":");
      const baseRatio = parseInt(ratioStr[0]) / parseInt(ratioStr[1]);
      if (window.setRatioAndCenter) {
        window.setRatioAndCenter(baseRatio);
      }
    } else if (window.isCustomMode && window.cropRatio) {
      window.cropRatio = 1 / window.cropRatio;
      if (window.drawLines) window.drawLines();
    }
    
    localStorage.setItem("bg_last_landscape", this.cropOrientation === "landscape");
  }
};

// Global Sync Function
window.syncInputs = (sourceId, value) => {
  const rootId = sourceId.replace("compact-", "");
  const targetIds = sourceId.startsWith("compact-") ? [rootId] : ["compact-" + sourceId];
  
  targetIds.forEach(tId => {
    const el = document.getElementById(tId);
    if (el && el.value !== value) {
      el.value = value;
    }
  });

  localStorage.setItem("bg_last_" + rootId, value);
  renderGallery();
};

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  UIState.init();
  try { lucide.createIcons(); } catch (e) { }

  // Bind Input Syncing
  const allInputIds = [
    "inp-game", "compact-inp-game",
    "inp-type", "compact-inp-type",
    "inp-number", "compact-inp-number"
  ];
  allInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", (e) => window.syncInputs(id, e.target.value));
    }
  });

  setupSmartDropdown("inp-game", "drop-game", () =>
    [...new Set(window.dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("inp-type", "drop-type", () => {
    const game = document.getElementById("inp-game").value;
    const ts = game
      ? window.dbCards.filter((c) => c.game === game).map((c) => c.type)
      : window.dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  setupSmartDropdown("compact-inp-game", "compact-drop-game", () =>
    [...new Set(window.dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("compact-inp-type", "compact-drop-type", () => {
    const game = document.getElementById("compact-inp-game").value;
    const ts = game
      ? window.dbCards.filter((c) => c.game === game).map((c) => c.type)
      : window.dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  setupSmartDropdown("edit-game", "drop-edit-game", () =>
    [...new Set(window.dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("edit-type", "drop-edit-type", () => {
    const game = document.getElementById("edit-game").value;
    const ts = game
      ? window.dbCards.filter((c) => c.game === game).map((c) => c.type)
      : window.dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  setupSmartDropdown("import-game", "drop-import-game", () =>
    [...new Set(window.dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("import-type", "drop-import-type", () => {
    const game = document.getElementById("import-game").value;
    const ts = game
      ? window.dbCards.filter((c) => c.game === game).map((c) => c.type)
      : window.dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  // iOS / Mobile Compatibility Optimization
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const folderOpt = document.getElementById("import-folder-option");
    if (folderOpt) {
      folderOpt.classList.add("opacity-50", "grayscale", "pointer-events-none");
      const title = folderOpt.querySelector(".font-bold");
      if (title) title.innerHTML += ' <span class="text-[10px] bg-slate-200 px-1 rounded text-slate-500 font-normal ml-1">僅限電腦</span>';
    }
  }

  // Mobile Environment Guidance
  const ua = navigator.userAgent;
  const isInApp = /Line|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  if (isMobile && !isStandalone) {
    setTimeout(() => {
      if (isInApp) {
        const inAppModal = document.getElementById("modal-inapp-browser");
        if (inAppModal) {
          inAppModal.classList.remove("hidden");
          inAppModal.classList.add("flex");
          try { lucide.createIcons(); } catch(e) {}
          return;
        }
      }

      const prompt = document.getElementById("pwa-prompt");
      if (!prompt) return;
      
      const isIOSPlatform = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const guideIos = document.getElementById("pwa-guide-ios");
      const guideAndroid = document.getElementById("pwa-guide-android");
      
      if (isIOSPlatform) {
        if (guideIos) {
          guideIos.classList.remove("hidden");
          guideIos.classList.add("flex");
        }
      } else {
        if (guideAndroid) {
          guideAndroid.classList.remove("hidden");
          guideAndroid.classList.add("flex");
        }
      }
      
      prompt.classList.remove("hidden");
      try { lucide.createIcons(); } catch(e) {}
    }, 100);
  }

  initRatioButtons();
});

function setupSmartDropdown(inputId, dropId, keyGetter) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!inp || !drop) return;

  document.body.appendChild(drop);
  drop.style.position = "fixed";
  drop.classList.add("fixed", "bg-white", "border", "border-slate-200", "rounded-xl", "shadow-2xl", "overflow-y-auto", "max-h-60");

  const wrap = inp.parentElement;
  let isOpen = false;
  let isSearchingMode = false;

  const updatePosition = () => {
    const rect = inp.getBoundingClientRect();
    drop.style.top = `${rect.bottom + 4}px`;
    drop.style.left = `${rect.left}px`;
    drop.style.width = `${Math.max(rect.width, 200)}px`;
    drop.style.zIndex = "100000";
  };

  const populate = () => {
    drop.innerHTML = "";
    const val = isSearchingMode ? inp.value.toLowerCase().trim() : "";
    const items = keyGetter().filter(item => !val || item.toLowerCase().includes(val));

    if (items.length === 0) {
      drop.innerHTML = `<div class="px-4 py-3 text-sm text-slate-400 text-center bg-white">無符合項目</div>`;
    } else {
      items.forEach((itemVal) => {
        const d = document.createElement("div");
        d.className = "px-4 py-2.5 text-xs hover:bg-emerald-50 cursor-pointer text-slate-700 active:bg-emerald-100 font-medium truncate bg-white";
        d.textContent = itemVal;
        d.onmousedown = (e) => {
          e.preventDefault();
          inp.value = itemVal;
          window.syncInputs(inputId, itemVal);
          close();
        };
        drop.appendChild(d);
      });
    }
    const newBtn = document.createElement("div");
    newBtn.className = "px-4 py-2.5 text-xs text-emerald-600 font-bold hover:bg-emerald-50 cursor-pointer bg-slate-50 text-center border-t border-slate-100 sticky bottom-0";
    newBtn.innerHTML = isSearchingMode ? `✅ 完成輸入` : `✏️ 搜尋或手動輸入`;
    newBtn.onmousedown = (e) => {
      e.preventDefault();
      if (isSearchingMode) close();
      else enterEditMode();
    };
    drop.appendChild(newBtn);

    if (isOpen) {
      updatePosition();
      drop.classList.remove("hidden");
      drop.classList.add("flex", "flex-col", "bg-white", "shadow-xl", "border", "border-slate-200", "rounded-lg", "overflow-hidden");
    }
  };

  const open = () => {
    isSearchingMode = false;
    isOpen = true;
    populate();
    inp.setAttribute("readonly", "true");
    inp.classList.add("cursor-pointer");
  };

  const close = () => {
    drop.classList.add("hidden");
    drop.classList.remove("flex", "flex-col");
    isOpen = false;
    isSearchingMode = false;
    inp.setAttribute("readonly", "true");
    inp.blur();
    inp.classList.add("cursor-pointer");
  };

  const enterEditMode = () => {
    isSearchingMode = true;
    inp.removeAttribute("readonly");
    inp.classList.remove("cursor-pointer");
    isOpen = true;
    populate();
    setTimeout(() => {
      inp.focus();
      if (inp.value) inp.select();
    }, 10);
  };

  inp.addEventListener("click", (e) => {
    if (inputId.includes("inp-game") && localStorage.getItem('bg_session_game')) {
      alert("【房間同步中】\n目前已鎖定遊戲名稱以確保資料安全隔離。\n若要更換遊戲，請先開啟右上角「即時同步」面板並關閉房間。");
      return;
    }
    if (inp.hasAttribute("readonly")) {
      if (!isOpen) open();
      else enterEditMode();
    }
  });

  inp.addEventListener("input", () => {
    if (!inp.hasAttribute("readonly")) {
      isSearchingMode = true;
      populate();
    }
  });

  inp.addEventListener("blur", () => {
    setTimeout(() => {
      if (!isOpen) {
        inp.setAttribute("readonly", "true");
        inp.classList.add("cursor-pointer");
      }
    }, 150);
  });

  window.addEventListener("resize", () => { if (isOpen) updatePosition(); });
  window.addEventListener("scroll", () => { if (isOpen) updatePosition(); }, true);

  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target) && !drop.contains(e.target) && isOpen) close();
  });
}

// Global UI functions
window.clearInput = (event, id) => {
  event.preventDefault();
  event.stopPropagation();
  const el = document.getElementById(id);
  if (el) {
    el.value = '';
    window.syncInputs(id, '');
    el.blur();
  }
};

window.toggleOrientation = () => UIState.toggleCropOrientation();
window.toggleCompactMode = () => UIState.setMode(UIState.viewMode === "compact" ? "normal" : "compact");

window.setCustomActive = () => {
  const activeBtn = document.querySelector(".ratio-btn.bg-emerald-600");
  if (activeBtn) {
    activeBtn.classList.remove("bg-emerald-600", "text-white");
    activeBtn.classList.add("bg-slate-800", "text-slate-300");
  }

  const box = document.getElementById("custom-ratio-box");
  if (box) {
    box.classList.remove("bg-slate-800");
    box.classList.add("bg-emerald-600");
    const t1 = document.getElementById("custom-ratio-text1");
    const t2 = document.getElementById("custom-ratio-text2");
    if (t1) t1.classList.replace("text-slate-300", "text-white");
    if (t2) t2.classList.replace("text-slate-300", "text-white");
  }

  window.isCustomMode = true;
  const savedCustom = parseFloat(localStorage.getItem("bg_last_custom_ratio"));
  if (window.setRatioAndCenter) {
    window.setRatioAndCenter(savedCustom || window.cropRatio || (63 / 88));
  }
  if (window.drawLines) window.drawLines();
  if (window.saveLastRatio) window.saveLastRatio();
};

function initRatioButtons() {
  const container = document.getElementById("ratio-buttons");
  if (!container) return;
  const buttons = container.querySelectorAll(".ratio-btn");
  const customBox = document.getElementById("custom-ratio-box");
  let lastActiveBtn = container.querySelector(".ratio-btn.bg-emerald-600");

  let isClickScrolling = false;
  let clickScrollTimeout;

  const setActive = (btn) => {
    if (btn === lastActiveBtn) return;
    if (lastActiveBtn) {
      lastActiveBtn.classList.remove("bg-emerald-600", "text-white");
      lastActiveBtn.classList.add("bg-slate-800", "text-slate-300");
    }
    if (customBox) {
      customBox.classList.remove("bg-emerald-600");
      customBox.classList.add("bg-slate-800");
      const t1 = document.getElementById("custom-ratio-text1");
      const t2 = document.getElementById("custom-ratio-text2");
      if (t1) t1.classList.replace("text-white", "text-slate-300");
      if (t2) t2.classList.replace("text-white", "text-slate-300");
    }
    window.isCustomMode = false;
    btn.classList.remove("bg-slate-800", "text-slate-300");
    btn.classList.add("bg-emerald-600", "text-white");
    lastActiveBtn = btn;

    const ratioStr = btn.getAttribute("data-ratio");
    if (ratioStr && window.setRatioAndCenter) {
      const r = ratioStr.split(":");
      window.setRatioAndCenter(parseInt(r[0]) / parseInt(r[1]));
    }
  };

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      isClickScrolling = true;
      clearTimeout(clickScrollTimeout);
      setActive(btn);
      if (window.saveLastRatio) window.saveLastRatio();
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      clickScrollTimeout = setTimeout(() => { isClickScrolling = false; }, 500);
    });
  });

  let saveTimeout;
  const observer = new IntersectionObserver((entries) => {
    if (isClickScrolling) return;
    const intersecting = entries.filter(e => e.isIntersecting);
    if (intersecting.length > 0) {
      const best = intersecting.reduce((prev, current) => (current.intersectionRatio > prev.intersectionRatio) ? current : prev);
      setActive(best.target);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { if (window.saveLastRatio) window.saveLastRatio(); }, 500);
    }
  }, { root: container, rootMargin: '0px -40% 0px -40%', threshold: [0, 0.5, 1] });
  buttons.forEach(btn => observer.observe(btn));
}

window.openFullPreview = (url) => {
  const modal = document.getElementById("modal-preview");
  const img = document.getElementById("preview-img");
  if (modal && img) { img.src = url; modal.classList.remove("hidden"); modal.classList.add("flex"); }
};
window.closeFullPreview = () => {
  const m = document.getElementById("modal-preview");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
};
window.openEditModal = (id) => {
  const c = window.dbCards.find((x) => x.id === id);
  if (!c) return;
  UIState.editingId = id;
  document.getElementById("edit-game").value = c.game;
  document.getElementById("edit-type").value = c.type;
  document.getElementById("edit-number").value = c.number;
  document.getElementById("edit-memo").value = c.memo || "";
  const m = document.getElementById("modal-edit");
  const o = document.getElementById("modal-edit-overlay");
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
    if (o) o.classList.remove("hidden");
    try { lucide.createIcons(); } catch (e) { }
  }
};
window.closeEditModal = () => {
  const m = document.getElementById("modal-edit");
  const o = document.getElementById("modal-edit-overlay");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
  if (o) o.classList.add("hidden");
};
window.saveEdit = async () => {
  const idx = window.dbCards.findIndex((c) => c.id === UIState.editingId);
  if (idx > -1) {
    window.dbCards[idx].game = document.getElementById("edit-game").value;
    window.dbCards[idx].type = document.getElementById("edit-type").value;
    window.dbCards[idx].number = document.getElementById("edit-number").value;
    window.dbCards[idx].memo = document.getElementById("edit-memo").value;
    window.dbCards[idx].timestamp = Date.now();
    await idbKeyval.set("bgCards", window.dbCards);
    renderGallery();
  }
  closeEditModal();
};

