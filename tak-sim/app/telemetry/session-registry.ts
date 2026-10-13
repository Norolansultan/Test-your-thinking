/**
 * The browser's list of sessions on this machine (SPEC/05 §9, local-first) — one small IndexedDB
 * database beside the per-session record stores:
 *
 * - `fire-sim-sessions` / `sessions`, keyed by `sessionId`: the header, the session's status
 *   (`running` → `complete` → `uploaded`; `abandoned` when the participant declines a resume;
 *   `aborted` when the session ended before the run — consent declined, or a hard preflight refusal),
 *   and the page address it was started from;
 * - `fire-sim-log-<sessionId>` / `records`: the session's records ({@link IndexedDbLogSink}), each
 *   written and committed before the UI acknowledges the action that produced it (I5).
 *
 * On load the app asks {@link SessionRegistry.findUnfinished} whether a session was left `running`
 * (tab closed, browser crashed: offer to resume) or `complete` but not uploaded (offer the upload
 * again, or the export). Nothing here is ever deleted by the app: a participant's data stays in the
 * browser until the upload has been confirmed, and after it until the browser's storage is cleared.
 */

import { IndexedDbLogSink } from "./indexeddb-sink.js";
import type { LogHeader, LogSink } from "./log.js";

export type SessionStatus = "running" | "complete" | "uploaded" | "abandoned" | "aborted";

/**
 * The registry status a session takes when its screen reaches `step`, if any (final review, 6 Oct
 * 2026): a declined consent or a hard preflight refusal ends the session (ABORTED), so a reload must
 * not offer to "continue" it — the participant would be taken back to the consent, or the refusal.
 */
export function statusOnStep(step: string): SessionStatus | null {
  return step === "consent_declined" || step === "preflight_refused" ? "aborted" : null;
}

/**
 * Revision (ah), 9 Oct 2026: whether leaving the page (Back, reload, closing the tab) asks first — the
 * browser's standard prompt — while a session is running: every step except the end (`complete`) and
 * the steps that ended it before the run. A resume restarts the interrupted period, so leaving by
 * accident costs the participant that period. Never under automation (`navigator.webdriver`).
 */
export function warnBeforeUnload(step: string | null, webdriver: boolean): boolean {
  if (webdriver || step === null) return false;
  return step !== "complete" && statusOnStep(step) === null;
}

export interface SessionEntry {
  readonly sessionId: string;
  readonly header: LogHeader;
  readonly status: SessionStatus;
  /** `window.location.search` when the session started (the configuration a resume restores). */
  readonly search: string;
}

export const REGISTRY_DB = "fire-sim-sessions";
const STORE = "sessions";

export function recordsDbName(sessionId: string): string {
  return `fire-sim-log-${sessionId}`;
}

/** Opens the session's own durable record store. */
export function openSessionSink(sessionId: string): Promise<IndexedDbLogSink> {
  return IndexedDbLogSink.open(recordsDbName(sessionId));
}

/**
 * A sink that registers the session (status `running`) before its first record — `session_started`,
 * whose detail is the header — is written; both committed before the append resolves (I5).
 */
export function registeringSink(inner: LogSink, register: (header: LogHeader) => Promise<void>): LogSink {
  let registered = false;
  return {
    async append(record) {
      if (!registered && record.kind === "session_started") { await register(record.detail as LogHeader); registered = true; }
      await inner.append(record);
    },
    readAll: () => inner.readAll(),
  };
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export class SessionRegistry {
  private constructor(private readonly db: IDBDatabase) {}

  static open(name = REGISTRY_DB): Promise<SessionRegistry> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "sessionId" });
      };
      request.onsuccess = () => resolve(new SessionRegistry(request.result));
      request.onerror = () => reject(request.error ?? new Error(`Failed to open IndexedDB database "${name}"`));
    });
  }

  /** Writes the entry; resolves when the transaction has committed. */
  private write(entry: SessionEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
    });
  }

  /** Registers a new session as `running` (before its first record is written). */
  register(header: LogHeader, search: string): Promise<void> {
    return this.write({ sessionId: header.sessionId, header, status: "running", search });
  }

  async get(sessionId: string): Promise<SessionEntry | null> {
    const tx = this.db.transaction(STORE, "readonly");
    return (await promisify(tx.objectStore(STORE).get(sessionId) as IDBRequest<SessionEntry | undefined>)) ?? null;
  }

  async setStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const entry = await this.get(sessionId);
    if (!entry) throw new Error(`No session ${sessionId} in the registry`);
    await this.write({ ...entry, status });
  }

  async all(): Promise<SessionEntry[]> {
    const tx = this.db.transaction(STORE, "readonly");
    const entries = await promisify(tx.objectStore(STORE).getAll() as IDBRequest<SessionEntry[]>);
    // Newest first by the header's start time (ISO strings order chronologically), id as the tie-break.
    return entries.slice().sort((a, b) => (a.header.startedAtIso < b.header.startedAtIso ? 1 : a.header.startedAtIso > b.header.startedAtIso ? -1 : a.sessionId < b.sessionId ? -1 : 1));
  }

  /** The newest session left `running` or `complete` (not uploaded), if any. */
  async findUnfinished(): Promise<SessionEntry | null> {
    return (await this.all()).find((e) => e.status === "running" || e.status === "complete") ?? null;
  }

  close(): void { this.db.close(); }
}
