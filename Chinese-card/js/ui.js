// Global UI State
let isLandscapeMode = false;
let editingId = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  
  const els = ["inp-game", "inp-type", "inp-number"];
  els.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = localStorage.getItem("bg_last_" + id) || el.value;
    el.addEventListener("input", () =>
      localStorage.setItem("bg_last_" + id, el.value),
    );
    el.addEventListener("change", () =>
      localStorage.setItem("bg_last_" + id, el.value),
    );
  });

  setTimeout(() => {
    const lastLandscape = localStorage.getItem("bg_last_landscape") === "true";
    if (lastLandscape) {
      isLandscapeMode = true;
      document.getElementById("icon-portrait").classList.add("hidden");
      document.getElementById("icon-landscape").classList.remove("hidden");
    }

    const lastRatio = localStorage.getItem("bg_last_ratio");
    if (lastRatio) {
      applyRatioValue(lastRatio);
    }
  }, 0);
  
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
});

window.toggleOrientation = () => {
  isLandscapeMode = !isLandscapeMode;
  if (isLandscapeMode) {
    document.getElementById("icon-portrait").classList.add("hidden");
    document.getElementById("icon-landscape").classList.remove("hidden");
  } else {
    document.getElementById("icon-portrait").classList.remove("hidden");
    document.getElementById("icon-landscape").classList.add("hidden");
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
};

const ratioContainer = document.getElementById("ratio-buttons");
const scrollBtnToCenter = (el) => {
  if (!ratioContainer.contains(el)) return;
  const containerRect = ratioContainer.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const scrollLeft =
    ratioContainer.scrollLeft +
    (elRect.left - containerRect.left) -
    containerRect.width / 2 +
    elRect.width / 2;
  ratioContainer.scrollTo({ left: scrollLeft, behavior: "smooth" });
};

window.setCustomActive = () => {
  document.getElementById("custom-w").focus();
  document.getElementById("custom-w").select();
  updateCustomRatio();
};

function setRatioValue(val) {
  if (!val) return;
  if (val.startsWith("custom:")) {
    const parts = val.split(":");
    document.getElementById("custom-w").value = parts[1] || 1;
    document.getElementById("custom-h").value = parts[2] || 2;
    updateCustomRatio();
    return;
  }
  const btn = document.querySelector(`.ratio-btn[data-ratio="${val}"]`);
  if (btn) btn.click();
}

function applyRatioValue(val) {
  setRatioValue(val);
  setTimeout(() => {
    if (!val.startsWith("custom:")) {
      const btn = document.querySelector(`.ratio-btn[data-ratio="${val}"]`);
      if (btn) scrollBtnToCenter(btn);
    }
  }, 50);
}

window.openFullPreview = (url) => {
  const modal = document.getElementById("modal-preview");
  const img = document.getElementById("preview-img");
  img.src = url;
  modal.classList.replace("hidden", "flex");
};

window.closeFullPreview = () => {
  const modal = document.getElementById("modal-preview");
  modal.classList.replace("flex", "hidden");
};

window.openEditModal = (id) => {
  const c = dbCards.find((x) => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById("edit-game").value = c.game;
  document.getElementById("edit-type").value = c.type;
  document.getElementById("edit-number").value = c.number;
  document.getElementById("edit-memo").value = c.memo || "";
  document.getElementById("modal-edit").classList.replace("hidden", "flex");
};

window.closeEditModal = () =>
  document.getElementById("modal-edit").classList.replace("flex", "hidden");

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

function setupSmartDropdown(inputId, dropId, keyGetter) {
  const inp = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!inp || !drop) return;
  const wrap = inp.parentElement;
  let isOpen = false;

  const populate = () => {
    drop.innerHTML = "";
    const isEditing = !inp.hasAttribute("readonly");
    const val = isEditing ? inp.value.toLowerCase().trim() : "";
    const items = keyGetter().filter(item => !val || item.toLowerCase().includes(val));

    if (items.length === 0) {
      drop.innerHTML = `<div class="px-4 py-3 text-sm text-slate-400 text-center">無符合項目</div>`;
    } else {
      items.forEach((itemVal) => {
        const d = document.createElement("div");
        d.className =
          "px-4 py-3 text-sm hover:bg-emerald-50 cursor-pointer text-slate-700 active:bg-emerald-100 font-medium truncate";
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
    newBtn.className =
      "px-4 py-3 text-sm text-emerald-600 font-bold hover:bg-emerald-50 cursor-pointer bg-slate-50 text-center border-t border-slate-100";
    newBtn.innerHTML = isEditing ? `✅ 完成輸入` : `✏️ 搜尋或手動輸入`;
    newBtn.onmousedown = (e) => {
      e.preventDefault();
      if (isEditing) close();
      else enterEditMode();
    };
    drop.appendChild(newBtn);
  };

  const open = () => {
    populate();
    drop.classList.remove("hidden");
    drop.classList.add("flex", "flex-col");
    isOpen = true;
    inp.setAttribute("readonly", "true");
    inp.classList.add("cursor-pointer");
  };

  const close = () => {
    drop.classList.add("hidden");
    drop.classList.remove("flex", "flex-col");
    isOpen = false;
    inp.setAttribute("readonly", "true");
    inp.blur();
    inp.classList.add("cursor-pointer");
  };

  const enterEditMode = () => {
    inp.removeAttribute("readonly");
    inp.classList.remove("cursor-pointer");
    inp.focus();
    inp.select();
    populate();
    if (!isOpen) {
      drop.classList.remove("hidden");
      drop.classList.add("flex", "flex-col");
      isOpen = true;
    }
  };

  inp.addEventListener("click", (e) => {
    if (inp.hasAttribute("readonly")) {
      if (!isOpen) {
        open();
      } else {
        enterEditMode();
      }
    }
  });

  inp.addEventListener("input", () => {
    if (!inp.hasAttribute("readonly")) populate();
  });

  inp.addEventListener("blur", () => {
    setTimeout(() => {
      if (!isOpen) {
        inp.setAttribute("readonly", "true");
        inp.classList.add("cursor-pointer");
      }
    }, 150);
  });

  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target) && isOpen) close();
  });
}

function updateCustomRatio() {
  const w = parseInt(document.getElementById("custom-w").value) || 1;
  const h = parseInt(document.getElementById("custom-h").value) || 1;

  document.querySelectorAll(".ratio-btn").forEach((b) => {
    b.classList.remove("bg-emerald-600", "text-white");
    b.classList.add("bg-slate-800", "text-slate-300");
  });

  const box = document.getElementById("custom-ratio-box");
  box.classList.replace("border-slate-700", "border-emerald-600");
  box.classList.remove("bg-slate-800");
  box.classList.add("bg-slate-800", "border", "border-emerald-600", "ring-1", "ring-emerald-600");

  setRatioAndCenter(w / h);
}

document.querySelectorAll(".ratio-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ratio-btn").forEach((b) => {
      b.classList.remove("bg-emerald-600", "text-white");
      b.classList.add("bg-slate-800", "text-slate-300");
    });
    btn.classList.add("bg-emerald-600", "text-white");
    btn.classList.remove("bg-slate-800", "text-slate-300");

    const box = document.getElementById("custom-ratio-box");
    box.classList.replace("border-emerald-600", "border-slate-700");
    box.classList.remove("ring-1", "ring-emerald-600");

    const ratioStr = btn.getAttribute("data-ratio").split(":");
    const newCropRatio = parseInt(ratioStr[0]) / parseInt(ratioStr[1]);
    setRatioAndCenter(newCropRatio);

    scrollBtnToCenter(btn);
  });
});

let scrollTimeout;
ratioContainer.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const containerCenter = ratioContainer.getBoundingClientRect().left + ratioContainer.clientWidth / 2;
    let closestEl = null;
    let minDiff = Infinity;

    document.querySelectorAll(".ratio-btn").forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      const btnCenter = rect.left + rect.width / 2;
      const diff = Math.abs(containerCenter - btnCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestEl = btn;
      }
    });

    if (closestEl && minDiff < 50) {
      if (!closestEl.classList.contains("bg-emerald-600")) {
        closestEl.click();
      }
    }
  }, 150);
});

document.getElementById("custom-w").addEventListener("input", updateCustomRatio);
document.getElementById("custom-h").addEventListener("input", updateCustomRatio);
