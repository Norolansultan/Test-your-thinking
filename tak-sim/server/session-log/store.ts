/**
 * The session-log store (SPEC/05 §9; protocol in `app/telemetry/session-log-protocol.ts`).
 *
 * Layout under the log directory (default `logs/sessions/`, gitignored):
 *
 *   <sessionId>.parts/meta.json         {"totalChunks": n}, fixed by the first chunk
 *   <sessionId>.parts/<index>.chunk     each chunk's text, written to a temp file and renamed
 *   <sessionId>.jsonl                   the finished session file + one manifest line
 *   <sessionId>.partial.jsonl           a checkpoint (9 Oct 2026): the session file's lines so far, no
 *                                       manifest line; appended at boundaries outside the run
 *   <sessionId>.partial.json            its manifest: {format, lines, records, sha256, checkpoint, …}
 *
 * Idempotency: a chunk already stored with the same bytes is a `duplicate` (200); with different
 * bytes, a conflict (409) — a session's data is never overwritten. Completion re-assembles the chunks
 * in order, checks the client's line count and SHA-256, appends the manifest line, writes the file
 * atomically (temp + rename) and removes the parts; a repeated completion with the same line count
 * and hash answers `already_complete` with the stored manifest.
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CHECKPOINT_LABEL, HEX64, isValidSessionId, MAX_CHUNK_BYTES, MAX_CHUNKS, MAX_SESSION_BYTES, type CompleteRequest } from "../../app/telemetry/session-log-protocol.js";
import { manifestLine, SESSION_FILE_FORMAT, type SessionManifest } from "../../app/telemetry/session-file.js";

export type StoreResult =
  | { readonly status: 200; readonly body: { readonly status: "stored" | "duplicate" | "already_complete" } }
  | { readonly status: 200; readonly body: { readonly status: "completed" | "already_complete"; readonly manifest: SessionManifest } }
  | { readonly status: 200; readonly body: { readonly status: "stored"; readonly lines: number } }
  /** `lines` on a checkpoint's 409: the server's line count, where the browser continues. */
  | { readonly status: 400 | 409 | 413; readonly body: { readonly error: string; readonly lines?: number } };

export const PARTIAL_FORMAT = "fire-sim-session-partial/1";

/** `<sessionId>.partial.json`: what a checkpoint holds (the admin listing reads it). */
export interface PartialManifest {
  readonly format: typeof PARTIAL_FORMAT;
  readonly sessionId: string;
  readonly lines: number;
  readonly records: number;
  /** SHA-256 of `<sessionId>.partial.jsonl` as stored (every line followed by "\n"). */
  readonly sha256: string;
  /** The last checkpoint's label (`freeze_v5`, `hinge`, …) and how many have been stored. */
  readonly checkpoint: string;
  readonly checkpoints: number;
  readonly updatedAtIso: string;
}

/** Highest `from` a checkpoint may name (a full session is a few thousand lines). */
const MAX_PARTIAL_LINES = 1_000_000;

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const bad = (status: 400 | 409 | 413, error: string): StoreResult => ({ status, body: { error } });

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function writeAtomic(path: string, data: string | Buffer): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  await writeFile(tmp, data, { flag: "wx" });
  await rename(tmp, path);
}

export interface SessionLogStoreOptions {
  readonly dir: string;
  /** The server's wall clock for the manifest (injected in tests). */
  readonly nowIso?: () => string;
}

export class SessionLogStore {
  private readonly dir: string;
  private readonly nowIso: () => string;
  /** Serialises work per session in this process, so a retry racing its original cannot interleave. */
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(options: SessionLogStoreOptions) {
    this.dir = options.dir;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
  }

  private locked<T>(sessionId: string, work: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) ?? Promise.resolve();
    const next = prev.then(work, work);
    this.locks.set(sessionId, next.catch(() => undefined));
    return next;
  }

  finalPath(sessionId: string): string { return join(this.dir, `${sessionId}.jsonl`); }
  partialPath(sessionId: string): string { return join(this.dir, `${sessionId}.partial.jsonl`); }
  partialManifestPath(sessionId: string): string { return join(this.dir, `${sessionId}.partial.json`); }
  private partsDir(sessionId: string): string { return join(this.dir, `${sessionId}.parts`); }

  async putChunk(sessionId: string, index: number, total: number, body: Buffer, declaredSha256: string | undefined): Promise<StoreResult> {
    if (!isValidSessionId(sessionId)) return bad(400, "invalid session id");
    if (!Number.isInteger(total) || total < 1 || total > MAX_CHUNKS) return bad(400, `total must be 1..${MAX_CHUNKS}`);
    if (!Number.isInteger(index) || index < 0 || index >= total) return bad(400, "chunk index out of range");
    if (body.length > MAX_CHUNK_BYTES) return bad(413, "chunk too large");
    if (declaredSha256 === undefined || !HEX64.test(declaredSha256)) return bad(400, "missing or malformed x-chunk-sha256");
    if (sha256(body) !== declaredSha256) return bad(400, "chunk hash mismatch");
    return this.locked(sessionId, async () => {
      if (await exists(this.finalPath(sessionId))) return { status: 200, body: { status: "already_complete" } } as const;
      const parts = this.partsDir(sessionId);
      await mkdir(parts, { recursive: true });
      const metaPath = join(parts, "meta.json");
      if (await exists(metaPath)) {
        const meta = JSON.parse(await readFile(metaPath, "utf8")) as { totalChunks: number };
        if (meta.totalChunks !== total) return bad(409, `total ${total} differs from the session's ${meta.totalChunks}`);
      } else {
        await writeAtomic(metaPath, JSON.stringify({ totalChunks: total }));
      }
      const chunkPath = join(parts, `${index}.chunk`);
      if (await exists(chunkPath)) {
        const stored = await readFile(chunkPath);
        return stored.equals(body) ? ({ status: 200, body: { status: "duplicate" } } as const) : bad(409, "a different chunk is already stored at this index");
      }
      // The session's size so far, this chunk included, stays under the limit.
      let size = body.length;
      for (const name of await readdir(parts)) if (name.endsWith(".chunk")) size += (await stat(join(parts, name))).size;
      if (size > MAX_SESSION_BYTES) return bad(413, "session too large");
      await writeAtomic(chunkPath, body);
      return { status: 200, body: { status: "stored" } } as const;
    });
  }

  async complete(sessionId: string, request: unknown): Promise<StoreResult> {
    if (!isValidSessionId(sessionId)) return bad(400, "invalid session id");
    const r = request as Partial<CompleteRequest> | null;
    if (!r || typeof r !== "object" || !Number.isInteger(r.totalChunks) || !Number.isInteger(r.lines) || typeof r.sha256 !== "string" || !HEX64.test(r.sha256)
      || r.totalChunks! < 1 || r.totalChunks! > MAX_CHUNKS || r.lines! < 1) return bad(400, "invalid completion request");
    const req = r as CompleteRequest;
    return this.locked(sessionId, async () => {
      const final = this.finalPath(sessionId);
      if (await exists(final)) {
        const text = await readFile(final, "utf8");
        const lastLine = text.trimEnd().split("\n").pop()!;
        const manifest = (JSON.parse(lastLine) as { manifest: SessionManifest }).manifest;
        if (manifest.sha256 === req.sha256 && manifest.lines === req.lines) return { status: 200, body: { status: "already_complete", manifest } } as const;
        return bad(409, "the session is already stored with different content");
      }
      const parts = this.partsDir(sessionId);
      const chunks: Buffer[] = [];
      for (let i = 0; i < req.totalChunks; i++) {
        const p = join(parts, `${i}.chunk`);
        if (!(await exists(p))) return bad(409, `chunk ${i} missing`);
        chunks.push(await readFile(p));
      }
      if (await exists(join(parts, "meta.json"))) {
        const meta = JSON.parse(await readFile(join(parts, "meta.json"), "utf8")) as { totalChunks: number };
        if (meta.totalChunks !== req.totalChunks) return bad(409, "totalChunks differs from the uploaded chunks");
      }
      const body = `${chunks.map((c) => c.toString("utf8")).join("\n")}\n`;
      const lines = body.split("\n").length - 1;
      if (lines !== req.lines) return bad(409, `line count ${lines} differs from the declared ${req.lines}`);
      if (sha256(body) !== req.sha256) return bad(409, "content hash differs from the declared sha256");
      // Each line must be JSON; the first is the header with this session's id.
      try {
        const first = JSON.parse(body.slice(0, body.indexOf("\n"))) as { header?: { sessionId?: unknown } };
        if (first.header?.sessionId !== sessionId) return bad(409, "the file's header names another session");
        for (const line of body.split("\n").slice(1, -1)) JSON.parse(line);
      } catch {
        return bad(400, "a line is not JSON");
      }
      const manifest: SessionManifest = {
        format: SESSION_FILE_FORMAT, sessionId, lines, records: lines - 1, sha256: req.sha256, writtenBy: "server",
        chunks: req.totalChunks, completedAtIso: this.nowIso(),
      };
      await mkdir(this.dir, { recursive: true });
      await writeAtomic(final, `${body}${manifestLine(manifest)}\n`);
      await rm(parts, { recursive: true, force: true });
      // The finished file supersedes the checkpoints (it holds every line they held, and more).
      await rm(this.partialPath(sessionId), { force: true });
      await rm(this.partialManifestPath(sessionId), { force: true });
      return { status: 200, body: { status: "completed", manifest } } as const;
    });
  }

  /** Appends a checkpoint's lines (`from` onwards) to `<sessionId>.partial.jsonl`; see the header comment. */
  async putPartial(sessionId: string, from: number, label: string, body: Buffer, declaredSha256: string | undefined): Promise<StoreResult> {
    if (!isValidSessionId(sessionId)) return bad(400, "invalid session id");
    if (!Number.isInteger(from) || from < 0 || from > MAX_PARTIAL_LINES) return bad(400, "from must be a line count");
    if (!CHECKPOINT_LABEL.test(label)) return bad(400, "invalid checkpoint label");
    if (body.length > MAX_CHUNK_BYTES) return bad(413, "chunk too large");
    if (declaredSha256 === undefined || !HEX64.test(declaredSha256)) return bad(400, "missing or malformed x-chunk-sha256");
    if (sha256(body) !== declaredSha256) return bad(400, "chunk hash mismatch");
    const text = body.toString("utf8");
    if (text.length === 0 || !text.endsWith("\n")) return bad(400, "the body must be whole lines, each ending in a newline");
    const lines = text.slice(0, -1).split("\n");
    try {
      lines.forEach((line, i) => {
        const at = from + i;
        const parsed = JSON.parse(line) as { header?: { sessionId?: unknown }; seq?: unknown };
        if (at === 0 ? parsed.header?.sessionId !== sessionId : parsed.seq !== at - 1) throw new Error(`line ${at}`);
      });
    } catch {
      return bad(400, "a line is not the next line of this session's file (JSON, header first, seq gapless)");
    }
    return this.locked(sessionId, async () => {
      if (await exists(this.finalPath(sessionId))) return { status: 200, body: { status: "already_complete" } } as const;
      const path = this.partialPath(sessionId);
      const stored = (await exists(path)) ? await readFile(path) : Buffer.alloc(0);
      let storedLines = 0;
      for (const byte of stored) if (byte === 0x0a) storedLines++;
      if (from !== storedLines) return { status: 409, body: { error: `the checkpoint holds ${storedLines} lines, not ${from}`, lines: storedLines } } as const;
      if (stored.length + body.length > MAX_SESSION_BYTES) return bad(413, "session too large");
      const whole = Buffer.concat([stored, body]);
      let previous = 0;
      try { previous = (JSON.parse(await readFile(this.partialManifestPath(sessionId), "utf8")) as PartialManifest).checkpoints; } catch { /* the first checkpoint */ }
      const total = storedLines + lines.length;
      const manifest: PartialManifest = {
        format: PARTIAL_FORMAT, sessionId, lines: total, records: total - 1, sha256: sha256(whole),
        checkpoint: label, checkpoints: previous + 1, updatedAtIso: this.nowIso(),
      };
      await mkdir(this.dir, { recursive: true });
      // The lines first: a crash before the manifest leaves a correct file whose manifest lags (the file is the truth).
      await writeAtomic(path, whole);
      await writeAtomic(this.partialManifestPath(sessionId), JSON.stringify(manifest));
      return { status: 200, body: { status: "stored", lines: total } } as const;
    });
  }
}
