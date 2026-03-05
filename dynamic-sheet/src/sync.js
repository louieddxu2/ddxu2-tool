import { deferOperation, deleteOperation, listPendingOperations } from "./storage.js";

class NoopCloudAdapter {
  async applyOperations() {
    return { ok: false, transient: false, reason: "no_adapter" };
  }
}

function resolveAdapter() {
  return window.dynamicSheetCloudAdapter || new NoopCloudAdapter();
}

export function createSyncEngine({ getActiveSheetId, onStatus }) {
  let syncing = false;

  async function syncNow() {
    const activeSheetId = getActiveSheetId();
    if (!activeSheetId || syncing) return;

    syncing = true;
    try {
      const pending = await listPendingOperations(activeSheetId);
      if (pending.length === 0) {
        onStatus({ text: "待同步 0 筆", tone: "ok", pending: 0 });
        return;
      }

      const adapter = resolveAdapter();
      for (const op of pending) {
        try {
          const result = await adapter.applyOperations([op], { spreadsheetId: activeSheetId });
          if (result?.ok) {
            await deleteOperation(op.id);
            continue;
          }

          await deferOperation(op.id, (op.retries || 0) + 1);
        } catch {
          await deferOperation(op.id, (op.retries || 0) + 1);
        }
      }
    } finally {
      syncing = false;
    }
  }

  return { syncNow };
}
