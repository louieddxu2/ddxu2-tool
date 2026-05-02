let peer = null;
let connections = new Set();
let qrcode = null;

const CHUNK_SIZE = 16384; 
let incomingChunks = {}; 
const TTL_MS = 60 * 60 * 1000; // 1 hour TTL for zombie session prevention

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
    const inpGame = document.getElementById("inp-game");
    if (inpGame) inpGame.disabled = false;
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
  } else if (state === "hosting") {
      hosting.classList.remove("hidden");
      if (dot) dot.classList.remove("hidden");
  } else if (state === "connected") {
      connected.classList.remove("hidden");
      if (dot) dot.classList.remove("hidden");
  }
  
  try { lucide.createIcons(); } catch (e) {}
}

// Host Logic
window.startHost = () => {
  const inpGame = document.getElementById("inp-game");
  const gameName = inpGame ? inpGame.value.trim() : "";
  if (!gameName && !localStorage.getItem('bg_session_game')) {
      alert("請先在左上角輸入「遊戲名稱」再開啟房間，以確保同步資料正確隔離。");
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
        inpGame.disabled = true;
    }
    
    updateActivity();
    document.getElementById("sync-my-id").innerText = id;
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    const qrEl = document.getElementById("sync-qrcode");
    qrEl.innerHTML = "";
    qrcode = new QRCode(qrEl, { text: url, width: 192, height: 192, colorDark: "#059669", colorLight: "#ffffff", correctLevel: 2 });
    updateSyncUI("hosting");
    logSync(`房間已開啟: ${id}`);
  });

  peer.on('connection', (c) => setupConnection(c));
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { localStorage.removeItem('bg_last_peer_id'); return startHost(); }
    logSync(`Peer 錯誤: ${err.type}`);
    updateSyncUI("initial");
  });
};

window.stopHost = () => {
  if (peer) peer.destroy();
  peer = null;
  connections.forEach(c => c.close());
  connections.clear();
  localStorage.removeItem('bg_last_peer_id');
  localStorage.removeItem('bg_sync_role');
  localStorage.removeItem('bg_last_joined_id');
  localStorage.removeItem('bg_last_active_time');
  localStorage.removeItem('bg_session_start_time');
  localStorage.removeItem('bg_session_game');
  const inpGame = document.getElementById("inp-game");
  if (inpGame) inpGame.disabled = false;
  updateSyncUI("initial");
  logSync("房間已關閉");
};

// Join Logic
window.joinRoomManually = () => {
  const id = document.getElementById("sync-join-id").value.trim();
  if (id) startJoin(id);
};

function startJoin(id) {
  if (!id) return;
  if (peer) peer.destroy();
  
  peer = new Peer();
  peer.on('open', () => {
    localStorage.setItem('bg_last_joined_id', id);
    localStorage.setItem('bg_sync_role', 'client');
    updateActivity();
    setupConnection(peer.connect(id));
  });
  peer.on('error', (err) => {
    logSync(`加入失敗: ${err.type}`);
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

function setupConnection(c) {
  connections.add(c);
    c.on('open', () => {
      updateSyncUI("connected");
      const count = connections.size;
      document.getElementById("sync-status-text").innerText = count > 1 ? `已連線 (共 ${count} 人)` : "已連線，正在對帳...";
      logSync(`連線成功: ${c.peer.slice(0,6)}`);
      
      const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
      const sessionGame = localStorage.getItem('bg_session_game') || "";
      
      if (localStorage.getItem('bg_sync_role') === 'host') {
          const sessionCards = dbCards.filter(c => c.timestamp >= sessionStart && c.game === sessionGame);
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
          inpGame.disabled = true;
          // Trigger filter update if needed
          inpGame.dispatchEvent(new Event('input'));
      }

      const myCards = dbCards.filter(c => c.timestamp >= data.sessionStart && c.game === data.sessionGame);
      
      const missingFromHost = data.metas.filter(m => {
          const local = myCards.find(x => x.id === m.id);
          return !local || (local.timestamp || 0) < m.timestamp;
      }).map(m => m.id);
      
      if (missingFromHost.length > 0) {
          logSync(`向主機索取 ${missingFromHost.length} 張卡片...`);
          c.send({ type: 'REQUEST_CARDS', ids: missingFromHost });
      }
      
      const myMetas = myCards.map(x => ({ id: x.id, timestamp: x.timestamp || 0 }));
      c.send({ type: 'MY_METAS', metas: myMetas });
    }
    
    if (data.type === 'MY_METAS') {
      const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
      const sessionGame = localStorage.getItem('bg_session_game') || "";
      const myCards = dbCards.filter(c => c.timestamp >= sessionStart && c.game === sessionGame);
      
      const missingFromClient = data.metas.filter(m => {
          const local = myCards.find(x => x.id === m.id);
          return !local || (local.timestamp || 0) < m.timestamp;
      }).map(m => m.id);
      
      if (missingFromClient.length > 0) {
          logSync(`向訪客索取 ${missingFromClient.length} 張卡片...`);
          c.send({ type: 'REQUEST_CARDS', ids: missingFromClient });
      }
    }

    if (data.type === 'REQUEST_CARDS') {
        logSync(`發送 ${data.ids.length} 張請求的卡片...`);
        for (const id of data.ids) {
            const card = dbCards.find(x => x.id === id);
            if (card) await sendCardChunked(c, card);
        }
    }

    if (data.type === 'CARD_START') {
      incomingChunks[data.cardId] = { chunks: new Array(data.totalChunks), received: 0, total: data.totalChunks, metadata: data.metadata };
    }
    if (data.type === 'CARD_CHUNK') {
      const state = incomingChunks[data.cardId];
      if (!state) return;
      state.chunks[data.index] = data.chunk;
      state.received++;
      if (state.received === state.total) {
        const card = { ...state.metadata, blob: new Blob(state.chunks) };
        delete incomingChunks[data.cardId];
        const idx = dbCards.findIndex(x => x.id === card.id);
        if (idx === -1) { dbCards.push(card); await window.idbKeyval.set("bgCards", dbCards, true); renderGallery(); logSync(`已同步: ${card.number || '新項目'}`); }
        else if (card.timestamp > (dbCards[idx].timestamp || 0)) { dbCards[idx] = card; await window.idbKeyval.set("bgCards", dbCards, true); renderGallery(); logSync(`已更新: ${card.number}`); }
      }
    }
  });

  const removeConn = () => {
    connections.delete(c);
    if (connections.size > 0) document.getElementById("sync-status-text").innerText = `已連線 (共 ${connections.size} 人)`;
    else { document.getElementById("sync-status-text").innerText = "連線已關閉"; setTimeout(() => { if (connections.size === 0 && peer && !peer.destroyed) updateSyncUI(localStorage.getItem('bg_sync_role') === 'host' ? 'hosting' : 'initial'); }, 3000); }
  };
  c.on('close', removeConn);
  c.on('error', removeConn);
}

// Global hook
const originalIdbSet = window.idbKeyval.set;
window.idbKeyval.set = async function(key, value, isFromSync = false) {
  const res = await originalIdbSet.apply(this, [key, value]);
  if (key === "bgCards" && !isFromSync && connections.size > 0) {
    const sessionStart = parseInt(localStorage.getItem('bg_session_start_time')) || 0;
    const sessionGame = localStorage.getItem('bg_session_game') || "";
    
    const mostRecent = [...value].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    
    // Only broadcast if the card belongs to the current locked session
    if (mostRecent && mostRecent.blob instanceof Blob && 
        mostRecent.timestamp >= sessionStart && 
        mostRecent.game === sessionGame) {
        
      logSync(`即時廣播: ${mostRecent.number || '新卡片'}`);
      for (const c of connections) {
        if (c.open) sendCardChunked(c, mostRecent);
      }
    }
  }
  return res;
};

// Persistence & Auto-reconnect Logic
function handleAutoReconnect() {
  if (checkAndClearExpiredSession()) {
    logSync("連線已逾時失效，請重新建立房間。");
    return;
  }
  updateActivity();
  const role = localStorage.getItem('bg_sync_role');
  if (role === 'host') {
    logSync("嘗試重新開啟房間...");
    startHost();
  } else if (role === 'client') {
    const lastId = localStorage.getItem('bg_last_joined_id');
    if (lastId) {
      logSync("嘗試重新連回房間...");
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
      connections.clear();
      updateSyncUI("initial");
      return;
    }
    updateActivity();
    const isDisconnected = !peer || peer.destroyed || (localStorage.getItem('bg_sync_role') === 'client' && connections.size === 0);
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
