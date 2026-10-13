/**
 * The real log header (SPEC/04 §10; 5 Oct 2026): a random session id, the wall-clock start, the
 * browser, the viewport, the app version and the scenario bundle hash — all produced outside the run
 * loop and only annotated. With the annotations fixed, identical inputs give a byte-identical log (I1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appVersion, newSessionId, sessionAnnotations, type AnnotationEnvironment } from "../../app/session/annotations.js";
import { FIXED_ANNOTATIONS, sessionHeader, type HeaderAnnotations } from "../../app/session/header.js";
import { scenarioBundleHash } from "../../app/telemetry/bundle-hash.js";
import { sessionFileLines } from "../../app/telemetry/session-file.js";
import { isValidSessionId } from "../../app/telemetry/session-log-protocol.js";
import { runThrough, scenario } from "./session-run.js";
import pkg from "../../package.json" with { type: "json" };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

const ENV: AnnotationEnvironment = {
  randomBytes: (bytes) => { for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 17 + 3) & 0xff; },
  nowIso: () => "2026-10-05T12:34:56.789Z",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Test/1.0",
  viewport: { w: 1536, h: 864, dpr: 1.25 },
};

describe("the annotations", () => {
  it("a session id is 128 random bits as 32 hex characters, valid for the upload", () => {
    const id = newSessionId(ENV.randomBytes);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id.startsWith("03142536")).toBe(true);
    expect(isValidSessionId(id)).toBe(true);
    expect(newSessionId((b) => b.fill(0))).not.toBe(id);
  });

  it("carries the start time, browser, viewport, app version and the scenario bundle hash", () => {
    const a = sessionAnnotations(scenario, ENV);
    expect(a).toEqual({
      sessionId: newSessionId(ENV.randomBytes), startedAtIso: "2026-10-05T12:34:56.789Z", userAgent: ENV.userAgent,
      viewport: { w: 1536, h: 864, dpr: 1.25 }, appVersion: pkg.version, bundleHash: scenarioBundleHash(scenario),
    });
    expect(appVersion()).toBe(pkg.version); // no build stamp outside `npm run build:prod`
    expect(a.bundleHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("the header records them as given, and keeps the fixed placeholders when none are given", () => {
    const a = sessionAnnotations(scenario, ENV);
    const h = sessionHeader(scenario, "directed", "P-1", "en", null, false, "radio", undefined, a);
    expect(h).toMatchObject({ sessionId: a.sessionId, startedAtIso: a.startedAtIso, userAgent: a.userAgent, viewport: a.viewport, appVersion: a.appVersion, bundleHash: a.bundleHash, language: "en", participantCode: "P-1" });
    expect(sessionHeader(scenario, "directed", "P-1", "en", null)).toMatchObject(FIXED_ANNOTATIONS);
  });
});

describe("determinism with fixed annotations (I1)", () => {
  const fixed: HeaderAnnotations = { ...sessionAnnotations(scenario, ENV) };

  it("two runs with identical inputs and annotations write byte-identical session files", async () => {
    const run = async () => {
      vi.setSystemTime(0);
      const { o } = await runThrough(2, { annotations: fixed });
      return sessionFileLines(o.logHeader, await o.logRecords()).join("\n");
    };
    const a = await run();
    const b = await run();
    expect(a.length).toBeGreaterThan(10_000);
    expect(b).toBe(a);
  });

  it("another session id changes only the header and session_started lines", async () => {
    vi.setSystemTime(0);
    const one = await runThrough(0, { annotations: fixed });
    const a = sessionFileLines(one.o.logHeader, await one.o.logRecords()); // read now: the first session's V1 clock runs on with the shared fake timers
    vi.setSystemTime(0);
    const two = await runThrough(0, { annotations: { ...fixed, sessionId: "ffffffffffffffffffffffffffffffff" } });
    const b = sessionFileLines(two.o.logHeader, await two.o.logRecords());
    expect(b).toHaveLength(a.length);
    const differing = a.map((line, i) => (line === b[i] ? null : i)).filter((i) => i !== null);
    expect(differing).toEqual([0, 1]);
  });
});
