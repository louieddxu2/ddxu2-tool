import { deferOperation, deleteOperation, listPendingOperations } from "./storage.js";

class NoopCloudAdapter {
  async applyOperations() {
    return { ok: false, transient: false, reason: "no_adapter" };
  }
}

function resolveAdapter() {
  return window.dynamicSheetCloudAdapter || new NoopCloudAdapter();
}

export function createSyncEngine({ getActiveSheetId, getSchema, onStatus }) {
  let syncing = false;

  async function syncNow(options = {}) {
    const activeSheetId = getActiveSheetId();
    if (!activeSheetId || syncing) {
      return { attempted: 0, success: 0, failed: 0, deferred: 0, lastErrorReason: "skipped" };
    }

    syncing = true;
    const summary = {
      attempted: 0,
      success: 0,
      failed: 0,
      deferred: 0,
      lastErrorReason: ""
    };

    try {
      const pending = await listPendingOperations(activeSheetId, 100, Boolean(options.includeDeferred));
      if (pending.length === 0) {
        onStatus({ text: "待同步 0 筆", tone: "ok", pending: 0 });
        return summary;
      }

      const adapter = resolveAdapter();
      for (const op of pending) {
        summary.attempted += 1;
        try {
          const schema = typeof getSchema === "function" ? getSchema() : null;
          const result = await adapter.applyOperations([op], { 
            spreadsheetId: activeSheetId,
            schema 
          });
          if (result?.ok) {

            await deleteOperation(op.id);
            summary.success += 1;
            continue;
          }

          await deferOperation(op.id, (op.retries || 0) + 1);
          summary.failed += 1;
          summary.deferred += 1;
          summary.lastErrorReason = result?.reason || "adapter_rejected";
        } catch (error) {
          await deferOperation(op.id, (op.retries || 0) + 1);
          summary.failed += 1;
          summary.deferred += 1;
          summary.lastErrorReason = error?.message || "sync_exception";
        }
      }

      return summary;
    } finally {
      syncing = false;
    }
  }

  return { syncNow };
}
