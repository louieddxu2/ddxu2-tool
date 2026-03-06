const GAPI_SRC = "https://apis.google.com/js/api.js";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureScriptLoaded(src, timeoutMs = 10000) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);

  const start = Date.now();
  while (!document.querySelector(`script[src="${src}"]`)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Picker script load timeout");
    }
    await wait(50);
  }
}

async function ensurePickerLoaded(timeoutMs = 10000) {
  if (window.google?.picker && window.gapi?.load) return;
  await ensureScriptLoaded(GAPI_SRC, timeoutMs);

  const start = Date.now();
  while (!window.gapi?.load || !window.google?.accounts) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Google API runtime load timeout");
    }
    await wait(50);
  }

  await new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("Picker module load timeout"));
    }, timeoutMs);

    window.gapi.load("picker", {
      callback: () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      },
      onerror: () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error("Picker module load failed"));
      }
    });
  });
}

export async function pickSpreadsheet({ accessToken, apiKey, origin = window.location.origin, title = "選擇試算表" }) {
  if (!accessToken) throw new Error("missing_access_token");
  if (!apiKey) throw new Error("missing_api_key_for_picker");

  await ensurePickerLoaded();

  return new Promise((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .setTitle(title)
      .setDeveloperKey(apiKey)
      .setOAuthToken(accessToken)
      .setOrigin(origin)
      .addView(view)
      .setCallback((data) => {
        const action = data?.[window.google.picker.Response.ACTION];
        if (action === window.google.picker.Action.CANCEL) {
          reject(new Error("picker_cancelled"));
          return;
        }
        if (action !== window.google.picker.Action.PICKED) return;

        const doc = data?.[window.google.picker.Response.DOCUMENTS]?.[0];
        if (!doc) {
          reject(new Error("picker_no_document"));
          return;
        }

        const id = String(doc.id || "").trim();
        const name = String(doc.name || "").trim();
        if (!id) {
          reject(new Error("picker_invalid_document"));
          return;
        }

        resolve({
          id,
          name: name || "Untitled Sheet",
          url: `https://docs.google.com/spreadsheets/d/${id}/edit`
        });
      })
      .build();

    picker.setVisible(true);
  });
}
