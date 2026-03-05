function assertOk(response, message) {
  if (response.ok) return;
  throw new Error(`${message} (${response.status})`);
}

function buildUrl(base, params = {}) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function escapeDriveQuery(value) {
  return String(value || "").replaceAll("'", "\\'");
}

export function parseSpreadsheetId(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function searchUserSheets({ accessToken, query = "", pageSize = 20 }) {
  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "trashed=false"
  ];
  if (query) qParts.push(`name contains '${escapeDriveQuery(query)}'`);

  const url = buildUrl("https://www.googleapis.com/drive/v3/files", {
    q: qParts.join(" and "),
    fields: "files(id,name,webViewLink,capabilities/canEdit)",
    orderBy: "modifiedTime desc",
    pageSize
  });

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  assertOk(response, "搜尋 Google 試算表失敗");
  const data = await response.json();
  return data.files || [];
}

export async function getSpreadsheetMeta({ accessToken, spreadsheetId, apiKey = "" }) {
  const url = buildUrl(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`, {
    fields: "spreadsheetId,properties/title",
    key: apiKey || undefined
  });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  assertOk(response, "讀取 Google 試算表資訊失敗");
  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || "Untitled Sheet"
  };
}

export async function resolveSheetFromInput({ accessToken, input, apiKey = "" }) {
  const spreadsheetId = parseSpreadsheetId(input);
  if (!spreadsheetId) {
    throw new Error("不是有效的 Google 試算表網址或 ID");
  }
  const meta = await getSpreadsheetMeta({ accessToken, spreadsheetId, apiKey });
  return {
    spreadsheetId: meta.spreadsheetId,
    title: meta.title,
    url: `https://docs.google.com/spreadsheets/d/${meta.spreadsheetId}/edit`
  };
}
