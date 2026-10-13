/**
 * Persistence (SPEC/05 §9, invariant I5; 5 Oct 2026): the session writes through the injected sink
 * (IndexedDB in the browser), and every action is acknowledged — the snapshot moves on — only after
 * its record's write has completed. The registry lists the session from its first record on.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogSink, type LogRecord, type LogSink } from "../../app/telemetry/log.js";
import { IndexedDbLogSink } from "../../app/telemetry/indexeddb-sink.js";
import { openSessionSink, registeringSink, SessionRegistry, statusOnStep } from "../../app/telemetry/session-registry.js";
import { readFileSync } from "node:fs";
import { newSession, runThrough } from "../session/session-run.js";
import { runOutView } from "../session/view-flow.js";

// fake-indexeddb completes its requests on setImmediate, which stays real.
beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] }); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

/** A sink whose writes complete only when released — a slow disk, made observable. */
class GatedSink implements LogSink {
  readonly inner = new InMemoryLogSink();
  gated = false;
  private pending: (() => void)[] = [];
  readonly started: string[] = [];
  async append(record: LogRecord): Promise<void> {
    this.started.push(record.kind);
    if (this.gated) await new Promise<void>((resolve) => this.pending.push(resolve));
    await this.inner.append(record);
  }
  readAll() { return this.inner.readAll(); }
  async releaseAll(): Promise<void> {
    while (this.pending.length > 0) { this.pending.shift()!(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(0); }
  }
  get waiting(): number { return this.pending.length; }
}

let dbs = 0;
const freshId = () => `persist${(dbs += 1).toString().padStart(4, "0")}`;

describe("I5: a record is durable before the action is acknowledged", () => {
  it("the plan: allocation_submitted is written before the view ends or the screen moves on", async () => {
    const sink = new GatedSink();
    const { o, snap } = newSession({ sink });
    await o.start();
    await runOutView(o, snap);
    sink.gated = true;
    const submitted = o.submitAllocation({ mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(snap().step).toBe("allocation");
    sink.gated = false;
    await sink.releaseAll();
    await submitted;
    while (snap().step !== "training") await vi.advanceTimersByTimeAsync(1_000); // the practice view ends at its 180 s minimum
    expect(snap().step).toBe("training");
  });

  it("a failing write is never acknowledged: the action rejects, the step stays, and no seq is consumed", async () => {
    let fail = false;
    const inner = new InMemoryLogSink();
    const sink: LogSink = { append: async (r) => { if (fail) throw new Error("disk full"); await inner.append(r); }, readAll: () => inner.readAll() };
    const { o, snap } = newSession({ sink });
    await o.start();
    await runOutView(o, snap);
    const plan = { mainEffort: "L2", posture: "direct_attack", secondary: null, drones: null } as const;
    const before = (await inner.readAll()).length;
    fail = true;
    await expect(o.submitAllocation(plan)).rejects.toThrow("disk full");
    expect(snap().step).toBe("allocation");
    expect((await inner.readAll()).length).toBe(before);
    fail = false;
    await o.submitAllocation(plan); // the retry takes the seq the failed write did not consume
    const allocation = (await inner.readAll()).find((r) => r.kind === "allocation_submitted")!;
    expect(allocation.seq).toBe(before);
  });
});

describe("the browser's IndexedDB sink, injected", () => {
  it("holds exactly the session's records, gapless, after VP and V1", async () => {
    const sink = await IndexedDbLogSink.open(`fire-sim-log-${freshId()}`);
    const { o } = await runThrough(1, { sink });
    const fromDb = await sink.readAll();
    expect(fromDb.length).toBeGreaterThan(40);
    expect(fromDb).toEqual(await o.logRecords());
    expect(fromDb.map((r) => r.seq)).toEqual(fromDb.map((_, i) => i));
  }, 120_000); // VP now runs 180 s of one-second steps against the IndexedDB sink

  it("the registry lists the session as running from its first record, then complete and uploaded", async () => {
    const registry = await SessionRegistry.open(`reg-${freshId()}`);
    const sessionId = freshId();
    const inner = await openSessionSink(sessionId);
    const sink = registeringSink(inner, (header) => registry.register(header, "?tuotanto"));
    const { o } = newSession({ sink, annotations: { sessionId, startedAtIso: "2026-10-05T09:00:00.000Z", userAgent: "ua", viewport: { w: 1440, h: 900, dpr: 2 }, appVersion: "0.1.0", bundleHash: "sha256:x" } });
    expect(await registry.findUnfinished()).toBeNull();
    await o.start();
    const entry = await registry.findUnfinished();
    expect(entry).toMatchObject({ sessionId, status: "running", search: "?tuotanto" });
    expect(entry!.header.sessionId).toBe(sessionId);
    await registry.setStatus(sessionId, "complete");
    expect((await registry.findUnfinished())!.status).toBe("complete");
    await registry.setStatus(sessionId, "uploaded");
    expect(await registry.findUnfinished()).toBeNull();
  });

  it("a session that ended before the run (consent declined, hard preflight refusal) is not offered for resume (final review, 6 Oct 2026)", async () => {
    expect(statusOnStep("consent_declined")).toBe("aborted");
    expect(statusOnStep("preflight_refused")).toBe("aborted");
    for (const step of ["consent", "preflight", "questionnaire", "briefing", "exploration", "debrief", "complete"]) expect(statusOnStep(step)).toBeNull();
    const registry = await SessionRegistry.open(`reg-${freshId()}`);
    const { o } = newSession({ studyShell: true, annotations: { sessionId: "cccccccc3", startedAtIso: "2026-10-05T11:00:00.000Z", userAgent: "", viewport: { w: 1, h: 1, dpr: 1 }, appVersion: "", bundleHash: "" } });
    await registry.register(o.logHeader, "?tuotanto&koodi=X");
    await o.start();
    await o.decideConsent(false, false);
    expect(o.engineState).toBe("ABORTED");
    await registry.setStatus("cccccccc3", statusOnStep("consent_declined")!);
    expect(await registry.findUnfinished()).toBeNull();
    expect(readFileSync("app/render/ui/components/SessionView.tsx", "utf8")).toMatch(/statusOnStep\(step\)[\s\S]{0,80}persistence\?\.setStatus/);
  });

  it("the newest unfinished session is offered first; abandoned ones are not", async () => {
    const registry = await SessionRegistry.open(`reg-${freshId()}`);
    const { o: a } = newSession({ annotations: { sessionId: "aaaaaaaa1", startedAtIso: "2026-10-05T09:00:00.000Z", userAgent: "", viewport: { w: 1, h: 1, dpr: 1 }, appVersion: "", bundleHash: "" } });
    const { o: b } = newSession({ annotations: { sessionId: "bbbbbbbb2", startedAtIso: "2026-10-05T10:00:00.000Z", userAgent: "", viewport: { w: 1, h: 1, dpr: 1 }, appVersion: "", bundleHash: "" } });
    await registry.register(a.logHeader, "");
    await registry.register(b.logHeader, "");
    expect((await registry.findUnfinished())!.sessionId).toBe("bbbbbbbb2");
    await registry.setStatus("bbbbbbbb2", "abandoned");
    expect((await registry.findUnfinished())!.sessionId).toBe("aaaaaaaa1");
  });
});

