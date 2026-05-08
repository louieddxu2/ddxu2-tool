// ============================================================
// 非侵入式智慧螢光筆 OCR (OCR Helper)
// ============================================================

let ocrOverlay, ocrCanvasPreview, ocrCanvasDraw, ocrCtxPreview, ocrCtxDraw, ocrStatusText;
let isDrawing = false;
let ocrPoints = [];
let tesseractWorker = null;
let isOcrProcessing = false;
let currentBlobUrl = null;
let currentCard = null;

document.addEventListener("DOMContentLoaded", () => {
  ocrOverlay = document.getElementById("ocr-helper-overlay");
  ocrCanvasPreview = document.getElementById("ocr-canvas-preview");
  ocrCanvasDraw = document.getElementById("ocr-canvas-draw");
  ocrStatusText = document.getElementById("ocr-status-text");

  if (!ocrOverlay || !ocrCanvasPreview || !ocrCanvasDraw) return;

  ocrCtxPreview = ocrCanvasPreview.getContext("2d", { willReadFrequently: true });
  ocrCtxDraw = ocrCanvasDraw.getContext("2d");

  // Pointer Events 支援全平台觸控與滑鼠手勢
  ocrCanvasDraw.addEventListener("pointerdown", handlePointerDown);
  ocrCanvasDraw.addEventListener("pointermove", handlePointerMove);
  ocrCanvasDraw.addEventListener("pointerup", handlePointerUp);
  ocrCanvasDraw.addEventListener("pointercancel", handlePointerUp);
});

// 檢查是否有 OCR 記憶位置，動態顯示/隱藏「自動」勾選框
window.checkOcrMemory = async (game, type) => {
  const wrap = document.getElementById("ocr-auto-wrap");
  const cb = document.getElementById("ocr-auto-checkbox");
  if (!wrap || !cb) return;
  if (!game || !type) {
    wrap.classList.add("hidden");
    wrap.classList.remove("flex");
    return;
  }
  try {
    const key = `ocr_pos_${game}_${type}`;
    const savedBox = await idbKeyval.get(key);
    if (savedBox) {
      wrap.classList.remove("hidden");
      wrap.classList.add("flex");
    } else {
      wrap.classList.add("hidden");
      wrap.classList.remove("flex");
      cb.checked = true; // 重置為預設勾選
    }
  } catch(e) {
    console.error(e);
  }
};

// 啟動 OCR 輔助
window.openOcrHelper = async () => {
  if (!UIState.editingId) return;
  currentCard = window.dbCards.find((c) => c.id === UIState.editingId);
  if (!currentCard || !currentCard.blob) return;

  // 1. 檢查是否為「全自動靜默辨識」模式
  const wrap = document.getElementById("ocr-auto-wrap");
  const cb = document.getElementById("ocr-auto-checkbox");
  if (cb && cb.checked && !wrap.classList.contains("hidden")) {
    const key = `ocr_pos_${currentCard.game}_${currentCard.type}`;
    const savedBox = await idbKeyval.get(key);
    if (savedBox) {
      await processOcrSilent(savedBox);
      return; // 靜默辨識完成，直接返回，不打開畫布！
    }
  }

  // 2. 手動除錯模式：無記憶、或使用者取消勾選
  ocrOverlay.classList.remove("hidden");
  ocrOverlay.classList.add("flex");
  updateOcrStatus("請在編號處畫一筆 🖍️");

  // 繪製已被裁切、去畸變的卡片影像
  const img = new Image();
  img.onload = () => {
    const w = img.width;
    const h = img.height;
    
    // 計算自適應縮放，確保完整顯示於螢幕 80vh 內，不變形
    const maxH = window.innerHeight * 0.8;
    const maxW = window.innerWidth - 32;
    let ratio = Math.min(maxW / w, maxH / h);
    if (ratio > 1) ratio = 1;

    // 設定底層預覽畫布 (繪製影像資料)
    ocrCanvasPreview.width = w;
    ocrCanvasPreview.height = h;
    ocrCanvasPreview.style.width = `${w * ratio}px`;
    ocrCanvasPreview.style.height = `${h * ratio}px`;
    ocrCtxPreview.drawImage(img, 0, 0);

    // 設定上層繪圖畫布 (覆蓋其上，尺寸一致)
    ocrCanvasDraw.width = w;
    ocrCanvasDraw.height = h;
    ocrCanvasDraw.style.width = `${w * ratio}px`;
    ocrCanvasDraw.style.height = `${h * ratio}px`;
    ocrCtxDraw.clearRect(0, 0, w, h);
    
    // 背景預載 Tesseract.js (此為乾淨的手動畫布)
    initTesseract();
  };
  
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(currentCard.blob);
  img.src = currentBlobUrl;
};

// 關閉 OCR 輔助
window.closeOcrHelper = () => {
  ocrOverlay.classList.add("hidden");
  ocrOverlay.classList.remove("flex");
  ocrPoints = [];
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
};

function updateOcrStatus(text, isLoading = false) {
  if (!ocrStatusText) return;
  if (isLoading) {
    ocrStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span><span>${text}</span>`;
  } else {
    ocrStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>${text}</span>`;
  }
}

// ==========================================
// 螢光筆手勢繪製引擎 (Highlighter Gesture Engine)
// ==========================================
function drawBoundingBox(x, y, w, h) {
  ocrCtxDraw.clearRect(0, 0, ocrCanvasDraw.width, ocrCanvasDraw.height);
  ocrCtxDraw.fillStyle = "rgba(245, 158, 11, 0.15)";
  ocrCtxDraw.fillRect(x, y, w, h);
  ocrCtxDraw.strokeStyle = "rgba(245, 158, 11, 0.8)";
  ocrCtxDraw.lineWidth = 2;
  ocrCtxDraw.setLineDash([5, 5]);
  ocrCtxDraw.strokeRect(x, y, w, h);
  ocrCtxDraw.setLineDash([]);
}

function getCanvasPt(e) {
  const rect = ocrCanvasDraw.getBoundingClientRect();
  const scaleX = ocrCanvasDraw.width / rect.width;
  const scaleY = ocrCanvasDraw.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function handlePointerDown(e) {
  if (isOcrProcessing) return;
  ocrCanvasDraw.setPointerCapture(e.pointerId);
  isDrawing = true;
  ocrPoints = [];
  ocrCtxDraw.clearRect(0, 0, ocrCanvasDraw.width, ocrCanvasDraw.height);
  ocrPoints.push(getCanvasPt(e));
}

function handlePointerMove(e) {
  if (!isDrawing || isOcrProcessing) return;
  ocrPoints.push(getCanvasPt(e));
  
  // 即時繪製螢光筆軌跡
  ocrCtxDraw.clearRect(0, 0, ocrCanvasDraw.width, ocrCanvasDraw.height);
  ocrCtxDraw.beginPath();
  ocrCtxDraw.moveTo(ocrPoints[0].x, ocrPoints[0].y);
  for (let i = 1; i < ocrPoints.length; i++) {
    ocrCtxDraw.lineTo(ocrPoints[i].x, ocrPoints[i].y);
  }
  ocrCtxDraw.strokeStyle = "rgba(245, 158, 11, 0.4)"; // 螢光黃
  ocrCtxDraw.lineWidth = 50;
  ocrCtxDraw.lineCap = "round";
  ocrCtxDraw.lineJoin = "round";
  ocrCtxDraw.stroke();
}

async function handlePointerUp(e) {
  if (!isDrawing || isOcrProcessing) return;
  isDrawing = false;
  ocrCanvasDraw.releasePointerCapture(e.pointerId);
  
  if (ocrPoints.length < 2) return; // 單擊或未移動無效

  // 計算最小包圍盒 (Bounding Box)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of ocrPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  
  // 加上筆觸半徑寬度的安全邊距
  const padding = 30; 
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(ocrCanvasDraw.width, maxX + padding);
  maxY = Math.min(ocrCanvasDraw.height, maxY + padding);
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  
  if (boxW < 20 || boxH < 20) {
    ocrCtxDraw.clearRect(0, 0, ocrCanvasDraw.width, ocrCanvasDraw.height);
    updateOcrStatus("選區太小，請重新劃過", false);
    return;
  }

  // 視覺回饋：在畫布上畫出一個發光的掃描包圍盒
  drawBoundingBox(minX, minY, boxW, boxH);

  // 送入手動模式的 OCR 處理引擎
  await processOcr(minX, minY, boxW, boxH);
}

// ==========================================
// 影像二值化與 OCR 引擎 (手動畫布模式)
// ==========================================
async function processOcr(x, y, w, h) {
  if (!window.Tesseract || !tesseractWorker) {
    updateOcrStatus("載入辨識引擎中...", true);
    await initTesseract();
  }
  
  isOcrProcessing = true;
  updateOcrStatus("影像二值化...", true);

  const imgData = ocrCtxPreview.getImageData(x, y, w, h);
  const data = imgData.data;
  
  // 灰階化與二值化
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
  }
  const threshold = (sum / (data.length / 4)) * 0.85; 
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
    data[i] = data[i+1] = data[i+2] = gray > threshold ? 255 : 0;
  }
  
  const tempCvs = document.createElement("canvas");
  tempCvs.width = w; tempCvs.height = h;
  tempCvs.getContext("2d").putImageData(imgData, 0, 0);

  updateOcrStatus("AI 辨識中...", true);
  
  try {
    const { data: { text } } = await tesseractWorker.recognize(tempCvs);
    const cleanedText = text.trim().replace(/\n/g, "").replace(/\s+/g, "");
    
    if (cleanedText) {
      document.getElementById("edit-number").value = cleanedText;
      updateOcrStatus("辨識成功！", false);
      
      // 更新記憶座標
      if (currentCard.game && currentCard.type) {
         const key = `ocr_pos_${currentCard.game}_${currentCard.type}`;
         await idbKeyval.set(key, {x, y, w, h});
         // 畫布關閉後，讓編輯彈窗的勾選框出現
         window.checkOcrMemory(currentCard.game, currentCard.type);
      }

      window.syncInputs("edit-number", cleanedText);

      // 手動模式：使用者操作完成，0.6秒後自動關閉，極致流暢
      setTimeout(() => closeOcrHelper(), 600);
    } else {
      updateOcrStatus("未辨識出文字，請重劃", false);
      ocrCtxDraw.clearRect(0, 0, ocrCanvasDraw.width, ocrCanvasDraw.height);
    }
  } catch (err) {
    console.error("OCR 辨識失敗:", err);
    updateOcrStatus("辨識失敗", false);
  } finally {
    isOcrProcessing = false;
  }
}

// ==========================================
// 靜默背景辨識 (Silent OCR) - 全自動模式
// ==========================================
async function processOcrSilent(box) {
  const btn = document.getElementById("btn-ocr-trigger");
  const numInp = document.getElementById("edit-number");
  if (!btn || !numInp) return;
  
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="w-4 h-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin"></span>`;
  btn.disabled = true;

  try {
    const img = new Image();
    const url = URL.createObjectURL(currentCard.blob);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);

    // 繪製到離屏畫布以擷取像素
    const cvs = document.createElement("canvas");
    cvs.width = img.width;
    cvs.height = img.height;
    const ctx = cvs.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(box.x, box.y, box.w, box.h);
    const data = imgData.data;

    // 二值化
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    const threshold = (sum / (data.length / 4)) * 0.85;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      data[i] = data[i+1] = data[i+2] = gray > threshold ? 255 : 0;
    }

    const tempCvs = document.createElement("canvas");
    tempCvs.width = box.w;
    tempCvs.height = box.h;
    tempCvs.getContext("2d").putImageData(imgData, 0, 0);

    await initTesseract();
    const { data: { text } } = await tesseractWorker.recognize(tempCvs);
    const cleanedText = text.trim().replace(/\n/g, "").replace(/\s+/g, "");

    if (cleanedText) {
      numInp.value = cleanedText;
      window.syncInputs("edit-number", cleanedText);
      
      // 成功回饋動畫 (Flash 綠色)
      btn.classList.add("bg-emerald-100", "text-emerald-600", "border-emerald-300");
      setTimeout(() => {
        btn.classList.remove("bg-emerald-100", "text-emerald-600", "border-emerald-300");
      }, 1000);
    } else {
      // 辨識不出結果時，不中斷體驗，只短暫提示紅色
      btn.classList.add("bg-red-100", "text-red-600");
      setTimeout(() => btn.classList.remove("bg-red-100", "text-red-600"), 1000);
    }
  } catch (e) {
    console.error("靜默 OCR 失敗:", e);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    try { lucide.createIcons(); } catch(e) {}
  }
}

// ==========================================
// Tesseract 加載與管理
// ==========================================
let isTesseractInitializing = false;
async function initTesseract() {
  if (tesseractWorker || isTesseractInitializing) return;
  isTesseractInitializing = true;
  
  if (!window.Tesseract) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = async () => {
        await createWorker();
        resolve();
      };
      document.head.appendChild(script);
    });
  } else {
    await createWorker();
  }
}

async function createWorker() {
  if (ocrStatusText) updateOcrStatus("載入中英雙語模型...", true);
  tesseractWorker = await Tesseract.createWorker("eng+chi_tra");
  if (ocrStatusText) updateOcrStatus("請在編號處畫一筆 🖍️", false);
  isTesseractInitializing = false;
}
