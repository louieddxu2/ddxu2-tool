import { getMeta, setMeta } from "./storage.js";

const DEFAULT_CONFIG = {
  clientId: "",
  apiKey: ""
};

export async function loadGoogleConfig() {
  const clientId = (await getMeta("googleClientId")) || "";
  const apiKey = (await getMeta("googleApiKey")) || "";
  return { clientId, apiKey };
}

export async function saveGoogleConfig(config = {}) {
  const next = {
    clientId: String(config.clientId || "").trim(),
    apiKey: String(config.apiKey || "").trim()
  };
  await setMeta("googleClientId", next.clientId);
  await setMeta("googleApiKey", next.apiKey);
  return next;
}

export function getDefaultGoogleConfig() {
  return { ...DEFAULT_CONFIG };
}
