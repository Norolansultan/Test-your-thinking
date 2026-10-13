/**
 * The session-log upload protocol, shared by the browser (`http-uploader.ts`) and the server
 * (`server/session-log/`). SPEC/05 §9: after `COMPLETE` the session file is uploaded in chunks with
 * retry; invariant I3: never during the run.
 *
 *   PUT  /api/session-log/<sessionId>/chunks/<index>?total=<n>   body: the chunk's JSONL text
 *        header `x-chunk-sha256: <hex>` (SHA-256 of the body)
 *        200 {status:"stored"|"duplicate"|"already_complete"} · 400 bad id/index/hash · 409 a different
 *        chunk already stored under that index, or a different total · 413 too large
 *   POST /api/session-log/<sessionId>/complete                   body: {@link CompleteRequest}
 *        200 {status:"completed"|"already_complete", manifest} · 409 chunks missing or content mismatch
 *
 * Every request is idempotent: a retry after a lost response gets the same outcome, never a second
 * copy. The server writes `logs/sessions/<sessionId>.jsonl` — the session file's lines followed by
 * one manifest line — only when every chunk is in and the content matches the client's line count
 * and SHA-256.
 *
 * Checkpoints (9 Oct 2026, `session-checkpoint.ts`): so an abandoned session is not lost, the browser
 * also appends what it has logged so far at boundaries outside the run (a freeze, the training, the
 * hinge, the post-session questionnaire and debrief — never while `RUNNING`):
 *
 *   PUT  /api/session-log/<sessionId>/partial?from=<n>&at=<label>   body: lines n.. of the session
 *        file, each followed by "\n"; header `x-chunk-sha256`
 *        200 {status:"stored", lines} · 200 {status:"already_complete"} · 409 {error, lines} when `from`
 *        is not the server's line count (the browser continues from `lines`) · 400 · 413
 *
 * The server keeps `<sessionId>.partial.jsonl` (no manifest line: it is not a finished file) and
 * `<sessionId>.partial.json` (lines, sha256, last checkpoint); the completed upload removes both.
 */

export const SESSION_LOG_ENDPOINT = "/api/session-log";

/** A session id: 8–64 characters from `[A-Za-z0-9_-]`, starting with a letter or digit (no dots, no slashes: it names a file). */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

/** Lines per chunk the browser sends; the server's limits below are what it enforces. */
export const LINES_PER_CHUNK = 500;
/** One chunk's body, bytes. */
export const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
/** Chunks per session. */
export const MAX_CHUNKS = 1000;
/** A whole session file, bytes (a full session is a few MB at most). */
export const MAX_SESSION_BYTES = 64 * 1024 * 1024;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && SESSION_ID_PATTERN.test(id);
}

export interface CompleteRequest {
  readonly totalChunks: number;
  /** Lines in the session file (header line + records), without the manifest line. */
  readonly lines: number;
  /** SHA-256 hex of the session file's text (`lines` joined by "\n", with a final "\n"). */
  readonly sha256: string;
}

export const HEX64 = /^[0-9a-f]{64}$/;

export function sessionChunkPath(sessionId: string, index: number, total: number): string {
  return `${SESSION_LOG_ENDPOINT}/${encodeURIComponent(sessionId)}/chunks/${index}?total=${total}`;
}

export function sessionCompletePath(sessionId: string): string {
  return `${SESSION_LOG_ENDPOINT}/${encodeURIComponent(sessionId)}/complete`;
}

/** A checkpoint's label (`freeze_v3`, `hinge`, …): recorded in the partial manifest, never a path. */
export const CHECKPOINT_LABEL = /^[a-z0-9_]{1,32}$/;

export function sessionPartialPath(sessionId: string, from: number, label: string): string {
  return `${SESSION_LOG_ENDPOINT}/${encodeURIComponent(sessionId)}/partial?from=${from}&at=${encodeURIComponent(label)}`;
}
