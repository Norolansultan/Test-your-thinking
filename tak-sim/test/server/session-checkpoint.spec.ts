/**
 * Checkpoint uploads (9 Oct 2026; `app/telemetry/session-checkpoint.ts`, the store's `putPartial`):
 * append-only partial files that are always a gapless prefix of the session file, a 409 that tells
 * the browser where to continue, the completed upload superseding them, and the browser's
 * checkpointer over real HTTP — which never starts a request while the engine is RUNNING (I3).
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PARTIAL_FORMAT, SessionLogStore, type PartialManifest } from "../../server/session-log/store.js";
import { createAppServer } from "../../server/production/server.js";
import { sessionPartialPath } from "../../app/telemetry/session-log-protocol.js";
import { linesText, sessionFileLines } from "../../app/telemetry/session-file.js";
import { uploadSession } from "../../app/telemetry/session-upload.js";
import { checkpointLabel, SessionCheckpointer } from "../../app/telemetry/session-checkpoint.js";
import type { EngineState } from "../../app/engine/freeze-machine.js";
import type { LogHeader, LogRecord } from "../../app/telemetry/log.js";
import { asSeq, asVirtualTime } from "../../app/engine/primitives.js";

const sha = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
let dir: string;
let store: SessionLogStore;
let server: Server;
let base: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "session-checkpoint-"));
  store = new SessionLogStore({ dir, nowIso: () => "2026-10-09T12:00:00.000Z" });
  server = createAppServer({ sessionLog: store });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await rm(dir, { recursive: true, force: true });
});

const header = (sessionId: string, participantCode = "EDQWGU"): LogHeader => ({
  formatVersion: "0.9.4", sessionId, participantCode, condition: "directed", scenarioId: "s", scenarioVersion: "1", seed: "1",
  bundleHash: "sha256:x", appVersion: "0.1.0", startedAtIso: "2026-10-09T10:00:00.000Z", userAgent: "ua", viewport: { w: 1, h: 1, dpr: 1 },
  cell: "reasoning_intent", echelon: "command",
});
const records = (n: number): LogRecord[] => Array.from({ length: n }, (_, i) => ({ seq: asSeq(i), tVirtual: asVirtualTime(i), tWallOffsetMs: i, kind: i === 0 ? "session_started" : "bubble_available", detail: { i } }));

const body = (lines: readonly string[]) => Buffer.from(linesText(lines));
const putPartial = (id: string, from: number, lines: readonly string[], label = "freeze_v1") => store.putPartial(id, from, label, body(lines), sha(body(lines)));
const exists = async (p: string) => { try { await stat(p); return true; } catch { return false; } };

describe("the store's checkpoints", () => {
  it("appends lines in order and keeps a manifest of the last checkpoint", async () => {
    const id = "aaaa0000aaaa0000";
    const lines = sessionFileLines(header(id), records(6));
    expect(await putPartial(id, 0, lines.slice(0, 3), "training")).toEqual({ status: 200, body: { status: "stored", lines: 3 } });
    expect(await putPartial(id, 3, lines.slice(3), "freeze_v1")).toEqual({ status: 200, body: { status: "stored", lines: 7 } });
    const text = await readFile(store.partialPath(id), "utf8");
    expect(text).toBe(linesText(lines));
    const manifest = JSON.parse(await readFile(store.partialManifestPath(id), "utf8")) as PartialManifest;
    expect(manifest).toEqual({ format: PARTIAL_FORMAT, sessionId: id, lines: 7, records: 6, sha256: sha(text), checkpoint: "freeze_v1", checkpoints: 2, updatedAtIso: "2026-10-09T12:00:00.000Z" });
    expect(text).not.toContain("manifest"); // a partial file is never mistaken for a finished one
  });

  it("answers 409 with its line count when `from` is not where the file ends, and writes nothing", async () => {
    const id = "bbbb0000bbbb0000";
    const lines = sessionFileLines(header(id), records(4));
    await putPartial(id, 0, lines.slice(0, 2));
    const before = await readFile(store.partialPath(id), "utf8");
    expect(await putPartial(id, 0, lines.slice(0, 2))).toMatchObject({ status: 409, body: { lines: 2 } }); // a repeat after a lost response
    expect(await putPartial(id, 4, lines.slice(4))).toMatchObject({ status: 409, body: { lines: 2 } }); // a gap
    expect(await readFile(store.partialPath(id), "utf8")).toBe(before);
  });

  it("refuses lines that are not the next lines of this session's file", async () => {
    const id = "cccc0000cccc0000";
    const lines = sessionFileLines(header(id), records(4));
    expect((await putPartial(id, 0, sessionFileLines(header("other0000other00"), records(1)))).status).toBe(400); // another session's header
    expect((await putPartial(id, 1, lines.slice(1, 3))).status).toBe(409); // records before any header: the file is empty, so not from line 1
    await putPartial(id, 0, lines.slice(0, 2));
    expect((await putPartial(id, 2, [lines[3]!])).status).toBe(400); // seq 2 at line 2 (seq must be 1): a gap inside the body
    expect((await putPartial(id, 2, ["not json"])).status).toBe(400);
    expect((await store.putPartial(id, 2, "freeze_v1", Buffer.from(lines[2]!), sha(lines[2]!))).status).toBe(400); // no final newline
    expect((await store.putPartial(id, 2, "../x", body([lines[2]!]), sha(body([lines[2]!])))).status).toBe(400); // a label is never a path
    expect((await store.putPartial(id, 2, "freeze_v1", body([lines[2]!]), "0".repeat(64))).status).toBe(400); // hash mismatch
    expect((await store.putPartial("../../etc", 0, "freeze_v1", body(lines), sha(body(lines)))).status).toBe(400);
  });

  it("is superseded by the completed upload: completion removes the checkpoint, a later checkpoint writes nothing", async () => {
    const id = "dddd0000dddd0000";
    const h = header(id);
    await putPartial(id, 0, sessionFileLines(h, records(3)));
    expect(await exists(store.partialPath(id))).toBe(true);
    await uploadSession({ engineState: "COMPLETE", header: h, records: records(5) }, { http: { baseUrl: base } });
    expect(await exists(store.partialPath(id))).toBe(false);
    expect(await exists(store.partialManifestPath(id))).toBe(false);
    expect(await putPartial(id, 4, sessionFileLines(h, records(5)).slice(4))).toEqual({ status: 200, body: { status: "already_complete" } });
    expect(await exists(store.partialPath(id))).toBe(false);
  });
});

describe("the browser's checkpointer over HTTP", () => {
  function source(id: string, log: LogRecord[], state: { value: EngineState }) {
    return { header: header(id), records: async () => [...log], atBoundary: () => state.value !== "RUNNING" };
  }

  it("sends only what is new at each boundary, in requests of at most linesPerRequest lines", async () => {
    const id = "eeee0000eeee0000";
    const log = records(7);
    const state = { value: "FREEZING" as EngineState };
    const calls: string[] = [];
    const c = new SessionCheckpointer(source(id, log, state), { baseUrl: base, linesPerRequest: 3, fetch: (url, init) => { calls.push(url); return fetch(url, init); } });
    expect(await c.checkpoint("freeze_v1")).toEqual({ status: "stored", lines: 8 });
    expect(calls.map((u) => new URL(u).searchParams.get("from"))).toEqual(["0", "3", "6"]);
    expect(await c.checkpoint("freeze_v1")).toEqual({ status: "up_to_date" });
    log.push(...records(10).slice(7));
    state.value = "HINGE_PAUSE";
    expect(await c.checkpoint("hinge")).toEqual({ status: "stored", lines: 11 });
    expect(await readFile(store.partialPath(id), "utf8")).toBe(linesText(sessionFileLines(header(id), records(10))));
    expect((JSON.parse(await readFile(store.partialManifestPath(id), "utf8")) as PartialManifest).checkpoint).toBe("hinge");
  });

  it("never starts a request while the engine is RUNNING, and stops between requests once the view resumes (I3)", async () => {
    const id = "ffff0000ffff0000";
    const state = { value: "RUNNING" as EngineState };
    let requests = 0;
    const c = new SessionCheckpointer(source(id, records(9), state), {
      baseUrl: base, linesPerRequest: 4,
      fetch: async (url, init) => { requests++; const res = await fetch(url, init); state.value = "RUNNING"; return res; }, // the participant goes back into the view
    });
    expect(await c.checkpoint("freeze_v2")).toEqual({ status: "left_boundary" });
    expect(requests).toBe(0);
    state.value = "PROBING_VISIBLE";
    expect(await c.checkpoint("freeze_v2")).toEqual({ status: "left_boundary" });
    expect(requests).toBe(1); // the first request went; the rest waits for the next boundary
  });

  it("continues from the server's count after a reload (a new checkpointer starts at 0)", async () => {
    const id = "abab0000abab0000";
    const log = records(5);
    const state = { value: "FREEZING" as EngineState };
    await new SessionCheckpointer(source(id, log, state), { baseUrl: base }).checkpoint("freeze_v3");
    log.push(...records(8).slice(5));
    const again = new SessionCheckpointer(source(id, log, state), { baseUrl: base });
    expect(await again.checkpoint("freeze_v4")).toEqual({ status: "stored", lines: 9 });
    expect(await readFile(store.partialPath(id), "utf8")).toBe(linesText(sessionFileLines(header(id), records(8))));
  });

  it("never throws: a network failure or a server error is `failed`, and a busy checkpointer answers `busy`", async () => {
    const state = { value: "FREEZING" as EngineState };
    const down = new SessionCheckpointer(source("acac0000acac0000", records(2), state), { fetch: async () => { throw new TypeError("network down"); } });
    expect(await down.checkpoint("freeze_v1")).toEqual({ status: "failed" });
    let release: () => void = () => undefined;
    const slow = new SessionCheckpointer(source("adad0000adad0000", records(2), state), {
      baseUrl: base, fetch: async (url, init) => { await new Promise<void>((r) => (release = r)); return fetch(url, init); },
    });
    const first = slow.checkpoint("freeze_v1");
    await new Promise((r) => setTimeout(r, 0));
    expect(await slow.checkpoint("freeze_v1")).toEqual({ status: "busy" });
    release();
    expect(await first).toEqual({ status: "stored", lines: 3 });
  });

  it("stops for good once the session's upload has completed", async () => {
    const id = "aeae0000aeae0000";
    await uploadSession({ engineState: "COMPLETE", header: header(id), records: records(3) }, { http: { baseUrl: base } });
    const c = new SessionCheckpointer(source(id, records(3), { value: "DEBRIEF_HANDOFF" }), { baseUrl: base });
    expect(await c.checkpoint("debrief")).toEqual({ status: "already_complete" });
    expect(await exists(store.partialPath(id))).toBe(false);
  });

  it("the route refuses a missing `from` and a wrong method", async () => {
    const res = await fetch(`${base}/api/session-log/afaf0000afaf0000/partial?at=hinge`, { method: "PUT", body: "x\n", headers: { "x-chunk-sha256": sha("x\n") } });
    expect(res.status).toBe(400);
    expect((await fetch(`${base}${sessionPartialPath("afaf0000afaf0000", 0, "hinge")}`, { method: "POST", body: "" })).status).toBe(405);
  });
});

describe("checkpointLabel", () => {
  it("labels only screens where the scenario stands still", () => {
    // The freeze halts the view's clock; the engine's variable reads RUNNING (WARMUP in the practice view) meanwhile.
    expect(checkpointLabel("freeze", 5, "RUNNING")).toBe("freeze_v5");
    expect(checkpointLabel("freeze", 0, "WARMUP")).toBe("freeze_vp");
    expect(checkpointLabel("training", 0, "TUTORIAL")).toBe("training");
    expect(checkpointLabel("hinge_pause", 7, "HINGE_PAUSE")).toBe("hinge");
    expect(checkpointLabel("questionnaire", 14, "DEBRIEF_HANDOFF")).toBe("questionnaire");
    expect(checkpointLabel("questionnaire", 0, "BRIEFING")).toBeNull(); // the pre-session item
    expect(checkpointLabel("debrief", 14, "DEBRIEF_HANDOFF")).toBe("debrief");
    expect(checkpointLabel("preflight", 0, "PREFLIGHT")).toBe("ai_literacy"); // after the AI literacy test (revision (ac))
    expect(checkpointLabel("preflight_refused", 0, "ABORTED")).toBeNull();
    expect(checkpointLabel("ai_literacy", 0, "PREFLIGHT")).toBeNull(); // the test itself is not a boundary: its answers are not yet in
    for (const step of ["exploration", "allocation", "awaiting_view_end", "probe", "briefing", "complete"] as const) expect(checkpointLabel(step, 3, "RUNNING")).toBeNull();
    for (const step of ["training", "hinge_pause", "debrief"] as const) expect(checkpointLabel(step, 3, "RUNNING")).toBeNull();
  });
});
