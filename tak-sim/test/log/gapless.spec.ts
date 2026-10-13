import { describe, expect, it } from "vitest";
import { asVirtualTime } from "../../app/engine/primitives.js";
import {
  GapDetectedError,
  InMemoryLogSink,
  SessionLog,
  assertGapless,
  type LogHeader,
  type LogRecord,
  type LogSink,
} from "../../app/telemetry/log.js";

const HEADER: LogHeader = {
  formatVersion: "0.1.0",
  sessionId: "session-test",
  participantCode: "p-test",
  condition: "directed",
  scenarioId: "scenario-golden",
  scenarioVersion: "0.1.0",
  seed: "1234567890",
  bundleHash: "deadbeef",
  appVersion: "0.1.0",
  startedAtIso: "2026-01-01T00:00:00.000Z",
  userAgent: "vitest",
  viewport: { w: 1280, h: 800, dpr: 1 },
  counterbalance: { expectationOrder: "A" },
  cell: "radio",
  echelon: "command",
};

/** Wraps another sink and throws on chosen 1-indexed call numbers, to simulate a failing storage backend (e.g. IndexedDB quota / write failure). */
class FlakySink implements LogSink {
  private calls = 0;
  constructor(
    private readonly inner: LogSink,
    private readonly failOnCallNumbers: ReadonlySet<number>,
  ) {}

  async append(record: LogRecord): Promise<void> {
    this.calls += 1;
    if (this.failOnCallNumbers.has(this.calls)) {
      throw new Error(`induced storage failure on call ${this.calls}`);
    }
    await this.inner.append(record);
  }

  async readAll(): Promise<readonly LogRecord[]> {
    return this.inner.readAll();
  }
}

describe("assertGapless", () => {
  it("accepts an empty log", () => {
    expect(() => assertGapless([])).not.toThrow();
  });

  it("accepts a contiguous 0..n-1 sequence", () => {
    const records = [0, 1, 2, 3].map((seq) => ({ seq, tVirtual: 0, tWallOffsetMs: 0, kind: "x", detail: null }) as unknown as LogRecord);
    expect(() => assertGapless(records)).not.toThrow();
  });

  it("detects a missing seq", () => {
    const records = [0, 1, 3].map((seq) => ({ seq, tVirtual: 0, tWallOffsetMs: 0, kind: "x", detail: null }) as unknown as LogRecord);
    expect(() => assertGapless(records)).toThrow(GapDetectedError);
  });

  it("detects a duplicate seq (which also manifests as a downstream gap)", () => {
    const records = [0, 1, 1, 2].map((seq) => ({ seq, tVirtual: 0, tWallOffsetMs: 0, kind: "x", detail: null }) as unknown as LogRecord);
    expect(() => assertGapless(records)).toThrow(GapDetectedError);
  });
});

describe("SessionLog — durable, gapless append (invariant I5)", () => {
  it("assigns gapless seq starting at 0 under normal operation", async () => {
    const log = new SessionLog(HEADER, new InMemoryLogSink());
    const r0 = await log.append(asVirtualTime(0), 0, "session_started", { header: HEADER });
    const r1 = await log.append(asVirtualTime(10), 5, "cycle_start", { cycle: 1 });
    const r2 = await log.append(asVirtualTime(20), 12, "cycle_end", { cycle: 1 });
    expect([r0.seq, r1.seq, r2.seq]).toEqual([0, 1, 2]);
    await expect(log.readAll()).resolves.toHaveLength(3);
    assertGapless(await log.readAll());
  });

  it("does not resolve append() until the sink confirms durable persistence", async () => {
    let resolved = false;
    const slowSink: LogSink = {
      async append() {
        await new Promise((r) => setTimeout(r, 5));
        resolved = true;
      },
      async readAll() {
        return [];
      },
    };
    const log = new SessionLog(HEADER, slowSink);
    const promise = log.append(asVirtualTime(0), 0, "x", null);
    expect(resolved).toBe(false); // not yet durable
    await promise;
    expect(resolved).toBe(true); // durable before the caller's await returns
  });

  it("a failed write leaves seq unconsumed — no gap is ever persisted, and a retry fills the slot", async () => {
    const inner = new InMemoryLogSink();
    const flaky = new FlakySink(inner, new Set([2])); // second append() call fails
    const log = new SessionLog(HEADER, flaky);

    await log.append(asVirtualTime(0), 0, "session_started", {});
    await expect(log.append(asVirtualTime(10), 5, "cycle_start", { cycle: 1 })).rejects.toThrow(
      /induced storage failure/,
    );

    // The persisted log so far must still be gapless — the failed record was never written.
    assertGapless(await inner.readAll());
    expect(await inner.readAll()).toHaveLength(1);
    expect(log.currentSeq()).toBe(1); // seq 1 was never consumed by the failed write

    // Retrying the same logical event reuses seq 1 and the log stays gapless.
    const retry = await log.append(asVirtualTime(10), 5, "cycle_start", { cycle: 1 });
    expect(retry.seq).toBe(1);
    assertGapless(await log.readAll());
    expect(await log.readAll()).toHaveLength(2);
  });

  it("survives multiple induced failures in a row without ever producing a gap", async () => {
    const inner = new InMemoryLogSink();
    const flaky = new FlakySink(inner, new Set([2, 3, 4])); // fail three times in a row on the second logical write
    const log = new SessionLog(HEADER, flaky);

    await log.append(asVirtualTime(0), 0, "session_started", {});
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(log.append(asVirtualTime(10), 5, "cycle_start", { cycle: 1 })).rejects.toThrow();
    }
    const final = await log.append(asVirtualTime(10), 5, "cycle_start", { cycle: 1 });
    expect(final.seq).toBe(1);
    assertGapless(await log.readAll());
  });
});
