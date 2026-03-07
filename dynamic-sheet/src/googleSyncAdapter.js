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

const SCHEMA_SHEET_TITLE = "_dynamic_sheet_schema";

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
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await googleFetch(url, accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, values: [[value ?? ""]] })
  });
}

async function getOrInitSchemaSheet({ spreadsheetId, accessToken }) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title))`;
  const response = await googleFetch(url, accessToken);
  const payload = await response.json();
  const sheets = payload?.sheets || [];
  const existing = sheets.find(s => s.properties?.title === SCHEMA_SHEET_TITLE);
  if (existing) return existing.properties.sheetId;

  // Create it hidden
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  const createResponse = await googleFetch(updateUrl, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: SCHEMA_SHEET_TITLE,
              hidden: true
            }
          }
        }
      ]
    })
  });
  const createPayload = await createResponse.json();
  return createPayload.replies[0].addSheet.properties.sheetId;
}

async function saveSchemaToCloud({ spreadsheetId, accessToken, schema }) {
  await getOrInitSchemaSheet({ spreadsheetId, accessToken });
  const json = JSON.stringify(schema || {});
  await updateSingleCell({
    spreadsheetId,
    accessToken,
    sheetTitle: SCHEMA_SHEET_TITLE,
    rowNumber: 1,
    colIndex: 0,
    value: json
  });
}

async function loadSchemaFromCloud({ spreadsheetId, accessToken }) {
  try {
    const range = `${quoteSheetTitle(SCHEMA_SHEET_TITLE)}!A1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
    const response = await googleFetch(url, accessToken);
    const payload = await response.json();
    const raw = payload.values?.[0]?.[0];
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // Ignore if sheet doesn't exist or JSON is invalid
  }
  return null;
}


async function appendRow({ spreadsheetId, accessToken, sheetTitle, values }) {
  const range = `${quoteSheetTitle(sheetTitle)}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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
    const dataSheets = sheets.filter(s => s.title !== SCHEMA_SHEET_TITLE);
    if (!dataSheets.length && sheets.length) {
       // All sheets are schema sheets? Should not happen normally.
       // Fallback to absolute first if no choice.
    }
    const targetSheet = sheetTabName
      ? dataSheets.find((item) => item.title === sheetTabName) || dataSheets[0] || sheets[0]
      : dataSheets[0] || sheets[0];
    const values = await getValues({ spreadsheetId, sheetTitle: targetSheet.title, accessToken });

    const schema = await loadSchemaFromCloud({ spreadsheetId, accessToken });
    const context = buildContext({ values, sheetTitle: targetSheet.title, sheetId: targetSheet.sheetId });

    return { context, accessToken, spreadsheetId, values, sheetTitle: targetSheet.title, schema };
  }

  async function applyCellUpdate(op, env) {
    const rowId = String(op?.payload?.rowId || "").trim();
    const key = String(op?.payload?.key || "").trim();
    if (!rowId || !key) throw toError("invalid_cell_update_payload", 400);

    // Map the internal key back to the label in Google Sheets
    const label = env.schema?.[key]?.label || key;
    await ensureHeaders(env, ["id", label]);

    let rowNumber = env.context.rowMap.get(rowId);
    if (!rowNumber) {
      rowNumber = await appendSkeletonRow(env, rowId, { [label]: op.payload?.value ?? "" });
      if (!rowNumber) return;
    }

    const colIndex = env.context.headerMap.get(label);
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

    // Map internal keys in the row payload to labels
    const mappedRow = { id: rowId };
    Object.keys(row).forEach(k => {
      const label = env.schema?.[k]?.label || k;
      mappedRow[label] = row[k];
    });

    await ensureHeaders(env, ["id", ...Object.keys(mappedRow)]);

    const out = env.context.header.map((key) => {
      if (!key) return "";
      return mappedRow[key] ?? "";
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

  async function applyOperations(operations, { spreadsheetId, schema }) {
    try {
      const env = await loadContext(spreadsheetId);
      env.schema = schema || env.schema || {}; // Prefer passed schema or cloud schema
      await ensureHeaders(env, ["id"]);

      let schemaChanged = false;

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
          schemaChanged = true;
          continue;
        }
        if (op.type === "column_update") {
          await applyColumnUpdate(op, env);
          schemaChanged = true;
          continue;
        }
        if (op.type === "column_delete") {
          await applyColumnDelete(op, env);
          schemaChanged = true;
          continue;
        }
      }

      if (schemaChanged) {
        await saveSchemaToCloud({
          spreadsheetId: env.spreadsheetId,
          accessToken: env.accessToken,
          schema: env.schema
        });
      }

      return { ok: true };
    } catch (error) {

      const { transient, reason } = classifyError(error);
      return { ok: false, transient, reason };
    }
  }

  async function pullData({ spreadsheetId }) {
    try {
      const { context, values, accessToken, schema: cloudSchema } = await loadContext(spreadsheetId);
      const schema = cloudSchema || {
        name: { label: "物件名稱", type: "text", options: [] }
      };

      // Reconcile headers with cloud schema
      const labelToKey = {};
      Object.entries(schema).forEach(([k, config]) => {
        if (config.label) labelToKey[config.label] = k;
      });

      const headerRawToKey = {};
      let schemaModified = false;

      context.header.forEach((raw) => {
        if (!raw || raw === "id" || raw === "name") return;
        const existingKey = labelToKey[raw];
        if (existingKey) {
          headerRawToKey[raw] = existingKey;
        } else {
          // New column found in cloud not in schema
          const key = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          schema[key] = { label: raw, type: "text", options: [] };
          headerRawToKey[raw] = key;
          schemaModified = true;
        }
      });

      if (schemaModified) {
        await saveSchemaToCloud({ spreadsheetId, accessToken, schema });
      }

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
