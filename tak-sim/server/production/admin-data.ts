/**
 * The researcher's view of the collected data (docs/DEPLOYMENT.md §6), shared by the admin routes
 * (`admin.ts`) and the local export (`npm run sessions:export`, `tools/deploy/export-sessions.ts`):
 *
 *   listSessions   one row per session id found in the session-log directory or the Thinker log
 *                  directory: participant code and cell (from the file's header), status, records,
 *                  last write, whether the upload completed, the last checkpoint
 *   sessionFiles   the files that belong to one id (finished file, checkpoint, its manifest, Thinker log)
 *   tarArchive     every file as one uncompressed ustar archive, written here (no dependency), streamed
 *                  file by file so memory stays at one file
 *
 * File names come from `readdir` and are kept only when the id matches the upload's own pattern
 * (`isValidSessionId`: no dots, no separators), so nothing outside the two directories is ever named.
 * The headers inside the files were written by browsers (the upload is unauthenticated): they are data,
 * escaped wherever they are shown.
 */

import { open, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { isValidSessionId } from "../../app/telemetry/session-log-protocol.js";
import type { SessionManifest } from "../../app/telemetry/session-file.js";
import type { PartialManifest } from "../session-log/store.js";

/** The Thinker proxy's log directory under the app (`LOG_DIR` in `server/thinker/deps.ts`, which loads the model stack; a test keeps them equal). */
export const THINKER_LOG_DIR = "logs/thinker";

export interface AdminDirs {
  /** SESSION_LOG_DIR: `<id>.jsonl`, `<id>.partial.jsonl`, `<id>.partial.json`, `<id>.parts/`. */
  readonly sessionLogDir: string;
  /** `logs/thinker/`: `<id>.jsonl` per session (the Thinker proxy's log). */
  readonly thinkerLogDir: string;
}

/**
 * complete: the upload finished (`<id>.jsonl` with its manifest); partial: only checkpoints (the
 * session was abandoned, or is still running); uploading: chunks arrived but no completion yet;
 * thinker_only: a Thinker log and no session data at all.
 */
export type SessionStatusOnServer = "complete" | "partial" | "uploading" | "thinker_only";

export interface SessionRow {
  readonly sessionId: string;
  readonly participantCode: string | null;
  readonly cell: string | null;
  readonly status: SessionStatusOnServer;
  readonly uploadComplete: boolean;
  /** Log records (lines after the header) in the finished file, else in the checkpoint. */
  readonly records: number | null;
  readonly lastCheckpoint: string | null;
  /** The newest modification time among the session's files (server clock). */
  readonly lastWriteIso: string | null;
  readonly thinkerLogBytes: number | null;
}

export interface SessionFile {
  /** Path inside the archive (and under the export directory): `sessions/…` or `thinker/…`. */
  readonly archivePath: string;
  readonly path: string;
  readonly mtimeSeconds: number;
}

const FINAL = /^([A-Za-z0-9][A-Za-z0-9_-]{7,63})\.jsonl$/;
const PARTIAL = /^([A-Za-z0-9][A-Za-z0-9_-]{7,63})\.partial\.jsonl$/;
const PARTS = /^([A-Za-z0-9][A-Za-z0-9_-]{7,63})\.parts$/;

async function names(dir: string): Promise<string[]> {
  try { return await readdir(dir); } catch { return []; }
}

async function statOrNull(path: string) {
  try { return await stat(path); } catch { return null; }
}

/** The first line of a file (the header), read from its first 64 KB. */
async function firstLine(path: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, "r");
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    const end = text.indexOf("\n");
    return end < 0 ? null : text.slice(0, end);
  } catch { return null; } finally { await handle?.close(); }
}

/** The last line of a file (the manifest of a finished one), read from its last 64 KB. */
async function lastLine(path: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, "r");
    const { size } = await handle.stat();
    const length = Math.min(size, 64 * 1024);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const lines = buffer.toString("utf8").trimEnd().split("\n");
    return lines[lines.length - 1] ?? null;
  } catch { return null; } finally { await handle?.close(); }
}

function headerOf(line: string | null): { participantCode: string | null; cell: string | null } {
  try {
    const header = (JSON.parse(line ?? "") as { header?: { participantCode?: unknown; cell?: unknown } }).header;
    return { participantCode: typeof header?.participantCode === "string" ? header.participantCode : null, cell: typeof header?.cell === "string" ? header.cell : null };
  } catch { return { participantCode: null, cell: null }; }
}

/** Every session id present in either directory, sorted. */
export async function sessionIds(dirs: AdminDirs): Promise<string[]> {
  const ids = new Set<string>();
  for (const name of await names(dirs.sessionLogDir)) {
    const m = PARTIAL.exec(name) ?? FINAL.exec(name) ?? PARTS.exec(name);
    if (m && isValidSessionId(m[1])) ids.add(m[1]!);
  }
  for (const name of await names(dirs.thinkerLogDir)) {
    const m = FINAL.exec(name);
    if (m && isValidSessionId(m[1])) ids.add(m[1]!);
  }
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function sessionRow(dirs: AdminDirs, sessionId: string): Promise<SessionRow> {
  const finalPath = join(dirs.sessionLogDir, `${sessionId}.jsonl`);
  const partialPath = join(dirs.sessionLogDir, `${sessionId}.partial.jsonl`);
  const [finalStat, partialStat, partsStat, thinkerStat] = await Promise.all([
    statOrNull(finalPath), statOrNull(partialPath), statOrNull(join(dirs.sessionLogDir, `${sessionId}.parts`)),
    statOrNull(join(dirs.thinkerLogDir, `${sessionId}.jsonl`)),
  ]);
  const newest = [finalStat, partialStat, partsStat, thinkerStat].reduce((m, s) => (s && s.mtimeMs > m ? s.mtimeMs : m), 0);
  let records: number | null = null;
  let lastCheckpoint: string | null = null;
  if (finalStat) {
    try { records = (JSON.parse((await lastLine(finalPath)) ?? "") as { manifest: SessionManifest }).manifest.records; } catch { /* a damaged file: no count */ }
  }
  if (partialStat) {
    try {
      const m = JSON.parse(await readFile(join(dirs.sessionLogDir, `${sessionId}.partial.json`), "utf8")) as PartialManifest;
      lastCheckpoint = m.checkpoint;
      if (records === null) records = m.records;
    } catch { /* the manifest lags or is missing: the file is still listed */ }
  }
  const status: SessionStatusOnServer = finalStat ? "complete" : partialStat ? "partial" : partsStat ? "uploading" : "thinker_only";
  const head = headerOf(await firstLine(finalStat ? finalPath : partialPath));
  return {
    sessionId, ...head, status, uploadComplete: finalStat !== null, records, lastCheckpoint,
    lastWriteIso: newest > 0 ? new Date(newest).toISOString() : null, thinkerLogBytes: thinkerStat ? thinkerStat.size : null,
  };
}

export async function listSessions(dirs: AdminDirs): Promise<SessionRow[]> {
  return Promise.all((await sessionIds(dirs)).map((id) => sessionRow(dirs, id)));
}

/** The files of one session that exist, in archive order. Null for an id that is not a session id. */
export async function sessionFiles(dirs: AdminDirs, sessionId: string): Promise<SessionFile[] | null> {
  if (!isValidSessionId(sessionId)) return null;
  const candidates: Omit<SessionFile, "mtimeSeconds">[] = [
    { archivePath: `sessions/${sessionId}.jsonl`, path: join(dirs.sessionLogDir, `${sessionId}.jsonl`) },
    { archivePath: `sessions/${sessionId}.partial.jsonl`, path: join(dirs.sessionLogDir, `${sessionId}.partial.jsonl`) },
    { archivePath: `sessions/${sessionId}.partial.json`, path: join(dirs.sessionLogDir, `${sessionId}.partial.json`) },
    { archivePath: `thinker/${sessionId}.jsonl`, path: join(dirs.thinkerLogDir, `${sessionId}.jsonl`) },
  ];
  const present: SessionFile[] = [];
  for (const f of candidates) {
    const s = await statOrNull(f.path);
    if (s?.isFile()) present.push({ ...f, mtimeSeconds: s.mtimeMs / 1000 });
  }
  return present;
}

// ---- ustar (POSIX.1-1988) ------------------------------------------------------------------------

const BLOCK = 512;

function octal(value: number, width: number): string {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

/** One 512-byte ustar header for a regular file. `name` is ASCII and at most 100 bytes (ours are ≤ 90). */
export function tarHeader(name: string, size: number, mtimeSeconds: number): Buffer {
  if (Buffer.byteLength(name) > 100 || /[^\x20-\x7e]/.test(name)) throw new Error(`tar: unsupported name ${name}`);
  const h = Buffer.alloc(BLOCK, 0);
  h.write(name, 0, "ascii");
  h.write(octal(0o600, 8), 100, "ascii"); // mode: the owner only (participant data)
  h.write(octal(0, 8), 108, "ascii"); // uid
  h.write(octal(0, 8), 116, "ascii"); // gid
  h.write(octal(size, 12), 124, "ascii");
  h.write(octal(Math.max(0, Math.floor(mtimeSeconds)), 12), 136, "ascii");
  h.write("        ", 148, "ascii"); // the checksum field counts as spaces while summing
  h.write("0", 156, "ascii"); // a regular file
  h.write("ustar\0", 257, "ascii");
  h.write("00", 263, "ascii");
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return h;
}

export interface TarEntry {
  readonly name: string;
  /** Null when the file disappeared before it was read (a completion removing a checkpoint): the entry is left out. */
  readonly data: () => Promise<Buffer | null>;
  readonly mtimeSeconds: number;
}

/** The archive as a stream of buffers: per entry its header, its bytes and the padding; two zero blocks at the end. */
export async function* tarStream(entries: Iterable<TarEntry> | AsyncIterable<TarEntry>): AsyncGenerator<Buffer> {
  for await (const entry of entries) {
    const data = await entry.data();
    if (data === null) continue;
    yield tarHeader(entry.name, data.length, entry.mtimeSeconds);
    yield data;
    const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (pad > 0) yield Buffer.alloc(pad, 0);
  }
  yield Buffer.alloc(BLOCK * 2, 0);
}

/** Everything the researcher needs: `index.json` (the listing) first, then each session's files. */
export async function* exportEntries(dirs: AdminDirs): AsyncGenerator<TarEntry> {
  const rows = await listSessions(dirs);
  yield { name: "index.json", data: async () => Buffer.from(`${JSON.stringify(rows, null, 2)}\n`), mtimeSeconds: Math.floor(Math.max(0, ...rows.map((r) => (r.lastWriteIso ? Date.parse(r.lastWriteIso) / 1000 : 0)))) };
  // The shared link's issued codes (`auto-assign.ts`, revision (af)), when the server issued any.
  const issuedPath = join(dirs.sessionLogDir, "issued-codes.json");
  const issued = await statOrNull(issuedPath);
  if (issued?.isFile()) yield { name: "issued-codes.json", data: () => readFile(issuedPath).catch(() => null), mtimeSeconds: issued.mtimeMs / 1000 };
  for (const row of rows) {
    // A file removed meanwhile (a completion superseding a checkpoint) reads as null and is left out.
    for (const file of (await sessionFiles(dirs, row.sessionId)) ?? []) yield { name: file.archivePath, data: () => readFile(file.path).catch(() => null), mtimeSeconds: file.mtimeSeconds };
  }
}
