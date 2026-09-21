(function autoRegister() {
  let appPath = window.location.pathname;
  if (appPath.endsWith("index.html"))
    appPath = appPath.replace("index.html", "");
  if (!appPath.endsWith("/")) appPath += "/";
  if (appPath === "/") return;
  try {
    localStorage.setItem("myAppLauncherLastPath", appPath);
    localStorage.setItem("myAppLauncherLastSeenAt", String(Date.now()));
  } catch { }
  const launcherPath = appPath.replace(/[^/]+\/$/, "");
  const normalizedLauncherPath = launcherPath || "/";
  function configureHomeLinkAndProbe() {
    const homeLinks = Array.from(
      document.querySelectorAll("[data-home-link]"),
    );
    const homeHref = normalizedLauncherPath.includes("?")
      ? `${normalizedLauncherPath}&home=1`
      : `${normalizedLauncherPath}?home=1`;
    homeLinks.forEach((el) => el.setAttribute("href", homeHref));
    if (window.location.protocol === "file:") return;
    const probeUrl = normalizedLauncherPath.endsWith("/")
      ? `${normalizedLauncherPath}index.html`
      : `${normalizedLauncherPath}/index.html`;
    fetch(probeUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok)
          homeLinks.forEach((el) =>
            el.classList.remove("invisible", "pointer-events-none"),
          );
      })
      .catch(() => { });
  }
  if (document.readyState === "loading")
    document.addEventListener(
      "DOMContentLoaded",
      configureHomeLinkAndProbe,
      { once: true },
    );
  else configureHomeLinkAndProbe();

  const appMeta = {
    id: "bg-card-cropper-v4",
    name: "卡牌翻譯圖庫",
    nameZh: "卡牌翻譯圖庫",
    nameEn: "Card Cropper",
    path: appPath,
    icon: "scan-text",
    color: "emerald",
  };
  const storageKey = "myAppLauncherStorage";
  const launcherData = JSON.parse(
    localStorage.getItem(storageKey) || "[]",
  );
  const existingIndex = launcherData.findIndex(
    (app) => app.path === appMeta.path,
  );
  if (existingIndex === -1) launcherData.push(appMeta);
  else
    launcherData[existingIndex] = {
      ...launcherData[existingIndex],
      ...appMeta,
    };
  localStorage.setItem(storageKey, JSON.stringify(launcherData));
})();

const CHINESE_CARD_SW_VERSION = "v27";
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker
    .register(`/sw.js?${CHINESE_CARD_SW_VERSION}`)
    .catch(() => { });
}

async function detectSharedBlobKind(blob) {
  const declaredType = String(blob.type || "").toLowerCase();
  if (declaredType.startsWith("image/")) {
    return { kind: "image", type: declaredType };
  }

  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const startsWith = (...signature) =>
    signature.every((value, index) => bytes[index] === value);
  const asciiAt = (offset, text) =>
    Array.from(text).every(
      (character, index) => bytes[offset + index] === character.charCodeAt(0),
    );

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { kind: "image", type: "image/png" };
  }
  if (startsWith(0xff, 0xd8, 0xff)) {
    return { kind: "image", type: "image/jpeg" };
  }
  if (asciiAt(0, "GIF87a") || asciiAt(0, "GIF89a")) {
    return { kind: "image", type: "image/gif" };
  }
  if (asciiAt(0, "RIFF") && asciiAt(8, "WEBP")) {
    return { kind: "image", type: "image/webp" };
  }
  if (asciiAt(0, "BM")) {
    return { kind: "image", type: "image/bmp" };
  }
  if (
    startsWith(0x49, 0x49, 0x2a, 0x00) ||
    startsWith(0x4d, 0x4d, 0x00, 0x2a)
  ) {
    return { kind: "image", type: "image/tiff" };
  }
  if (asciiAt(4, "ftyp")) {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (["avif", "avis"].includes(brand)) {
      return { kind: "image", type: "image/avif" };
    }
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return { kind: "image", type: "image/heic" };
    }
  }
  if (
    declaredType === "application/zip" ||
    declaredType === "application/x-zip-compressed" ||
    startsWith(0x50, 0x4b, 0x03, 0x04) ||
    startsWith(0x50, 0x4b, 0x05, 0x06) ||
    startsWith(0x50, 0x4b, 0x07, 0x08)
  ) {
    return { kind: "zip", type: "application/zip" };
  }
  return { kind: "unknown", type: declaredType };
}

let sharedContentCheckPromise = null;

async function consumeCachedSharedContent() {
  if (!("caches" in window)) return false;

  const currentUrl = new URL(window.location.href);
  const hasSharedFlag = currentUrl.searchParams.get("shared") === "1";

  try {
    const cache = await caches.open("share-target-cache");
    const [imgRes, zipRes] = await Promise.all([
      cache.match("/_shared_image"),
      cache.match("/_shared_zip"),
    ]);
    let consumed = false;

    if (hasSharedFlag || imgRes || zipRes) {
      console.info("[share-target] cached payload check", {
        hasSharedFlag,
        hasImage: Boolean(imgRes),
        hasZip: Boolean(zipRes),
      });
    }

    // The cache is authoritative. Android may resume an existing PWA window
    // without preserving the ?shared=1 launch URL.
    if (imgRes) {
      const blob = await imgRes.blob();
      const file = new File([blob], "shared_image.jpg", {
        type: blob.type || "image/jpeg",
      });
      handleSharedImage(file);
      await cache.delete("/_shared_image");
      consumed = true;
    }

    if (zipRes) {
      const blob = await zipRes.blob();
      const detected = await detectSharedBlobKind(blob);
      if (detected.kind === "image") {
        const file = new File([blob], "shared_image", {
          type: detected.type,
        });
        handleSharedImage(file);
      } else {
        const file = new File([blob], "shared_backup.zip", {
          type: "application/zip",
        });
        if (typeof processZipFile === "function") {
          processZipFile(file);
        } else {
          window.addEventListener("DOMContentLoaded", () => processZipFile(file), { once: true });
        }
      }
      await cache.delete("/_shared_zip");
      consumed = true;
    }

    if (hasSharedFlag) {
      currentUrl.searchParams.delete("shared");
      window.history.replaceState(
        {},
        document.title,
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
    return consumed;
  } catch (error) {
    console.error("[share-target] failed to consume cached content", error);
    return false;
  }
}

function checkForSharedContent() {
  if (!sharedContentCheckPromise) {
    sharedContentCheckPromise = consumeCachedSharedContent()
      .finally(() => {
        sharedContentCheckPromise = null;
      });
  }
  return sharedContentCheckPromise;
}

window.addEventListener("load", checkForSharedContent);
window.addEventListener("pageshow", checkForSharedContent);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForSharedContent();
});

function handleSharedImage(file) {
  if (file && file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    
    const triggerCrop = () => {
      if (typeof openCropView === "function") {
        openCropView(url);
      } else {
        window.addEventListener(
          "DOMContentLoaded",
          () => openCropView(url),
          { once: true },
        );
      }
    };

    // 解決 Race Condition: 確保 IndexedDB 的歷史卡牌已經載入，才能讓裁切器正確參考過去的比例
    if (window.UIState && window.UIState.isDBReady) {
      triggerCrop();
    } else {
      const checkDB = setInterval(() => {
        if (window.UIState && window.UIState.isDBReady) {
          clearInterval(checkDB);
          triggerCrop();
        }
      }, 50);
      
      // 避免無限等待，設定 2.5 秒的 Timeout
      setTimeout(() => {
        clearInterval(checkDB);
        if (!(window.UIState && window.UIState.isDBReady)) {
          triggerCrop();
        }
      }, 2500);
    }
  }
}
