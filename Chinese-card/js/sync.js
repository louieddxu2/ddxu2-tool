let peer = null;
let connections = new Set();
let qrcode = null;

const CHUNK_SIZE = 16384; 
let incomingChunks = {}; 

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
  if (peer) peer.destroy();
  
  // Try to use a persistent ID for session stability
  const savedId = sessionStorage.getItem('bg_last_peer_id');
  peer = savedId ? new Peer(savedId) : new Peer();
  
  peer.on('open', (id) => {
    sessionStorage.setItem('bg_last_peer_id', id);
    document.getElementById("sync-my-id").innerText = id;
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    
    const qrEl = document.getElementById("sync-qrcode");
    qrEl.innerHTML = "";
    qrcode = new QRCode(qrEl, {
      text: url, width: 192, height: 192, colorDark: "#059669", colorLight: "#ffffff",
      correctLevel: 2
    });
    
    updateSyncUI("hosting");
    logSync(`房間已開啟，房號: ${id}`);
  });

  peer.on('connection', (c) => setupConnection(c));
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
        sessionStorage.removeItem('bg_last_peer_id');
        return startHost();
    }
    logSync(`錯誤: ${err.type}`, 'error');
    updateSyncUI("initial");
  });
};

window.stopHost = () => {
  if (peer) peer.destroy();
  peer = null;
  connections.forEach(c => c.close());
  connections.clear();
  sessionStorage.removeItem('bg_last_peer_id');
  updateSyncUI("initial");
  logSync("房間已關閉");
};

window.copyMyId = () => {
  const id = document.getElementById("sync-my-id").innerText;
  navigator.clipboard.writeText(id).then(() => alert("房號已複製"));
};

// Join Logic
window.joinRoomManually = () => {
  const id = document.getElementById("sync-join-id").value.trim();
  if (id) startJoin(id);
};

function startJoin(id) {
  if (peer) peer.destroy();
  peer = new Peer();
  peer.on('open', () => setupConnection(peer.connect(id)));
  peer.on('error', (err) => {
    logSync(`加入失敗: ${err.type}`, 'error');
    updateSyncUI("initial");
  });
}

// Data Transfer with Chunking
async function sendCardChunked(targetConn, card) {
  if (!targetConn || !targetConn.open) return;
  
  const buffer = await card.blob.arrayBuffer();
  const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
  const cardId = card.id;

  targetConn.send({
    type: 'CARD_START',
    cardId: cardId,
    totalChunks: totalChunks,
    metadata: { ...card, blob: null }
  });

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
    const chunk = buffer.slice(start, end);
    targetConn.send({ type: 'CARD_CHUNK', cardId: cardId, index: i, chunk: chunk });
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
  }
}

// Connection Setup
function setupConnection(c) {
  connections.add(c);
  
  c.on('open', () => {
    updateSyncUI("connected");
    const count = connections.size;
    const msg = count > 1 ? `玩家已加入 (共 ${count} 人)` : "已連線，正在比對資料...";
    document.getElementById("sync-status-text").innerText = msg;
    logSync(`連線成功: ${c.peer.slice(0,8)}...`);
    
    const maxTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
    c.send({ type: 'HELLO', latestTimestamp: maxTs });
  });

  c.on('data', async (data) => {
    if (data.type === 'HELLO') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      if (missing.length > 0) {
        logSync(`向對方發送 ${missing.length} 筆差額資料...`);
        for (const card of missing) { await sendCardChunked(c, card); }
      }
      const myTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
      c.send({ type: 'REQUEST_DIFF', latestTimestamp: myTs });
    }
    
    if (data.type === 'REQUEST_DIFF') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      if (missing.length > 0) {
          logSync(`補發 ${missing.length} 筆資料給新玩家...`);
          for (const card of missing) { await sendCardChunked(c, card); }
      }
    }

    if (data.type === 'CARD_START') {
      incomingChunks[data.cardId] = {
        chunks: new Array(data.totalChunks),
        received: 0,
        total: data.totalChunks,
        metadata: data.metadata
      };
    }

    if (data.type === 'CARD_CHUNK') {
      const state = incomingChunks[data.cardId];
      if (!state) return;
      state.chunks[data.index] = data.chunk;
      state.received++;
      if (state.received === state.total) {
        const finalBuffer = new Blob(state.chunks);
        const card = { ...state.metadata, blob: finalBuffer };
        delete incomingChunks[data.cardId];
        const idx = dbCards.findIndex(x => x.id === card.id);
        if (idx === -1) {
          dbCards.push(card);
          await window.idbKeyval.set("bgCards", dbCards, true);
          renderGallery();
          logSync(`已同步: ${card.number || '新項目'}`);
        } else if (card.timestamp > (dbCards[idx].timestamp || 0)) {
          dbCards[idx] = card;
          await window.idbKeyval.set("bgCards", dbCards, true);
          renderGallery();
          logSync(`已更新: ${card.number || '項目更新'}`);
        }
      }
    }
  });

  const removeConn = () => {
    connections.delete(c);
    const count = connections.size;
    logSync(`連線中斷: ${c.peer.slice(0,8)}...`);
    if (count > 0) {
        document.getElementById("sync-status-text").innerText = `已連線 (共 ${count} 人)`;
    } else {
        document.getElementById("sync-status-text").innerText = "連線已關閉";
        setTimeout(() => { if (connections.size === 0 && !peer.destroyed) updateSyncUI("hosting"); }, 3000);
    }
  };

  c.on('close', removeConn);
  c.on('error', removeConn);
}

// Hook into IDB Keyval
const originalIdbSet = window.idbKeyval.set;
window.idbKeyval.set = async function(key, value, isFromSync = false) {
  const res = await originalIdbSet.apply(this, [key, value]);
  if (key === "bgCards" && !isFromSync && connections.size > 0) {
    const mostRecent = [...value].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    if (mostRecent && mostRecent.blob instanceof Blob) {
      logSync(`即時廣播: ${mostRecent.number || '新卡片'}`);
      for (const c of connections) {
        if (c.open) sendCardChunked(c, mostRecent);
      }
    }
  }
  return res;
};

// Auto-join from URL
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    setTimeout(() => { openSyncModal(); startJoin(roomId); }, 1500);
  }
});
