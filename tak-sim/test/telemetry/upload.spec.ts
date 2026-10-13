/**
 * SPEC/10_Build_Plan_and_Acceptance.md, M4: "`test/telemetry/upload.spec`
 * interrupts the upload at three points and asserts completion."
 */

import { describe, expect, it } from "vitest";
import { UploadIncompleteError, UploadQueue, chunkPayload, type Uploader } from "../../app/telemetry/upload-queue.js";

const NO_DELAY = { sleep: async () => {} };

function linesFor(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `record-${i}`);
}

/** Fails uploadChunk for the given chunk indices on their first N calls, then succeeds — models a flaky connection. */
class FlakyUploader implements Uploader {
  readonly calls: number[] = [];
  readonly completedSessions: string[] = [];
  private readonly remainingFailures: Map<number, number>;

  constructor(failuresPerChunk: ReadonlyMap<number, number> = new Map()) {
    this.remainingFailures = new Map(failuresPerChunk);
  }

  async uploadChunk(_sessionId: string, chunk: { index: number }): Promise<void> {
    this.calls.push(chunk.index);
    const remaining = this.remainingFailures.get(chunk.index) ?? 0;
    if (remaining > 0) {
      this.remainingFailures.set(chunk.index, remaining - 1);
      throw new Error(`simulated network failure on chunk ${chunk.index}`);
    }
  }

  async markComplete(sessionId: string): Promise<void> {
    this.completedSessions.push(sessionId);
  }
}

/** Always fails a given chunk, permanently — models a connection that drops entirely partway through. */
class DiesAtChunkUploader implements Uploader {
  readonly calls: number[] = [];
  readonly completedSessions: string[] = [];
  constructor(private readonly dieAtIndex: number) {}

  async uploadChunk(_sessionId: string, chunk: { index: number }): Promise<void> {
    this.calls.push(chunk.index);
    if (chunk.index === this.dieAtIndex) {
      throw new Error(`connection dropped at chunk ${chunk.index}`);
    }
  }

  async markComplete(sessionId: string): Promise<void> {
    this.completedSessions.push(sessionId);
  }
}

describe("chunkPayload", () => {
  it("splits into fixed-size chunks", () => {
    const chunks = chunkPayload(linesFor(25), 10);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.payload.split("\n")).toHaveLength(10);
    expect(chunks[2]!.payload.split("\n")).toHaveLength(5);
    expect(chunks.every((c) => c.totalChunks === 3)).toBe(true);
  });

  it("produces one empty chunk for an empty session, rather than zero chunks", () => {
    const chunks = chunkPayload([], 10);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.payload).toBe("");
  });

  it("rejects a non-positive chunk size", () => {
    expect(() => chunkPayload(linesFor(1), 0)).toThrow(RangeError);
  });
});

describe("UploadQueue — retries transient failures and completes", () => {
  it("retries a chunk that fails once, then succeeds", async () => {
    const uploader = new FlakyUploader(new Map([[1, 1]])); // chunk 1 fails once, then succeeds
    const chunks = chunkPayload(linesFor(30), 10);
    const queue = new UploadQueue(uploader, "session-1", chunks, NO_DELAY);
    await queue.run();
    expect(queue.isComplete()).toBe(true);
    expect(uploader.completedSessions).toEqual(["session-1"]);
  });

  it("gives up after maxRetriesPerChunk and throws UploadIncompleteError, leaving partial progress intact", async () => {
    const uploader = new FlakyUploader(new Map([[1, 10]])); // chunk 1 always fails within the retry budget
    const chunks = chunkPayload(linesFor(30), 10);
    const queue = new UploadQueue(uploader, "session-1", chunks, { ...NO_DELAY, maxRetriesPerChunk: 3 });
    await expect(queue.run()).rejects.toThrow(UploadIncompleteError);
    expect(queue.progress()).toEqual(new Set([0])); // chunk 0 succeeded before the failure; nothing lost
    expect(uploader.completedSessions).toEqual([]); // markComplete never called on an incomplete upload
  });
});

describe("UploadQueue — interrupted at three different points, resumed each time (SPEC/10 M4 acceptance)", () => {
  const interruptionPoints = [0, 1, 2]; // first chunk, middle chunk, last chunk of a 3-chunk upload

  it.each(interruptionPoints)("interruption at chunk %i: a fresh queue seeded with prior progress completes the upload", async (dieAt) => {
    const chunks = chunkPayload(linesFor(25), 10); // 3 chunks: [0,1,2]
    const sessionId = `session-interrupt-${dieAt}`;

    // First attempt: connection dies at `dieAt`.
    const dyingUploader = new DiesAtChunkUploader(dieAt);
    const firstQueue = new UploadQueue(dyingUploader, sessionId, chunks, { ...NO_DELAY, maxRetriesPerChunk: 1 });
    await expect(firstQueue.run()).rejects.toThrow(UploadIncompleteError);

    const progressBeforeResume = firstQueue.progress();
    // Everything before `dieAt` succeeded; nothing from `dieAt` onward did.
    for (let i = 0; i < dieAt; i++) expect(progressBeforeResume.has(i)).toBe(true);
    for (let i = dieAt; i < chunks.length; i++) expect(progressBeforeResume.has(i)).toBe(false);

    // Resume: a fresh UploadQueue (simulating an app restart), a healthy uploader this time, seeded with prior progress.
    const healthyUploader = new FlakyUploader();
    const resumedQueue = new UploadQueue(healthyUploader, sessionId, chunks, { ...NO_DELAY, alreadyUploaded: progressBeforeResume });
    await resumedQueue.run();

    expect(resumedQueue.isComplete()).toBe(true);
    expect(healthyUploader.completedSessions).toEqual([sessionId]);
    // The already-uploaded chunks were never re-sent to the new uploader.
    for (let i = 0; i < dieAt; i++) expect(healthyUploader.calls).not.toContain(i);
    for (let i = dieAt; i < chunks.length; i++) expect(healthyUploader.calls).toContain(i);
  });
});

describe("UploadQueue — resuming an already-complete upload is a no-op", () => {
  it("does not re-upload anything and still calls markComplete", async () => {
    const chunks = chunkPayload(linesFor(10), 5);
    const uploader = new FlakyUploader();
    const queue = new UploadQueue(uploader, "session-done", chunks, { ...NO_DELAY, alreadyUploaded: new Set([0, 1]) });
    await queue.run();
    expect(uploader.calls).toEqual([]); // nothing uploaded — both chunks were already confirmed
    expect(uploader.completedSessions).toEqual(["session-done"]);
  });
});
