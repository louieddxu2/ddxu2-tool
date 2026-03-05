function classifyError(error) {
  const status = Number(error?.status || 0);
  if (!status) return { transient: true, reason: error?.message || "network_error" };
  if (status === 401 || status === 403) return { transient: false, reason: "auth_or_permission_denied" };
  if (status === 404) return { transient: false, reason: "spreadsheet_not_found" };
  if (status === 429 || status >= 500) return { transient: true, reason: `http_${status}` };
  return { transient: false, reason: `http_${status}` };
}

function toError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildA1Column(colIndex) {
  let index = colIndex + 1;
  let out = "";
  while (index > 0) {
    const mod = (index - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    index = Math.floor((index - 1) / 26);
  }
  return out;
}

function quoteSheetTitle(title) {
  return `'${String(title || "").replaceAll("'", "''")}'`;
}

function normalizeHeaderKey(raw) {
  return String(raw || "").trim();
}

async function googleFetch(url, accessToken, init = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(init.headers || {})
  };

  const response = await fetch(url, { ...init, headers });
  if (response.ok) return response;

  let message = `Google API error (${response.status})`;
  try {
    const payload = await response.json();
    const detail = payload?.error?.message;
    if (detail) message = `${message}: ${detail}`;
  } catch {
    // ignore JSON parse failure
  }

  throw toError(message, response.status);
}

async function getSpreadsheetShape({ spreadsheetId, accessToken }) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title,index))`;
  const response = await googleFetch(url, accessToken);
  const payload = await response.json();
  const sheets = payload?.sheets || [];
  if (!sheets.length) throw toError("Spreadsheet has no sheets", 400);
  return sheets
    .map((item) => item.properties)
    .filter(Boolean)
    .sort((a, b) => (a.index || 0) - (b.index || 0));
}

async function getValues({ spreadsheetId, sheetTitle, accessToken }) {
  const range = `${quoteSheetTitle(sheetTitle)}!A1:ZZZ`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const response = await googleFetch(url, accessToken);
  const payload = await response.json();
  return payload.values || [];
}

function buildContext({ values, sheetTitle, sheetId }) {
  if (!values.length || !values[0].length) {
    throw toError("遠端試算表缺少 header，請先建立 header（至少要有 id 欄）", 400);
  }

  const header = values[0].map((cell) => normalizeHeaderKey(cell));
  const headerMap = new Map();
  header.forEach((key, idx) => {
    if (key) headerMap.set(key, idx);
  });

  if (!headerMap.has("id")) {
    throw toError("遠端試算表 header 缺少 id 欄位，無法對齊列資料", 400);
  }

  const idCol = headerMap.get("id");
  const rowMap = new Map();
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    const rowId = String(row[idCol] || "").trim();
    if (!rowId) continue;
    rowMap.set(rowId, rowIndex + 1);
  }

  return {
    sheetTitle,
    sheetId,
    header,
    headerMap,
    rowMap
  };
}

async function updateSingleCell({ spreadsheetId, accessToken, sheetTitle, rowNumber, colIndex, value }) {
  const col = buildA1Column(colIndex);
  const range = `${quoteSheetTitle(sheetTitle)}!${col}${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  await googleFetch(url, accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, values: [[value ?? ""]] })
  });
}

async function appendRow({ spreadsheetId, accessToken, sheetTitle, values }) {
  const range = `${quoteSheetTitle(sheetTitle)}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await googleFetch(url, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, values: [values] })
  });
  const payload = await response.json();
  return payload.updates?.updatedRange || "";
}

function parseUpdatedRangeRowNumber(updatedRange) {
  const match = String(updatedRange || "").match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?$/i);
  return match ? Number(match[1]) : 0;
}

async function deleteRowByNumber({ spreadsheetId, accessToken, sheetId, rowNumber }) {
  const startIndex = rowNumber - 1;
  const endIndex = startIndex + 1;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  await googleFetch(url, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex
            }
          }
        }
      ]
    })
  });
}

export function createGoogleSyncAdapter({ getAccessToken, sheetTabName = "" }) {
  async function loadContext(spreadsheetId) {
    const accessToken = await getAccessToken();
    if (!accessToken) throw toError("missing_access_token", 401);

    const sheets = await getSpreadsheetShape({ spreadsheetId, accessToken });
    const targetSheet = sheetTabName
      ? sheets.find((item) => item.title === sheetTabName) || sheets[0]
      : sheets[0];
    const values = await getValues({ spreadsheetId, sheetTitle: targetSheet.title, accessToken });
    const context = buildContext({ values, sheetTitle: targetSheet.title, sheetId: targetSheet.sheetId });
    return { context, accessToken };
  }

  async function applyCellUpdate(op, env) {
    const rowId = String(op?.payload?.rowId || "").trim();
    const key = String(op?.payload?.key || "").trim();
    if (!rowId || !key) throw toError("invalid_cell_update_payload", 400);

    const rowNumber = env.context.rowMap.get(rowId);
    if (!rowNumber) throw toError(`row_not_found:${rowId}`, 400);

    const colIndex = env.context.headerMap.get(key);
    if (colIndex === undefined) throw toError(`column_not_found:${key}`, 400);

    await updateSingleCell({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetTitle: env.context.sheetTitle,
      rowNumber,
      colIndex,
      value: op.payload?.value ?? ""
    });
  }

  async function applyRowAdd(op, env) {
    const row = op?.payload?.row || {};
    const rowId = String(row.id || "").trim();
    if (!rowId) throw toError("invalid_row_add_payload", 400);

    const out = env.context.header.map((key) => {
      if (!key) return "";
      return row[key] ?? "";
    });

    const updatedRange = await appendRow({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetTitle: env.context.sheetTitle,
      values: out
    });

    const rowNumber = parseUpdatedRangeRowNumber(updatedRange);
    if (rowNumber) env.context.rowMap.set(rowId, rowNumber);
  }

  async function applyRowDelete(op, env) {
    const rowId = String(op?.payload?.rowId || "").trim();
    if (!rowId) throw toError("invalid_row_delete_payload", 400);

    const rowNumber = env.context.rowMap.get(rowId);
    if (!rowNumber) {
      return;
    }

    await deleteRowByNumber({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetId: env.context.sheetId,
      rowNumber
    });

    env.context.rowMap.delete(rowId);
    for (const [id, num] of env.context.rowMap.entries()) {
      if (num > rowNumber) env.context.rowMap.set(id, num - 1);
    }
  }

  async function applyOperations(operations, { spreadsheetId }) {
    try {
      const env = await loadContext(spreadsheetId);
      env.spreadsheetId = spreadsheetId;

      for (const op of operations || []) {
        if (op.type === "cell_update") {
          await applyCellUpdate(op, env);
        } else if (op.type === "row_add") {
          await applyRowAdd(op, env);
        } else if (op.type === "row_delete") {
          await applyRowDelete(op, env);
        } else {
          return { ok: false, transient: false, reason: `unsupported_operation:${op.type}` };
        }
      }

      return { ok: true };
    } catch (error) {
      const { transient, reason } = classifyError(error);
      return { ok: false, transient, reason };
    }
  }

  return {
    applyOperations
  };
}
