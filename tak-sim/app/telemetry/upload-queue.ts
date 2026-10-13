/**
 * The resumable, chunked telemetry upload queue — SPEC/05_System_Architecture.md
 * §9: "Upload is resumable and post-hoc. After `COMPLETE`, the session
 * file is uploaded in chunks with retry. If the upload cannot complete,
 * the participant is shown a one-click export... Nothing is lost because
 * the network failed." And invariant I3 (SPEC/00 §3): "Telemetry uploads
 * occur only after the run" — this module is never invoked from the live
 * run loop.
 *
 * The actual transport is an injected {@link Uploader}. A real backend
 * endpoint is blocked on the hosting/DPIA decision (SPEC/11 §1.5 —
 * "pilot 1 already transmits real participant data" and needs an EU
 * hosting agreement first); what's specified and testable now is the
 * queue mechanics — chunking, retry, and resumability from wherever a
 * prior attempt left off — against that abstraction.
 */

export interface UploadChunk {
  readonly index: number;
  readonly totalChunks: number;
  readonly payload: string;
}

export interface Uploader {
  uploadChunk(sessionId: string, chunk: UploadChunk): Promise<void>;
  markComplete(sessionId: string): Promise<void>;
}

export class UploadIncompleteError extends Error {
  constructor(
    readonly failedChunkIndex: number,
    override readonly cause: unknown,
  ) {
    super(`Upload failed at chunk ${failedChunkIndex} after all retries`);
    this.name = "UploadIncompleteError";
  }
}

/** Splits serialised records into fixed-size chunks. One line (one record) per array entry in, joined with "\n" per chunk — matches the JSONL log format (SPEC/04 §10). */
export function chunkPayload(lines: readonly string[], maxLinesPerChunk: number): UploadChunk[] {
  if (maxLinesPerChunk <= 0) {
    throw new RangeError(`maxLinesPerChunk must be positive, got ${maxLinesPerChunk}`);
  }
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
    chunks.push(lines.slice(i, i + maxLinesPerChunk));
  }
  if (chunks.length === 0) chunks.push([]); // an empty session still uploads one (empty) chunk, so markComplete has something to follow
  const totalChunks = chunks.length;
  return chunks.map((linesInChunk, index) => ({ index, totalChunks, payload: linesInChunk.join("\n") }));
}

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UploadQueueOptions {
  readonly maxRetriesPerChunk?: number;
  readonly retryDelayMs?: (attempt: number) => number;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Chunk indices already confirmed uploaded in a prior attempt — the resumability entry point. Pass `queue.progress()` from a previous, interrupted run. */
  readonly alreadyUploaded?: ReadonlySet<number>;
}

export class UploadQueue {
  private readonly uploadedChunkIndices: Set<number>;
  private readonly maxRetriesPerChunk: number;
  private readonly retryDelayMs: (attempt: number) => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly uploader: Uploader,
    private readonly sessionId: string,
    private readonly chunks: readonly UploadChunk[],
    options: UploadQueueOptions = {},
  ) {
    this.uploadedChunkIndices = new Set(options.alreadyUploaded ?? []);
    this.maxRetriesPerChunk = options.maxRetriesPerChunk ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? ((attempt) => 100 * 2 ** attempt);
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Chunk indices confirmed uploaded so far — pass to a later `UploadQueueOptions.alreadyUploaded` to resume. */
  progress(): ReadonlySet<number> {
    return new Set(this.uploadedChunkIndices);
  }

  isComplete(): boolean {
    return this.uploadedChunkIndices.size === this.chunks.length;
  }

  /**
   * Uploads every chunk not already confirmed, skipping ones `progress()`
   * already covers — the resume path. Each chunk is retried up to
   * `maxRetriesPerChunk` times before giving up; on final failure, throws
   * {@link UploadIncompleteError} immediately (does not attempt later
   * chunks out of order — SPEC/05 §9 does not describe out-of-order
   * upload, and doing so would make "resume from where it left off"
   * ambiguous). `progress()` reflects exactly what succeeded, so calling
   * `run()` again later — after the participant's connection recovers —
   * resumes cleanly.
   */
  async run(): Promise<void> {
    for (const chunk of this.chunks) {
      if (this.uploadedChunkIndices.has(chunk.index)) continue;

      let lastError: unknown;
      let succeeded = false;
      for (let attempt = 0; attempt < this.maxRetriesPerChunk && !succeeded; attempt++) {
        if (attempt > 0) {
          await this.sleep(this.retryDelayMs(attempt));
        }
        try {
          await this.uploader.uploadChunk(this.sessionId, chunk);
          succeeded = true;
        } catch (e) {
          lastError = e;
        }
      }

      if (!succeeded) {
        throw new UploadIncompleteError(chunk.index, lastError);
      }
      this.uploadedChunkIndices.add(chunk.index);
    }
    await this.uploader.markComplete(this.sessionId);
  }
}
