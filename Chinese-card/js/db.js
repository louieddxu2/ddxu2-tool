// Global data state
let dbCards = [];

// Initialize data from IndexedDB
idbKeyval.get("bgCards").then((d) => {
  dbCards = d || [];
  
  // Initial Data Recovery: Clean up corrupted or incomplete records on startup
  const validCards = dbCards.filter(c => {
    return c && c.id && (c.blob instanceof Blob) && 
           typeof (c.game || "") === "string" && 
           typeof (c.type || "") === "string";
  });
  
  if (validCards.length !== dbCards.length) {
    console.warn(`Startup Recovery: Cleaned up ${dbCards.length - validCards.length} invalid records.`);
    dbCards = validCards;
    saveCardsToDB();
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
