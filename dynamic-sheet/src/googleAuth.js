const GIS_SRC = "https://accounts.google.com/gsi/client";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureGisLoaded(timeoutMs = 7000) {
  if (window.google?.accounts?.oauth2) return;

  if (!document.querySelector(`script[src=\"${GIS_SRC}\"]`)) {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  const start = Date.now();
  while (!window.google?.accounts?.oauth2) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Google Identity Services 載入逾時，請稍後再試");
    }
    await wait(50);
  }
}

async function fetchUserInfo(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error(`取得 Google 使用者資訊失敗 (${response.status})`);
  }
  return response.json();
}

export function createGoogleAuthManager({ getClientId, scope }) {
  let tokenClient = null;
  let accessToken = "";
  let expiresAt = 0;
  let profile = null;

  function clearAuth() {
    accessToken = "";
    expiresAt = 0;
    profile = null;
  }

  async function init() {
    const clientId = String(getClientId?.() || "").trim();
    if (!clientId) return false;
    await ensureGisLoaded();
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: () => {}
    });
    return true;
  }

  async function requestToken(prompt = "") {
    if (!tokenClient) {
      const ok = await init();
      if (!ok) throw new Error("尚未設定 Google Client ID");
    }

    const tokenResponse = await new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error || "Google 授權失敗"));
          return;
        }
        resolve(resp);
      };
      tokenClient.requestAccessToken({ prompt });
    });

    accessToken = tokenResponse.access_token || "";
    const expiresIn = Number(tokenResponse.expires_in || 3600);
    expiresAt = Date.now() + expiresIn * 1000;
    try {
      profile = await fetchUserInfo(accessToken);
    } catch {
      profile = null;
    }
    return accessToken;
  }

  async function connect() {
    await requestToken("consent");
    return getState();
  }

  async function ensureToken() {
    if (accessToken && Date.now() + 30_000 < expiresAt) return accessToken;
    await requestToken("");
    return accessToken;
  }

  async function disconnect() {
    if (window.google?.accounts?.oauth2?.revoke && accessToken) {
      await new Promise((resolve) => {
        window.google.accounts.oauth2.revoke(accessToken, () => resolve());
      });
    }
    clearAuth();
    return getState();
  }

  function getState() {
    return {
      connected: Boolean(accessToken),
      accessToken,
      expiresAt,
      profile
    };
  }

  return {
    init,
    connect,
    ensureToken,
    disconnect,
    getState
  };
}
