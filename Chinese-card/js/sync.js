let peer = null;
let conn = null;
let qrcode = null;

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
      text: url,
      width: 192,
      height: 192,
      colorDark: "#059669",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    
    updateSyncUI("hosting");
  });

  peer.on('connection', (c) => {
    setupConnection(c);
  });

  peer.on('error', (err) => {
    console.error("Peer Error:", err);
    if (err.type === 'peer-unavailable') {
        alert("找不到目標房號，請確認輸入是否正確。");
    } else {
        alert("連線發生錯誤: " + err.type);
    }
    updateSyncUI("initial");
  });
};

window.stopHost = () => {
  if (peer) peer.destroy();
  peer = null;
  conn = null;
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
  peer.on('open', () => {
    const c = peer.connect(id);
    setupConnection(c);
  });

  peer.on('error', (err) => {
    console.error("Join Error:", err);
    alert("連線失敗: " + err.type);
    updateSyncUI("initial");
  });
}

// Connection Setup
function setupConnection(c) {
  conn = c;
  
  conn.on('open', () => {
    updateSyncUI("connected");
    document.getElementById("sync-status-text").innerText = "已連線，正在比對資料庫...";
    
    // Step 1: Send my latest timestamp
    const maxTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
    conn.send({ type: 'HELLO', latestTimestamp: maxTs });
  });

  conn.on('data', async (data) => {
    if (data.type === 'HELLO') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      if (missing.length > 0) {
        document.getElementById("sync-status-text").innerText = `正在傳送 ${missing.length} 筆差額資料...`;
        for (const card of missing) {
          // Convert Blob to ArrayBuffer for stable P2P transfer
          const cardToSend = { ...card };
          const buffer = await card.blob.arrayBuffer();
          cardToSend.blob = buffer;
          cardToSend.blobType = card.blob.type;
          conn.send({ type: 'CARD', card: cardToSend });
        }
      }
      const myTs = dbCards.length > 0 ? Math.max(...dbCards.map(x => x.timestamp || 0)) : 0;
      conn.send({ type: 'REQUEST_DIFF', latestTimestamp: myTs });
    }
    
    if (data.type === 'REQUEST_DIFF') {
      const missing = dbCards.filter(c => (c.timestamp || 0) > data.latestTimestamp);
      for (const card of missing) {
        const cardToSend = { ...card };
        const buffer = await card.blob.arrayBuffer();
        cardToSend.blob = buffer;
        cardToSend.blobType = card.blob.type;
        conn.send({ type: 'CARD', card: cardToSend });
      }
    }

    if (data.type === 'CARD') {
      const card = data.card;
      
      // Enhanced binary detection: ArrayBuffer or TypedArray
      if (card.blob && (card.blob instanceof ArrayBuffer || ArrayBuffer.isView(card.blob))) {
        // Handle cases where the blob might be wrapped in a view
        const buffer = card.blob.buffer || card.blob;
        card.blob = new Blob([buffer], { type: card.blobType || 'image/webp' });
      }

      const idx = dbCards.findIndex(x => x.id === card.id);
      if (idx === -1) {
        dbCards.push(card);
        await window.idbKeyval.set("bgCards", dbCards, true); // True flag means "don't broadcast back"
        renderGallery();
        document.getElementById("sync-status-text").innerText = `同步成功：${card.number || '新卡片'}`;
      } else if (card.timestamp > (dbCards[idx].timestamp || 0)) {
        dbCards[idx] = card;
        await window.idbKeyval.set("bgCards", dbCards, true);
        renderGallery();
        document.getElementById("sync-status-text").innerText = `更新成功：${card.number || '卡片已更新'}`;
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
      const cardToSend = { ...mostRecent };
      const buffer = await mostRecent.blob.arrayBuffer();
      cardToSend.blob = buffer;
      cardToSend.blobType = mostRecent.blob.type;
      conn.send({ type: 'CARD', card: cardToSend });
    }
  }
  return res;
};

// Auto-join from URL
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    setTimeout(() => {
      openSyncModal();
      startJoin(roomId);
    }, 1500);
  }
});
