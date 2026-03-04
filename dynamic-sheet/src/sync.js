import { deferOperation, deleteOperation, getPendingCount, listPendingOperations } from "./storage.js";

class NoopCloudAdapter {
  async applyOperations() {
    return { ok: false, transient: false, reason: "no_adapter" };
  }
}

export function createSyncEngine(onStatus) {
  const adapter = window.dynamicSheetCloudAdapter || new NoopCloudAdapter();
  let syncing = false;

  async function syncNow() {
    if (syncing) return;
    syncing = true;
    try {
      const pending = await listPendingOperations();
      if (pending.length === 0) {
        onStatus({ text: "待同步 0 筆", tone: "ok", pending: 0 });
        return;
      }

      for (const op of pending) {
        try {
          const result = await adapter.applyOperations([op]);
          if (result && result.ok) {
            await deleteOperation(op.id);
          } else if (result && result.transient) {
            await deferOperation(op.id, (op.retries || 0) + 1);
          } else {
            // Permanent failure: keep operation queued for manual resolution.
            await deferOperation(op.id, (op.retries || 0) + 1);
          }
        } catch (error) {
          await deferOperation(op.id, (op.retries || 0) + 1);
        }
      }

      const pendingCount = await getPendingCount();
      if (window.dynamicSheetCloudAdapter) {
        onStatus({ text: pendingCount > 0 ? `待同步 ${pendingCount} 筆` : "同步完成", tone: pendingCount > 0 ? "warn" : "ok", pending: pendingCount });
      } else {
        onStatus({ text: `未連線 adapter（待同步 ${pendingCount} 筆）`, tone: "warn", pending: pendingCount });
      }
    } finally {
      syncing = false;
    }
  }

  return { syncNow };
}

