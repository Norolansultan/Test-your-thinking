/**
 * Where checkpoint uploads happen (9 Oct 2026; `app/telemetry/session-checkpoint.ts`), on a session
 * driven through the real orchestrator with `attachCheckpoints` as the UI wires it: every request
 * starts on a screen where the scenario stands still — a freeze (the view clock paused), the
 * training, the hinge — never during a view's live time (I3); one checkpoint per boundary; and the
 * checkpoints do not change the log (I1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSnapshot } from "../../app/session/orchestrator.js";
import { attachCheckpoints } from "../../app/telemetry/session-checkpoint.js";
import type { FetchLike } from "../../app/telemetry/http-uploader.js";
import { completeView, newSession } from "./session-run.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

async function drive(withCheckpoints: boolean) {
  const { o, snap } = newSession();
  let latest: SessionSnapshot | null = null;
  o.subscribe((s) => (latest = s));
  const requests: { label: string; step: string; engine: string; from: number }[] = [];
  // A server that stores everything: answers with the line count the body brings it to.
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url, "http://study.test");
    const from = Number(u.searchParams.get("from"));
    requests.push({ label: u.searchParams.get("at")!, step: latest!.step, engine: o.engineState, from });
    const lines = from + init.body.split("\n").length - 1;
    return { ok: true, status: 200, json: async () => ({ status: "stored", lines }) };
  };
  const detach = withCheckpoints ? attachCheckpoints(o, { fetch }) : () => undefined;
  await o.start();
  for (let v = 0; v <= 8; v++) await completeView(o, snap);
  await vi.advanceTimersByTimeAsync(0);
  detach();
  return { requests, records: await o.logRecords() };
}

describe("checkpoints in a driven session", () => {
  it("start only on halted screens: the training, every freeze, the hinge — never in a view's live time", async () => {
    const { requests } = await drive(true);
    expect(requests.length).toBeGreaterThan(0);
    for (const r of requests) expect(["freeze", "training", "hinge_pause"]).toContain(r.step);
    const labels = requests.map((r) => r.label);
    expect(labels).toContain("training");
    expect(labels).toContain("hinge");
    expect(labels.filter((l) => l.startsWith("freeze_v")).length).toBeGreaterThanOrEqual(5);
    expect(new Set(labels).size).toBe(labels.length); // one request per boundary (each is small: what is new)
    // Each checkpoint continues where the previous one ended.
    for (let i = 1; i < requests.length; i++) expect(requests[i]!.from).toBeGreaterThan(requests[i - 1]!.from);
  });

  it("leave the session's log byte-identical (nothing about them is logged; I1)", async () => {
    const strip = (rs: readonly { kind: string; seq: number; tVirtual: number; detail: unknown }[]) => rs.map((r) => JSON.stringify([r.seq, r.kind, r.tVirtual, r.detail]));
    const a = await drive(true);
    vi.setSystemTime(0);
    const b = await drive(false);
    expect(strip(a.records as never)).toEqual(strip(b.records as never));
  });
});
