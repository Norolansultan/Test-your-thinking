/**
 * The session-log upload endpoint (SPEC/05 §9; `app/telemetry/session-log-protocol.ts`): chunks with
 * their hashes, idempotent retries, conflicts never overwrite, id and size validation, completion
 * with the line count and SHA-256 checked and a manifest line; and the browser's upload end to end
 * over real HTTP, including a flaky network.
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionLogStore } from "../../server/session-log/store.js";
import { createAppServer } from "../../server/production/server.js";
import { MAX_CHUNK_BYTES, sessionChunkPath, sessionCompletePath } from "../../app/telemetry/session-log-protocol.js";
import { linesText, sessionFileLines } from "../../app/telemetry/session-file.js";
import { uploadSession, UploadBeforeCompleteError } from "../../app/telemetry/session-upload.js";
import { UploadIncompleteError } from "../../app/telemetry/upload-queue.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
let dir: string;
let server: Server;
let base: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "session-log-"));
  server = createAppServer({ sessionLog: new SessionLogStore({ dir, nowIso: () => "2026-10-05T18:00:00.000Z" }) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

const header = (sessionId: string): LogHeader => ({
  formatVersion: "0.9.4", sessionId, participantCode: "p", condition: "directed", scenarioId: "s", scenarioVersion: "1", seed: "1",
  bundleHash: "sha256:x", appVersion: "0.1.0", startedAtIso: "2026-10-05T10:00:00.000Z", userAgent: "ua", viewport: { w: 1, h: 1, dpr: 1 },
  counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
});
const records = (n: number): LogRecord[] => Array.from({ length: n }, (_, i) => ({ seq: asSeq(i), tVirtual: asVirtualTime(i), tWallOffsetMs: i, kind: i === 0 ? "session_started" : "bubble_available", detail: { i } }));

async function put(sessionId: string, index: number, total: number, body: string, hash = sha(body), init: { origin?: string } = {}) {
  const res = await fetch(`${base}${sessionChunkPath(sessionId, index, total)}`, { method: "PUT", body, headers: { "x-chunk-sha256": hash, ...(init.origin ? { origin: init.origin } : {}) } });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
async function complete(sessionId: string, body: unknown) {
  const res = await fetch(`${base}${sessionCompletePath(sessionId)}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** The file's lines split into two chunks, as the browser would send them. */
function twoChunks(sessionId: string) {
  const lines = sessionFileLines(header(sessionId), records(5));
  const text = linesText(lines);
  return { lines, c0: lines.slice(0, 3).join("\n"), c1: lines.slice(3).join("\n"), req: { totalChunks: 2, lines: lines.length, sha256: sha(text) }, text };
}

describe("chunks", () => {
  it("stores a chunk, and a retry with the same bytes is a duplicate, not a second copy", async () => {
    const id = "chunkstest01";
    const { c0 } = twoChunks(id);
    expect(await put(id, 0, 2, c0)).toEqual({ status: 200, body: { status: "stored" } });
    expect(await put(id, 0, 2, c0)).toEqual({ status: 200, body: { status: "duplicate" } });
    expect(await readdir(join(dir, `${id}.parts`))).toEqual(expect.arrayContaining(["0.chunk", "meta.json"]));
  });

  it("refuses different bytes at a stored index, and a different total (409): data is never overwritten", async () => {
    const id = "chunkstest02";
    await put(id, 0, 2, "a");
    expect((await put(id, 0, 2, "b")).status).toBe(409);
    expect((await put(id, 1, 3, "c")).status).toBe(409);
    expect(await readFile(join(dir, `${id}.parts`, "0.chunk"), "utf8")).toBe("a");
  });

  it.each([
    ["a path in the id", "..%2F..%2Fetc", 400],
    ["a short id", "abc", 400],
    ["a dot in the id", "abcdefgh.x", 400],
  ])("refuses %s", async (_n, id, status) => {
    const res = await fetch(`${base}/api/session-log/${id}/chunks/0?total=1`, { method: "PUT", body: "x", headers: { "x-chunk-sha256": sha("x") } });
    expect(res.status).toBe(status);
  });

  it("refuses an index outside total, a bad total, a missing or wrong hash", async () => {
    expect((await put("chunkstest03", 2, 2, "x")).status).toBe(400);
    expect((await put("chunkstest03", 0, 0, "x")).status).toBe(400);
    expect((await put("chunkstest03", 0, 5000, "x")).status).toBe(400);
    expect((await put("chunkstest03", 0, 1, "x", "zz")).status).toBe(400);
    expect((await put("chunkstest03", 0, 1, "x", sha("y"))).status).toBe(400);
  });

  it("refuses a chunk over the size limit (413)", async () => {
    const big = "x".repeat(MAX_CHUNK_BYTES + 1);
    expect((await put("chunkstest04", 0, 1, big)).status).toBe(413);
  });

  it("answers 405 to the wrong method and 404 to an unknown path", async () => {
    expect((await fetch(`${base}/api/session-log/chunkstest05/chunks/0?total=1`)).status).toBe(405);
    expect((await fetch(`${base}/api/session-log/chunkstest05/other`, { method: "POST" })).status).toBe(404);
  });
});

describe("completion", () => {
  it("refuses while a chunk is missing, then writes <id>.jsonl with a manifest line and removes the parts", async () => {
    const id = "completetest01";
    const { c0, c1, req, text, lines } = twoChunks(id);
    await put(id, 0, 2, c0);
    expect((await complete(id, req)).status).toBe(409);
    await put(id, 1, 2, c1);
    const done = await complete(id, req);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("completed");
    const file = await readFile(join(dir, `${id}.jsonl`), "utf8");
    expect(file.startsWith(text)).toBe(true);
    const manifest = JSON.parse(file.slice(text.length)).manifest;
    expect(manifest).toEqual({ format: "fire-sim-session-jsonl/1", sessionId: id, lines: lines.length, records: 5, sha256: req.sha256, writtenBy: "server", chunks: 2, completedAtIso: "2026-10-05T18:00:00.000Z" });
    expect((await readdir(dir)).includes(`${id}.parts`)).toBe(false);
  });

  it("is idempotent: the same completion again is already_complete; a late chunk retry is accepted without effect", async () => {
    const id = "completetest02";
    const { c0, c1, req } = twoChunks(id);
    await put(id, 0, 2, c0); await put(id, 1, 2, c1);
    await complete(id, req);
    const before = await readFile(join(dir, `${id}.jsonl`), "utf8");
    expect(await complete(id, req)).toMatchObject({ status: 200, body: { status: "already_complete" } });
    expect(await put(id, 1, 2, c1)).toEqual({ status: 200, body: { status: "already_complete" } });
    expect(await readFile(join(dir, `${id}.jsonl`), "utf8")).toBe(before);
    expect((await complete(id, { ...req, sha256: sha("other") })).status).toBe(409);
  });

  it("refuses content that does not match the declared hash or line count, or a header naming another session", async () => {
    const id = "completetest03";
    const { c0, c1, req } = twoChunks(id);
    await put(id, 0, 2, c0); await put(id, 1, 2, c1);
    expect((await complete(id, { ...req, lines: req.lines + 1 })).status).toBe(409);
    expect((await complete(id, { ...req, sha256: sha("x") })).status).toBe(409);
    expect((await complete(id, { totalChunks: "2" })).status).toBe(400);
    const other = "completetest04";
    const t = twoChunks("someoneelse1");
    await put(other, 0, 2, t.c0); await put(other, 1, 2, t.c1);
    expect((await complete(other, t.req)).status).toBe(409);
  });
});

describe("the browser's upload, end to end", () => {
  const input = (sessionId: string) => ({ engineState: "COMPLETE" as const, header: header(sessionId), records: records(1203) });

  it("uploads in chunks and the server's file is the session file plus its manifest", async () => {
    const id = "e2eupload0001";
    await uploadSession(input(id), { http: { baseUrl: base }, linesPerChunk: 500 });
    const file = await readFile(join(dir, `${id}.jsonl`), "utf8");
    const lines = file.trimEnd().split("\n");
    expect(lines).toHaveLength(1 + 1203 + 1);
    expect(JSON.parse(lines.at(-1)!).manifest).toMatchObject({ records: 1203, chunks: 3, sha256: sha(linesText(sessionFileLines(header(id), records(1203)))) });
  });

  it("survives a flaky network: failed requests are retried and nothing is duplicated", async () => {
    const id = "e2eupload0002";
    let calls = 0;
    const flaky = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      calls += 1;
      if (calls % 2 === 1) return Promise.reject(new Error("network down"));
      return fetch(url, init);
    };
    await uploadSession(input(id), { http: { baseUrl: base, fetch: flaky }, linesPerChunk: 400, sleep: async () => {} });
    const lines = (await readFile(join(dir, `${id}.jsonl`), "utf8")).trimEnd().split("\n");
    expect(lines).toHaveLength(1205);
    expect(calls).toBeGreaterThan(8);
  });

  it("gives up after the retries with UploadIncompleteError (the end screen then offers the export)", async () => {
    const down = () => Promise.reject(new Error("offline"));
    await expect(uploadSession(input("e2eupload0003"), { http: { baseUrl: base, fetch: down }, sleep: async () => {} })).rejects.toBeInstanceOf(UploadIncompleteError);
  });

  it("refuses to start before COMPLETE (I3)", async () => {
    await expect(uploadSession({ ...input("e2eupload0004"), engineState: "RUNNING" }, { http: { baseUrl: base } })).rejects.toBeInstanceOf(UploadBeforeCompleteError);
    expect((await readdir(dir)).some((n) => n.startsWith("e2eupload0004"))).toBe(false);
  });
});
