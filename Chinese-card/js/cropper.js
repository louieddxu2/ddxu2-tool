let p1 = { x: 0, y: 0 },
  p2 = { x: 0, y: 0 },
  cropRatio = 63 / 88;
let originalImgWidth, originalImgHeight, displayRatio;

const initCropState = (w, h) => {
  const activeBtn = document.querySelector(".ratio-btn.bg-emerald-600");
  if (activeBtn) {
    const ratioStr = activeBtn.getAttribute("data-ratio").split(":");
    cropRatio = parseInt(ratioStr[0]) / parseInt(ratioStr[1]);
  } else {
    const cw = parseInt(document.getElementById("custom-w").value) || 1;
    const ch = parseInt(document.getElementById("custom-h").value) || 1;
    cropRatio = cw / ch;
  }

  const savedWidthPct = parseFloat(localStorage.getItem("bg_crop_widthPct")) || 0.8;
  const savedCenterYPct = parseFloat(localStorage.getItem("bg_crop_centerYPct")) || 0.85;
  const savedAngle = parseFloat(localStorage.getItem("bg_crop_angle")) || 0;

  const cx = w / 2;
  const cy = h * savedCenterYPct;
  const width = w * savedWidthPct;

  p1.x = cx - (width / 2) * Math.cos(savedAngle);
  p1.y = cy - (width / 2) * Math.sin(savedAngle);
  p2.x = cx + (width / 2) * Math.cos(savedAngle);
  p2.y = cy + (width / 2) * Math.sin(savedAngle);
};

const snapToEdge = (w, h) => {
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const ctx = document.getElementById("canvas-source").getContext("2d", { willReadFrequently: true });
  const scanRange = 30;
  const scanX = Math.max(0, Math.min(w - 1, Math.floor(cx)));
  const startY = Math.max(0, Math.floor(cy - scanRange));
  const endY = Math.min(h - 1, Math.floor(cy + scanRange));
  const scanH = endY - startY;

  if (scanH <= 1) return;
  try {
    const imgData = ctx.getImageData(scanX, startY, 1, scanH).data;
    let maxDiff = 0, bestY = cy;
    for (let i = 0; i < scanH - 1; i++) {
      const l1 = 0.299 * imgData[i * 4] + 0.587 * imgData[i * 4 + 1] + 0.114 * imgData[i * 4 + 2];
      const l2 = 0.299 * imgData[(i + 1) * 4] + 0.587 * imgData[(i + 1) * 4 + 1] + 0.114 * imgData[(i + 1) * 4 + 2];
      const diff = Math.abs(l1 - l2);
      if (diff > maxDiff && diff > 15) {
        maxDiff = diff;
        bestY = startY + i;
      }
    }
    if (maxDiff > 15) {
      const diffY = bestY - cy;
      p1.y += diffY;
      p2.y += diffY;
    }
  } catch (e) { }
};

const calculatePolygon = () => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const width = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const height = (width / cropRatio) * 1.05;

  const upAngle = angle - Math.PI / 2;
  const dxUp = Math.cos(upAngle) * height;
  const dyUp = Math.sin(upAngle) * height;

  const p4 = { x: p1.x + dxUp, y: p1.y + dyUp };
  const p3 = { x: p2.x + dxUp, y: p2.y + dyUp };
  return [p4, p3, p2, p1];
};

const drawLines = () => {
  const pts = calculatePolygon();
  const s = pts.map((p) => `${p.x * displayRatio},${p.y * displayRatio}`).join(" ");
  document.getElementById("crop-polygon").setAttribute("points", s);

  const wrap = document.getElementById("canvas-wrapper");
  let h1 = document.getElementById("ind-p1");
  if (!h1) {
    h1 = document.createElement("div");
    h1.id = "ind-p1";
    h1.className = "indicator-point";
    wrap.appendChild(h1);
  }
  let h2 = document.getElementById("ind-p2");
  if (!h2) {
    h2 = document.createElement("div");
    h2.id = "ind-p2";
    h2.className = "indicator-point";
    wrap.appendChild(h2);
  }
  h1.style.left = p1.x * displayRatio + "px";
  h1.style.top = p1.y * displayRatio + "px";
  h2.style.left = p2.x * displayRatio + "px";
  h2.style.top = p2.y * displayRatio + "px";
};

let pointerDownSrc = null;
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("canvas-wrapper");
  const container = document.getElementById("crop-container");

  container.addEventListener("pointerdown", (e) => {
    if (!wrap) return;
    e.preventDefault();
    container.setPointerCapture(e.pointerId);
    const rect = wrap.getBoundingClientRect();
    const ptX = e.clientX - rect.left;
    const ptY = e.clientY - rect.top;

    const scrP1x = p1.x * displayRatio;
    const scrP1y = p1.y * displayRatio;
    const scrP2x = p2.x * displayRatio;
    const scrP2y = p2.y * displayRatio;

    let dragTarget = null;
    if (Math.hypot(ptX - scrP1x, ptY - scrP1y) < 25) dragTarget = "p1";
    else if (Math.hypot(ptX - scrP2x, ptY - scrP2y) < 25) dragTarget = "p2";

    pointerDownSrc = {
      x: ptX / displayRatio,
      y: ptY / displayRatio,
      clientX: e.clientX,
      clientY: e.clientY,
      dragTarget: dragTarget,
    };
  });

  container.addEventListener("pointermove", (e) => {
    if (!pointerDownSrc || !wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    const currX = Math.max(0, Math.min(originalImgWidth, (e.clientX - rect.left) / displayRatio));
    const currY = Math.max(0, Math.min(originalImgHeight, (e.clientY - rect.top) / displayRatio));
    const dist = Math.hypot(e.clientX - pointerDownSrc.clientX, e.clientY - pointerDownSrc.clientY);

    if (pointerDownSrc.dragTarget) {
      if (pointerDownSrc.dragTarget === "p1") {
        p1.x = currX;
        p1.y = currY;
      } else {
        p2.x = currX;
        p2.y = currY;
      }
      drawLines();
    } else if (dist >= 15) {
      let nx1 = Math.max(0, Math.min(originalImgWidth, pointerDownSrc.x));
      let ny1 = Math.max(0, Math.min(originalImgHeight, pointerDownSrc.y));
      let nx2 = currX, ny2 = currY;
      if (nx1 > nx2) {
        let tx = nx1, ty = ny1;
        nx1 = nx2; ny1 = ny2;
        nx2 = tx; ny2 = ty;
      }

      const dx = nx2 - nx1;
      const dy = ny2 - ny1;
      const width = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const height = (width / cropRatio) * 1.05;
      const upAngle = angle - Math.PI / 2;
      const pts = [
        { x: nx1 + Math.cos(upAngle) * height, y: ny1 + Math.sin(upAngle) * height },
        { x: nx2 + Math.cos(upAngle) * height, y: ny2 + Math.sin(upAngle) * height },
        { x: nx2, y: ny2 },
        { x: nx1, y: ny1 },
      ];

      let h1 = document.getElementById("ind-p1");
      let h2 = document.getElementById("ind-p2");
      if (h1 && h2) {
        h1.style.display = "none";
        h2.style.display = "none";
      }

      document.getElementById("crop-polygon").setAttribute("points", pts.map((p) => `${p.x * displayRatio},${p.y * displayRatio}`).join(" "));
    }
  });

  container.addEventListener("pointerup", (e) => {
    if (!pointerDownSrc || !wrap) return;
    e.preventDefault();
    container.releasePointerCapture(e.pointerId);
    let h1 = document.getElementById("ind-p1");
    let h2 = document.getElementById("ind-p2");
    if (h1 && h2) {
      h1.style.display = "block";
      h2.style.display = "block";
    }

    const rect = wrap.getBoundingClientRect();
    const upX = Math.max(0, Math.min(originalImgWidth, (e.clientX - rect.left) / displayRatio));
    const upY = Math.max(0, Math.min(originalImgHeight, (e.clientY - rect.top) / displayRatio));
    const dist = Math.hypot(e.clientX - pointerDownSrc.clientX, e.clientY - pointerDownSrc.clientY);

    if (pointerDownSrc.dragTarget) {
      if (pointerDownSrc.dragTarget === "p1") {
        p1.x = upX; p1.y = upY;
      } else {
        p2.x = upX; p2.y = upY;
      }
    } else if (dist < 15) {
      const d1 = Math.hypot(upX - p1.x, upY - p1.y);
      const d2 = Math.hypot(upX - p2.x, upY - p2.y);
      if (d1 < d2) {
        p1.x = upX; p1.y = upY;
      } else {
        p2.x = upX; p2.y = upY;
      }
    } else {
      let nx1 = Math.max(0, Math.min(originalImgWidth, pointerDownSrc.x));
      let ny1 = Math.max(0, Math.min(originalImgHeight, pointerDownSrc.y));
      let nx2 = upX, ny2 = upY;
      if (nx1 > nx2) {
        let tx = nx1, ty = ny1;
        nx1 = nx2; ny1 = ny2;
        nx2 = tx; ny2 = ty;
      }
      p1.x = nx1; p1.y = ny1;
      p2.x = nx2; p2.y = ny2;
    }

    if (p1.x > p2.x) {
      let tx = p1.x, ty = p1.y;
      p1.x = p2.x; p1.y = p2.y;
      p2.x = tx; p2.y = ty;
    }

    pointerDownSrc = null;
    drawLines();
  });
  container.addEventListener("pointercancel", (e) => {
    container.releasePointerCapture(e.pointerId);
    pointerDownSrc = null;
    drawLines();
  });
});

window.openCropView = (src) => {
  document.getElementById("view-crop").classList.remove("hidden");
  document.getElementById("crop-loading").classList.remove("hidden");
  document.getElementById("crop-loading-text").innerText = "定位中...";

  const curGame = document.getElementById("inp-game").value;
  const curType = document.getElementById("inp-type").value;
  const lastMatchedCard = dbCards.slice().reverse().find((c) => c.game === curGame && c.type === curType && c.ratio);
  if (lastMatchedCard) {
    applyRatioValue(lastMatchedCard.ratio);
  }

  const img = new Image();
  img.onload = () => {
    if (src.startsWith("blob:")) window.URL.revokeObjectURL(src);
    const w = img.width > 1200 ? 1200 : img.width;
    const h = Math.round(img.height * (w / img.width));
    const canvas = document.getElementById("canvas-source");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    originalImgWidth = w;
    originalImgHeight = h;
    displayRatio = Math.min((window.innerWidth - 32) / w, (window.innerHeight - 160) / h);
    canvas.style.width = w * displayRatio + "px";
    canvas.style.height = h * displayRatio + "px";

    initCropState(w, h);
    setTimeout(() => {
      snapToEdge(w, h);
      drawLines();
      document.getElementById("crop-loading").classList.add("hidden");
    }, 50);
  };
  img.src = src;
};

window.cancelCrop = () => document.getElementById("view-crop").classList.add("hidden");

window.processCrop = async () => {
  document.getElementById("crop-loading").classList.remove("hidden");
  document.getElementById("crop-loading-text").innerText = "儲存中...";

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const width = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const height = (width / cropRatio) * 1.05;

  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  localStorage.setItem("bg_crop_widthPct", width / originalImgWidth);
  localStorage.setItem("bg_crop_centerYPct", cy / originalImgHeight);
  localStorage.setItem("bg_crop_angle", angle);

  const outW = 800;
  const outH = Math.round(outW / cropRatio);
  const outCvs = document.getElementById("canvas-processing");
  outCvs.width = outW;
  outCvs.height = outH;
  const ctx = outCvs.getContext("2d");

  const scale = outW / width;
  const upAngle = angle - Math.PI / 2;
  const p4x = p1.x + Math.cos(upAngle) * height;
  const p4y = p1.y + Math.sin(upAngle) * height;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.rotate(-angle);
  ctx.translate(-p4x, -p4y);

  ctx.drawImage(document.getElementById("canvas-source"), 0, 0);
  ctx.restore();

  outCvs.toBlob(
    async (b) => {
      const c = {
        id: crypto.randomUUID(),
        game: document.getElementById("inp-game").value,
        type: document.getElementById("inp-type").value,
        number: document.getElementById("inp-number").value,
        ratio: getRatioValue(),
        blob: b,
        timestamp: Date.now(),
      };
      dbCards.push(c);
      await idbKeyval.set("bgCards", dbCards);
      document.getElementById("inp-number").value = "";
      localStorage.removeItem("bg_last_inp-number");
      renderGallery();
      document.getElementById("view-crop").classList.add("hidden");
      document.getElementById("crop-loading").classList.add("hidden");
    },
    "image/webp",
    0.85,
  );
};

function getRatioValue() {
  const activeBtn = document.querySelector(".ratio-btn.bg-emerald-600");
  if (activeBtn) {
    return activeBtn.getAttribute("data-ratio");
  }
  return `custom:${document.getElementById("custom-w").value}:${document.getElementById("custom-h").value}`;
}

window.setRatioAndCenter = (baseCropRatio) => {
  const newCropRatio = isLandscapeMode ? 1 / baseCropRatio : baseCropRatio;
  if (!document.getElementById("view-crop").classList.contains("hidden")) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const width = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const upAngle = angle - Math.PI / 2;

    const oldHeight = (width / cropRatio) * 1.05;
    const newHeight = (width / newCropRatio) * 1.05;

    const shiftX = Math.cos(upAngle) * ((oldHeight - newHeight) / 2);
    const shiftY = Math.sin(upAngle) * ((oldHeight - newHeight) / 2);

    p1.x += shiftX;
    p1.y += shiftY;
    p2.x += shiftX;
    p2.y += shiftY;

    cropRatio = newCropRatio;
    drawLines();
  } else {
    cropRatio = newCropRatio;
  }
};

window.saveLastRatio = () => {
  localStorage.setItem("bg_last_ratio", getRatioValue());
  localStorage.setItem("bg_last_landscape", isLandscapeMode);
};

window.applyRatioValue = (val) => {
  if (!val) return;
  const buttons = document.querySelectorAll(".ratio-btn");
  let found = false;
  buttons.forEach((btn) => {
    if (btn.getAttribute("data-ratio") === val) {
      btn.click();
      found = true;
    }
  });
  if (!found && val.startsWith("custom:")) {
    const parts = val.split(":");
    document.getElementById("custom-w").value = parts[1];
    document.getElementById("custom-h").value = parts[2];
    if (window.setCustomActive) window.setCustomActive();
  }
};
