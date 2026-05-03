let pendingImagesToImport = [];

window.deleteCard = async (id) => {
  if (!confirm("確定刪除？")) return;
  dbCards = dbCards.filter((c) => c.id !== id);
  await saveCardsToDB();
  renderGallery();
};

window.exportData = async () => {
  if (dbCards.length === 0) return alert("無資料可匯出");
  const zip = new JSZip();
  const metadata = [];
  const usedFilenames = new Set();
  const sanitize = (str) => (str || "").toString().trim().replace(/[\/\\?%*:|"<>]/g, "-");

  for (let i = 0; i < dbCards.length; i++) {
    const c = dbCards[i];
    const ext = c.blob.type === "image/webp" ? "webp" : c.blob.type === "image/jpeg" ? "jpg" : "png";
    const gameStr = sanitize(c.game) || "未命名項目";
    const typeStr = sanitize(c.type) || "未分類";
    const numStr = sanitize(c.number) || "未命名";
    let shortId = c.id.toString().split("-")[0];
    if (shortId.length > 8) shortId = shortId.slice(-6);
    let filename = `${gameStr}/${typeStr}/${numStr}_${shortId}.${ext}`;
    if (usedFilenames.has(filename)) filename = `${gameStr}/${typeStr}/${numStr}_${c.id}.${ext}`;
    usedFilenames.add(filename);
    zip.file(filename, c.blob);
    metadata.push({ id: c.id, game: c.game || "", type: c.type || "", number: c.number || "", memo: c.memo || "", ratio: c.ratio || "", filename: filename, timestamp: c.timestamp });
  }

  const keys = ["id", "game", "type", "number", "memo", "ratio", "filename", "timestamp"];
  const rows = [keys.join(",")];
  for (const row of metadata) {
    const values = keys.map((k) => {
      let val = row[k] === undefined || row[k] === null ? "" : String(row[k]);
      if (val.includes(",") || val.includes('"') || val.includes("\n")) val = `"${val.replace(/"/g, '""')}"`;
      return val;
    });
    rows.push(values.join(","));
  }
  const csvStr = "\uFEFF" + rows.join("\n");
  zip.file("db.csv", csvStr);
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));
  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = `cards_export_${Date.now()}.zip`;
  a.click();
};

window.openImportModal = () => {
  const m = document.getElementById("modal-import");
  if (m) { m.classList.remove("hidden"); m.classList.add("flex"); }
};
window.closeImportModal = () => {
  const m = document.getElementById("modal-import");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
};

window.toggleImportManual = (isManual) => {
  const inputs = document.getElementById("import-manual-inputs");
  if (isManual) inputs.classList.remove("opacity-50", "pointer-events-none");
  else inputs.classList.add("opacity-50", "pointer-events-none");
};

window.cancelImportConfig = () => {
  const m = document.getElementById("modal-import-config");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
  pendingImagesToImport = [];
  renderGallery();
};

window.confirmImportConfig = async () => {
  const m = document.getElementById("modal-import-config");
  if (m) { m.classList.remove("flex"); m.classList.add("hidden"); }
  const mode = document.querySelector('input[name="import_mode"]:checked').value;
  if (mode === "manual") {
    const mGame = document.getElementById("import-game").value.trim();
    const mType = document.getElementById("import-type").value.trim();
    pendingImagesToImport.forEach(item => { item.game = mGame; item.type = mType; });
  }
  await commitImport(pendingImagesToImport);
  pendingImagesToImport = [];
};

const showImportConfig = (images) => {
  if (images.length === 0) {
    alert("沒有找到可匯入的圖片。");
    renderGallery();
    return;
  }
  pendingImagesToImport = images;
  document.getElementById("import-config-count").innerText = `找到 ${images.length} 張無分類元資料的圖片，請選擇分類方式：`;
  document.getElementById("import-game").value = document.getElementById("inp-game").value;
  document.getElementById("import-type").value = document.getElementById("inp-type").value;
  document.querySelector('input[name="import_mode"][value="auto"]').checked = true;
  toggleImportManual(false);
  const m = document.getElementById("modal-import-config");
  if (m) { m.classList.remove("hidden"); m.classList.add("flex"); }
};

const extractInfoFromPath = (pathStr) => {
  const parts = pathStr.split("/").filter(Boolean);
  const fileName = parts.pop() || "";
  const nameTokens = fileName.split(".");
  const ext = nameTokens.length > 1 ? nameTokens.pop() : "";
  let numPart = nameTokens.join(".");
  let idMatch = numPart.match(/^(.*)_([a-zA-Z0-9-]{6,36})$/);
  let number = idMatch && idMatch[2].length >= 6 ? idMatch[1] : numPart;
  let inferredId = crypto.randomUUID();
  if (!number) number = inferredId.slice(0, 8);
  let type = parts.length > 0 ? parts.pop() : "";
  let game = parts.length > 0 ? parts.pop() : "";
  return { game, type, number, ext, id: inferredId };
};

let sharedCanvas = null;
const convertToWebP = async (blob, quality = 0.8) => {
  await new Promise((r) => setTimeout(r, 10));
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      let w = img.width, h = img.height;
      const MAX_SIZE = 1600;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
      }
      if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
      sharedCanvas.width = w; sharedCanvas.height = h;
      const ctx = sharedCanvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      sharedCanvas.toBlob((b) => { 
        URL.revokeObjectURL(url); 
        resolve({ blob: b || blob, w: img.width, h: img.height }); 
      }, "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ blob, w: 0, h: 0 }); };
    img.src = url;
  });
};

const commitImport = async (imagesToImport) => {
  if (imagesToImport.length === 0) { renderGallery(); return; }
  const state = document.getElementById("empty-state");
  state.innerHTML = '<div class="loader rounded-full border-4 border-emerald-500 h-10 w-10 mx-auto my-4 border-t-transparent animate-spin"></div><p class="text-sm" id="import-progress">資料匯入中，請稍候...</p>';
  state.classList.remove("hidden");

  let importCount = 0, updateCount = 0;
  for (let i = 0; i < imagesToImport.length; i++) {
    const item = imagesToImport[i];
    const prog = document.getElementById("import-progress");
    if (prog) prog.innerText = `處理轉檔與資料寫入中 (${i + 1}/${imagesToImport.length})...`;
    
    const res = await convertToWebP(item.blob, 0.8);
    item.blob = res.blob;
    
    // Prediction logic for ratio during bulk import
    if (!item.ratio && res.w > 0) {
      const ar = res.w / res.h;
      const presets = [
        { name: "63:88", val: 63/88 },
        { name: "70:120", val: 70/120 },
        { name: "1:1", val: 1 },
        { name: "88:63", val: 88/63 },
        { name: "120:70", val: 120/70 }
      ];
      let detected = presets.find(p => Math.abs(ar - p.val) < 0.03);
      if (detected) {
        item.ratio = detected.name;
      } else {
        // Record precise custom ratio for non-standard imported images
        item.ratio = ar.toFixed(4);
      }
    }

    let idx = dbCards.findIndex((c) => c.id === item.id);
    if (idx === -1 && item.game && item.type && item.number) {
      idx = dbCards.findIndex((c) => c.game === item.game && c.type === item.type && c.number === item.number);
      if (idx > -1) item.id = dbCards[idx].id;
    }
    if (idx > -1) {
      if (item.timestamp >= (dbCards[idx].timestamp || 0)) {
        dbCards[idx] = { ...dbCards[idx], ...item, id: dbCards[idx].id };
        updateCount++;
      }
    } else { dbCards.push(item); importCount++; }
  }
  await saveCardsToDB();
  renderGallery();
  state.classList.add("hidden");
  alert(`成功匯入 ${importCount} 筆，更新 ${updateCount} 筆卡牌資料！`);
};

const parseCSV = (csvText) => {
  const lines = []; let cur = "", inQuote = false; let row = [];
  for (let i = 0; i < csvText.length; i++) {
    let char = csvText[i];
    if (inQuote) {
      if (char === '"' && csvText[i + 1] === '"') { cur += '"'; i++; }
      else if (char === '"') inQuote = false;
      else cur += char;
    } else {
      if (char === '"') inQuote = true;
      else if (char === ",") { row.push(cur); cur = ""; }
      else if (char === "\n") { row.push(cur); cur = ""; lines.push(row); row = []; }
      else if (char !== "\r") cur += char;
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); lines.push(row); }
  if (lines.length > 1 && lines[0][0].replace(/^\uFEFF/, "").trim() === "id") {
    const headers = lines[0].map((h) => h.replace(/^\uFEFF/, "").trim());
    return lines.slice(1).map((r) => {
      const obj = {}; headers.forEach((h, idx) => (obj[h] = r[idx])); return obj;
    });
  }
  return null;
};

window.processZipFile = async (file) => {
  if (!file) return;
  const state = document.getElementById("empty-state");
  state.innerHTML = '<div class="loader rounded-full border-4 border-emerald-500 h-10 w-10 mx-auto my-4 border-t-transparent animate-spin"></div><p class="text-sm">資料匯入中，請稍候...</p>';
  state.classList.remove("hidden");
  try {
    const zip = await JSZip.loadAsync(file);
    let metadata = null;
    const csvFile = zip.file("db.csv");
    if (csvFile) metadata = parseCSV(await csvFile.async("string"));
    if (!metadata) {
      const jsonFile = zip.file("metadata.json");
      if (jsonFile) metadata = JSON.parse(await jsonFile.async("string"));
    }
    let imagesToImport = [];
    if (metadata) {
      for (const item of metadata) {
        if (!item.id || !item.filename) continue;
        const zf = zip.file(item.filename);
        if (!zf) continue;
        const blob = await zf.async("blob");
        imagesToImport.push({ id: item.id, game: item.game || "", type: item.type || "", number: item.number || "", memo: item.memo || "", ratio: item.ratio || "", blob: blob, timestamp: parseInt(item.timestamp) || Date.now() });
      }
      await commitImport(imagesToImport);
    } else {
      for (const [path, zf] of Object.entries(zip.files)) {
        if (zf.dir) continue;
        const ext = path.split(".").pop().toLowerCase();
        if (!["png", "jpg", "jpeg", "webp"].includes(ext)) continue;
        const info = extractInfoFromPath(path);
        imagesToImport.push({ id: info.id, game: info.game, type: info.type, number: info.number, memo: "", ratio: "", blob: await zf.async("blob"), timestamp: Date.now() });
      }
      showImportConfig(imagesToImport);
    }
  } catch (err) { alert("匯入失敗：" + (err.message || "檔案格式錯誤")); renderGallery(); }
};

window.processBrowserFiles = async (fileList) => {
  if (!fileList || fileList.length === 0) return;
  const state = document.getElementById("empty-state");
  state.innerHTML = '<div class="loader rounded-full border-4 border-emerald-500 h-10 w-10 mx-auto my-4 border-t-transparent animate-spin"></div><p class="text-sm">資料匯入中，請稍候...</p>';
  state.classList.remove("hidden");
  try {
    let metadata = null;
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.name === "db.csv") metadata = parseCSV(await f.text());
      else if (f.name === "metadata.json") metadata = JSON.parse(await f.text());
    }
    let imagesToImport = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (!f.type.startsWith("image/")) continue;
      const path = f.webkitRelativePath || f.name;
      const info = extractInfoFromPath(path);
      let metaItem = metadata ? metadata.find((m) => path.endsWith(m.filename)) : null;
      imagesToImport.push({ id: metaItem ? metaItem.id : info.id, game: metaItem ? metaItem.game || "" : info.game, type: metaItem ? metaItem.type || "" : info.type, number: metaItem ? metaItem.number || "" : info.number, memo: metaItem ? metaItem.memo || "" : "", ratio: metaItem ? metaItem.ratio || "" : "", blob: f, timestamp: metaItem ? parseInt(metaItem.timestamp) || Date.now() : Date.now() });
    }
    if (metadata) await commitImport(imagesToImport);
    else showImportConfig(imagesToImport);
  } catch (err) { alert("匯入失敗：" + err.message); renderGallery(); }
};

document.getElementById("file-upload").onchange = (e) => {
  const f = e.target.files[0];
  if (f) openCropView(URL.createObjectURL(f));
  e.target.value = "";
};

window.addEventListener("paste", (e) => {
  const item = e.clipboardData.items[0];
  if (item && item.type.indexOf("image") === 0) openCropView(URL.createObjectURL(item.getAsFile()));
});
