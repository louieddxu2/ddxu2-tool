// Global data state
window.dbCards = window.dbCards || [];

// Initialize data from IndexedDB
idbKeyval.get("bgCards").then((d) => {
  const loadedCards = d || [];
  
  // Anti-Race-Condition: Merge instead of overwrite
  const existingIds = new Set(window.dbCards.map(c => c.id));
  
  loadedCards.forEach(c => {
    if (!existingIds.has(c.id)) {
      window.dbCards.push(c);
    }
  });

  // Mark as ready in UIState
  if (window.UIState) window.UIState.isDBReady = true;
  
  // Initial Data Recovery
  const validCards = window.dbCards.filter(c => {
    try {
      const isBlob = c.blob && (c.blob instanceof Blob || (typeof c.blob.size === 'number' && typeof c.blob.type === 'string'));
      return c && c.id && isBlob;
    } catch(e) { return false; }
  });
  
  if (validCards.length !== window.dbCards.length) {
    window.dbCards.length = 0;
    window.dbCards.push(...validCards);
    saveCardsToDB();
  }

  if (typeof window.renderGallery === "function") {
    window.renderGallery();
  }
});

async function saveCardsToDB() {
  await idbKeyval.set("bgCards", window.dbCards);
  
  // Request persistence after first successful save to increase browser approval chance
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      console.log(`Storage persistence granted: ${granted}`);
    }
  }
}

// Initial check on startup
if (navigator.storage && navigator.storage.persisted) {
  navigator.storage.persisted().then(isPersisted => {
    if (isPersisted) console.log("Storage is already persisted.");
  });
}
