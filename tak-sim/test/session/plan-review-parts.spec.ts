/**
 * SPEC/32 §3's smaller parts: `ViewClock.add` (the cap's cues set again for a revision opened at the plan review: scheduled
 * at once while the clock runs, at its resume while it is paused), the browser's premise lookup (`requestPremiseReview`: the
 * timeout on the ordinary timers, the reply's shape, a failure as a short reason; the HTTP transport's endpoint and body),
 * and `lastRecordedPlan` (the plan a session resumed into a forced SPAM item shows at its review).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewClock } from "../../app/session/view-clock.js";
import { httpPremiseReviewTransport, requestPremiseReview } from "../../app/session/plan-review-transport.js";
import { lastRecordedPlan } from "../../app/session/plan-review.js";
import { PREMISE_REVIEW_ENDPOINT, type PremiseReviewRequest } from "../../app/session/thinker-protocol.js";
import type { LogRecord } from "../../app/telemetry/log.js";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const REQUEST: PremiseReviewRequest = { sessionId: "s", cell: "reasoning_intent", view: 9, virtualTimeS: 13_200, language: "en" };
const GOOD = { lines: ["P1 …"], statuses: [{ premiseId: "P1", status: "contradicted", atomIds: ["a"] }], tableSha256: "a".repeat(64) };

describe("ViewClock.add", () => {
  it("schedules added cues on the view's time: at once while running, from the resume while paused", async () => {
    const clock = new ViewClock(() => Date.now());
    const fired: string[] = [];
    clock.start([{ atSeconds: 10, fire: () => fired.push("10") }]);
    await vi.advanceTimersByTimeAsync(5_000);
    clock.add([{ atSeconds: 8, fire: () => fired.push("8") }]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fired).toEqual(["8"]);
    clock.pause();
    clock.add([{ atSeconds: 12, fire: () => fired.push("12") }]);
    await vi.advanceTimersByTimeAsync(60_000); // paused: nothing fires
    expect(fired).toEqual(["8"]);
    clock.resume();
    await vi.advanceTimersByTimeAsync(4_000); // view time 12
    expect(fired).toEqual(["8", "10", "12"]);
    expect(clock.elapsedSeconds()).toBe(12);
  });
});

describe("the premise lookup in the browser", () => {
  it("a well-formed reply is returned", async () => {
    expect(await requestPremiseReview(async () => GOOD as never, REQUEST)).toEqual({ ok: true, response: GOOD });
  });

  it("no reply within the timeout: client_timeout (on the ordinary timers)", async () => {
    const pending = requestPremiseReview(() => new Promise(() => undefined), REQUEST, 4_000);
    await vi.advanceTimersByTimeAsync(3_999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, error: "client_timeout" });
  });

  it("a wrong shape or a failure is a short reason, never a throw", async () => {
    expect(await requestPremiseReview(async () => ({ ...GOOD, tableSha256: "x" }) as never, REQUEST)).toEqual({ ok: false, error: "invalid_response: tableSha256 is not a sha256" });
    expect(await requestPremiseReview(async () => { throw new TypeError("offline"); }, REQUEST)).toEqual({ ok: false, error: "network_error: offline" });
  });

  it("the HTTP transport posts the request to the endpoint; an HTTP error is http_<status>", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(GOOD), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestPremiseReview(httpPremiseReviewTransport(), REQUEST)).toEqual({ ok: true, response: GOOD });
    expect(fetchMock).toHaveBeenCalledWith(PREMISE_REVIEW_ENDPOINT, expect.objectContaining({ method: "POST", body: JSON.stringify(REQUEST) }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    expect(await requestPremiseReview(httpPremiseReviewTransport(), REQUEST)).toEqual({ ok: false, error: "http_400" });
  });
});

describe("lastRecordedPlan", () => {
  const rec = (seq: number, kind: string, detail: unknown): LogRecord => ({ seq: seq as LogRecord["seq"], tVirtual: 0 as LogRecord["tVirtual"], tWallOffsetMs: seq, kind, detail });
  const plan = (mainEffort: string) => ({ mainEffort, posture: "direct_attack", secondary: null, drones: null });

  it("the view's last attempt's plan: submitted, then its latest revision, counted", () => {
    const records = [
      rec(0, "cycle_start", { cycle: 8 }), rec(1, "allocation_submitted", { plan: plan("L1") }),
      rec(2, "cycle_start", { cycle: 9 }), rec(3, "allocation_submitted", { plan: plan("L2") }), rec(4, "allocation_revised", { cycle: 9, revision: 1, plan: plan("L3") }),
    ];
    expect(lastRecordedPlan(records, 9)).toEqual({ plan: plan("L3"), revisions: 1 });
    expect(lastRecordedPlan([...records, rec(5, "cycle_start", { cycle: 9 })], 9)).toEqual({ plan: null, revisions: 0 }); // replayed: nothing yet
  });
});
