// Global UI State
let isLandscapeMode = false;
let editingId = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  try { lucide.createIcons(); } catch (e) { }

  const els = ["inp-game", "inp-type", "inp-number"];
  els.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = localStorage.getItem("bg_last_" + id) || el.value;
    el.addEventListener("input", () =>
      localStorage.setItem("bg_last_" + id, el.value),
    );
  });

  setupSmartDropdown("inp-game", "drop-game", () =>
    [...new Set(dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("inp-type", "drop-type", () => {
    const game = document.getElementById("inp-game").value;
    const ts = game
      ? dbCards.filter((c) => c.game === game).map((c) => c.type)
      : dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  setupSmartDropdown("edit-game", "drop-edit-game", () =>
    [...new Set(dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("edit-type", "drop-edit-type", () => {
    const game = document.getElementById("edit-game").value;
    const ts = game
      ? dbCards.filter((c) => c.game === game).map((c) => c.type)
      : dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });

  setupSmartDropdown("import-game", "drop-import-game", () =>
    [...new Set(dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("import-type", "drop-import-type", () => {
    const game = document.getElementById("import-game").value;
    const ts = game
      ? dbCards.filter((c) => c.game === game).map((c) => c.type)
      : dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });
});

function setupSmartDropdown(inputId, dropId, keyGetter) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!inp || !drop) return;
  const wrap = inp.parentElement;
  let isOpen = false;
  let isSearchingMode = false;

  const updatePosition = () => {
    const rect = inp.getBoundingClientRect();
    drop.style.position = "fixed";
    drop.style.top = `${rect.bottom + 4}px`;
    drop.style.left = `${rect.left}px`;
    drop.style.width = `${rect.width}px`;
    drop.style.zIndex = "9999";
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
          inp.dispatchEvent(new Event("input"));
          inp.dispatchEvent(new Event("change"));
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

// Global functions
window.toggleOrientation = () => {
  isLandscapeMode = !isLandscapeMode;
  const p = document.getElementById("icon-portrait");
  const l = document.getElementById("icon-landscape");
  if (p && l) {
    if (isLandscapeMode) { p.classList.add("hidden"); l.classList.remove("hidden"); }
    else { p.classList.remove("hidden"); l.classList.add("hidden"); }
  }
  const activeBtn = document.querySelector(".ratio-btn.bg-emerald-600");
  if (activeBtn) {
    const ratioStr = activeBtn.getAttribute("data-ratio").split(":");
    setRatioAndCenter(parseInt(ratioStr[0]) / parseInt(ratioStr[1]));
  } else {
    const w = parseInt(document.getElementById("custom-w").value) || 1;
    const h = parseInt(document.getElementById("custom-h").value) || 1;
    setRatioAndCenter(w / h);
  }
  if (window.saveLastRatio) window.saveLastRatio();
};

window.setCustomActive = () => {
  document.querySelectorAll(".ratio-btn").forEach(b => {
    b.classList.remove("bg-emerald-600", "text-white");
    b.classList.add("bg-slate-800", "text-slate-300");
  });
  const box = document.getElementById("custom-ratio-box");
  if (box) {
    box.classList.add("border-emerald-500", "ring-1", "ring-emerald-500");
    box.classList.remove("border-slate-700");
  }
  const w = parseInt(document.getElementById("custom-w").value) || 1;
  const h = parseInt(document.getElementById("custom-h").value) || 1;
  if (window.setRatioAndCenter) window.setRatioAndCenter(w / h);
  if (window.saveLastRatio) window.saveLastRatio();
};

function initRatioButtons() {
  const container = document.getElementById("ratio-buttons");
  if (!container) return;
  const buttons = container.querySelectorAll(".ratio-btn");
  const customBox = document.getElementById("custom-ratio-box");

  const setActive = (btn) => {
    buttons.forEach(b => {
      b.classList.remove("bg-emerald-600", "text-white");
      b.classList.add("bg-slate-800", "text-slate-300");
    });
    if (customBox) {
      customBox.classList.remove("border-emerald-500", "ring-1", "ring-emerald-500");
      customBox.classList.add("border-slate-700");
    }
    btn.classList.add("bg-emerald-600", "text-white");
    btn.classList.remove("bg-slate-800", "text-slate-300");

    const ratioStr = btn.getAttribute("data-ratio");
    if (ratioStr) {
      const r = ratioStr.split(":");
      if (window.setRatioAndCenter) {
        window.setRatioAndCenter(parseInt(r[0]) / parseInt(r[1]));
      }
    }
  };

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      setActive(btn);
      if (window.saveLastRatio) window.saveLastRatio();
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  });

  let saveTimeout;
  container.addEventListener("scroll", () => {
    const scrollCenterX = container.scrollLeft + container.offsetWidth / 2;
    let closestBtn = null;
    let minDistance = Infinity;

    buttons.forEach(btn => {
      const btnCenterX = btn.offsetLeft + btn.offsetWidth / 2;
      const dist = Math.abs(scrollCenterX - btnCenterX);
      if (dist < minDistance) {
        minDistance = dist;
        closestBtn = btn;
      }
    });

    if (closestBtn && !closestBtn.classList.contains("bg-emerald-600")) {
      setActive(closestBtn);
      
      // Debounce saving to localStorage
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (window.saveLastRatio) window.saveLastRatio();
      }, 500);
    }
  }, { passive: true });
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
  const c = dbCards.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
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
  if (m) {
    m.classList.remove("flex");
    m.classList.add("hidden");
  }
  if (o) o.classList.add("hidden");
};
window.saveEdit = async () => {
  const idx = dbCards.findIndex((c) => c.id === editingId);
  if (idx > -1) {
    dbCards[idx].game = document.getElementById("edit-game").value;
    dbCards[idx].type = document.getElementById("edit-type").value;
    dbCards[idx].number = document.getElementById("edit-number").value;
    dbCards[idx].memo = document.getElementById("edit-memo").value;
    dbCards[idx].timestamp = Date.now();
    await idbKeyval.set("bgCards", dbCards);
    renderGallery();
  }
  closeEditModal();
};

// Global UI state and logic updated.
window.toggleCompactMode = () => {
  const normalHeader = document.getElementById("sidebar-header-normal");
  const normalSearch = document.getElementById("search-section-normal");
  const compactBar = document.getElementById("compact-bar");
  if (!normalHeader || !normalSearch || !compactBar) return;

  const isEnteringCompact = compactBar.classList.contains("hidden");
  localStorage.setItem("bg_compact_mode", isEnteringCompact ? "1" : "0");

  if (isEnteringCompact) {
    normalHeader.classList.add("hidden");
    normalSearch.classList.add("hidden");
    compactBar.classList.remove("hidden");
    compactBar.classList.add("flex");
    
    document.getElementById("compact-inp-game").value = document.getElementById("inp-game").value;
    document.getElementById("compact-inp-type").value = document.getElementById("inp-type").value;
    document.getElementById("compact-inp-number").value = document.getElementById("inp-number").value;
  } else {
    normalHeader.classList.remove("hidden");
    normalSearch.classList.remove("hidden");
    compactBar.classList.add("hidden");
    compactBar.classList.remove("flex");
    
    document.getElementById("inp-game").value = document.getElementById("compact-inp-game").value;
    document.getElementById("inp-type").value = document.getElementById("compact-inp-type").value;
    document.getElementById("inp-number").value = document.getElementById("compact-inp-number").value;
  }
  renderGallery();
  try { lucide.createIcons(); } catch(e) {}
};

document.addEventListener("DOMContentLoaded", () => {
  setupSmartDropdown("compact-inp-game", "compact-drop-game", () =>
    [...new Set(dbCards.map((c) => c.game))].filter(Boolean),
  );
  setupSmartDropdown("compact-inp-type", "compact-drop-type", () => {
    const game = document.getElementById("compact-inp-game").value;
    const ts = game
      ? dbCards.filter((c) => c.game === game).map((c) => c.type)
      : dbCards.map((c) => c.type);
    return [...new Set(ts)].filter(Boolean);
  });
  
  const compNum = document.getElementById("compact-inp-number");
  if (compNum) {
    compNum.oninput = () => {
      document.getElementById("inp-number").value = compNum.value;
      renderGallery();
    };
    compNum.onfocus = function () { this.select(); };
  }

  initRatioButtons();

  if (localStorage.getItem("bg_compact_mode") === "1") {
    setTimeout(window.toggleCompactMode, 50);
  }
});
