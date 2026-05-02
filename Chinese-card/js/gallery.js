let currentObserver = null;

const renderGallery = () => {
  if (isCropViewOpen) return;
  const gQ = document.getElementById("inp-game").value.toLowerCase();
  const tQ = document.getElementById("inp-type").value.toLowerCase();
  const nQ = document.getElementById("inp-number").value.toLowerCase();

  const filtered = dbCards
    .filter(
      (c) =>
        (c.game || "").toLowerCase().includes(gQ) &&
        (c.type || "").toLowerCase().includes(tQ) &&
        ((c.number || "").toLowerCase().includes(nQ) ||
          (c.memo && c.memo.toLowerCase().includes(nQ))),
    )
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

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

  displayed.forEach((c, index) => {
    // Safety check: skip corrupted records to prevent UI crash
    if (!c.blob || !(c.blob instanceof Blob)) {
      console.warn("Skipping invalid card blob:", c.id);
      return;
    }
    const url = URL.createObjectURL(c.blob);
    const div = document.createElement("div");
    div.className = "snap-start flex items-center justify-center w-full h-full p-2 md:p-6 overflow-hidden";
    div.setAttribute("data-id", c.id);
    div.setAttribute("data-game", c.game);
    div.setAttribute("data-type", c.type);
    div.setAttribute("data-number", c.number || "未命名");
    div.setAttribute("data-memo", c.memo || "");
    
    div.innerHTML = `
      <div class="w-full h-full flex items-center justify-center">
         <img src="${url}" class="max-w-full max-h-full object-contain shadow-2xl rounded-sm" onload="window.URL.revokeObjectURL(this.src)">
      </div>
    `;
    grid.appendChild(div);
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

  // Manually trigger initial footer content for the first card
  const firstCard = grid.firstElementChild;
  if (firstCard) {
    updateStationaryFooter(firstCard);
  }
};

const updateStationaryFooter = (target) => {
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

  const footer = document.getElementById("gallery-footer");
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
      </div>
    </div>
  `;
  try { lucide.createIcons({ props: { class: "w-4 h-4" }, elements: [footer] }); } catch(e) {}
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inp-game").oninput = renderGallery;
  document.getElementById("inp-type").oninput = renderGallery;
  document.getElementById("inp-number").oninput = renderGallery;
  document.getElementById("inp-number").onfocus = function () { this.select(); };
  document.getElementById("edit-number").onfocus = function () { this.select(); };
});
