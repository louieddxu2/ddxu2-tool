import { deferOperation, deleteOperation, listPendingOperations } from "./storage.js";

class NoopCloudAdapter {
  async applyOperations() {
    return { ok: false, transient: false, reason: "no_adapter" };
  }
}

export function createSyncEngine({ getActiveSheetId, onStatus }) {
  const adapter = window.dynamicSheetCloudAdapter || new NoopCloudAdapter();
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

      for (const op of pending) {
        try {
          const result = await adapter.applyOperations([op], { spreadsheetId: activeSheetId });
          if (result && result.ok) {
            await deleteOperation(op.id);
          } else if (result && result.transient) {
            await deferOperation(op.id, (op.retries || 0) + 1);
          } else {
            await deferOperation(op.id, (op.retries || 0) + 1);
          }
        } catch (error) {
          await deferOperation(op.id, (op.retries || 0) + 1);
        }
      }
    } finally {
      syncing = false;
    }
  }

  return { syncNow };
}

