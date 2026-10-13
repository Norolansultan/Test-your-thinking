/**
 * IndexedDB-backed {@link LogSink} — SPEC/05_System_Architecture.md §9:
 * "Local-first. Records are written to IndexedDB in an append-only object
 * store, flushed before the UI acknowledges the action that produced
 * them (I5). `seq` is assigned by the writer and is gapless."
 *
 * Relies on the ambient `indexedDB` global. In a real browser that is the
 * native implementation; in Node (tests, tooling) it is provided by the
 * `fake-indexeddb` package, imported only by test files — this module
 * itself has no dependency on which one is present.
 */

import type { LogRecord, LogSink } from "./log.js";

export class IndexedDbLogSink implements LogSink {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly storeName: string,
  ) {}

  /** Opens (creating if needed) the database and its single append-only object store, keyed by `seq`. */
  static async open(databaseName: string, storeName = "records"): Promise<IndexedDbLogSink> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "seq" });
        }
      };
      request.onsuccess = () => resolve(new IndexedDbLogSink(request.result, storeName));
      request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database "${databaseName}"`));
    });
  }

  /**
   * Resolves only once the write transaction *completes* — IndexedDB
   * transactions are durable on completion, which is exactly the "flushed
   * before the UI acknowledges the action" guarantee I5 requires. Uses
   * `add` (not `put`): a duplicate `seq` is a bug this should surface as
   * an error, not silently overwrite.
   */
  append(record: LogRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write transaction aborted"));
    });
  }

  readAll(): Promise<readonly LogRecord[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const request = tx.objectStore(this.storeName).getAll();
      request.onsuccess = () => {
        const records = request.result as LogRecord[];
        // determinism-lint-allow: explicit numeric comparator, not object-key iteration — getAll() order is not contractually guaranteed, so this is required for correctness, not merely style (I1).
        resolve(records.slice().sort((a, b) => a.seq - b.seq));
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
    });
  }

  close(): void {
    this.db.close();
  }
}
