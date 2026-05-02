// Global data state
let dbCards = [];

// Initialize data from IndexedDB
idbKeyval.get("bgCards").then((d) => {
  dbCards = d || [];
  
  // Initial Data Recovery: Clean up corrupted or incomplete records on startup
  const validCards = dbCards.filter(c => {
    try {
      return c && c.id && (c.blob instanceof Blob) && 
             typeof (c.game || "") === "string" && 
             typeof (c.type || "") === "string";
    } catch(e) { return false; }
  });
  
  if (validCards.length !== dbCards.length) {
    const count = dbCards.length - validCards.length;
    console.warn(`Startup Recovery: Cleaned up ${count} invalid records.`);
    dbCards = validCards;
    saveCardsToDB();
    
    // Notify user about the fix
    const tip = document.createElement("div");
    tip.className = "fixed top-20 left-1/2 -translate-x-1/2 z-[300000] bg-slate-800 text-white text-[10px] px-3 py-1 rounded-full shadow-lg animate-bounce";
    tip.innerText = `已自動修復 ${count} 筆損壞資料`;
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 5000);
  }

  if (typeof renderGallery === "function") {
    renderGallery();
  }
});

async function saveCardsToDB() {
  // Data Recovery: Filter out corrupted records where blob is missing or invalid
  const validCards = dbCards.filter(c => c.blob && (c.blob instanceof Blob));
  if (validCards.length !== dbCards.length) {
    console.warn(`Recovered database: Removed ${dbCards.length - validCards.length} corrupted records.`);
    dbCards = validCards;
  }
  await idbKeyval.set("bgCards", dbCards);
}
