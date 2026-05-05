let peer = null;
window.connections = new Set();
let qrcode = null;

const CHUNK_SIZE = 16384; 
let incomingChunks = {}; 
let broadcastedCardVersions = new Map(); 
const TTL_MS = 60 * 60 * 1000; // 1 hour TTL for zombie session prevention
const INCOMING_CHUNK_TTL_MS = 60 * 1000;

let syncRenderTimeout = null;
function throttledRenderGallery() {
    if (syncRenderTimeout) return; 
    syncRenderTimeout = setTimeout(() => {
        if (typeof window.renderGallery === 'function') window.renderGallery();
        syncRenderTimeout = null;
    }, 300); // Wait for 300ms of quiet before redrawing
}

function updateActivity() {
  localStorage.setItem('bg_last_active_time', Date.now().toString());
}

function checkAndClearExpiredSession() {
  const lastActive = localStorage.getItem('bg_last_active_time');
  if (lastActive && (Date.now() - parseInt(lastActive, 10)) > TTL_MS) {
    localStorage.removeItem('bg_last_peer_id');
    localStorage.removeItem('bg_sync_role');
    localStorage.removeItem('bg_last_joined_id');
    localStorage.removeItem('bg_last_active_time');
    localStorage.removeItem('bg_session_start_time');
    localStorage.removeItem('bg_session_game');
    return true;
  }
  return false;
}

// UI Helpers
window.openSyncModal = () => {
  const m = document.getElementById("modal-sync");
  if (m) { m.classList.remove("hidden"); m.classList.add("flex"); }
  try { lucide.createIcons(); } catch (e) {}
};

window.closeSyncModal = () => {
  const m = document.getElementById("modal-sync");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
};

function logSync(msg, type = 'info') {
    const logEl = document.getElementById("sync-log");
    if (!logEl) return;
    logEl.classList.remove("hidden");
    const div = document.createElement("div");
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    div.innerHTML = `<span class="opacity-50">[${time}]</span> ${msg}`;
    logEl.prepend(div);
    if (logEl.children.length > 20) logEl.lastElementChild.remove();
}

function updateSyncUI(state) {
  const initial = document.getElementById("sync-initial");
  const hosting = document.getElementById("sync-hosting");
  const connected = document.getElementById("sync-connected");
  const dot = document.getElementById("sync-active-dot");

  initial.classList.add("hidden");
  hosting.classList.add("hidden");
  connected.classList.add("hidden");

  if (state === "initial") {
      initial.classList.remove("hidden");
      if (dot) dot.classList.add("hidden");
      updateGameInputLockUI(false);
  } else if (state === "hosting") {
      hosting.classList.remove("hidden");
      if (dot) dot.classList.remove("hidden");
      updateGameInputLockUI(true);
  } else if (state === "connected") {
      connected.classList.remove("hidden");
      if (dot) dot.classList.remove("hidden");
      updateGameInputLockUI(true);
  }
  
  try { lucide.createIcons(); } catch (e) {}
}

function updateGameInputLockUI(isLocked) {
    const inpGame = document.getElementById("inp-game");
    const iconContainer = document.getElementById("icon-game");
    
    if (!inpGame) return;

    if (isLocked) {
        inpGame.classList.remove("bg-white", "border-slate-200");
        inpGame.classList.add("bg-emerald-50", "border-emerald-300", "text-emerald-800", "font-bold");
        if (iconContainer) {
            iconContainer.innerHTML = '<i data-lucide="lock" class="w-3 h-3 text-emerald-600"></i>';
            try { lucide.createIcons(); } catch (e) {}
        }
    } else {
        inpGame.classList.remove("bg-emerald-50", "border-emerald-300", "text-emerald-800", "font-bold");
        inpGame.classList.add("bg-white", "border-slate-200");
        if (iconContainer) {
            iconContainer.innerHTML = '<i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>';
            try { lucide.createIcons(); } catch (e) {}
        }
    }
}

// Host Logic
window.startHost = () => {
  const inpGame = document.getElementById("inp-game");
  const gameName = inpGame ? inpGame.value.trim() : "";
  if (!gameName && !localStorage.getItem('bg_session_game')) {
      alert("Please enter a game name before starting host sync.");
      return;
  }

  if (peer) peer.destroy();
  const savedId = localStorage.getItem('bg_last_peer_id');
  peer = new Peer(savedId || undefined);
  
  peer.on('open', (id) => {
    localStorage.setItem('bg_last_peer_id', id);
    localStorage.setItem('bg_sync_role', 'host');
    
    // Session Scope Locking
    if (!localStorage.getItem('bg_session_start_time')) {
        localStorage.setItem('bg_session_start_time', Date.now().toString());
        localStorage.setItem('bg_session_game', gameName);
    }
    if (inpGame) {
        inpGame.value = localStorage.getItem('bg_session_game');
    }
    
    updateActivity();
    document.getElementById("sync-my-id").innerText = id;
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    const qrEl = document.getElementById("sync-qrcode");
    qrEl.innerHTML = "";
    qrcode = new QRCode(qrEl, { text: url, width: 192, height: 192, colorDark: "#059669", colorLight: "#ffffff", correctLevel: 2 });
    updateSyncUI("hosting");
    broadcastedCardVersions.clear(); // Reset on session start
    logSync(`??™è????Œè????? ${id}`);
  });

  peer.on('connection', (c) => setupConnection(c));
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { localStorage.removeItem('bg_last_peer_id'); return startHost(); }
    logSync(`Peer ??™è³ª?? ${err.type}`);
    updateSyncUI("initial");
  });
};

window.stopHost = () => {
  if (peer) peer.destroy();
  peer = null;
  window.connections.forEach(c => c.close());
  window.connections.clear();
  localStorage.removeItem('bg_last_peer_id');
  localStorage.removeItem('bg_sync_role');
  localStorage.removeItem('bg_last_joined_id');
  localStorage.removeItem('bg_last_active_time');
  localStorage.removeItem('bg_session_start_time');
  localStorage.removeItem('bg_session_game');
  updateSyncUI("initial");
  broadcastedCardVersions.clear(); 
  logSync("Host session stopped.");
};



function startJoin(id) {
  if (!id) return;
  if (peer) peer.destroy();
  
  peer = new Peer();
  peer.on('open', () => {
    localStorage.setItem('bg_last_joined_id', id);
    localStorage.setItem('bg_sync_role', 'client');
    updateActivity();
    broadcastedCardVersions.clear(); // Reset on join
    setupConnection(peer.connect(id));
  });
  peer.on('error', (err) => {
    logSync(`??™è³¢?¯æ†­æ¢§è•­?: ${err.type}`);
    updateSyncUI("initial");
  });
}

async function sendCardChunked(targetConn, card) {
  if (!targetConn || !targetConn.open) return;
  const buffer = await card.blob.arrayBuffer();
  const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
  targetConn.send({ type: 'CARD_START', cardId: card.id, totalChunks: totalChunks, metadata: { ...card, blob: null } });
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
    const chunk = buffer.slice(start, end);
    targetConn.send({ type: 'CARD_CHUNK', cardId: card.id, index: i, chunk: chunk });
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
  }
}

function getIncomingChunkKey(peerId, cardId) {
  return `${peerId || 'unknown'}::${cardId}`;
}

function clearIncomingChunkState(key) {
  const state = incomingChunks[key];
  if (!state) return;
  if (state.timeoutId) clearTimeout(state.timeoutId);
  delete incomingChunks[key];
}

window.setupConnection = function(c) {
  // 1. Environment Guard (In-App Browser detection)
  const ua = navigator.userAgent;
  const isInApp = /Line|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua);
  if (isInApp) {
      const inAppModal = document.getElementById("modal-inapp-browser");
      if (inAppModal) {
          inAppModal.classList.remove("hidden");
          inAppModal.classList.add("flex");
          try { lucide.createIcons(); } catch(e) {}
      }
  }

  window.connections.add(c);
    c.on('open', () => {
      const role = localStorage.getItem('bg_sync_role');
      if (role === 'host') {
          updateSyncUI("hosting");
          const hs = document.getElementById("sync-host-status");
          if (hs) { hs.classList.remove("hidden"); hs.classList.add("flex"); }
          const hc = document.getElementById("sync-host-count");
          if (hc) hc.innerText = `?Œè???? (${window.connections.size}??`;
      } else {
          updateSyncUI("connected");
          setTimeout(() => { window.closeSyncModal(); }, 3000); // Auto-close for client after 3s
      }
      
      logSync(`?????™è???: ${c.peer.slice(0,6)}`);
      
      const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
      const sessionGame = localStorage.getItem('bg_session_game') || "";
      
      if (localStorage.getItem('bg_sync_role') === 'host') {
          const sessionCards = window.dbCards.filter(c => c.timestamp >= sessionStart && c.game === sessionGame);
          const metas = sessionCards.map(c => ({ id: c.id, timestamp: c.timestamp || 0 }));
          c.send({ type: 'HELLO', sessionStart, sessionGame, metas });
      }
    });

  c.on('data', async (data) => {
    updateActivity(); 
    
    if (data.type === 'HELLO') {
      localStorage.setItem('bg_session_start_time', data.sessionStart.toString());
      localStorage.setItem('bg_session_game', data.sessionGame);
      
      const inpGame = document.getElementById("inp-game");
      if (inpGame) {
          inpGame.value = data.sessionGame;
          inpGame.dispatchEvent(new Event('input'));
      }

      const myCards = window.dbCards.filter(c => c.timestamp >= data.sessionStart && c.game === data.sessionGame);
      
      const missingFromHost = data.metas.filter(m => {
          const local = myCards.find(x => x.id === m.id);
          return !local || (local.timestamp || 0) < m.timestamp;
      }).map(m => m.id);
      
      if (missingFromHost.length > 0) {
          logSync(`??™è³­?“ç?î¸ƒæ£??${missingFromHost.length} ?˜è????..`);
          c.send({ type: 'REQUEST_CARDS', ids: missingFromHost });
      }
      
      const myMetas = myCards.map(x => ({ id: x.id, timestamp: x.timestamp || 0 }));
      c.send({ type: 'MY_METAS', metas: myMetas });
    }

    if (data.type === 'MY_METAS' && localStorage.getItem('bg_sync_role') === 'host') {
      const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
      const sessionGame = localStorage.getItem('bg_session_game') || '';
      const sessionCards = window.dbCards.filter(x => x.timestamp >= sessionStart && x.game === sessionGame);

      const missingOnClient = sessionCards.filter(card => {
        const peerMeta = data.metas.find(m => m.id === card.id);
        return !peerMeta || (peerMeta.timestamp || 0) < (card.timestamp || 0);
      }).map(card => card.id);

      if (missingOnClient.length > 0) {
        logSync(`Client missing ${missingOnClient.length} card(s); requesting backfill send.`);
        c.send({ type: 'REQUEST_CARDS', ids: missingOnClient });
      }
    }

    if (data.type === 'REQUEST_CARDS') {
        logSync(`??™è???${data.ids.length} ?˜è????™î¿¢????™è???...`);
        for (const id of data.ids) {
            const card = window.dbCards.find(x => x.id === id);
            if (card) await sendCardChunked(c, card);
        }
    }

    if (data.type === 'CARD_START') {
      const chunkKey = getIncomingChunkKey(c.peer, data.cardId);
      clearIncomingChunkState(chunkKey);
      incomingChunks[chunkKey] = {
        chunks: new Array(data.totalChunks),
        received: 0,
        total: data.totalChunks,
        metadata: data.metadata,
        timeoutId: setTimeout(() => {
          clearIncomingChunkState(chunkKey);
          logSync(`Sync timeout for card ${data.cardId}.`, "error");
        }, INCOMING_CHUNK_TTL_MS),
      };
      
      // Update progress bar UI
      const bar = document.getElementById("sync-progress-bar");
      const inner = document.getElementById("sync-progress-inner");
      if (bar && inner) {
          bar.classList.remove("hidden");
          inner.style.width = "0%";
      }
    }
    if (data.type === 'CARD_CHUNK') {
      const chunkKey = getIncomingChunkKey(c.peer, data.cardId);
      const state = incomingChunks[chunkKey];
      if (!state) return;
      state.chunks[data.index] = data.chunk;
      state.received++;

      // Update progress
      const inner = document.getElementById("sync-progress-inner");
      if (inner) {
          const pct = Math.floor((state.received / state.total) * 100);
          inner.style.width = `${pct}%`;
      }

      if (state.received === state.total) {
        const card = { ...state.metadata, blob: new Blob(state.chunks) };
        clearIncomingChunkState(chunkKey);
        
        // Hide progress bar with a slight delay
        setTimeout(() => {
            const bar = document.getElementById("sync-progress-bar");
            if (bar) bar.classList.add("hidden");
        }, 500);

        const idx = window.dbCards.findIndex(x => x.id === card.id);
        const isUpdate = idx !== -1;
        
        if (!isUpdate) { 
            window.dbCards.push(card); 
        } else if (card.timestamp > (window.dbCards[idx].timestamp || 0)) { 
            window.dbCards[idx] = card; 
        } else {
            return; // Already have newer or same version
        }

        try {
            await window.idbKeyval.set("bgCards", window.dbCards, true);
        } catch (err) {
            console.error("Storage write failed:", err);
            if (err.name === 'QuotaExceededError') {
                logSync("????™è????›ç¶½???Œè„«?›å??¼ï??œî?ç¥??™è³£î¡??™è???", "error");
            } else {
                logSync(`???–æ€ ï…¯?­æùë??: ${err.message}`, "error");
            }
            return;
        }
        
        // Smart Refresh Logic: Only refresh if the card matches current filters
        const gQ = document.getElementById("inp-game")?.value.toLowerCase().trim() || "";
        const tQ = document.getElementById("inp-type")?.value.toLowerCase().trim() || "";
        const nQ = document.getElementById("inp-number")?.value.toLowerCase().trim() || "";

        const isMatch = (card.game || "").toLowerCase().includes(gQ) &&
                        (card.type || "").toLowerCase().includes(tQ) &&
                        ((card.number || "").toLowerCase().includes(nQ) || 
                         (card.memo || "").toLowerCase().includes(nQ));

        if (isMatch) {
            throttledRenderGallery();
            logSync(`${isUpdate ? 'Card updated' : 'Card received'}: ${card.number || 'unknown'}`);
        } else {
            logSync(`Synced card not in current filter: ${card.number || 'unknown'}`);
        }
      }
    }
  });

  const removeConn = () => {
    const peerPrefix = `${c.peer || 'unknown'}::`;
    Object.keys(incomingChunks).forEach((key) => {
      if (key.startsWith(peerPrefix)) clearIncomingChunkState(key);
    });
    window.connections.delete(c);
    const role = localStorage.getItem('bg_sync_role');
    if (role === 'host') {
        if (window.connections.size > 0) {
            const hc = document.getElementById("sync-host-count");
            if (hc) hc.innerText = `?Œè???? (${window.connections.size}??`;
        } else {
            const hs = document.getElementById("sync-host-status");
            if(hs) { hs.classList.add("hidden"); hs.classList.remove("flex"); }
        }
    } else {
        if (window.connections.size === 0 && peer && !peer.destroyed) {
            setTimeout(() => { updateSyncUI('initial'); }, 3000);
        }
    }
  };
  c.on('close', removeConn);
  c.on('error', removeConn);
}

// Global hook
const originalIdbSet = window.idbKeyval.set;
window.idbKeyval.set = async function(key, value, isFromSync = false) {
  const res = await originalIdbSet.apply(this, [key, value]);
  if (key === "bgCards" && !isFromSync && window.connections.size > 0) {
    const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
    const sessionGame = localStorage.getItem('bg_session_game') || "";
    
    // Find all cards added in this session that haven't been broadcasted yet
    const pendingBroadcast = value.filter(c => 
        c.blob instanceof Blob && 
        c.timestamp >= sessionStart && 
        c.game === sessionGame &&
        (broadcastedCardVersions.get(c.id) || 0) < (c.timestamp || 0)
    );

    if (pendingBroadcast.length > 0) {
      if (pendingBroadcast.length > 1) {
        logSync(`??™è??????™è??? ??™è³£æ´??™è???${pendingBroadcast.length} ?˜è????..`);
      } else {
        logSync(`Queued broadcast: ${pendingBroadcast[0]?.number || 'unknown'}`);
      }
      
      for (const card of pendingBroadcast) {
        let sentToAllConnections = true;
        for (const c of window.connections) {
          if (c.open) {
            // Sequential send to avoid interleaving messages on the data channel
            try {
              await sendCardChunked(c, card);
            } catch (err) {
              sentToAllConnections = false;
              logSync(`Broadcast failed for ${card.number || card.id}: ${err.message || err}`, "error");
            }
          }
        }
        if (sentToAllConnections) {
          broadcastedCardVersions.set(card.id, card.timestamp || 0);
        }
      }
    }
  }
  return res;
};

// Persistence & Auto-reconnect Logic
function handleAutoReconnect() {
  if (checkAndClearExpiredSession()) {
    logSync("Session expired, cleared stale state.");
    return;
  }
  updateActivity();
  const role = localStorage.getItem('bg_sync_role');
  if (role === 'host') {
    logSync("??™è³ªå²??™è³£î¡??™è?????™è???...");
    startHost();
  } else if (role === 'client') {
    const lastId = localStorage.getItem('bg_last_joined_id');
    if (lastId) {
      logSync("??™è³ªå²??™è³£î¡?????™è???...");
      startJoin(lastId);
    }
  }
}

// Listen for tab focus
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (checkAndClearExpiredSession()) {
      if (peer) peer.destroy();
      peer = null;
      window.connections.clear();
      updateSyncUI("initial");
      return;
    }
    updateActivity();
    const isDisconnected = !peer || peer.destroyed || (localStorage.getItem('bg_sync_role') === 'client' && window.connections.size === 0);
    if (isDisconnected) {
      handleAutoReconnect();
    }
  }
});

// Initial join or reconnect
document.addEventListener("DOMContentLoaded", () => {
  checkAndClearExpiredSession(); // Clean up on cold boot
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    setTimeout(() => { openSyncModal(); startJoin(roomId); }, 1500);
  } else {
    // If no URL param, check if we should auto-reconnect
    if (localStorage.getItem('bg_sync_role')) {
        handleAutoReconnect();
    }
  }
});





