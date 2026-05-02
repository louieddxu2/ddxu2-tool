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

// Check for cached shared image
window.addEventListener("load", async () => {
  if (window.location.search.includes("shared=1") && "caches" in window) {
    try {
      const cache = await caches.open("share-target-cache");
      
      // Handle image share
      const imgRes = await cache.match("/_shared_image");
      if (imgRes) {
        const blob = await imgRes.blob();
        const file = new File([blob], "shared_image.jpg", {
          type: blob.type || "image/jpeg",
        });
        handleSharedImage(file);
        await cache.delete("/_shared_image");
      }

      // Handle zip share
      const zipRes = await cache.match("/_shared_zip");
      if (zipRes) {
        const blob = await zipRes.blob();
        const file = new File([blob], "shared_backup.zip", {
          type: "application/zip",
        });
        if (typeof processZipFile === "function") {
          processZipFile(file);
        } else {
          window.addEventListener("DOMContentLoaded", () => processZipFile(file), { once: true });
        }
        await cache.delete("/_shared_zip");
      }

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error("Failed to load shared content", e);
    }
  }
});

function handleSharedImage(file) {
  if (file && file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    if (typeof openCropView === "function") {
      openCropView(url);
    } else {
      window.addEventListener(
        "DOMContentLoaded",
        () => openCropView(url),
        { once: true },
      );
    }
  }
}
