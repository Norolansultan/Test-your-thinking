/**
 * The {@link Uploader} over HTTP to the study's own server (`session-log-protocol.ts`). Used only by
 * `session-upload.ts`, which refuses to start before the engine reaches `COMPLETE` (I3: no network
 * during the run except the Thinker proxy).
 */

import { sessionChunkPath, sessionCompletePath, type CompleteRequest } from "./session-log-protocol.js";
import { sha256Hex } from "./sha256.js";
import type { UploadChunk, Uploader } from "./upload-queue.js";

export type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class UploadHttpError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`session-log upload answered HTTP ${status}`);
    this.name = "UploadHttpError";
  }
}

export interface HttpUploaderOptions {
  /** The server's origin; empty for the page's own origin (the deployment's default). */
  readonly baseUrl?: string;
  /** Injected in tests; the browser's `fetch` by default. */
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

export class HttpUploader implements Uploader {
  private readonly baseUrl: string;
  private readonly doFetch: FetchLike;
  private readonly timeoutMs: number;

  /** `complete` is what the server checks the reassembled file against (line count and SHA-256). */
  constructor(private readonly complete: CompleteRequest, options: HttpUploaderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    // determinism-lint-allow: SPEC/05 §9 post-hoc upload — called only after COMPLETE (`session-upload.ts` checks), never in the run loop (I3).
    this.doFetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private async send(path: string, method: string, headers: Record<string, string>, body: string): Promise<unknown> {
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const res = await this.doFetch(`${this.baseUrl}${path}`, { method, headers, body, ...(controller ? { signal: controller.signal } : {}) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new UploadHttpError(res.status, json);
      return json;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async uploadChunk(sessionId: string, chunk: UploadChunk): Promise<void> {
    await this.send(sessionChunkPath(sessionId, chunk.index, chunk.totalChunks), "PUT",
      { "content-type": "application/x-ndjson; charset=utf-8", "x-chunk-sha256": sha256Hex(chunk.payload) }, chunk.payload);
  }

  async markComplete(sessionId: string): Promise<void> {
    await this.send(sessionCompletePath(sessionId), "POST", { "content-type": "application/json" }, JSON.stringify(this.complete));
  }
}
