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
  const header = values.length > 0 ? values[0].map((cell) => normalizeHeaderKey(cell)) : [];
  const headerMap = new Map();
  header.forEach((key, idx) => {
    if (key) headerMap.set(key, idx);
  });

  const rowMap = new Map();
  const idCol = headerMap.get("id");
  if (idCol !== undefined) {
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      const row = values[rowIndex] || [];
      const rowId = String(row[idCol] || "").trim();
      if (!rowId) continue;
      rowMap.set(rowId, rowIndex + 1);
    }
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

async function deleteColumnByIndex({ spreadsheetId, accessToken, sheetId, colIndex }) {
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
              dimension: "COLUMNS",
              startIndex: colIndex,
              endIndex: colIndex + 1
            }
          }
        }
      ]
    })
  });
}

async function ensureHeaderKey(env, key) {
  const normalized = normalizeHeaderKey(key);
  if (!normalized) throw toError("invalid_header_key", 400);

  if (env.context.headerMap.has(normalized)) {
    return env.context.headerMap.get(normalized);
  }

  const nextIndex = env.context.header.length;
  await updateSingleCell({
    spreadsheetId: env.spreadsheetId,
    accessToken: env.accessToken,
    sheetTitle: env.context.sheetTitle,
    rowNumber: 1,
    colIndex: nextIndex,
    value: normalized
  });

  env.context.header.push(normalized);
  env.context.headerMap.set(normalized, nextIndex);
  return nextIndex;
}

async function ensureHeaders(env, keys = []) {
  for (const key of keys) {
    await ensureHeaderKey(env, key);
  }
}

function shiftHeaderMapAfterDelete(env, deletedIndex) {
  const nextHeader = [];
  for (let i = 0; i < env.context.header.length; i += 1) {
    if (i !== deletedIndex) nextHeader.push(env.context.header[i]);
  }
  env.context.header = nextHeader;
  env.context.headerMap.clear();
  env.context.header.forEach((key, idx) => {
    if (key) env.context.headerMap.set(key, idx);
  });
}

async function appendSkeletonRow(env, rowId, payloadByKey = {}) {
  await ensureHeaders(env, ["id", ...Object.keys(payloadByKey)]);
  const out = env.context.header.map((key) => {
    if (key === "id") return rowId;
    return payloadByKey[key] ?? "";
  });

  const updatedRange = await appendRow({
    spreadsheetId: env.spreadsheetId,
    accessToken: env.accessToken,
    sheetTitle: env.context.sheetTitle,
    values: out
  });

  const rowNumber = parseUpdatedRangeRowNumber(updatedRange);
  if (rowNumber) env.context.rowMap.set(rowId, rowNumber);
  return rowNumber;
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

    return { context, accessToken, spreadsheetId, values, sheetTitle: targetSheet.title };
  }

  async function applyCellUpdate(op, env) {
    const rowId = String(op?.payload?.rowId || "").trim();
    const key = String(op?.payload?.key || "").trim();
    if (!rowId || !key) throw toError("invalid_cell_update_payload", 400);

    await ensureHeaders(env, ["id", key]);
    let rowNumber = env.context.rowMap.get(rowId);
    if (!rowNumber) {
      rowNumber = await appendSkeletonRow(env, rowId, { [key]: op.payload?.value ?? "" });
      if (!rowNumber) return;
    }

    const colIndex = env.context.headerMap.get(key);
    await updateSingleCell({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetTitle: env.context.sheetTitle,
      rowNumber,
      colIndex,
      value: op.payload?.value ?? ""
    });
  }

  async function applyRowRename(op, env) {
    const rowId = String(op?.payload?.rowId || "").trim();
    if (!rowId) throw toError("invalid_row_rename_payload", 400);

    await ensureHeaders(env, ["id", "name"]);

    let rowNumber = env.context.rowMap.get(rowId);
    if (!rowNumber) {
      rowNumber = await appendSkeletonRow(env, rowId, { name: op.payload?.name ?? "" });
      if (!rowNumber) return;
    }

    const nameIndex = env.context.headerMap.get("name");
    await updateSingleCell({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetTitle: env.context.sheetTitle,
      rowNumber,
      colIndex: nameIndex,
      value: op.payload?.name ?? ""
    });
  }

  async function applyRowAdd(op, env) {
    const row = op?.payload?.row || {};
    const rowId = String(row.id || "").trim();
    if (!rowId) throw toError("invalid_row_add_payload", 400);

    await ensureHeaders(env, ["id", ...Object.keys(row)]);

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
    if (!rowNumber) return;

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

  async function applyColumnAdd(op, env) {
    const key = String(op?.payload?.key || "").trim();
    if (!key) throw toError("invalid_column_add_payload", 400);
    await ensureHeaders(env, ["id", key]);
  }

  async function applyColumnUpdate(op, env) {
    const key = String(op?.payload?.key || "").trim();
    if (!key) throw toError("invalid_column_update_payload", 400);
    await ensureHeaders(env, ["id", key]);
  }

  async function applyColumnDelete(op, env) {
    const key = String(op?.payload?.key || "").trim();
    if (!key || key === "id") return;

    const colIndex = env.context.headerMap.get(key);
    if (colIndex === undefined) return;

    await deleteColumnByIndex({
      spreadsheetId: env.spreadsheetId,
      accessToken: env.accessToken,
      sheetId: env.context.sheetId,
      colIndex
    });

    shiftHeaderMapAfterDelete(env, colIndex);
  }

  async function applyOperations(operations, { spreadsheetId }) {
    try {
      const env = await loadContext(spreadsheetId);
      await ensureHeaders(env, ["id"]);

      for (const op of operations || []) {
        if (op.type === "cell_update") {
          await applyCellUpdate(op, env);
          continue;
        }
        if (op.type === "row_rename") {
          await applyRowRename(op, env);
          continue;
        }
        if (op.type === "row_add") {
          await applyRowAdd(op, env);
          continue;
        }
        if (op.type === "row_delete") {
          await applyRowDelete(op, env);
          continue;
        }
        if (op.type === "column_add") {
          await applyColumnAdd(op, env);
          continue;
        }
        if (op.type === "column_update") {
          await applyColumnUpdate(op, env);
          continue;
        }
        if (op.type === "column_delete") {
          await applyColumnDelete(op, env);
          continue;
        }
        // Unknown ops are ignored to avoid blocking the queue.
      }

      return { ok: true };
    } catch (error) {
      const { transient, reason } = classifyError(error);
      return { ok: false, transient, reason };
    }
  }

  async function pullData({ spreadsheetId }) {
    try {
      const { context, values } = await loadContext(spreadsheetId);
      const schema = {
        name: { label: "物件名稱", type: "text", options: [] }
      };

      const headerRawToKey = {};
      context.header.forEach((raw) => {
        if (!raw || raw === "id" || raw === "name") return;
        const key = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        schema[key] = { label: raw, type: "text", options: [] };
        headerRawToKey[raw] = key;
      });

      const rows = [];
      const idCol = context.headerMap.get("id");
      const nameCol = context.headerMap.get("name");

      if (values && values.length > 1) {
        for (let i = 1; i < values.length; i++) {
          const rowData = values[i];
          if (!rowData || rowData.length === 0) continue;
          
          const rowObj = {};
          let id = idCol !== undefined ? rowData[idCol] : undefined;
          if (!id) id = `row_imported_${Date.now()}_${i}`;
          
          rowObj.id = String(id).trim();
          rowObj.name = nameCol !== undefined && rowData[nameCol] ? String(rowData[nameCol]) : `Row ${i}`;

          context.header.forEach((raw, idx) => {
            if (!raw || raw === "id" || raw === "name") return;
            const key = headerRawToKey[raw];
            if (key && rowData[idx] !== undefined) {
              rowObj[key] = String(rowData[idx]);
            }
          });
          rows.push(rowObj);
        }
      }

      return { ok: true, schema, rows };
    } catch (error) {
      const { transient, reason } = classifyError(error);
      return { ok: false, transient, reason };
    }
  }

  return {
    applyOperations,
    pullData
  };
}
