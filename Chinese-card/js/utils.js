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
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
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

const SHARED_PAYLOAD_KEY = "/_shared_payload";
const SHARED_STATUS_KEY = "/_shared_status";
const LEGACY_SHARED_IMAGE_KEY = "/_shared_image";
const LEGACY_SHARED_ZIP_KEY = "/_shared_zip";
let sharedContentCheckPromise = null;

function waitForSharedContent(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function waitForWindowFunction(name, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (typeof window[name] === "function") return window[name];
    await waitForSharedContent(25);
  }
  throw new Error(`${name} was not ready within ${timeoutMs}ms`);
}

function showSharedContentError(code, details = "") {
  console.error("[share-target] share failed", { code, details });

  let banner = document.getElementById("share-target-error");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "share-target-error";
    banner.className = "fixed inset-x-3 top-3 z-[200] rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-2xl";
    banner.setAttribute("role", "alert");
    document.body.appendChild(banner);
  }
  banner.dataset.shareError = code;
  banner.textContent = `照片分享失敗（${code}）。${details || "請保留此畫面並回報代碼。"}`;
}

async function readShareStatus(response) {
  if (!response) return null;
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

async function processSharedZip(blob) {
  const processZip = await waitForWindowFunction("processZipFile");
  const file = new File([blob], "shared_backup.zip", {
    type: "application/zip",
  });
  await processZip(file);
}

async function consumeCachedSharedContent() {
  if (!("caches" in window)) return false;

  const currentUrl = new URL(window.location.href);
  const hasSharedFlag = currentUrl.searchParams.get("shared") === "1";
  const urlError = currentUrl.searchParams.get("share_error");

  try {
    const cache = await caches.open("share-target-cache");
    const attempts = hasSharedFlag || urlError ? 30 : 1;
    let payloadRes = null;
    let imgRes = null;
    let zipRes = null;
    let statusRes = null;
    let status = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      [payloadRes, imgRes, zipRes, statusRes] = await Promise.all([
        cache.match(SHARED_PAYLOAD_KEY),
        cache.match(LEGACY_SHARED_IMAGE_KEY),
        cache.match(LEGACY_SHARED_ZIP_KEY),
        cache.match(SHARED_STATUS_KEY),
      ]);
      status = await readShareStatus(statusRes);
      if (payloadRes || imgRes || zipRes || (status && status.ok === false)) break;
      if (attempt + 1 < attempts) await waitForSharedContent(100);
    }

    console.info("[share-target] payload check", {
      hasSharedFlag,
      urlError,
      hasPayload: Boolean(payloadRes),
      hasLegacyImage: Boolean(imgRes),
      hasLegacyZip: Boolean(zipRes),
      status,
    });

    if ((urlError || (status && status.ok === false)) && !payloadRes && !imgRes && !zipRes) {
      const code = urlError || status.stage || "sw-unknown";
      const receivedFields = status && Array.isArray(status.fields)
        ? status.fields.map((field) => field.fieldName).filter(Boolean)
        : [];
      const details = status && status.error
        ? status.error
        : (receivedFields.length
          ? `Android 只送出欄位：${receivedFields.join(", ")}，沒有附加檔案。`
          : "分享資料未成功進入工具。");
      showSharedContentError(code, details);
      return false;
    }

    let consumedKey = null;
    let blob = null;
    let forcedImageSlot = false;

    if (payloadRes) {
      consumedKey = SHARED_PAYLOAD_KEY;
      blob = await payloadRes.blob();
    } else if (imgRes) {
      consumedKey = LEGACY_SHARED_IMAGE_KEY;
      blob = await imgRes.blob();
      forcedImageSlot = true;
    } else if (zipRes) {
      consumedKey = LEGACY_SHARED_ZIP_KEY;
      blob = await zipRes.blob();
    }

    if (!blob) {
      if (hasSharedFlag) {
        showSharedContentError("page-no-payload", "工具已開啟，但找不到 Android 傳入的檔案。");
      }
      return false;
    }

    const detected = await detectSharedBlobKind(blob);
    if (detected.kind === "image" || forcedImageSlot) {
      const fileName = payloadRes
        ? decodeURIComponent(payloadRes.headers.get("X-Share-Name") || "shared_image")
        : "shared_image";
      const imageType = detected.kind === "image"
        ? detected.type
        : (blob.type.startsWith("image/") ? blob.type : "image/jpeg");
      const file = new File([blob], fileName, { type: imageType });
      await handleSharedImage(file);
    } else if (detected.kind === "zip") {
      await processSharedZip(blob);
    } else {
      throw new Error(`Unrecognized shared payload: type=${blob.type || "empty"}, size=${blob.size}`);
    }

    await Promise.all([
      cache.delete(consumedKey),
      cache.delete(SHARED_STATUS_KEY),
      cache.delete(LEGACY_SHARED_IMAGE_KEY),
      cache.delete(LEGACY_SHARED_ZIP_KEY),
    ]);

    currentUrl.searchParams.delete("shared");
    currentUrl.searchParams.delete("share_error");
    window.history.replaceState(
      {},
      document.title,
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showSharedContentError("page-process-failed", message);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkForSharedContent, { once: true });
} else {
  checkForSharedContent();
}
window.addEventListener("pageshow", checkForSharedContent);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForSharedContent();
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "chinese-card-share-ready") {
      checkForSharedContent();
    }
  });
}

async function handleSharedImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error(`Shared file is not an image: ${file ? file.type : "missing"}`);
  }

  const openCrop = await waitForWindowFunction("openCropView");
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      finish(reject, new Error("Image decoding timed out"));
    }, 15000);

    try {
      openCrop(url, file.name || "", {
        onLoad: () => {
          clearTimeout(timeout);
          finish(resolve, true);
        },
        onError: (error) => {
          clearTimeout(timeout);
          finish(reject, error instanceof Error ? error : new Error("Image decoding failed"));
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      finish(reject, error);
    }
  });
}
