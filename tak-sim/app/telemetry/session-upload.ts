/**
 * Uploads a finished session (SPEC/05 §9): the session file's lines in chunks through the existing
 * {@link UploadQueue}, then the completion request carrying the line count and SHA-256 the server
 * checks the reassembled file against. Invariant I3: refuses to start unless the engine is in
 * `COMPLETE` — the upload is never part of the run.
 */

import type { EngineState } from "../engine/freeze-machine.js";
import type { LogHeader, LogRecord } from "./log.js";
import { linesText, sessionFileLines } from "./session-file.js";
import { LINES_PER_CHUNK } from "./session-log-protocol.js";
import { sha256Hex } from "./sha256.js";
import { HttpUploader, type HttpUploaderOptions } from "./http-uploader.js";
import { chunkPayload, UploadQueue, type Uploader, type UploadQueueOptions } from "./upload-queue.js";

export class UploadBeforeCompleteError extends Error {
  constructor(state: EngineState) {
    super(`The session log is uploaded only after COMPLETE (I3); the engine is in ${state}`);
    this.name = "UploadBeforeCompleteError";
  }
}

export interface SessionUploadInput {
  readonly engineState: EngineState;
  readonly header: LogHeader;
  readonly records: readonly LogRecord[];
}

export interface SessionUploadOptions extends UploadQueueOptions {
  /** Defaults to an {@link HttpUploader} to the page's own origin. */
  readonly uploader?: (complete: { totalChunks: number; lines: number; sha256: string }) => Uploader;
  readonly http?: HttpUploaderOptions;
  readonly linesPerChunk?: number;
  /** Attempts at the completion request (the queue retries each chunk itself). */
  readonly completeAttempts?: number;
}

/** Wraps an uploader so `markComplete` is retried like a chunk (a lost response is safe: the server's completion is idempotent). */
function retryingComplete(inner: Uploader, attempts: number, sleep: (ms: number) => Promise<void>, delay: (attempt: number) => number): Uploader {
  return {
    uploadChunk: (sessionId, chunk) => inner.uploadChunk(sessionId, chunk),
    async markComplete(sessionId) {
      let last: unknown;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await sleep(delay(attempt));
        try { await inner.markComplete(sessionId); return; } catch (e) { last = e; }
      }
      throw last;
    },
  };
}

/** Uploads the session; resolves once the server has written the file and its manifest. Throws on failure (the caller offers the export). */
export async function uploadSession(input: SessionUploadInput, options: SessionUploadOptions = {}): Promise<void> {
  if (input.engineState !== "COMPLETE") throw new UploadBeforeCompleteError(input.engineState);
  const lines = sessionFileLines(input.header, input.records);
  const chunks = chunkPayload(lines, options.linesPerChunk ?? LINES_PER_CHUNK);
  const complete = { totalChunks: chunks.length, lines: lines.length, sha256: sha256Hex(linesText(lines)) };
  const inner = options.uploader ? options.uploader(complete) : new HttpUploader(complete, options.http ?? {});
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = options.retryDelayMs ?? ((attempt: number) => 500 * 2 ** attempt);
  const uploader = retryingComplete(inner, options.completeAttempts ?? 3, sleep, delay);
  await new UploadQueue(uploader, input.header.sessionId, chunks, { ...options, sleep, retryDelayMs: delay }).run();
}
