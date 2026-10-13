import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { asVirtualTime, asSeq } from "../../app/engine/primitives.js";
import { assertGapless, SessionLog, type LogHeader, type LogRecord } from "../../app/telemetry/log.js";
import { IndexedDbLogSink } from "../../app/telemetry/indexeddb-sink.js";

const HEADER: LogHeader = {
  formatVersion: "0.1.0", sessionId: "idb-test", participantCode: "p", condition: "directed", scenarioId: "s",
  scenarioVersion: "0.1.0", seed: "1", bundleHash: "b", appVersion: "0.1.0", startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "vitest", viewport: { w: 1280, h: 800, dpr: 1 }, counterbalance: { expectationOrder: "A" }, cell: "radio", echelon: "command",
};

let dbCounter = 0;
function freshDbName(): string {
  dbCounter += 1;
  return `test-db-${dbCounter}`;
}

describe("IndexedDbLogSink", () => {
  it("appends and reads back records", async () => {
    const sink = await IndexedDbLogSink.open(freshDbName());
    const record: LogRecord = { seq: asSeq(0), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "session_started", detail: HEADER };
    await sink.append(record);
    const all = await sink.readAll();
    expect(all).toEqual([record]);
    sink.close();
  });

  it("readAll returns records sorted by seq regardless of write order", async () => {
    const sink = await IndexedDbLogSink.open(freshDbName());
    const r2: LogRecord = { seq: asSeq(2), tVirtual: asVirtualTime(20), tWallOffsetMs: 0, kind: "cycle_end", detail: { cycle: 1, totalRealDurationMs: 1 } };
    const r0: LogRecord = { seq: asSeq(0), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "cycle_start", detail: { cycle: 1, phase: "A", clockLabel: "13:20" } };
    const r1: LogRecord = { seq: asSeq(1), tVirtual: asVirtualTime(10), tWallOffsetMs: 0, kind: "session_completed", detail: {} };
    await sink.append(r2);
    await sink.append(r0);
    await sink.append(r1);
    const all = await sink.readAll();
    expect(all.map((r) => r.seq)).toEqual([0, 1, 2]);
    sink.close();
  });

  it("append() does not resolve until the write transaction completes (durability, I5)", async () => {
    const sink = await IndexedDbLogSink.open(freshDbName());
    await sink.append({ seq: asSeq(0), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "session_started", detail: HEADER });
    // If append() resolved before durability, a fresh read (even via a new handle) could race it. Reading through the same sink immediately must see it.
    const all = await sink.readAll();
    expect(all).toHaveLength(1);
    sink.close();
  });

  it("rejects a duplicate seq rather than silently overwriting", async () => {
    const sink = await IndexedDbLogSink.open(freshDbName());
    const record: LogRecord = { seq: asSeq(0), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "session_started", detail: HEADER };
    await sink.append(record);
    await expect(sink.append({ ...record, kind: "session_completed" })).rejects.toThrow();
    sink.close();
  });

  it("data persists across separate handles to the same database name", async () => {
    const dbName = freshDbName();
    const sinkA = await IndexedDbLogSink.open(dbName);
    await sinkA.append({ seq: asSeq(0), tVirtual: asVirtualTime(0), tWallOffsetMs: 0, kind: "session_started", detail: HEADER });
    sinkA.close();

    const sinkB = await IndexedDbLogSink.open(dbName);
    const all = await sinkB.readAll();
    expect(all).toHaveLength(1);
    sinkB.close();
  });
});

describe("IndexedDbLogSink through SessionLog (full stack, invariant I5)", () => {
  it("a real session's worth of appends stays gapless when persisted through IndexedDB", async () => {
    const sink = await IndexedDbLogSink.open(freshDbName());
    const log = new SessionLog(HEADER, sink);
    for (let i = 0; i < 20; i++) {
      await log.append(asVirtualTime(i * 1200), 0, "cycle_start", { cycle: i + 1, phase: "A", clockLabel: "13:20" });
    }
    const all = await log.readAll();
    assertGapless(all);
    expect(all).toHaveLength(20);
    sink.close();
  });
});
