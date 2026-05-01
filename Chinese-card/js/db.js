// Global data state
let dbCards = [];

// Initialize data from IndexedDB
idbKeyval.get("bgCards").then((d) => {
  dbCards = d || [];
  if (typeof renderGallery === "function") {
    renderGallery();
  }
});

async function saveCardsToDB() {
  await idbKeyval.set("bgCards", dbCards);
}
