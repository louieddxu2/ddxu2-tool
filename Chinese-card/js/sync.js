let peer = null;
let conn = null;
let qrcode = null;

const CHUNK_SIZE = 16384; // 16KB per chunk for maximum compatibility
let incomingChunks = {}; // { cardId: { chunks: [], total: 0, received: 0, metadata: {} } }

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

function updateSyncUI(state) {
  const initial = document.getElementById("sync-initial");
  const hosting = document.getElementById("sync-hosting");
  const connected = document.getElementById("sync-connected");

  initial.classList.add("hidden");
  hosting.classList.add("hidden");
  connected.classList.add("hidden");

  if (state === "initial") initial.classList.remove("hidden");
  else if (state === "hosting") hosting.classList.remove("hidden");
  else if (state === "connected") connected.classList.remove("hidden");
  
  try { lucide.createIcons(); } catch (e) {}
}

// Host Logic
window.startHost = () => {
  if (peer) peer.destroy();
  peer = new Peer();
  peer.on('open', (id) => {
    document.getElementById("sync-my-id").innerText = id;
    const url = `${window.location.origin}${window.location.pathname}?room=${id}`;
    const qrEl = document.getElementById("sync-qrcode");
    qrEl.innerHTML = "";
    qrcode = new QRCode(qrEl, {
      text: url, width: 192, height: 192, colorDark: "#059669", colorLight: "#ffffff",
      correctLevel: QRCode.Level ? QRCode.Level.H : 2
    });
    updateSyncUI("hosting");
  });
  peer.on('connection', (c) => setupConnection(c));
  peer.on('error', (err) => {
    alert("連線發生錯誤: " + err.type);
    updateSyncUI("initial");
  });
};

window.stopHost = () => {
  if (peer) peer.destroy();
  peer = null; conn = null;
  updateSyncUI("initial");
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
    alert("連線失敗: " + err.type);
    updateSyncUI("initial");
  });
}

// Data Transfer with Chunking
async function sendCardChunked(card) {
  if (!conn || !conn.open) return;
  
  const buffer = await card.blob.arrayBuffer();
  const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
  const cardId = card.id;

  // Send Metadata first
  conn.send({
    type: 'CARD_START',
    cardId: cardId,
    totalChunks: totalChunks,
    metadata: { ...card, blob: null } // Exclude blob from meta
  });

  // Send Chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
    const chunk = buffer.slice(start, end);
    
    conn.send({
      type: 'CARD_CHUNK',
      cardId: cardId,
      index: i,
      chunk: chunk
    });
    
    // Tiny delay to prevent buffer overflow on slow devices
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
  }
}

// Connection Setup
function setupConnection(c) {
  conn = c;
  conn.on('open', () => {
    updateSyncUI("connected");
    document.getElementById("sync-status-text").innerText = "已連線，正在同步...";
    const maxTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
    conn.send({ type: 'HELLO', latestTimestamp: maxTs });
  });

  conn.on('data', async (data) => {
    if (data.type === 'HELLO') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      if (missing.length > 0) {
        document.getElementById("sync-status-text").innerText = `發送中 (0/${missing.length})`;
        for (let i=0; i<missing.length; i++) {
            await sendCardChunked(missing[i]);
            document.getElementById("sync-status-text").innerText = `發送中 (${i+1}/${missing.length})`;
        }
      }
      const myTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
      conn.send({ type: 'REQUEST_DIFF', latestTimestamp: myTs });
    }
    
    if (data.type === 'REQUEST_DIFF') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      for (const card of missing) { await sendCardChunked(card); }
    }

    if (data.type === 'CARD_START') {
      incomingChunks[data.cardId] = {
        chunks: new Array(data.totalChunks),
        received: 0,
        total: data.totalChunks,
        metadata: data.metadata
      };
      document.getElementById("sync-status-text").innerText = `接收新卡片中...`;
    }

    if (data.type === 'CARD_CHUNK') {
      const state = incomingChunks[data.cardId];
      if (!state) return;
      state.chunks[data.index] = data.chunk;
      state.received++;

      if (state.received === state.total) {
        // Reconstruct
        const finalBuffer = new Blob(state.chunks);
        const card = { ...state.metadata, blob: finalBuffer };
        delete incomingChunks[data.cardId];

        const idx = dbCards.findIndex(x => x.id === card.id);
        if (idx === -1) {
          dbCards.push(card);
          await window.idbKeyval.set("bgCards", dbCards, true);
          renderGallery();
          document.getElementById("sync-status-text").innerText = `同步成功：${card.number || '新項目'}`;
        } else if (card.timestamp > (dbCards[idx].timestamp || 0)) {
          dbCards[idx] = card;
          await window.idbKeyval.set("bgCards", dbCards, true);
          renderGallery();
        }
      }
    }
  });

  conn.on('close', () => {
    document.getElementById("sync-status-text").innerText = "連線已關閉";
    setTimeout(() => { if (!conn || !conn.open) updateSyncUI("initial"); }, 3000);
  });
}

// Hook into IDB Keyval to broadcast changes
const originalIdbSet = window.idbKeyval.set;
window.idbKeyval.set = async function(key, value, isFromSync = false) {
  const res = await originalIdbSet.apply(this, [key, value]);
  if (key === "bgCards" && !isFromSync && conn && conn.open) {
    const mostRecent = [...value].sort((a,b) => (b.timestamp||0) - (a.timestamp||0))[0];
    if (mostRecent && mostRecent.blob instanceof Blob) {
      await sendCardChunked(mostRecent);
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
